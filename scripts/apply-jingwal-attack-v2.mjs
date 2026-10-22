import { readFile, writeFile } from 'node:fs/promises';

// Select drawings and explicitly reviewed boot anchors; never resize source art.
const root = 'docs/source/zhuge-family-v1';
const jobs = JSON.parse(await readFile(`${root}/generation-jobs.json`, 'utf8'));
const anchors = JSON.parse(await readFile(`${root}/ground-anchors.json`, 'utf8'));
const feet = {
  'front-right': [[209,409],[202,398],[134,409],[190,395],[199,391],[195,403]],
  front: [[268,363],[255,359],[229,364],[275,396],[250,394],[247,394]],
  right: [[180,404],[190,406],[127,414],[174,444],[248,425],[236,425]],
  'rear-right': [[192,398],[178,404],[103,401],[186,396],[212,417],[223,395]],
  back: [[179,378],[184,378],[218,387],[215,414],[213,383],[221,386]],
};
const overrides = { right:{2:'right-hands',3:'right-hands'}, 'rear-right':{1:'rear-right-hands',4:'rear-right-hands'}, back:{2:'back-aim',3:'back-aim'} };
for (const job of jobs.filter(j=>j.character==='jingwal')) {
  const view = job.id.replace('jingwal-','');
  for (let index=0;index<6;index++) {
    const pose=index+6;
    (job.poseSources??={})[pose]=`jingwal-attack-v2-${overrides[view]?.[index]??view}.png`;
    (job.poseSourceCells??={})[pose]={columns:3,rows:3,index};
    anchors[job.id][pose]=feet[view][index];
  }
}
await writeFile(`${root}/generation-jobs.json`,JSON.stringify(jobs,null,2)+'\n');
await writeFile(`${root}/ground-anchors.json`,JSON.stringify(anchors,null,2)+'\n');
console.log('Selected 30 Jingwal attack drawings in five cameras.');
