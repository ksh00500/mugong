import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = 'docs/source/bamboo-special-v1';
const plan = JSON.parse(await readFile(root + '/preflight.json'));
const names = {
  qingbi: '죽엽살수 청비',
  nogae: '취봉객 노개',
  yanqing: '청죽검객 연청',
  songwol: '죽림은사 송월',
};
const hash = (b) => createHash('sha256').update(b).digest('hex');
for (const r of plan.promptRecords) {
  if (
    hash(await readFile(r.prompt)) !== r.promptSha256 ||
    hash(await readFile(r.reference)) !== r.referenceSha256
  )
    throw Error('Prepared input changed: ' + r.id);
}
const attempt = {
  date: '2026-10-06',
  tool: 'built-in imagegen',
  attemptedSource: 'qingbi-front-ring',
  result: 'usage_limit_reached',
  httpStatus: 429,
  resetUnixSeconds: 1791299394,
  resetTimeKst: '2026-10-07 00:09:54',
  preparedBosses: 4,
  preparedMoves: 8,
  preparedReferences: 20,
  preparedPrompts: 40,
  inputHashChecks: 80,
  generatedSources: 0,
  installedFrames: 0,
  gameBuildRerun: false,
  gameBrowserTestsRerun: false,
  publicDeploymentPerformed: false,
  realUserSaveChanged: false,
};
await writeFile(root + '/generation-attempt.json', JSON.stringify(attempt, null, 2) + '\n');
const scope =
  '사용자 명시 지시로 현재 우선 지역을 **죽림**으로 바꿨다. 청비→노개→연청→송월의4보스8패턴을 준비했다. 첫 청비 정면 귀환 단도를 내장 imagegen으로 요청했으나 사용량 한도429로 새 원화0개·게임 적용0개다. 지역을 바꿔도 이번 생성 제한은 동일했다. 도구 안내 초기화는2026-10-07 00:09:54 KST이며 이후 성공 여부는 다시 확인해야 한다. 설산 미완성3보스는 대기 목록에 보존한다.';
const doc =
  '# 죽림 보스 특별 모션 — 제작 준비\n\n2026-10-06. ' +
  scope +
  '\n\n| 보스 | 특별 모션 | 준비/공격/회수 초 | 접촉 초 |\n|---|---|---|---|\n' +
  plan.timings
    .map(
      (t) =>
        `| ${names[t.character]} | ${t.name} | ${t.windup}/${t.duration}/${t.recovery} | ${t.contacts.join('/')} |`,
    )
    .join('\n') +
  '\n\n모두 실제 boss kit와 대조했다. stance라는 키도 이번4행동에서는 장기 방어 유지가 아닌 발동 모션이다. 청비 귀환 단도는 원래 LEFT 단도를 놓고 RIGHT 암기를 유지하며, 노개는 양손으로 한 대나무 봉의 분리된 잡기 위치를 지킨다. 연청은 높은 준비에서 아래/앞으로 베고 송월은 RIGHT 부채의 뿌리에 손을 고정한다. 연막·낙죽·반사벽·투사체는 게임에서 별도로 그린다.\n\n생성 기준20PNG는 현재 기본 READY의 보이는 구성 픽셀을 네이티브 크기로 잘라32px 투명 패딩을 추가했다. 40프롬프트는 각 시점·패턴의6노출/2열3행/넓은 셀·고정 해부학적 크기·투명 경계·관절과 장비 소유권을 명시한다. 생성 완료 결과가 아니라 준비 입력이다.\n\n## 이번 확인\n\n준비 스크립트 실행과40프롬프트/20기준 이미지 해시 확인만 수행했다(총80입력 해시 확인). 새 원화가 없으므로 원화의 관절/크기 품질을 검증하거나 게임 빌드·브라우저 검사를 새로 실행했다고 하지 않는다. 이전 목진의1293단위/12브라우저 결과와 구분한다. 현재 특별 원화 연결은17보스34행동이며 죽림은 기본 원화만 연결된 상태다. 실제 사용자 저장·공개 서버 변경은 없다.\n\n## 재개\n\n내장 imagegen에 정확한 프롬프트와 해당 reference를 전달 → 원본을 프로젝트에 보존 → 인물 경계·장비/손·모든 방향·몸 크기·관절·발을 검토 → 승인된 파일만 선택 manifest에 등록 → 원본 RGBA1:1/출력32px 이상 여백과 직접 검토한 발 좌표로 내보내기 → 실제 접촉/후속/회수 연결 → Canvas/WebGL/움직임 감소/지역 전환/세 화면 크기 검사 → 직접 캡처 검토·옵시디언 갱신.\n\n- [내장 imagegen 입력 프롬프트와 기준](source/bamboo-special-v1/promptset.md)\n- [실제 타이밍·입력 해시](source/bamboo-special-v1/preflight.json)\n- [이번 생성 시도 결과](source/bamboo-special-v1/generation-attempt.json)\n';
