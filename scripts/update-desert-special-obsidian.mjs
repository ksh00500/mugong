import { readFile, writeFile, mkdir } from 'node:fs/promises';
const vault='C:/Users/user/Documents/AI-Memory/projects/murim-roguelike/murim-roguelike';
const root='docs/obsidian-sync/2026-10-07-desert-special-v1/notes';
await mkdir(root,{recursive:true});
const names=['README.md','project-overview.md','current-status.md','decisions.md','art-and-assets.md','gameplay-systems.md','architecture.md','known-issues.md','backlog.md'];
const docs='file:///C:/Users/user/Documents/ChatGPT/MUGONG/docs/';
const evidence=`[서역사막 제작](${docs}desert-special-v1.md) · [이번 검토 검사](${docs}verification/desert-special-v1/README.md) · [생성/선택 이력](${docs}source/desert-special-v1/generation-status.json)`;
const scope='사용자 지정으로 서역사막을 우선했다. 아사르·나야·발타·아르칸 4보스8패턴/5시점 원화40장을 내장 imagegen으로 생성했다. 수정 시안10장 중5개 시트6자세를 선택하고20개 검토 WebP/240논리 프레임을 RGBA1:1·최소32px 여백으로 내보냈다. 로컬 8방향 비교 화면을 제공하지만 게임 등록·공개 배포는 하지 않았다. 적용된 특별 원화 합계17보스34행동1,020프레임은 그대로다.';
const pending='같은 배율의 직접 캡처에서 새 원화의 몸체가 기본보다 큰 것을 확인했다. 머리/몸 크기·240개 자동 발점·나야 앞사선 팔/몸 회전 및 뒷사선 힘 싣기를 추가 교정/검토해야 한다. 나야 연환격의 왼손 두 번째 전용 접촉은 미작성이다. 프레임별 맞춤 축소로 숨기지 않는다. 이번 타입/분리 빌드와 검토 UI144표본은 통과했으나 실제 전투·피해·Phaser Canvas/WebGL·저장/공개 배포 검사는 실행하지 않았다.';
for(const name of names){
 let s=await readFile(`${vault}/${name}`,'utf8');
 s=s.replace("as_of: '2026-10-06'","as_of: '2026-10-07'");
 // Retain earlier production evidence and daily log, but qualify old priorities as historical.
 s=s.replaceAll('현재 우선 지역은 **고묘**','2026-10-06 당시 우선 지역은 **고묘**').replaceAll('현재 우선은 고묘','2026-10-06 당시 우선은 고묘').replaceAll('현재 다음은 **고묘 적호**','2026-10-06 당시 다음은 **고묘 적호**');
 if(name==='README.md')s=s.replace('2026-10-06 갱신.','2026-10-07 갱신.').replace('- [[worklog-2026-10-06]]','- [[worklog-2026-10-07]] — 서역사막 생성/검토와 남은 미술 교정\n- [[worklog-2026-10-06]]');
 if(name==='art-and-assets.md')s=s.replace(/\| 서역사막[^\n]+/,'| 서역사막 | 일반3·보스4 연결 | 4보스8패턴 원화40장/240검토 프레임, 크기/접지 교정 필요·게임 미적용 | docs/desert-special-v1.md |');
 if(name==='backlog.md'){
  s=s.replace('| 고묘 적호','| 서역사막 아사르 → 나야 → 발타 → 아르칸 | 원화40장/검토240프레임. 몸 크기·손/접지 교정 후 게임 연결 |\n| 고묘 적호');
  s=s.replaceAll('서역사막·혈마전·팔진고성/제갈','혈마전·팔진고성/제갈');
 }
 const front=s.indexOf('---',4)+3,heading=s.indexOf('\n# ',front),end=s.indexOf('\n',heading+1);
 if(end<0)throw Error(name+' heading missing');
 s=s.slice(0,end)+`\n\n## 현재 작업 — 서역사막 특별 원화 검토\n\n2026-10-07. ${scope}\n\n${pending}\n\n${evidence}. 다음 미술 작업은 이 교정 목록부터다. 고묘·죽림·설산 미완성 제작 입력과10월6일429기록은 보존하며 현재 생성 한도 실패로 해석하지 않는다.\n\n`+s.slice(end);
 await writeFile(`${root}/${name}`,s);
}
await writeFile(`${root}/worklog-2026-10-07.md`,`---\ntitle: worklog-2026-10-07\ntype: note\npermalink: murim-roguelike/worklog-2026-10-07\nas_of: '2026-10-07'\nsource: desert-special-art-and-draft-verification\nrepository: MUGONG\ntags: [mugong, project-context]\n---\n\n# 2026-10-07 작업 기록\n\n${scope}\n\n${pending}\n\n${evidence}.\n\n원본40장·수정10장·첫 경계 불량1장을 보존했다. 흐릿한 미리보기 배경은 alpha0 RGB임을 확인했고 실제 캔버스에서는 표시되지 않았다. 생성 시도 결과와 선택 여부를 구분한다. 실제 사용자 저장과 기존 게임 등록은 변경하지 않았다.\n\n[[current-status]] · [[art-and-assets]] · [[known-issues]] · [[backlog]] · [[worklog-2026-10-06]].\n`);
console.log(JSON.stringify({prepared:10,date:'2026-10-07',scope:'draft only'}));
