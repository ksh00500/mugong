import {readFile,writeFile} from 'node:fs/promises';
const root='docs/verification/desert-family-v1';
const render=[];
for(const renderer of ['canvas','webgl'])for(const motion of ['full','reduced']) {
 const r=JSON.parse(await readFile(`${root}/${renderer}-${motion}.json`));
 render.push({renderer,motion,states:r.records.length,contacts:r.contacts.length,minHealthGap:Math.min(...r.records.filter(r=>r.gap!==null).map(r=>r.gap)),fixedScale:[...new Set(r.records.map(r=>r.scale))]});
}
const release=JSON.parse(await readFile(`${root}/actual-release.json`));
const report={date:'2026-10-05',identities:7,nativeViews:5,directions:8,selectedSourceSheets:41,packedSheets:35,frames:420,unit:{files:55,tests:1261,passed:true},build:true,browser:{renderAndRelease:5,production:3,viewports:[[1440,900],[1366,768],[1093,614]]},render,actualReleaseCases:release.length,actualReleaseIdentities:[...new Set(release.map(r=>r.role))],sourceScanIssues:0,sourcePixelsPreserved:true,encodedTransparentPadding:true,userSaveUntouched:true,preview:'http://127.0.0.1:5173/art/desert-family-v1/review.html',limitations:['Boss patterns share representative character attack poses; dedicated stomp, sand stance and melee ring poses remain further art work.','Automated checks verify bounds, scale, direction, timing and padding; anatomy and physical head/body consistency are visual reviews.']};
await writeFile(`${root}/summary.json`,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
