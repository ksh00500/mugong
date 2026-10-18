import {readFile,writeFile} from 'node:fs/promises';
const root='docs/source/desert-family-v1';
const requests=JSON.parse(await readFile(`${root}/generation-requests.json`));
if(process.argv[2]==='--repair-ring'){
 const prompt=`Use case: precise-object-edit. Correct this transparent 3columns x4rows twelve-pose sheet. Preserve identity, costume, brightness, every pose meaning, SAME head/torso/limb/weapon scale and same southeast camera. ONLY translate figures into roomy cell centers with 32px+ clear alpha margin to every outer edge. Pose5 prone must be complete, neither scarf nor head nor ring clipped at right edge. Pose8 open-hand release must be completely inside canvas, all fingertips intact. Pose9 followthrough is empty right hand, left hand keeps reserve ring. No resizing bodies to fit, no background, glow, VFX or text. Keep same right-hand ring ownership across all poses. Genuine transparent alpha.`;
 await writeFile(`${root}/ringblade-front-right.repair.prompt.txt`,prompt);
 console.log(JSON.stringify([{id:'ringblade-front-right',source:'ringblade-front-right.png',prompt:'ringblade-front-right.repair.prompt.txt',text:prompt,references:['docs/source/desert-family-v1/ringblade-front-right.png']}]));
}else{
 const selected=process.argv.slice(2);
 const jobs=requests.filter(r=>selected.includes(r.id));
 if(jobs.length!==selected.length)throw Error('Unknown or repeated requested source');
 console.log(JSON.stringify(await Promise.all(jobs.map(async r=>({...r,text:await readFile(`${root}/${r.prompt}`,'utf8')})))));
}
