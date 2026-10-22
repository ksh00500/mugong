import { readFile, writeFile } from 'node:fs/promises';
const root = 'docs/source/zhuge-special-v1';
const status = JSON.parse(await readFile(`${root}/generation-status.json`));
const jobs = JSON.parse(await readFile(`${root}/generation-planned-jobs.json`));
for (const job of jobs) {
  for (const correction of status.selectedRepairs) {
    const offset = job.sources.findIndex(s => s.id === correction.id) * 6;
    if (offset < 0) continue;
    for (const pose of correction.poses) job.poseSources[offset + pose] = correction.source;
  }
}
await writeFile(`${root}/generation-draft-jobs.json`, JSON.stringify(jobs,null,2)+'\n');
for (const r of status.repairAttempts) await writeFile(`${root}/${r.source.replace('.png','.prompt.txt')}`,r.prompt+'\n');
const preflight = JSON.parse(await readFile(`${root}/preflight.json`));
preflight.status = status.mainSources+' generated main sheets, '+status.repairAttempts.length+' repair attempts, '+status.selectedCorrectionPoses+' selected draft correction poses; pending orientation/ownership/scale/feet; no game installation';
await writeFile(`${root}/preflight.json`, JSON.stringify(preflight,null,2)+'\n');
// Generate the established comparison screen with explicit draft status and direct pose selection.
let program = await readFile('scripts/boss-special-review.mjs','utf8');
program = program.replace('<main><h1>${title} 보스 특별 모션</h1>', '<main><h1>${title} 보스 특별 원화 · 두 번째 교정</h1><p>2026-10-08 원화 검토 시안입니다. 특별 모션 앞사선 방향·무기 연결을 교정했습니다. 왼쪽은 기존 기본 그림, 오른쪽은 수정 특별 그림입니다. 미완료: 기존 기본 앞사선 방향, 일부 몸 치수·손 배치와 발 좌표. 같은 배율로 비교하며 자세별 맞춤 축소는 하지 않습니다. 게임 미적용.</p>');
program = program.replace('<button id="pause">', '<label>자세 <select id="pose"><option value="auto">시간에 따라 재생</option><option value="0">1 · 준비</option><option value="1">2 · 힘 싣기</option><option value="2">3 · 판정</option><option value="3">4 · 후속</option><option value="4">5 · 회수</option><option value="5">6 · 대기</option></select></label><button id="pause">');
program = program.replace('발 접지점과 HP바 기준은 고정됩니다.', '발 접지점은 자동 제안이며 적용 전 검토가 필요합니다. HP바 높이는 기본·특별 전체 그림을 포함합니다.');
program = program.replace('const motion=clock(m,action,p,t,hold.checked&&t.holdEligible);', "let motion=clock(m,action,p,t,hold.checked&&t.holdEligible);const override=document.querySelector('#pose').value;if(override!=='auto')motion={...motion,pose:+override,phase:['prepare','load','contact','follow','return','ready'][+override],contact:-1};");
program = program.replace("document.querySelector('#next').onclick=()=>{running=false;pauseLabel();time+=.06}", "document.querySelector('#next').onclick=()=>{running=false;pauseLabel();const p=document.querySelector('#pose');p.value=String((p.value==='auto'?0:+p.value+1)%6)}");
await writeFile('scripts/zhuge-special-draft-review-generated.mjs',program);
console.log(JSON.stringify({jobs:jobs.length,selectedCorrectionPoses:status.selectedRepairs.reduce((n,r)=>n+r.poses.length,0)}));

