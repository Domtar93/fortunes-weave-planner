"""Read-only companion import. Original workbook/IDs/calculations are never replaced."""
import argparse
import hashlib
import json
import math
import re
from pathlib import Path
from import_proficiencies import entry_state

ROOT = Path(__file__).resolve().parents[1]
URL = 'https://docs.google.com/spreadsheets/d/1toaw286JE2caHAnf_5zy-_4m-3PM-ysS9ihmd2SBjtE/edit'
CATEGORIES = ['Sword','Spear','Axe','Bow','Gauntlet','Reason','Faith','Authority','Infantry','Riding','Armor','Flying']
STATS = ['HP','Str','Mag','Spd','Dex','Def','Res','Lck','Cha']
RENAMES = {'Reason':'Black Magic','Faith':'White Magic'}
RANKS = ['E','E+','D','D+','C','C+','B','B+','A','A+','S','S+']
MARKERS = {'-','—','N/A','NONE'}

def column(n):
    result = ''
    while n:
        n, digit = divmod(n-1,26)
        result = chr(65+digit)+result
    return result

def status(value, error=None):
    if error: return 'unknown'
    if value is None or isinstance(value,str) and not value.strip(): return 'unknown'
    if isinstance(value,str) and value.strip().upper() in MARKERS: return 'unavailable'
    return 'unverified'

