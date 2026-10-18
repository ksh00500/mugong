import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = 'docs/source/snow-special-v1';
const plan = JSON.parse(await readFile(root + '/resume-v2/manifest.json'));
const pending = JSON.parse(await readFile(root + '/pending.json'));
pending.lastRetry = {
  timeUtc: '2026-10-06T14:03:29Z',
  result: 'usage_limit_reached',
  status: 429,
  resetUnixSeconds: 1791299393,
  resetTimeKst: '2026-10-07 00:09:53',
  newlyGenerated: 0,
  newlyInstalled: 0,
  preparedSources: plan.sources.length,
  preparedMoves: plan.moves.length,
};
await writeFile(root + '/pending.json', JSON.stringify(pending, null, 2) + '\n');
const title = '설산 세 보스 일괄 진행 재시도';
const content =
  '2026-10-06 23:03 KST 재시도에서 내장 imagegen이 사용량 한도429를 반환했다. 도구 안내 초기화 시각은 **2026-10-07 00:09:53 KST**이며 이후 생성 성공을 확인한 결과는 아니다. 이번 새 원화0개·게임 적용0개다. 목진2행동/60프레임만 적용된 상태를 유지한다.\n\n남은 설란·백설노괴·한설의6패턴/15시점/30원화 프롬프트를 실제 kit와 대조했다. 구슬·맨손·부채 프롬프트에 섞인 창끝/봉 손잡이 지시를 제거한 별도 resume-v2를 만들었다. 기존 생성 입력과 선택 manifest는 보존했다. 설란 시안의 뷰어상 파란 테두리/몸 크기는 미술 재검토 항목이며 적용하지 않았다. 이번에는 소스 준비 스크립트만 실행했으며 게임 빌드·브라우저 검사를 다시 실행하지 않았다. 이전 목진의1293단위/12브라우저 결과는 그대로 이전 실행 기록이다.';
const url =
  'file:///C:/Users/user/Documents/ChatGPT/MUGONG/docs/source/snow-special-v1/resume-v2/README.md';
const notes = 'docs/obsidian-sync/2026-10-06-snow-special-resume-v2/notes';
for (const name of await readdir(notes)) {
  const path = notes + '/' + name;
  let text = await readFile(path, 'utf8');
  if (text.includes('## ' + title)) throw Error('Resume record already appended');
  if (name === 'current-status.md')
    text = text.replace('## 가장 최근 검증', '## 가장 최근 게임 검증 — 이전 목진 적용 실행');
  if (name === 'backlog.md')
    text = text.replace(
      '목진 완료, 나머지3보스6행동의30원화는 생성 사용량 한도로 미완성',
      '목진 완료, 나머지3보스6행동/30원화의 수정 프롬프트 준비. 23:03 재시도429로 미생성',
    );
  const detail = [
    'current-status.md',
    'backlog.md',
    'known-issues.md',
    'art-and-assets.md',
    'worklog-2026-10-06.md',
  ].includes(name)
    ? content
    : '설산 남은3보스/6패턴을 일괄 진행하도록 확정했다. 23:03 KST 내장 imagegen 재시도429로 새 원화·게임 적용은0개다. 장비별 프롬프트30개와 실제 타이밍을 별도 재개 묶음으로 정리했다. 완료 범위는 목진2행동/60프레임이며 다음은 설란이다.';
  await writeFile(
    path,
    text + '\n\n## ' + title + '\n\n' + detail + `\n\n[준비 내용·재개 기준](${url}).\n`,
  );
}
const doc = 'docs/snow-special-v1.md';
const prior = await readFile(doc, 'utf8');
if (!prior.includes('## ' + title))
  await writeFile(
    doc,
    prior +
      '\n\n## ' +
      title +
      '\n\n' +
      content +
      '\n\n[남은30원화의 수정 프롬프트·실제 타이밍](source/snow-special-v1/resume-v2/README.md).\n',
  );
console.log(
  JSON.stringify({
    generationAttempt: 1,
    status: 429,
    preparedSources: plan.sources.length,
    selectedManifestPreserved:
      plan.selectedManifestSha256 ===
      createHash('sha256')
        .update(await readFile(root + '/generation-jobs.json'))
        .digest('hex'),
    newGameAssets: 0,
  }),
);
