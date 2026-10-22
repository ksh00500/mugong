import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const art=JSON.parse(await readFile('src/game/boss-remaining-frames.json'));
const textures=new Map(Object.entries(art.textures));
for(const family of ['shaolin','tianjian','dokmu','qingha'])for(const suffix of ['family','special']){
 const base=JSON.parse(await readFile(`src/game/${family}-${suffix}-frames.json`));
 for(const key of new Set(base.characters.flatMap(c=>c.frames.map(f=>f.texture))))textures.set(key,`/art/${family}-${suffix}-v1/${key.replace(family+'-'+suffix+'-','')}.webp`);
}
const used=new Set(art.characters.flatMap(c=>c.frames.map(f=>f.texture))),proof=[];
for(const key of used){const path=textures.get(key);if(!path)throw Error('Unknown texture '+key);
 const a=createHash('sha256').update(await readFile('public'+path)).digest('hex'),b=createHash('sha256').update(await readFile('dist'+path)).digest('hex');
 if(a!==b)throw Error('Stale local reused texture '+path);proof.push({key,path,sha256:a});
}
await writeFile('docs/verification/boss-remaining-v1/reused-texture-hashes.json',JSON.stringify(proof,null,2)+'\n');
console.log(JSON.stringify({matchedSourceAndLocalTextures:proof.length}));
