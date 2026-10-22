import {readFile,writeFile,access} from 'node:fs/promises';
const root='docs/source/qingha-family-v1',requests=JSON.parse(await readFile(`${root}/generation-requests.json`));
for(const r of requests.filter(r=>r.view!==1)){
 const master=`${r.character}-front-right.png`;await access(`${root}/${master}`);
 let text=await readFile(`${root}/${r.prompt}`,'utf8');
 text=text.slice(0,text.indexOf('REFERENCES:'))+`REFERENCES: Input1 is the FRONT-RIGHT master of this SAME identity. Redraw all twelve poses from requested DIFFERENT CAMERA; preserve EXACT costume/palette/brightness and physical head, torso, limb and weapon dimensions. Camera projection and pose only change. Never shrink attacks or enlarge rear views. Keep complete tips and boots with generous alpha space; no pose may touch neighbor. Change camera correctly: strict back has no face, rear-right attacks upper-right, right profile attacks right, front attacks bottom.\n`;
 if(['qinghaguard','nojin'].includes(r.character))text+='Every attack uses TWO hands on one rigid continuous spear, at WAIST/CHEST height. Load draws shaft back beside HIP, contact drives it STRAIGHT toward camera target; no overhead spear swing.\n';
 r.references=[`${root}/${master}`];await writeFile(`${root}/${r.prompt}`,text);
}
await writeFile(`${root}/generation-requests.json`,JSON.stringify(requests,null,2)+'\n');
console.log('Prepared28 camera redraws from seven identity masters.');
