import {readFile,writeFile,access} from 'node:fs/promises';
const root='docs/source/desert-family-v1';
const selected=process.argv.slice(2);
const requests=JSON.parse(await readFile(`${root}/generation-requests.json`));
for(const r of requests.filter(r=>selected.includes(r.character)&&r.view!==1)){
 const master=r.character==='rider'?`${r.character}-front-right-${r.kind}.png`:`${r.character}-front-right.png`;
 await access(`${root}/${master}`);
 const path=`${root}/${r.prompt}`;
 let text=await readFile(path,'utf8');
 text=text.slice(0,text.indexOf('REFERENCES:'))+`REFERENCES: Input1 is the APPROVED FRONT-RIGHT master of this SAME character. Redraw all poses from the requested DIFFERENT CAMERA, do not keep its front-right camera. Preserve EXACT costume, palette, head/torso/limb/weapon size, weapon ownership, sheet layout and pose meanings. Change camera and pose projection only. Keep head and boots intact with wide alpha padding.\n`;
 r.references=[`${root}/${master}`];
 await writeFile(path,text);
}
await writeFile(`${root}/generation-requests.json`,JSON.stringify(requests,null,2)+'\n');
console.log(selected.join(', '));
