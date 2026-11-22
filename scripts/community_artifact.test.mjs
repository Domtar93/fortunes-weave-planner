import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {unpackRuntimeData} from '../src/runtimeCodec.js';
const root=fileURLToPath(new URL('../',import.meta.url));
test('community runtime reconstructs every imported field exactly',()=>{
 const core=JSON.parse(fs.readFileSync(path.join(root,'src/data/community-core.json'),'utf8'));
 const runtime=JSON.parse(fs.readFileSync(path.join(root,'src/data/community-runtime.json'),'utf8'));
 assert.deepStrictEqual(unpackRuntimeData(runtime),core);
});
test('ability information runtime preserves every description, fact and reference',()=>{
 const original=JSON.parse(fs.readFileSync(path.join(root,'src/data/ability-info.json'),'utf8'));
 const packed=JSON.parse(fs.readFileSync(path.join(root,'src/data/ability-info-runtime.json'),'utf8'));
 assert.deepStrictEqual(unpackRuntimeData(packed),original);
 assert.ok(original.records.some(record=>record.name==='Swordfaire'&&record.description.includes('Hit/Avo+10')));
});
test('ability runtime check blocks research bound to a different source without rewriting artifacts',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'weave-research-'));
 try{
  for(const name of ['scripts/pack_ability_info.mjs','src/runtimeCodec.js','src/data/ability-info.json','src/data/ability-info-runtime.json','src/data/ability-research.json','src/data/personal-ability-research.json','data/source.xlsx','data/community/source.snapshot.json']){
   const target=path.join(temp,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(root,name),target);
  }
  fs.writeFileSync(path.join(temp,'package.json'),'{"type":"module"}');
  const run=()=>spawnSync(process.execPath,[path.join(temp,'scripts/pack_ability_info.mjs'),'--check'],{encoding:'utf8'});
  assert.equal(run().status,0);
  const output=path.join(temp,'src/data/ability-info-runtime.json'),original=fs.readFileSync(output);
  const research=path.join(temp,'src/data/ability-research.json'),data=JSON.parse(fs.readFileSync(research,'utf8'));
  data.sourceSnapshotSha256='different';fs.writeFileSync(research,JSON.stringify(data));
  const failure=run();assert.notEqual(failure.status,0);assert.match(failure.stderr,/research needs review/);
  assert.deepEqual(fs.readFileSync(output),original);
  data.sourceSnapshotSha256=JSON.parse(fs.readFileSync(path.join(root,'src/data/ability-research.json'),'utf8')).sourceSnapshotSha256;
  fs.writeFileSync(research,JSON.stringify(data));
  const personalPath=path.join(temp,'src/data/personal-ability-research.json'),personalBytes=fs.readFileSync(personalPath);
  for(const field of ['sourceSnapshotSha256','originalSourceSha256']){
   const personal=JSON.parse(personalBytes);personal[field]='changed';fs.writeFileSync(personalPath,JSON.stringify(personal));
   const stalePersonal=run();assert.notEqual(stalePersonal.status,0);assert.match(stalePersonal.stderr,/Personal ability research needs review/);
   assert.deepEqual(fs.readFileSync(output),original);fs.writeFileSync(personalPath,personalBytes);
  }
 }finally{if(path.dirname(path.resolve(temp))!==path.resolve(os.tmpdir())||!path.basename(temp).startsWith('weave-research-'))throw new Error('Unexpected temporary cleanup target.');fs.rmSync(temp,{recursive:true,force:true});}
});
test('community CLI rejects stale runtime and changed snapshots without writes',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'weave-community-'));
 try{
  for(const name of ['scripts/pack_community_data.mjs','src/runtimeCodec.js','src/data/community-core.json','src/data/community-runtime.json','src/data/ability-info.json','data/community/source.snapshot.json']){
   const target=path.join(temp,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(root,name),target);
  }
  fs.cpSync(path.join(root,'src/data/community-sheets'),path.join(temp,'src/data/community-sheets'),{recursive:true});
  fs.writeFileSync(path.join(temp,'package.json'),'{"type":"module"}');
  const run=()=>spawnSync(process.execPath,[path.join(temp,'scripts/pack_community_data.mjs'),'--check'],{encoding:'utf8'});
  assert.equal(run().status,0);
  const runtime=path.join(temp,'src/data/community-runtime.json'), original=fs.readFileSync(runtime);
  fs.appendFileSync(runtime,' ');assert.notEqual(run().status,0);fs.writeFileSync(runtime,original);
  const core=JSON.parse(fs.readFileSync(path.join(temp,'src/data/community-core.json'),'utf8'));
  const sheet=path.join(temp,`src/data/community-sheets/${core.sheets[0].key}.json`),sheetBytes=fs.readFileSync(sheet);
  fs.appendFileSync(sheet,' ');assert.match(run().stderr,/stale community sheet/);fs.writeFileSync(sheet,sheetBytes);
  fs.renameSync(sheet,sheet+'.missing');assert.match(run().stderr,/Missing or stale community sheet/);fs.renameSync(sheet+'.missing',sheet);
  const abilities=path.join(temp,'src/data/ability-info.json'),abilityBytes=fs.readFileSync(abilities);
  fs.appendFileSync(abilities,' ');assert.match(run().stderr,/stale ability description index/);fs.writeFileSync(abilities,abilityBytes);
  fs.renameSync(abilities,abilities+'.missing');assert.match(run().stderr,/stale ability description index/);fs.renameSync(abilities+'.missing',abilities);
  fs.appendFileSync(path.join(temp,'data/community/source.snapshot.json'),' ');const failure=run();assert.notEqual(failure.status,0);assert.match(failure.stderr,/snapshot changed/);
  assert.deepEqual(fs.readFileSync(runtime),original);
 }finally{if(path.dirname(path.resolve(temp))!==path.resolve(os.tmpdir())||!path.basename(temp).startsWith('weave-community-'))throw new Error('Unexpected temporary cleanup target.');fs.rmSync(temp,{recursive:true,force:true});}
});
