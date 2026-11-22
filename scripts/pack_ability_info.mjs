import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {packRuntimeData,unpackRuntimeData} from '../src/runtimeCodec.js';
const input=new URL('../src/data/ability-info.json',import.meta.url),output=new URL('../src/data/ability-info-runtime.json',import.meta.url);
const value=JSON.parse(fs.readFileSync(input,'utf8'));
const snapshot=fs.readFileSync(new URL('../data/community/source.snapshot.json',import.meta.url));
const research=JSON.parse(fs.readFileSync(new URL('../src/data/ability-research.json',import.meta.url),'utf8'));
if(research.schemaVersion!==1||research.game!=="Fire Emblem: Fortune's Weave"||research.sourceSnapshotSha256!==createHash('sha256').update(snapshot).digest('hex'))throw new Error('Ability research needs review against the current source snapshot.');
const personal=JSON.parse(fs.readFileSync(new URL('../src/data/personal-ability-research.json',import.meta.url),'utf8'));
const workbook=fs.readFileSync(new URL('../data/source.xlsx',import.meta.url));
if(personal.schemaVersion!==1||personal.game!=="Fire Emblem: Fortune's Weave"||personal.sourceSnapshotSha256!==createHash('sha256').update(snapshot).digest('hex')||personal.originalSourceSha256!==createHash('sha256').update(workbook).digest('hex'))throw new Error('Personal ability research needs review against the current source snapshots.');
if(value.schemaVersion!==1||value.sourceSnapshotSha256!==createHash('sha256').update(snapshot).digest('hex'))throw new Error('Ability descriptions use a different source snapshot. Reimport community data.');
const text=JSON.stringify(packRuntimeData(value))+'\n';
if(!isDeepStrictEqual(unpackRuntimeData(JSON.parse(text)),value))throw new Error('Ability descriptions did not round-trip.');
if(process.argv.includes('--check')){
 if(!fs.existsSync(output)||fs.readFileSync(output,'utf8')!==text)throw new Error('Ability description runtime is stale. Run pnpm pack:community.');
}else fs.writeFileSync(output,text);
console.log(`Ability descriptions ${process.argv.includes('--check')?'verified':'packed'}: ${value.records.length} records, ${Buffer.byteLength(text)} bytes; exact round trip.`);
