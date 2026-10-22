import {readFile,writeFile} from 'node:fs/promises';
const root='docs/source/snow-family-v1',jobs=JSON.parse(await readFile(`${root}/generation-jobs.json`)),requests=JSON.parse(await readFile(`${root}/generation-requests.json`));
function select(character,source,poses) {
 const j=jobs.find(j=>j.id===`${character}-front-right`);
 for(const p of poses) { j.poseSources[p]=source;j.poseSourceCells[p]={columns:2,rows:3,index:p%6}; }
}
select('snowhunter','snowhunter-front-right-follow-tip.png',[9]);
select('mujin','mujin-front-right-locomotion-v2.png',[0,1,2,3,4,5]);
select('mujin','mujin-front-right-contact-separated.png',[8]);
select('mujin','mujin-front-right-follow-separated.png',[9]);
for(const [id,source] of [['snowhunter-front-right-combat','snowhunter-front-right-follow-tip.png'],['mujin-front-right-locomotion','mujin-front-right-locomotion-v2.png']])requests.find(r=>r.id===id).source=source;
await writeFile(`${root}/generation-jobs.json`,JSON.stringify(jobs,null,2)+'\n');
await writeFile(`${root}/generation-requests.json`,JSON.stringify(requests,null,2)+'\n');
console.log('Reviewed wide-grid master poses selected.');
