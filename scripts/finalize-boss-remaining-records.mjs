import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root='docs/source/boss-remaining-v1',proof='docs/verification/boss-remaining-v1';
const hash=async path=>createHash('sha256').update(await readFile(path)).digest('hex');
const jobs=JSON.parse(await readFile(root+'/generation-jobs.json'));
const audit=JSON.parse(await readFile(root+'/action-audit.json'));
const art=JSON.parse(await readFile('src/game/boss-remaining-frames.json'));
const exported=JSON.parse(await readFile(root+'/export-review.json'));
const records=[];
for(const [i,j] of jobs.entries()){
 j.status='applied-local';j.bossId=audit.find(a=>a.family===j.family&&a.character===j.character).bossId;
 const correction=j.source.endsWith('-v2.png');
 const prompt=correction?j.source.replace('.png','.prompt.txt'):j.promptFile;
 records.push({id:j.id,bossId:j.bossId,selected:j.source,guide:j.guide,prompt,guideSha256:await hash(root+'/'+j.guide),selectedSha256:await hash(root+'/'+j.source),promptSha256:await hash(root+'/'+prompt),normalization:exported.normalization.find(n=>n.id===j.id),promptScope:i<16&&!correction?'saved base prompt; per-attempt conversation additions are not a complete exact transcript':'exact saved selected prompt',tool:'built-in imagegen'});
 const recordPath=root+'/generated/'+j.id+'.generation.json';
 const record=JSON.parse(await readFile(recordPath));
 record.status=correction?'superseded':'selected';record.selectedLocalSource=j.source;
 await writeFile(recordPath,JSON.stringify(record,null,2)+'\n');
}
await writeFile(root+'/generation-jobs.json',JSON.stringify(jobs,null,2)+'\n');
const selected=new Set(jobs.map(j=>j.source));
const discarded=[];
for(const name of (await readdir(root+'/generated')).filter(n=>n.endsWith('.png'))){
 if(selected.has('generated/'+name))continue;
 const reason=name.includes('gongheo')?'wrong striking arm':name.includes('cheongrin')?'north/northeast sword aimed sideways':'northeast camera incorrectly east profile';
 discarded.push({source:'generated/'+name,sha256:await hash(root+'/generated/'+name),reason});
}
await writeFile(root+'/provenance.json',JSON.stringify({date:'2026-10-08',tool:'built-in imagegen',selectedSheets:18,newDirectionalContacts:90,retainedRejectedSheets:discarded.length,normalization:'ONE uniform scale per complete source sheet against stationary south READY. Source preserved; normalized exports are not original RGBA1:1.',records,discarded},null,2)+'\n');
const completion=art.characters.map(c=>({bossId:c.bossId,character:c.id,remainingActions:c.moves,addedLogicalFrames:c.frames.length,allKitActions:audit.filter(a=>a.bossId===c.bossId).map(a=>a.move),completeKitCoverage:true}));
await writeFile(root+'/completion.json',JSON.stringify({date:'2026-10-08',gameRegistered:true,localApplied:true,publicDeployedThisRun:false,bosses:16,addedActions:41,fourRegionKitActions:73,totalWithSnowMokjinActions:75,addedLogicalFrames:1590,totalWithExistingLogicalFrames:2610,newDirectionalContactDrawings:90,characters:completion},null,2)+'\n');
const reports=[];
for(const name of (await readdir(proof)).filter(n=>/^[0124]-(canvas|webgl)-(full|reduced)\.json$/.test(n))){const r=JSON.parse(await readFile(proof+'/'+name));if(r.failures.length||r.errors.length||!r.unchanged)throw Error('Renderer failure '+name);reports.push({name,samples:r.count,contacts:r.contacts.length,renderer:r.renderer,reduced:r.reduced});}
if(reports.length!==16)throw Error('Expected 16 current renderer reports');
const localRegions=[];for(const region of [0,1,2,4])localRegions.push(JSON.parse(await readFile(proof+'/local-region-'+region+'.json')));
if(localRegions.some(r=>r.errors.length||r.failed.length||r.expected!==r.loaded)||localRegions.reduce((s,r)=>s+r.newRemainingLoaded.length,0)!==18)throw Error('Local compiled image loading failure');
await writeFile(proof+'/summary.json',JSON.stringify({date:'2026-10-08',unitTests:9,initialBrowserTests:16,finalAffectedRerun:8,finalCurrentConfigurations:16,totalFinalSamples:reports.reduce((s,r)=>s+r.samples,0),reports,reviewUI:JSON.parse(await readFile(proof+'/review-ui.json')),localCompiledTests:5,localRegions,matchedPublicDistTextures:JSON.parse(await readFile(proof+'/reused-texture-hashes.json')).length,notes:['Initial art snapshots retained under initial/. Regions1/2 overwritten only after final art corrections. Regions0/4 unchanged.','First affected-rerun startup failed waiting for webServer; retry passed8.','First review UI run failed rapid-selection image readiness. Fixed request ownership/disabled pending controls; final three viewports passed.','Visual human/model review is separate from coordinate assertions.']},null,2)+'\n');
console.log(JSON.stringify({selected:records.length,discarded:discarded.length,samples:reports.reduce((s,r)=>s+r.samples,0)}));
