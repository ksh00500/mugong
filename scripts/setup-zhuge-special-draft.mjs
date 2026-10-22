import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const root='docs/source/zhuge-special-v1';
const hash=b=>createHash('sha256').update(b).digest('hex');
const sharp=createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH || 'sharp');
let finish=(await readFile('scripts/finish-hyeolma-special-draft.mjs','utf8')).replaceAll('hyeolma','zhuge');
finish=finish.replace("preflight.status = '40 generated base sheets, 18 correction attempts, 19 selected correction poses; draft preview only, no game installation';", "preflight.status = status.mainSources+' generated main sheets, '+status.repairAttempts.length+' repair attempts, '+status.selectedCorrectionPoses+' selected draft correction poses; pending orientation/ownership/scale/feet; no game installation';");
finish=finish.replace('몸 크기·관절·무기와 접지점을 검토합니다.', '몸 크기·관절·무기와 접지점을 검토합니다. 미완료: 앞사선 방향, 일부 무기 손 배치, 몸 치수와 발 좌표.');
await writeFile('scripts/finish-zhuge-special-draft.mjs',finish);
let review=await readFile('scripts/boss-special-review.mjs','utf8');
if (!review.includes("zhuge: ['개문수 양기'")) review=review.replace("hyeolma: ['혈도객 적우','혈마제자 연살','홍의마녀 소홍','혈마교주 적천']", "hyeolma: ['혈도객 적우','혈마제자 연살','홍의마녀 소홍','혈마교주 적천'], zhuge: ['개문수 양기','기관사 묵연','팔문장군 진괄','팔진노사 제갈현']");
await writeFile('scripts/boss-special-review.mjs',review);
for(const [before,after] of [['audit-hyeolma-special.mjs','audit-zhuge-special.mjs'],['verify-hyeolma-special-files.mjs','verify-zhuge-special-files.mjs'],['verify-hyeolma-special-draft.mjs','verify-zhuge-special-draft.mjs']]){
 let s=(await readFile('scripts/'+before,'utf8')).replaceAll('hyeolma','zhuge').replace('jeogu|yeonsal|sohong|jeokcheon','yanggi|mukyeon|jingwal|zhugehyeon').replace('dash|stance|fan|slam','sweep|stance|fan|dash');
 await writeFile('scripts/'+after,s);
}
await mkdir('docs/verification/zhuge-special-v1',{recursive:true});
const provenance=[];
for(const f of (await readdir(root)).filter(f=>f.endsWith('.generation.json'))){
 const r=JSON.parse(await readFile(root+'/'+f));
 const source=r.source || f.replace('.generation.json','.png');
 const promptFile=r.promptFile || source.replace('.png','.generation.prompt.txt');
 const png=await readFile(root+'/'+source);
 const meta=await sharp(png).metadata();
 provenance.push({...r,source,sourceSha256:hash(png),promptFile,promptSha256:hash(await readFile(root+'/'+promptFile)),width:meta.width,height:meta.height,hasAlpha:meta.hasAlpha});
}
await writeFile(root+'/provenance.json',JSON.stringify({date:'2026-10-07',note:'Actual image-generation outputs and used prompts; input preflight hashes separate.',records:provenance},null,2)+'\n');
console.log(JSON.stringify({provenance:provenance.length}));

