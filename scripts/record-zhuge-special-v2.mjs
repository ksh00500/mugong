import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const sharp=createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH??'sharp');
const root='docs/source/zhuge-special-v1';
const fixes=JSON.parse(await readFile(root+'/correction-v2/generation-records.json'));
const status=JSON.parse(await readFile(root+'/generation-status.json'));
status.date='2026-10-08';
status.repairAttempts=status.repairAttempts.filter(r=>!r.source.startsWith('correction-v2/'));
status.repairAttempts.push(...fixes);
status.selectedRepairs=status.selectedRepairs.filter(r=>!r.source.startsWith('correction-v2/'));
status.selectedRepairs.push(...fixes.filter(r=>r.acceptedAsDraftPoses.length).map(r=>({id:r.id,source:r.source,poses:r.acceptedAsDraftPoses,review:r.review})));
const selected=new Set();
for(const r of status.selectedRepairs)for(const p of r.poses)selected.add(r.id+'/'+p);
status.selectedCorrectionPoses=selected.size;
status.pending=[
 'Special front-right artwork now faces southeast for Mukyeon, Jingwal and Zhugehyeon. Their existing BASIC motion source still faces left; base locomotion/attack must be reconciled before game registration.',
 'Yanggi side body size improved. Mukyeon rear-right v3 command body remains larger than its basic READY; correct source proportions, never per-pose fitting.',
 'Jingwal side command keeps connected support and empty arm but anatomical ownership is opposite original plan; final hand review pending.',
 'Zhugehyeon rear-right fan selected new load pose only; contact/follow timing and body-size continuity require final review.',
 '240 automatic ground-point proposals need boot-by-boot manual review. Weapon tips and robe edges can enter automatic lowest band.',
 'Remaining 10 of 18 regional action keys still use basic artwork; selected 8 dedicated actions are draft, no runtime registration or public deployment.'
];
for(const r of status.repairAttempts){r.acceptedAsDraftPoses=status.selectedRepairs.filter(s=>s.source===r.source).flatMap(s=>s.poses);r.finalApproved=false;}
await writeFile(root+'/generation-status.json',JSON.stringify(status,null,2)+'\n');
const hash=b=>createHash('sha256').update(b).digest('hex');
const provenance=[];
for(const r of fixes){
 const image=await readFile(root+'/'+r.source),prompt=await readFile(root+'/'+r.promptFile),m=await sharp(image).metadata();
 provenance.push({id:r.id,source:r.source,prompt:r.promptFile,original:r.original,width:m.width,height:m.height,sourceSha256:hash(image),promptSha256:hash(prompt),mode:'built-in imagegen',acceptedAsDraftPoses:r.acceptedAsDraftPoses,finalApproved:false,review:r.review});
}
await writeFile(root+'/correction-v2/provenance.json',JSON.stringify(provenance,null,2)+'\n');
await mkdir('docs/verification/zhuge-special-v2',{recursive:true});
console.log(JSON.stringify({newCorrectionSheets:fixes.length,totalCorrections:status.repairAttempts.length,newSelectedSheets:fixes.filter(r=>r.acceptedAsDraftPoses.length).length,selectedUniqueCorrectionPoses:selected.size}));

