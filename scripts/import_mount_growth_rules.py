"""Validate the workbook's narrow mount-growth formulas; never edit the workbook or fill blanks."""
import argparse
import hashlib
import json
import re
from pathlib import Path
import openpyxl
from openpyxl.utils import get_column_letter

ROOT = Path(__file__).resolve().parents[1]

def normalized(value):
    # Formatting outside literals is harmless; spaces/case inside a string can
    # change a lookup/condition and must never be silently normalized away.
    return ''.join(part if index % 2 else re.sub(r"[\s$']", '', part).lower()
                   for index, part in enumerate(re.split(r'("(?:[^"]|"")*")', str(value))))

def extract_rules(workbook, source_sha256):
    sheet = workbook['Character Learnsets']
    sources = []
    def check(cell, expected):
        actual = getattr(sheet[cell].value, 'text', sheet[cell].value)
        if sheet[cell].data_type != 'f' or normalized(actual) != normalized(expected):
            raise ValueError(f'Unsupported mount-growth formula at Character Learnsets!{cell}; no rule inferred.')
        sources.append(dict(source=f'Character Learnsets!{cell}', formula=actual))
    check('D5', '=INDEX(Classes!$A$2:$BA$62,MATCH($D$4,Classes!$A$2:$A$62,0),MATCH("Mount",Classes!$A$2:$BA$2,0))')
    check('D7', '=vlookup(D6,Mounts!A:B,2,0)')
    check('F7', '=D7=D5')
    for index in range(9):
        output = get_column_letter(4 + index)
        source = get_column_letter(8 + index)
        check(f'{output}28', f'=sum({output}26:{output}27)')
        check(f'{output}30', f'=if($D$4&$F$7="CharioteerTRUE",sumif(Mounts!$A:$A,$D$6,Mounts!{source}:{source})*2,if($F$7=TRUE,sumif(Mounts!$A:$A,$D$6,Mounts!{source}:{source}),0))')
        check(f'{output}31', f'={output}28+{output}30')
    return dict(schemaVersion=1, sourceSha256=source_sha256, status='unverified-workbook-calculation', normalMultiplier=1, classLookupLastRow=62,
                doubledClass='Charioteer', doubledMultiplier=2, sources=sources,
                missingValuePolicy='Unknown, never zero. Conflicting written/numeric records are not selected for calculations.')

def build(source=ROOT/'data/source.xlsx', snapshot=ROOT/'src/data/growths.json'):
    digest = hashlib.sha256(Path(source).read_bytes()).hexdigest()
    metadata = json.loads(Path(snapshot).read_text(encoding='utf-8'))['metadata']
    if metadata['sourceSha256'] != digest:
        raise ValueError('Workbook and imported snapshot hashes differ. No rule sidecar published.')
    workbook = openpyxl.load_workbook(source, read_only=True, data_only=False)
    try:
        return extract_rules(workbook, digest)
    finally:
        workbook.close()

def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--output', type=Path, default=ROOT/'src/data/mount-growth-rules.json')
    args = parser.parse_args(argv)
    if args.output.resolve() in ((ROOT/'data/source.xlsx').resolve(), (ROOT/'src/data/growths.json').resolve()):
        parser.error('Output must not overwrite the source workbook or imported snapshot.')
    text = json.dumps(build(), ensure_ascii=False, indent=2) + '\n'
    if args.check:
        if args.output.read_text(encoding='utf-8') != text: raise ValueError('Mount-growth rule sidecar is stale.')
    else:
        temporary = args.output.with_suffix(args.output.suffix + '.tmp')
        temporary.write_text(text, encoding='utf-8', newline='\n')
        temporary.replace(args.output)
    print('Validated 30 source formulas; mount-growth evidence is current.')

if __name__ == '__main__':
    main()