await writeFile('docs/bamboo-special-v1.md', doc);
await writeFile(
  root + '/README.md',
  '# 죽림 특별 모션 제작 입력\n\n준비만 완료. 내장 imagegen 사용량 한도429로 생성·게임 적용0개.\n\n[프롬프트40개/기준20장](promptset.md) · [준비 manifest](generation-planned-jobs.json) · [타이밍/해시](preflight.json) · [생성 시도](generation-attempt.json) · [적용 범위와 재개](../../bamboo-special-v1.md).\n',
);
const bundle = 'docs/obsidian-sync/2026-10-06-bamboo-special-v1';
const evidence =
  '[죽림 제작 준비](file:///C:/Users/user/Documents/ChatGPT/MUGONG/docs/bamboo-special-v1.md)';
for (const file of await readdir(bundle + '/notes')) {
  const path = bundle + '/notes/' + file;
  let text = await readFile(path, 'utf8');
  if (text.includes('## 죽림 우선 진행 — 생성 대기')) throw Error('Already recorded');
  if (file === 'backlog.md') {
    text = text.replace(
      /\| 설산 설란[^\n]+/,
      (row) =>
        '| 죽림 청비 → 노개 → 연청 → 송월 | 4보스8패턴/40프롬프트 준비. 첫 생성429로 원화·적용0개 |\n' +
        row,
    );
    text = text.replace(
      /\| 죽림·고묘[^\n]+/,
      '| 고묘·서역사막·혈마전·팔진고성/제갈 | 기본 원화 완료, 특별 전용 원화 미착수 |',
    );
    text = text.replace(
      '현재 다음은 **설산 설란**이다.',
      '사용자 지정에 따라 현재 다음은 **죽림 청비**다. 설산 남은3보스는 대기한다.',
    );
  }
  if (file === 'decisions.md')
    text = text.replace(
      '현재 미완성 맨 위는 설산 설란이다.',
      '현재 우선은 사용자 지정 죽림 청비다. 설산 설란은 대기 목록에 보존한다.',
    );
  if (file === 'current-status.md')
    text = text.replace(
      '설산 나머지3보스, 미착수5지역과 완료4지역의 미전용 행동을 구분한다.',
      '현재 우선은 죽림4보스8패턴이다. 제작 입력 준비 후 첫 생성429로 미적용이다. 설산 나머지3보스, 다른4지역과 완료4지역의 미전용 행동은 남아 있다.',
    );
  if (file === 'art-and-assets.md')
    text = text.replace(
      /\| 죽림[^\n]+/,
      '| 죽림 | 일반3·보스4 기본 연결 | 4보스8패턴/40입력 준비, 생성429/특별 미적용 | docs/bamboo-special-v1.md |',
    );
  text +=
    '\n\n## 죽림 우선 진행 — 생성 대기\n\n' +
    scope +
    '\n\n40프롬프트/20기준을 준비하고80입력 해시를 확인했다. 새 게임 빌드·브라우저 검사는 실행하지 않았다. 이전 완료17보스34행동은 그대로다.\n\n' +
    evidence +
    '.\n';
  await writeFile(path, text);
}
console.log(JSON.stringify(attempt));
