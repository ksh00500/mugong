import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const root='docs/source/zhuge-family-v1', before=`${root}/attempts/jingwal-attack-v2-before`;
const json=async path=>JSON.parse((await readFile(path,'utf8')).replace(/^\uFEFF/,''));
const old=await json(`${before}/frames.json`), current=await json('src/game/zhuge-family-frames.json');
let unchangedFrames=0;
for(const art of current.characters){
  const previous=old.characters.find(a=>a.id===art.id);
  assert.equal(art.pixelScale,previous.pixelScale);
  for(const f of art.frames){
    const p=previous.frames.find(f0=>f0.name===f.name);
    if(art.id==='jingwal'&&f.kind==='combat'){
      assert.match(f.source,/^jingwal-attack-v2-/);
      assert.deepEqual(f.sourceCell,{columns:3,rows:3,index:f.pose});
    } else {
      for(const k of ['source','sourceBounds','footX','footY','bounds']) assert.deepEqual(f[k],p[k],`${art.id}/${f.name}/${k}`);
      unchangedFrames++;
    }
  }
}
const hashes=await json(`${before}/atlas-hashes.json`);let unchangedAtlases=0;
for(const entry of hashes){
  const filename=entry.File.split(/[\\/]/).pop();
  if(filename.startsWith('jingwal-'))continue;
  const hash=createHash('sha256').update(await readFile(`public/art/zhuge-family-v1/${filename}`)).digest('hex');
  assert.equal(hash.toLowerCase(),entry.Hash.toLowerCase(),filename);unchangedAtlases++;
}
assert.equal(unchangedFrames,390);assert.equal(unchangedAtlases,30);
const result={unchangedFrames,unchangedAtlases,replacedCombatFrames:30,pixelScale:.225,jingwal:current.characters.find(a=>a.id==='jingwal').cell};
await mkdir('docs/verification/jingwal-attack-v2',{recursive:true});
await writeFile('docs/verification/jingwal-attack-v2/preservation.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
