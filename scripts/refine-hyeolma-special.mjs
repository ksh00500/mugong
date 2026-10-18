import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root='docs/source/hyeolma-special-v1';
const p=JSON.parse(await readFile(root+'/preflight.json'));
for(const r of p.promptRecords){
 let t=await readFile(r.prompt,'utf8');
 if(!t.includes('STRICT SIZE:')){
  t+='\nSTRICT SIZE: preserve guide READY skull/torso pixel dimensions. Standing equivalent height '+r.referenceHeight+'px. Do not enlarge any figure. Output same1024x1536 guide geometry.\n';
  if(r.id.startsWith('sohong-'))t=t.replaceAll('RIGHT','__HAND__').replaceAll('LEFT','RIGHT').replaceAll('__HAND__','LEFT').replace('fan held right hand','fan held left hand');
  await writeFile(r.prompt,t);
 }
 r.promptSha256=createHash('sha256').update(t).digest('hex');
}
await writeFile(root+'/preflight.json',JSON.stringify(p,null,2)+'\n');
console.log(JSON.stringify(p.promptRecords.map(({id,reference,guide,referenceHeight,prompt})=>({id,reference,guide,referenceHeight,prompt}))));
