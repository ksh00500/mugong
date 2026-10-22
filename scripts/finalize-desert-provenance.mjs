import {readFile,writeFile} from 'node:fs/promises';
const root='docs/source/desert-family-v1';
const entries=JSON.parse(await readFile(`${root}/provenance.json`));
for(const e of entries) {
 if(e.source==='ringblade-back.png')e.prompt='ringblade-back.grip-final.prompt.txt';
 if(e.source==='rider-back-combat.png')e.prompt='rider-back-combat.contact-repair.prompt.txt';
}
await writeFile(`${root}/provenance.json`,JSON.stringify(entries,null,2)+'\n');
const jobs=JSON.parse(await readFile(`${root}/generation-jobs.json`));
const j=jobs.find(j=>j.id==='arkan-rear-right');
j.poseSources ??= {};
for(let pose=8;pose<12;pose++) {
 j.poseSources[pose]='arkan-rear-right-finish.png';
 j.poseSourceCells[pose]={columns:2,rows:2,index:pose-8};
}
await writeFile(`${root}/generation-jobs.json`,JSON.stringify(jobs,null,2)+'\n');
