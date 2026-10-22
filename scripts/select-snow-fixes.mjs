import {readFile,writeFile,access} from 'node:fs/promises';
const root='docs/source/snow-family-v1',fixes=JSON.parse(await readFile(`${root}/axial-repair-requests.json`)),jobs=JSON.parse(await readFile(`${root}/generation-jobs.json`));
for(const f of fixes){
 await access(`${root}/${f.output}`); const j=jobs.find(j=>j.id===f.id);
 for(const p of f.poses){ (j.poseSources??={})[p]=f.output;(j.poseSourceCells??={})[p]=f.cell??{columns:f.wide?2:3,rows:f.wide?3:4,index:f.wide?p%6:p}; }
}
await writeFile(`${root}/generation-jobs.json`,JSON.stringify(jobs,null,2)+'\n');
console.log('Selected axial and owning-hand corrections.');
