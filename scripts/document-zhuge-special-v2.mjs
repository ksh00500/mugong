import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
const root='docs/source/zhuge-special-v1',proof='docs/verification/zhuge-special-v2';
const status=JSON.parse(await readFile(root+'/generation-status.json'));
status.pending[1]='Yanggi side body size improved. Mukyeon rear-right command and new front-right Mukyeon/Jingwal/Zhugehyeon bodies still appear larger than BASIC ready at identical scale; source proportions and all skull dimensions need review, never per-pose fitting.';
await writeFile(root+'/generation-status.json',JSON.stringify(status,null,2)+'\n');
const summary='2026-10-08. 제갈/팔진고성 양기·묵연·진괄·제갈현의 특별 원화를 이어서 교정했다. 새 교정 시트14장 중12시트67자세를 로컬 시안에 선택했다. 기존 선택과 겹치는 자세를 제외한 누적 교정 자세는91개다. 전체 특별 검토 출력은 계속20WebP/240논리 프레임이며 게임 미등록이다.';
const changes='양기 측면 봉 지지와 빈손 명령, 진괄 후면 창 지지와 명령 팔 연결, 제갈현 뒷사선 시전 팔을 다듬었다. 묵연·진괄·제갈현 특별 앞사선은 대기 포함 여섯 자세의 방향을 오른쪽으로 맞췄다. 제갈현 앞사선 부채 판정/후속에서 무기가 반대 손으로 넘어가는 v3는 미채택하고, 가까운 팔이 가슴 앞을 가로지르는 v4를 선택했다. 묵연 뒷사선 v4는 판정 팔이 다시 바뀌어 미채택했다.';
const pending='기존 기본 이동/공격의 앞사선 방향, 일부 확대된 몸·머리 치수, 진괄 측면 시전의 계획과 반대인 손 소유, 제갈현 뒷사선 부채 힘 싣기 전환,240자동 발 좌표의 수동 확정이 남는다. 같은 배율 비교에서 일부 몸 확대를 직접 확인해 게임 등록을 완료로 기록하지 않았다. 지역18실제 행동 중 전용 그림은8개이며10개는 기본 그림을 사용한다.';
const tests='이번 타입 검사와 분리 빌드(184모듈/20.14초), 독립 브라우저144표본(1440×900·1366×768·1093×614), 입력SHA120개와 새교정 이미지/프롬프트28해시, public/dist22파일 일치,240프레임 원본 픽셀/32px패딩 검사를 통과했다. 판정8캡처와1093화면을 직접 비교했다.1800kB 초과 번들 경고는 남는다. 실제 게임 전투·Phaser Canvas/WebGL·공개 배포 검사는 이번에 실행하지 않았다.';
let main=await readFile('docs/zhuge-special-v1.md','utf8');
const titleEnd=main.indexOf('\n');
main=main.slice(0,titleEnd)+'\n\n## 최신 교정 — 2026-10-08\n\n'+summary+'\n\n'+changes+'\n\n'+pending+'\n\n'+tests+'\n\n[두 번째 교정 검증](verification/zhuge-special-v2/README.md) · [새 교정 프롬프트/해시](source/zhuge-special-v1/correction-v2/provenance.json) · [로컬 비교](http://127.0.0.1:5173/art/zhuge-special-v1/review.html).\n\n## 이전 제작 — 2026-10-07\n'+main.slice(titleEnd);
await writeFile('docs/zhuge-special-v1.md',main);
await writeFile(proof+'/README.md','# 제갈 특별 원화 두 번째 교정 검증\n\n'+summary+'\n\n'+tests+'\n\n자동 결과: [브라우저](browser-results.json), [입력·출력 파일](file-integrity.json). 원본 픽셀/여백 검사는 관절·신체 치수의 승인이 아니다.\n\n직접 시각 검토: 여덟 판정 캡처에서 오른쪽 특별 앞사선 방향, 부채 손 연결과 기본 대비 몸 치수를 비교했다. 양기 측면 크기는 가까워졌으나 일부 새 앞사선과 묵연 뒷사선은 확대가 남았다.1093 화면의 보스·패턴·자세·재생·다음 프레임은 화면 안에 보인다.240자세 전체 수동 승인은 하지 않았다.\n\n'+pending+'\n');
const fixes=JSON.parse(await readFile(root+'/correction-v2/generation-records.json'));
await writeFile(root+'/correction-v2/README.md','# 제갈 특별 원화 두 번째 교정\n\n'+summary+'\n\n내장 imagegen. 기준판8장은 기본 READY를 원본 크기로 복사해 만든1086×1448의 두 열·세 행 안내판이다. 추출은 RGBA1:1 복사이며 창·부채 끝까지 연결 성분을 회수한다. 원화에 맞춤 축소·창작 보정 필터를 적용하지 않았다.\n\n'+changes+'\n\n'+pending+'\n\n[생성 입력과 미채택 이유](generation-records.json) · [원본 위치·프롬프트·실제 크기·SHA](provenance.json).\n\n'+fixes.map(r=>'- ['+r.source.split('/').pop()+']('+r.source.split('/').pop()+') · [prompt]('+r.promptFile.split('/').pop()+') · 선택 '+r.acceptedAsDraftPoses.join(',')).join('\n')+'\n');
let prompts=await readFile(root+'/promptset.md','utf8');
await writeFile(root+'/promptset.md','2026-10-08 추가 교정14장: [실제 사용 프롬프트와 선택 이력](correction-v2/README.md). 현재 본원화40장/교정42장, 로컬240프레임 시안. 게임 미적용.\n\n'+prompts);
let source=await readFile(root+'/README.md','utf8');
await writeFile(root+'/README.md','2026-10-08 후속: [두 번째 교정14장](correction-v2/README.md), 누적 교정42장. 현재 선택한 서로 다른 교정 자세91개. 이전10월7일 기록과 원화는 보존한다.\n\n'+source);
await writeFile(proof+'/checks.json',JSON.stringify({date:'2026-10-08',typecheckExit:0,buildExit:0,buildModules:184,buildSeconds:20.14,buildOutput:'dist-validation-zhuge-special-v2',browserSamples:144,gameInstalled:false,publicDeployment:false,visualContactScreensReviewed:8,smallScreenReviewed:true,manualAllPoseApproval:false},null,2)+'\n');
// Preserve existing project notes; prepare a separate, conflict-checked bundle.
const vault='C:/Users/user/Documents/AI-Memory/projects/murim-roguelike/murim-roguelike';
const dest='docs/obsidian-sync/2026-10-08-zhuge-special-v2/notes';await mkdir(dest,{recursive:true});
const names=['README.md','project-overview.md','current-status.md','decisions.md','art-and-assets.md','gameplay-systems.md','architecture.md','known-issues.md','backlog.md'];
const refs='[제갈 교정](file:///C:/Users/user/Documents/ChatGPT/MUGONG/docs/zhuge-special-v1.md) · [이번 검사](file:///C:/Users/user/Documents/ChatGPT/MUGONG/docs/verification/zhuge-special-v2/README.md) · [선택/미완료](file:///C:/Users/user/Documents/ChatGPT/MUGONG/docs/source/zhuge-special-v1/generation-status.json)';
for(const name of names){
 let s=await readFile(vault+'/'+name,'utf8');
 s=s.replace(/^as_of:.*$/m,"as_of: '2026-10-08'");
 s=s.replace('## 현재 작업 — 팔진고성 특별 원화 검토','## 이전 작업 — 팔진고성 특별 원화 검토');
 const start=s.indexOf('\n# '),end=s.indexOf('\n',start+1);if(start<0||end<0)throw Error('Missing heading '+name);
 s=s.slice(0,end)+'\n\n## 현재 작업 — 제갈 특별 원화 두 번째 교정\n\n'+summary+'\n\n'+changes+'\n\n'+pending+'\n\n'+tests+'\n\n'+refs+'. 이전 혈마전·서역사막 기록과 미완료 항목을 보존한다.\n\n'+s.slice(end);
 if(name==='backlog.md')s=s.replace(/\| 팔진고성\/제갈[^\n]+/,'| 팔진고성/제갈 | 본40장·교정42장/240검토 프레임. 특별 앞사선·무기 연결 교정, 기본 방향·몸 치수·발점 미완료·게임 미적용 |');
 await writeFile(dest+'/'+name,s);
}
let daily='';
try{daily=await readFile(vault+'/worklog-2026-10-08.md','utf8')}catch{daily="---\ntitle: 2026-10-08 작업 기록\ntype: note\npermalink: murim-roguelike/worklog-2026-10-08\nas_of: '2026-10-08'\nsource: repository-and-verification-audit\nrepository: MUGONG\ntags: [mugong, project-context]\n---\n\n# 2026-10-08 작업 기록\n";}
await writeFile(dest+'/worklog-2026-10-08.md',daily+'\n\n## 제갈/팔진고성 후속 교정\n\n'+summary+'\n\n'+changes+'\n\n'+pending+'\n\n'+tests+'\n\n'+refs+'. 실제 사용자 저장은 변경하지 않았다.\n');
console.log(JSON.stringify({preparedNotes:10,newCorrectionSheets:14,selectedNewPoseCount:67,uniqueTotalCorrectionPoses:91}));

