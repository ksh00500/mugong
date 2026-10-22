import { readFile, writeFile, mkdir } from 'node:fs/promises';
const repoRoot='docs/source/zhuge-special-v1';
const status=JSON.parse(await readFile(repoRoot+'/generation-status.json'));
status.pending[0]='Mukyeon, Jingwal and Zhugehyeon basic front-right references visibly face screen-left despite southeast view label; Yanggi faces screen-right. Reconcile base/special orientation together, never per-pose flip.';
status.pending.splice(5,0,'Yanggi right stance body appears larger than basic READY in direct comparison; preserve native pixels but correct source proportions before install.');
for(const r of status.repairAttempts){const selected=status.selectedRepairs.filter(x=>x.source===r.source);r.acceptedAsDraftPoses=selected.flatMap(x=>x.poses);r.finalApproved=false;}
await writeFile(repoRoot+'/generation-status.json',JSON.stringify(status,null,2)+'\n');
let prompts=await readFile(repoRoot+'/promptset.md','utf8');
prompts=prompts.replace('내장 imagegen 제작 예정. 아직 생성·게임 적용은 하지 않았다. 단일 READY 기준20장, 4보스×2패턴×5시점의40프롬프트.','내장 imagegen 본 원화40장·교정28장 생성. 선택17시트38자세를 포함한 20WebP/240논리 프레임 로컬 검토 시안이다. 게임 미적용. 방향·손 배치·몸 치수·발점 미완료는 generation-status.json에 기록한다. 아래는 계획 입력이며 실제 사용 프롬프트/해시는 provenance.json을 따른다.');
await writeFile(repoRoot+'/promptset.md',prompts);
const vault='C:/Users/user/Documents/AI-Memory/projects/murim-roguelike/murim-roguelike';
const root='docs/obsidian-sync/2026-10-07-zhuge-special-v1/notes';
await mkdir(root,{recursive:true});
const names=['README.md','project-overview.md','current-status.md','decisions.md','art-and-assets.md','gameplay-systems.md','architecture.md','known-issues.md','backlog.md'];
const docs='file:///C:/Users/user/Documents/ChatGPT/MUGONG/docs/';
const scope='사용자 지정 팔진고성을 진행했다. 양기·묵연·진괄·제갈현4보스8패턴5시점 본 원화40장·수정 시안28장을 생성했다. 기본 READY 네이티브 기준판을 입력하고17수정시트38자세를 선택해20WebP/240논리 프레임을 원본 RGBA1:1·최소32px 패딩·고정0.225로 내보냈다. 로컬 비교 시안이며 게임 등록·공개 배포 전이다. 기존 게임 특별 원화17보스34행동1,020프레임은 유지된다.';
const pending='진괄 창 방향/잘림·중복 봉/창 자루·묵연 정면 쇠뇌·제갈현 측면 판정의 부채 연결을 개선했다. 묵연·진괄·제갈현의 기존 앞사선 READY 방향 불일치, 양기 측면 시전 몸 확대, 일부 시전/부채의 무기 손 소유 문제,240자동 발점 수동 확정이 남는다. 교정본 선택을 완성 승인으로 기록하지 않는다. 지역18실제 행동 중 이번 전용 그림은8개이고 나머지10개는 기본 그림을 사용한다. 타입·분리 빌드·UI144표본·입력SHA120개·로컬22파일·240원본 픽셀/패딩 검사는 통과했다.8판정 캡처와1093화면을 직접 검토했다. 실제 게임/Canvas/WebGL 검사는 이번 범위가 아니다.';
const evidence='[팔진고성 범위]('+docs+'zhuge-special-v1.md) · [이번 검사]('+docs+'verification/zhuge-special-v1/README.md) · [선택/미완료]('+docs+'source/zhuge-special-v1/generation-status.json)';
for(const name of names){
 let s=await readFile(vault+'/'+name,'utf8');
 s=s.replaceAll('## 현재 작업 — 혈마전 특별 원화 검토','## 이전 작업 — 혈마전 특별 원화 검토');
 if(name==='README.md')s=s.replace('— 혈마전·서역사막 생성/검토와 남은 적용 작업','— 팔진고성·혈마전·서역사막 생성/검토와 남은 적용 작업');
 if(name==='backlog.md')s=s.replace(/\| 팔진고성\/제갈[^\n]+/,'| 팔진고성/제갈 | 40원화/28교정/240검토 프레임 생성. 방향·손·몸 치수·발점 교정 후 게임 등록 |');
 if(name==='art-and-assets.md')s=s.replace(/\| 팔진고성[^\n]+/,'| 팔진고성 | 일반3·보스4 기본 연결 | 특별4보스8패턴/240시안, 방향·손·몸 크기·발점 미완료·게임 미적용 | docs/zhuge-special-v1.md |');
 const front=s.indexOf('---',4)+3,heading=s.indexOf('\n# ',front),end=s.indexOf('\n',heading+1);
 if(end<0)throw Error('Heading missing '+name);
 s=s.slice(0,end)+'\n\n## 현재 작업 — 팔진고성 특별 원화 검토\n\n2026-10-07. '+scope+'\n\n'+pending+'\n\n'+evidence+'. 혈마전·서역사막 적용 전 교정과 이전 당일 기록을 보존한다.\n\n'+s.slice(end);
 await writeFile(root+'/'+name,s);
}
const daily=await readFile(vault+'/worklog-2026-10-07.md','utf8');
await writeFile(root+'/worklog-2026-10-07.md',daily+'\n\n## 팔진고성 특별 원화 제작과 시안 검증\n\n'+scope+'\n\n'+pending+'\n\n'+evidence+'. 실제 사용자 저장은 변경하지 않았다. 기본 앞사선 방향과 일부 손 소유가 고쳐지지 않은 수정본을 반복 생성했으나 완료로 처리하지 않았다. 초기 미채택 파일럿1장을 별도 보존한다.\n');
console.log(JSON.stringify({prepared:10,scope:'zhuge draft, pending art fixes, preserve previous work'}));