def build(snapshot_bytes, base):
    raw=json.loads(snapshot_bytes)
    document=raw['spreadsheet']
    if document.get('spreadsheetId') != URL.split('/d/')[1].split('/')[0]: raise ValueError('Unexpected community source identity.')
    sha=hashlib.sha256(snapshot_bytes).hexdigest()
    sheets={}; cells={}; issues=[]
    for sheet in document['sheets']:
        props=sheet['properties']; title=props['title']; gid=props['sheetId']
        if title in sheets: raise ValueError(f'Duplicate worksheet: {title}')
        positions={}; rows={}
        for block in sheet.get('data',[]):
            for r,row in enumerate(block.get('rowData',[]),block.get('startRow',0)+1):
                for c,cell in enumerate(row.get('values',[]),block.get('startColumn',0)+1):
                    if not cell: continue
                    rawvalue=cell.get('userEnteredValue',{}); effective=cell.get('effectiveValue',rawvalue)
                    value=next((effective[k] for k in ['stringValue','numberValue','boolValue'] if k in effective),None)
                    error=effective.get('errorValue')
                    if error: value=None
                    if isinstance(value,float) and not math.isfinite(value): raise ValueError(f'Nonfinite value: {title}!{column(c)}{r}')
                    item=dict(column=c,value=value,formatted=cell.get('formattedValue'),note=cell.get('note'),formula=rawvalue.get('formulaValue'),error=error)
                    if (r,c) in positions: raise ValueError(f'Overlapping source blocks: {title}!{column(c)}{r}')
                    positions[r,c]=item; rows.setdefault(r,[]).append(item)
                    if error: issues.append(dict(sheet=title,cell=f'{column(c)}{r}',message=error.get('message','Source formula error'),kind='source_error'))
        key=f'sheet-{gid}'
        sheets[title]=dict(title=title,gid=gid,key=key,rows=[dict(row=r,cells=sorted(items,key=lambda x:x['column'])) for r,items in sorted(rows.items())])
        cells[title]=positions
    if len(sheets)!=27: raise ValueError('Expected all 27 reference worksheets; refusing partial import.')
    expected_headers={1:'Name',**{c:stat for c,stat in enumerate(STATS,2)},
        **{c:RENAMES.get(category,category) for c,category in enumerate(CATEGORIES,22)},
        34:'Inherent ability',35:'Description',36:'Equippable ability/abilities',37:'Description',38:'Name',39:'Description',
        **{c:f"{route}'s Path" for c,route in enumerate(['Cai','Dietrich','Theodora','Leda'],40)}}
    for c,expected in expected_headers.items():
        if cells['Characters'].get((2,c),{}).get('value')!=expected: raise ValueError(f'Changed Characters schema at {column(c)}2; review column mappings.')
    def field(title,r,c):
        item=cells[title].get((r,c),dict(value=None,note=None,error=None))
        cell=f'{column(c)}{r}'
        return dict(value=item['value'],status=status(item['value'],item.get('error')),source=f'{title}!{cell}',url=f'{URL}#gid={sheets[title]["gid"]}&range={cell}',note=item.get('note'),formula=item.get('formula'),error=item.get('error'))
    def rows_by_name(title,start):
        names={}
        for (r,c),item in cells[title].items():
            if c==1 and r>=start and isinstance(item['value'],str) and item['value'].strip(): names.setdefault(item['value'].strip(),[]).append(r)
        return names
    names=rows_by_name('Characters',3); characters={}
    for profile in base['characters']:
        name=profile['name']; positions=names.get(name,[])
        if len(positions)!=1: raise ValueError(f'Missing/duplicate character mapping: {name}')
        r=positions[0]
        for c,stat in enumerate(STATS,2):
            item=cells['Characters'].get((r,c),{}); value=item.get('value'); fmt=item.get('formatted')
            if isinstance(value,bool) or not isinstance(value,(int,float)): raise ValueError(f'Malformed growth for {name} {stat}')
            if isinstance(fmt,str) and fmt.endswith('%'): value=float(fmt[:-1])
            if value!=profile['growths'][stat]: raise ValueError(f'Personal growth disagreement for {name} {stat}; review before importing.')
        fields={key:field('Characters',r,c) for key,c in [('inherent',34),('inherentDescription',35),('equippable',36),('equippableDescription',37),('bloodmark',38),('bloodmarkDescription',39)]}
        fields['recruitment']={route:field('Characters',r,c) for c,route in enumerate(['Cai','Dietrich','Theodora','Leda'],40)}
        for item in [fields[key] for key in ['inherent','inherentDescription','equippable','equippableDescription','bloodmark','bloodmarkDescription']]+list(fields['recruitment'].values()):
            if item['value'] is not None and not isinstance(item['value'],str): raise ValueError(f'Malformed character reference text: {item["source"]}')
        fields['proficiencies']={category:field('Characters',r,c) for c,category in enumerate(CATEGORIES,22)}
        characters[name]=fields
    if len(characters)!=64: raise ValueError('Expected 64 existing growth profiles.')
    identities=set(base['proficiencies']['categories']['Sword']['characters'])
    learnsets={}
    for category in CATEGORIES:
        title=RENAMES.get(category,category); category_cells=cells[title]
        columns={item['value']:c for (r,c),item in category_cells.items() if r==1 and item['value'] in RANKS}
        if len(columns)!=sum(1 for (r,c),item in category_cells.items() if r==1 and item['value'] in RANKS): raise ValueError(f'Duplicate rank heading: {title}')
        if not columns: raise ValueError(f'No rank headings: {title}')
        candidates=rows_by_name(title,2); records={}
        for name in sorted(identities):
            positions=[r for r in candidates.get(name,[]) if r<68]
            if len(positions)!=1: raise ValueError(f'Missing/duplicate learnset identity: {title} / {name}')
            r=positions[0]; values={}
            for rank,c in columns.items():
                f=field(title,r,c); value=f['value']
                if value is not None and not isinstance(value,str): raise ValueError(f'Malformed learnset text: {title}!{column(c)}{r}')
                values[rank]=[value,entry_state(value,''),f['note']]
            records[name]=dict(row=r,values=values)
        learnsets[category]=dict(sheet=title,gid=sheets[title]['gid'],columns=columns,characters=records)
    skills=[]
    for r in range(3,222):
        name=field('Equipable Skills',r,2)['value']; description=field('Equipable Skills',r,3)
        if isinstance(name,str) and name.strip() not in ['', 'Skill Name','Name'] and description['status']=='unverified':
            skills.append(dict(name=name.strip(),description=description,access=field('Equipable Skills',r,4)))
    combat_arts=[]
    for r in sorted({r for r,c in cells['Combat Arts']}):
        name=field('Combat Arts',r,1)
        match=re.fullmatch(r"=(?:'([^']+)'|([A-Za-z ]+))!A([1-9]\d*)",name['formula'] or '')
        if not match or not isinstance(name['value'],str) or name['value'] in ['', 'Name']: continue
        origin=match[1] or match[2]
        category=next((p for p in CATEGORIES if RENAMES.get(p,p)==origin),None)
        if not category: continue
        original=field(origin,int(match[3]),1)
        if original['value']!=name['value']:
            issues.append(dict(sheet='Combat Arts',cell=f'A{r}',kind='reference_disagreement',message='Mirrored name does not match its recorded origin; no contextual link supplied.'))
            continue
        combat_arts.append(dict(name=name['value'],proficiency=category,row=r,reference=name,origin=original,effect=field('Combat Arts',r,7)))
    for r in range(2,9):
        f=field('Magic Scrolls',r,5)
        if isinstance(f['value'],(int,float)): issues.append(dict(sheet='Magic Scrolls',cell=f'E{r}',kind='date_serial',message='Numeric date serial cannot be used as an attack range. Corrected original range is retained.'))
    index=[dict(title=s['title'],gid=s['gid'],key=s['key'],rows=len(s['rows']),cells=sum(len(r['cells']) for r in s['rows']),
        sha256=hashlib.sha256((json.dumps(s,ensure_ascii=False,separators=(',',':'),allow_nan=False)+'\n').encode()).hexdigest()) for s in sheets.values()]
    core=dict(schemaVersion=1,sourceUrl=URL,sourceTitle=raw['metadata']['properties']['title'],snapshotSha256=sha,namespace=f'Community {sha[:12]}',characters=characters,learnsets=learnsets,skills=skills,combatArts=combat_arts,sheets=index,issues=issues)
    return core,{s['key']:s for s in sheets.values()}

