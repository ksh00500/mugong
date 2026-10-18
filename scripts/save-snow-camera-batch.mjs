import {readFile,writeFile} from 'node:fs/promises';
const root='docs/source/snow-family-v1', batch=JSON.parse(await readFile(`${root}/camera-batch.json`)), requests=JSON.parse(await readFile(`${root}/generation-requests.json`));
for(const j of batch.slice(16)) {
 j.prompt=`${j.id}-camera.prompt.txt`;
 j.promptText=await readFile(`${root}/${j.prompt}`,'utf8');
 requests.find(r=>r.id===j.id).prompt=j.prompt;
}
await writeFile(`${root}/camera-batch.json`,JSON.stringify(batch,null,2)+'\n');
await writeFile(`${root}/generation-requests.json`,JSON.stringify(requests,null,2)+'\n');
console.log('Future20 camera prompts persisted.');
