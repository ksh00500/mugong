import {readFile,writeFile,access} from 'node:fs/promises';
const root='docs/source/snow-family-v1',fixes=JSON.parse(await readFile(`${root}/separation-repair-requests.json`)),jobs=JSON.parse(await readFile(`${root}/generation-jobs.json`));
for(const f of fixes){
 await access(`${root}/${f.output}`);const j=jobs.find(j=>j.id===f.id);
 for(const p of f.poses){ (j.poseSources??={})[p]=f.output;j.poseSourceCells[p]=f.cell; }
}
await writeFile(`${root}/generation-jobs.json`,JSON.stringify(jobs,null,2)+'\n');
console.log('Selected individual spacious source drawings.');
