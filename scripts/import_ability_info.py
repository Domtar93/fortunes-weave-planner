"""Build a reader-facing ability description index from preserved reference data."""
import json
import math

FACT_HEADERS={'Cost','Might','Might/Power','Hit','Crit','Range','Weight','Uses'}

def useful(value):
    return isinstance(value,str) and bool(value.strip()) and value.strip().upper() not in {'?','-','--','---','—','N/A','NONE'}

def build_ability_info(core,sheets):
    source=core['sourceUrl'];records=[]
    def ref(sheet,row,column,note=False):
        from import_community_reference import column as column_name
        cell=f'{column_name(column)}{row}'
        return dict(label=f'{sheet["title"]}!{cell}'+(' (note)' if note else ''),url=f'{source}#gid={sheet["gid"]}&range={cell}')
    known_names={value[0] for category in core['learnsets'].values() for character in category['characters'].values() for value in character['values'].values() if value[0]}
    for proficiency,category in core['learnsets'].items():
        sheet=next(sheet for sheet in sheets.values() if sheet['title']==category['sheet'])
        # Dedicated skill tables also store complete effects as name-cell notes.
        # Ignore rank guesses and notes on other columns (which may describe a
        # character-specific range or a speculative research comment).
        for row in sheet['rows']:
            if row['row']<68:continue
            cell=next((cell for cell in row['cells'] if cell['column']==1),{})
            name=cell.get('value');note=cell.get('note')
            if useful(name) and useful(note) and note.lstrip().startswith(('Grants ','Inflicts ','[Armored]','[Infantry]','[Cavalry]','[Flying]','[Combat Art]','If ','After ','Unit ')):
                records.append(dict(name=name,proficiency=proficiency,kind='skill-note',description=note,reference=ref(sheet,row['row'],1,True),facts=[]))
        seen_notes=set()
        for character in category['characters'].values():
            for rank,(name,state,note) in character['values'].items():
                if not useful(name) or not useful(note) or (name,note) in seen_notes: continue
                seen_notes.add((name,note))
                records.append(dict(name=name,proficiency=proficiency,kind='alias' if note.startswith('Identical effect to ') else 'skill',description=note,
                    reference=ref(sheet,character['row'],category['columns'][rank],True),facts=[]))
        headers=None
        for row in sheet['rows']:
            values={cell['column']:cell for cell in row['cells']}
            name=values.get(1,{}).get('value')
            if name=='Name':
                headers={cell['column']:cell['value'] for cell in row['cells'] if isinstance(cell['value'],str)}
                if not any(label in {'Effect','Description'} for label in headers.values()):headers=None
                continue
            if not headers or not useful(name) or len(name)>80: continue
            if all(cell['column']==1 or cell['value'] is None for cell in row['cells']):
                headers=None;continue
            facts=[]
            for column,label in headers.items():
                if label not in FACT_HEADERS:continue
                cell=values.get(column,{})
                value=cell.get('value')
                if cell.get('error') or value is None or isinstance(value,bool):continue
                if isinstance(value,(int,float)) and (not math.isfinite(value) or label=='Range' and abs(value)>99):continue
                if isinstance(value,str) and (not useful(value) or '?' in value):continue
                facts.append(dict(label='Power' if label=='Might/Power' else label,value=str(cell.get('formatted') if cell.get('formatted') is not None else value),reference=ref(sheet,row['row'],column)))
            description=None;description_column=1
            for target in ['Effect','Description']:
                column=next((c for c,h in headers.items() if h==target),None)
                value=values.get(column,{}).get('value')
                if useful(value):description=value;description_column=column;break
            if not facts and name not in known_names:continue
            if not description and not facts:continue
            records.append(dict(name=name,proficiency=proficiency,kind='spell' if proficiency in ['Reason','Faith'] else 'art',description=description,
                reference=ref(sheet,row['row'],description_column),facts=facts))
    # Literal definitions in the Combat Arts appendix are not formula mirrors.
    # Section headings establish their category; never borrow a neighbouring one.
    sheet=next(sheet for sheet in sheets.values() if sheet['title']=='Combat Arts')
    validated={item['row']:item['proficiency'] for item in core['combatArts']}
    category=None
    for row in sheet['rows']:
        values={cell['column']:cell for cell in row['cells']}
        name=values.get(1,{}).get('value')
        if len([c for c in row['cells'] if c['value'] is not None])==1:
            category={'Authority':'Authority','Armor':'Armor','Other':None}.get(name)
            continue
        if not useful(name) or name=='Name':continue
        if values.get(1,{}).get('formula') and row['row'] not in validated:continue
        description=values.get(7,{}).get('value')
        if not useful(description):continue
        facts=[]
        for col,label in enumerate(['Cost','Might','Hit','Crit','Range'],2):
            cell=values.get(col,{});value=cell.get('value')
            if cell.get('error') or value is None or isinstance(value,bool):continue
            if isinstance(value,str) and (not useful(value) or '?' in value):continue
            if isinstance(value,(int,float)) and (not math.isfinite(value) or label=='Range' and abs(value)>99):continue
            facts.append(dict(label=label,value=str(cell.get('formatted') if cell.get('formatted') is not None else value),reference=ref(sheet,row['row'],col)))
        records.append(dict(name=name,proficiency=validated.get(row['row'],category),kind='art',description=description,reference=ref(sheet,row['row'],7),facts=facts))
    return dict(schemaVersion=1,sourceSnapshotSha256=core['snapshotSha256'],records=records)

def serialize(value):
    return json.dumps(value,ensure_ascii=False,separators=(',',':'),allow_nan=False)+'\n'
