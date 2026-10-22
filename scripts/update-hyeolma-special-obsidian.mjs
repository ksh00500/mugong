import { readFile, writeFile, mkdir } from 'node:fs/promises';
const vault='C:/Users/user/Documents/AI-Memory/projects/murim-roguelike/murim-roguelike';
const root='docs/obsidian-sync/2026-10-07-hyeolma-special-v1/notes';
await mkdir(root,{recursive:true});
const names=['README.md','project-overview.md','current-status.md','decisions.md','art-and-assets.md','gameplay-systems.md','architecture.md','known-issues.md','backlog.md'];
const docs='file:///C:/Users/user/Documents/ChatGPT/MUGONG/docs/';
const scope='사용자 지정 혈마전을 진행했다. 적우·연살·소홍·적천4보스8패턴5시점 원화40장, 수정 시안18장을 생성했다. 기본 READY와 동일한 크기의6슬롯 기준판을 사용했다. 수정8시트19자세를 선택하고20WebP/240논리 프레임을 원본 RGBA1:1·최소32px 여백·고정0.225로 내보냈다. 로컬8방향 비교 시안이며 게임 등록·공개 배포 전이다. 적용된 특별 원화17보스34행동1,020프레임은 유지된다.';
const pending='연살 중복 권갑, 소홍 부채 손/소실, 적천 무기 손을 교정했다. 적우 뒷사선 시전은 양팔을 고정한 작은 무릎/고개 동작으로 선택했다. 240자동 발 좌표의 수동 확정, 전 자세 머리/관절 검토, 게임 등록·실제 접촉·Phaser Canvas/WebGL 검증은 남아 있다. 프레임별 맞춤 축소로 숨기지 않는다. 타입·분리 빌드·비교 UI144표본·입력 SHA120개 및로컬22파일/240프레임 보존 검사는 이번에 통과했다. 직접8판정 캡처와1093화면을 검토했으며 전 프레임 수동 승인으로 해석하지 않는다.';
const evidence=`[혈마전 범위](${docs}hyeolma-special-v1.md) · [이번 검사](${docs}verification/hyeolma-special-v1/README.md) · [선택 이력](${docs}source/hyeolma-special-v1/generation-status.json)`;
for(const name of names) {
 let s=await readFile(`${vault}/${name}`,'utf8');
 s=s.replaceAll('## 현재 작업 — 서역사막 특별 원화 검토','## 이전 작업 — 서역사막 특별 원화 검토').replaceAll('다음 미술 작업은 이 교정 목록부터다.','서역사막 적용 전 교정 목록으로 보존한다.');
 if(name==='README.md')s=s.replace('— 서역사막 생성/검토와 남은 미술 교정','— 혈마전·서역사막 생성/검토와 남은 적용 작업');
 if(name==='backlog.md')s=s.replace(/\| 혈마전·팔진고성\/제갈[^\n]+/, '| 혈마전 적우 → 연살 → 소홍 → 적천 | 40원화/240검토 프레임 생성. 발점·미술 검토 후 게임 등록 |\n| 팔진고성/제갈 | 기본 원화 완료, 특별 전용 원화 미착수 |');
 if(name==='art-and-assets.md')s=s.replace(/\| 혈마전[^\n]+/,'| 혈마전 | 일반3·보스4 기본 연결 | 특별4보스8패턴 원화40장/240검토 프레임, 발점 검토 전·게임 미적용 | docs/hyeolma-special-v1.md |');
 const front=s.indexOf('---',4)+3, heading=s.indexOf('\n# ',front), end=s.indexOf('\n',heading+1);
 if(end<0)throw Error('Heading missing '+name);
 s=s.slice(0,end)+`\n\n## 현재 작업 — 혈마전 특별 원화 검토\n\n2026-10-07. ${scope}\n\n${pending}\n\n${evidence}. 서역사막의 몸 크기·나야 두 번째 타격·접지 교정도 남아 있으며 이전 기록을 보존한다.\n\n`+s.slice(end);
 await writeFile(`${root}/${name}`,s);
}
const daily=await readFile(`${vault}/worklog-2026-10-07.md`,'utf8');
await writeFile(`${root}/worklog-2026-10-07.md`,daily+`\n\n## 혈마전 특별 원화 제작과 시안 검증\n\n${scope}\n\n${pending}\n\n${evidence}. 실제 사용자 저장은 변경하지 않았다. 배경 알파 불량·팔 중복·몸 확대가 남는 수정본은 미채택 시도로 보존한다. 생성 한도 실패는 이번에 없었으며 과거429와 구분한다.\n`);
console.log(JSON.stringify({prepared:10,scope:'hyeolma draft; preserve existing desert worklog'}));
