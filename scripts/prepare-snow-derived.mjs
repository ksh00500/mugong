import {readFile,writeFile,access} from 'node:fs/promises';
const root='docs/source/snow-family-v1', requests=JSON.parse(await readFile(`${root}/generation-requests.json`,'utf8'));
for(const r of requests.filter(r=>r.view!==1)) {
 const master=requests.find(m=>m.character===r.character && m.view===1 && m.kind===r.kind).source; await access(`${root}/${master}`);
 let prompt=await readFile(`${root}/${r.prompt}`,'utf8');
 prompt=prompt.slice(0,prompt.indexOf('REFERENCES:'))+'REFERENCES: Input1 approved FRONT-RIGHT master of this SAME identity and pose set. Redraw from the requested DIFFERENT CAMERA, retaining exact costume, neutral brightness/color, physical head/body/weapon dimensions. Do not shrink attacks or enlarge rear views. Correct camera: back shows no face, front aims bottom, rear-right aims top-right. Preserve anatomical weapon owning hand in all poses; front/back use foreshortening, not a side-on attack. No glow on white fur, no weapons through torso.\n';
 r.references=[`${root}/${master}`]; await writeFile(`${root}/${r.prompt}`,prompt);
}
await writeFile(`${root}/generation-requests.json`,JSON.stringify(requests,null,2)+'\n');
console.log('36 camera sources prepared from9 masters.');
