import { readFile, writeFile } from 'node:fs/promises';
const root='docs/source/snow-family-v1', ledger=JSON.parse(await readFile(`${root}/provenance.json`)), jobs=JSON.parse(await readFile(`${root}/generation-jobs.json`));
const generated=new Set(ledger.map(r=>r.source)), completed=jobs.flatMap(j=>Array.from({length:12},(_,pose)=>({id:j.id,pose,source:j.poseSources?.[pose]??j.source}))).filter(r=>generated.has(r.source));
const status={status:'generating-and-reviewing',tool:'image_gen.imagegen',updatedAtUTC:new Date().toISOString(),characters:7,viewsPerCharacter:5,posesPerView:12,targetFrames:420,availableFrames:completed.length,generatedCandidateSources:ledger.length,gameApplied:false,remoteDeployed:false};
await writeFile(`${root}/generation-status.json`,JSON.stringify(status,null,2)+'\n');
console.log(JSON.stringify(status));
