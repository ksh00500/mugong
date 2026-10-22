import { readFile, writeFile } from 'node:fs/promises';
const root='docs/source/hyeolma-family-v1';
const requests=JSON.parse(await readFile(`${root}/final-v8-requests.json`));
const jobs=JSON.parse(await readFile(`${root}/generation-jobs.json`));
const anchors=JSON.parse(await readFile(`${root}/ground-anchors.json`));
const accepted=JSON.parse(await readFile(`${root}/final-accepted.json`));
const before=[];
for(const choice of accepted){
  const request=requests.find(r=>r.id===choice.id);
  const job=jobs.find(j=>j.id===choice.id);
  if(!request||!job)throw Error('Unknown correction');
  await readFile(`${root}/${choice.source??request.source}`);
  for(const pose of choice.poses??request.poses){
    before.push({id:job.id,pose,source:job.poseSources?.[pose]??job.source,cell:job.poseSourceCells[pose],reuse:job.poseReuse?.[pose]??null});
    (job.poseSources??={})[pose]=choice.source??request.source;
    job.poseSourceCells[pose]=choice.cell??(choice.single?{columns:1,rows:1,index:0}:{columns:3,rows:4,index:pose});
    if(job.poseReuse)delete job.poseReuse[pose];
    // Export proposes a new ground point for new art only. Keep reviewed old points intact.
    anchors[job.id][pose]=null;
  }
  if(job.poseReuse&&!Object.keys(job.poseReuse).length)delete job.poseReuse;
}
await writeFile(`${root}/final-replaced.json`,JSON.stringify(before,null,2)+'\n');
await writeFile(`${root}/generation-jobs.json`,JSON.stringify(jobs,null,2)+'\n');
await writeFile(`${root}/ground-anchors.json`,JSON.stringify(anchors,null,2)+'\n');
console.log(`${before.length} selected original drawings replaced`);
