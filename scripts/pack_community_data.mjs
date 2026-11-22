import fs from 'node:fs';
import {isDeepStrictEqual} from 'node:util';
import {createHash} from 'node:crypto';
import {packRuntimeData,unpackRuntimeData} from '../src/runtimeCodec.js';
const input=new URL('../src/data/community-core.json',import.meta.url);
const output=new URL('../src/data/community-runtime.json',import.meta.url);
const original=JSON.parse(fs.readFileSync(input,'utf8'));
const snapshot=fs.readFileSync(new URL('../data/community/source.snapshot.json',import.meta.url));
if(original.snapshotSha256!==createHash('sha256').update(snapshot).digest('hex'))throw new Error('Community source snapshot changed. Review and reimport before packing.');
if(original.sheets.length!==27||new Set(original.sheets.map(s=>s.key)).size!==27)throw new Error('Incomplete or duplicate community sheet manifest.');
const abilityFile=new URL('../src/data/ability-info.json',import.meta.url);
if(!fs.existsSync(abilityFile)||createHash('sha256').update(fs.readFileSync(abilityFile)).digest('hex')!==original.abilityInfoSha256)throw new Error('Missing or stale ability description index. Run import:community.');
for(const sheet of original.sheets){
 if(!/^sheet-\d+$/u.test(sheet.key))throw new Error('Invalid community artifact name.');
 const file=new URL(`../src/data/community-sheets/${sheet.key}.json`,import.meta.url);
 if(!fs.existsSync(file)||createHash('sha256').update(fs.readFileSync(file)).digest('hex')!==sheet.sha256)throw new Error(`Missing or stale community sheet: ${sheet.title}. Run import:community and pack:community.`);
}
const packed=JSON.stringify(packRuntimeData(original))+'\n';
if(!isDeepStrictEqual(original,unpackRuntimeData(JSON.parse(packed))))throw new Error('Community reference did not round-trip.');
if(process.argv.includes('--check')){
 if(!fs.existsSync(output)||fs.readFileSync(output,'utf8')!==packed)throw new Error('Community runtime data is stale. Run pack:community.');
}else fs.writeFileSync(output,packed);
console.log(`Community runtime ${process.argv.includes('--check')?'verified':'packed'}: ${Buffer.byteLength(packed)} bytes, exact round trip.`);
