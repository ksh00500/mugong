import {readFile,writeFile} from 'node:fs/promises';
const root='docs/source/snow-family-v1',requests=JSON.parse(await readFile(`${root}/generation-requests.json`)),jobs=JSON.parse(await readFile(`${root}/generation-jobs.json`));
jobs.find(j=>j.id==='snowhunter-front-right').poseSourceCells[9]={columns:2,rows:3,index:3};
await writeFile(`${root}/generation-jobs.json`,JSON.stringify(jobs,null,2)+'\n');
const out=[];
for(const r of requests.filter(r=>r.view!==1)) {
 let prompt=await readFile(`${root}/${r.prompt}`,'utf8');
 prompt=prompt.replace('On an approximately1088px-wide canvas head about90-100px, standing head-to-boots300-330px.', 'Keep exactly the reference master physical head/body size on a1024x1536portrait canvas. Do not follow any former catalogue proportions.')
 .replace('Each spacious cell about544px wide. WHOLE spear may span430px, BODY stays around300-330px tall.', 'Each spacious cell512x512px. Preserve the approved master head and body dimensions. Spear has ONE forward leaf point and a PLAIN blunt wood rear end, NEVER a second blade. Two separated grips. Choose camera foreshortening for correct perspective, not smaller body.')
 .replace('Catalogue TOP SECOND:', 'Approved blue winter mouthscarf spear soldier:')
 .replace('blue headband/crown','blue headband with modest silver clasp');
 if(r.character==='mujin'&&r.kind==='combat') r.references=['docs/source/snow-family-v1/mujin-front-right-locomotion-v2.png','docs/source/snow-family-v1/mujin-front-right-contact-separated.png'];
 await writeFile(`${root}/${r.prompt}`,prompt);
 out.push({...r,promptText:prompt,references:r.references.map(p=>'C:/Users/user/Documents/ChatGPT/MUGONG/'+p)});
}
await writeFile(`${root}/generation-requests.json`,JSON.stringify(requests,null,2)+'\n');
await writeFile(`${root}/camera-batch.json`,JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify(out));