def artifacts(source=ROOT/'data/community/source.snapshot.json'):
    core,sheets=build(source.read_bytes(),json.loads((ROOT/'src/data/growths.json').read_text(encoding='utf-8')))
    from import_ability_info import build_ability_info,serialize
    ability_info=build_ability_info(core,sheets)
    core['abilityInfoSha256']=hashlib.sha256(serialize(ability_info).encode()).hexdigest()
    result={ROOT/'src/data/community-core.json':core,ROOT/'src/data/ability-info.json':ability_info,**{ROOT/f'src/data/community-sheets/{key}.json':value for key,value in sheets.items()}}
    return {path:json.dumps(value,ensure_ascii=False,separators=(',',':'),allow_nan=False)+'\n' for path,value in result.items()}

def check_source_refresh(previous, current, accepted=False):
    if previous and previous.get('snapshotSha256')!=current['snapshotSha256'] and not accepted:
        raise ValueError('Source snapshot changed. Preserve normal and reference-recovery backups and the previous release, review the source diff, then use --accept-source-refresh. No generated files were replaced.')

def main(argv=None):
    parser=argparse.ArgumentParser(description=__doc__); parser.add_argument('--check',action='store_true'); parser.add_argument('--accept-source-refresh',action='store_true',help='Explicitly accept a reviewed new snapshot after preserving recovery backups.'); args=parser.parse_args(argv)
    outputs=artifacts()
    if not args.check:
        core_path=ROOT/'src/data/community-core.json'
        previous=json.loads(core_path.read_text(encoding='utf-8')) if core_path.exists() else None
        try: check_source_refresh(previous,json.loads(outputs[core_path]),args.accept_source_refresh)
        except ValueError as error: parser.error(str(error))
    for path,text in outputs.items():
        if args.check:
            if not path.exists() or path.read_text(encoding='utf-8')!=text: raise ValueError(f'Stale/missing community artifact: {path.name}. Run import:community.')
        else:
            path.parent.mkdir(parents=True,exist_ok=True); temp=path.with_suffix('.json.tmp'); temp.write_text(text,encoding='utf-8',newline='\n'); temp.replace(path)
    print(f'Community reference {"verified" if args.check else "imported"}: 64 profiles, 12 learnsets, 27 sheets; original source untouched.')
    return 0

if __name__=='__main__': raise SystemExit(main())
