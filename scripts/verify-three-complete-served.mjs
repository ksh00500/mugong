import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root='docs/verification/three-complete-v3',old=JSON.parse(await readFile('src/game/three-special-frames.json')),extra=JSON.parse(await readFile('src/game/three-complete-frames.json'));
const bases={};for(const family of ['desert','hyeolma','zhuge'])bases[family]=JSON.parse(await readFile(`src/game/${family}-family-frames.json`));
const paths=new Map(Object.entries({...old.textures,...extra.textures}));
for(const [family,base]of Object.entries(bases))for(const a of base.characters)for(const f of a.frames)paths.set(f.texture,`/art/${family}-family-v1/${f.texture.replace(family+'-family-','')}.webp`);
const keys=new Set([...old.characters,...extra.characters].flatMap(a=>a.frames.map(f=>f.texture))),records=[];
for(const key of keys){
 const url=paths.get(key);if(!url)throw Error(key+': no path');
 const source=await readFile('public'+url),built=await readFile('dist-three-complete-v3'+url),response=await fetch('http://127.0.0.1:5203'+url);
 const sha=b=>createHash('sha256').update(b).digest('hex'),digest=sha(source);
 if(response.status!==200||sha(built)!==digest||sha(Buffer.from(await response.arrayBuffer()))!==digest)throw Error(key+': public/dist/HTTP mismatch');
 records.push({key,url,sha256:digest});
}
await writeFile(root+'/all-used-atlases.json',JSON.stringify({textures:records.length,records},null,2)+'\n');console.log(JSON.stringify({textures:records.length,publicDistHttpEqual:true}));
