import {readFile,writeFile} from 'node:fs/promises';
const root='docs/source/desert-family-v1';
const requests=JSON.parse(await readFile(`${root}/generation-requests.json`));
const provenance=JSON.parse(await readFile(`${root}/provenance.json`));
const extra=provenance.find(p=>p.source==='arkan-rear-right-finish.png');
if(!requests.some(r=>r.source===extra.source))requests.push({
 id:extra.id,jobId:'arkan-rear-right',character:'arkan',view:3,kind:'combat-finish',
 source:extra.source,prompt:extra.prompt,references:[`${root}/arkan-rear-right.png`],status:'generated'
});
for(const r of requests){const p=provenance.find(p=>p.source===r.source);if(p){r.status='generated';r.prompt=p.prompt;}}
await writeFile(`${root}/generation-requests.json`,JSON.stringify(requests,null,2)+'\n');
