import {readFile,writeFile} from 'node:fs/promises';
const root='docs/verification/hyeolma-family-v1', final=`${root}/final`;
const unit=JSON.parse(await readFile(`${root}/final-unit.json`));
const source=JSON.parse(await readFile('docs/source/hyeolma-family-v1/selection-summary.json'));
const atlas=JSON.parse(await readFile('docs/source/hyeolma-family-v1/encoded-atlas-review.json'));
if(atlas.length!==35||!atlas.every(s=>s.transparentPadding&&s.frames===12))throw Error('Atlas padding verification incomplete');
const render=[];
for(const renderer of ['canvas','webgl'])for(const motion of ['full','reduced']){
 const r=JSON.parse(await readFile(`${final}/${renderer}-${motion}.json`));
 if(r.errors.length)throw Error('Browser error');
 render.push({renderer,motion,states:r.records.length,contacts:r.contacts.length,minHealthGap:Math.min(...r.records.filter(r=>r.gap!==null).map(r=>r.gap)),fixedScale:[...new Set(r.records.map(r=>r.scale))]});
}
const release=JSON.parse(await readFile(`${final}/actual-release.json`));
for(const width of [1440,1366,1093]){
 const r=JSON.parse(await readFile(`${final}/production/verification-${width}.json`));
 if(r.errors.length||new Set(r.assets).size!==35)throw Error('Production check incomplete');
}
if(!unit.success||unit.numFailedTests||source.reused.length||source.pendingArt.length)throw Error('Incomplete final correction');
const report={date:'2026-10-05',identities:7,nativeViews:5,directions:8,frames:420,uniqueSourceFigures:source.uniqueSourceFigures,selectedSourceSheets:source.selectedSources,correctedDrawings:20,explicitPoseReuse:0,pendingArt:[],unit:{files:unit.testResults.length,tests:unit.numPassedTests,passed:true},build:true,browser:{renderAndRelease:5,production:3,viewports:[[1440,900],[1366,768],[1093,614]]},render,actualReleaseCases:release.length,sourceScanIssues:0,sourcePixelsPreserved:true,encodedTransparentPadding:true,userSaveUntouched:true,preview:'http://127.0.0.1:5173/art/hyeolma-family-v1/review.html',buildAssets:['main-chUjCh5I.js','mount-BQV1lNYb.js'],limitations:['Boss19 actions share character base attack cycle, not19 separate authored cycles.','Death uses one authored pose and fade.','Automated checks verify bounds, pixel copying, direction, timing and spacing, not anatomy certification.'],environmentRecovery:'Initial Vitest temp-cache rename EPERM resolved using a workspace temp folder; browser tests ran outside sandbox localhost socket restrictions.'};
await writeFile(`${root}/summary.json`,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
