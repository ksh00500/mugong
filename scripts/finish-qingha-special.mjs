import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const proof = 'docs/verification/qingha-special-v1';
const json = async (p) => JSON.parse(await readFile(p, 'utf8'));
const unit = await json(proof + '/unit-results.json');
const source = await json(proof + '/source-browser-results.json');
const production = await json(proof + '/production-browser-results.json');
if (
  !unit.success ||
  unit.numPassedTests !== unit.numTotalTests ||
  source.stats.unexpected ||
  source.stats.expected !== 9 ||
  production.stats.unexpected ||
  production.stats.expected !== 3
)
  throw Error('Final checks did not pass');
let count = 0,
  contacts = 0,
  basic = 0,
  basicContacts = 0;
for (const mode of ['canvas-full', 'canvas-reduced', 'webgl-full', 'webgl-reduced']) {
  const r = await json(proof + '/' + mode + '.json');
  count += r.count;
  contacts += r.contacts.length;
  const b = await json(proof + '/base-regression/' + mode + '.json');
  basic += b.records.length;
  basicContacts += b.contacts.length;
}
const hash = (b) => createHash('sha256').update(b).digest('hex');
const textures = (await readdir('public/art/qingha-special-v1')).filter((f) => f.endsWith('.webp'));
let identical = true;
for (const file of textures)
  identical &&=
    hash(await readFile('public/art/qingha-special-v1/' + file)) ===
    hash(await readFile('dist/art/qingha-special-v1/' + file));
if (!identical || textures.length !== 20) throw Error('Dist texture mismatch');
const records = await json('docs/source/qingha-special-v1/generation-records.json');
for (const r of records)
  if (hash(await readFile(r.original)) !== hash(await readFile(r.source)))
    throw Error('Original copy mismatch: ' + r.id);
const run = {
  date: '2026-10-06',
  deployment: 'local production preview at 127.0.0.1:5173',
  unit: { total: unit.numTotalTests, passed: unit.numPassedTests, failed: unit.numFailedTests },
  build: { command: 'npm run build', typecheck: 'passed', vite: 'passed', modules: 183 },
  sourceBrowser: {
    passed: source.stats.expected,
    failed: source.stats.unexpected,
    port: 5182,
    output: 'playwright-source',
    elapsedMinutes: source.stats.duration / 60000,
  },
  productionBrowser: {
    passed: production.stats.expected,
    failed: production.stats.unexpected,
    port: 5173,
    output: 'playwright-production',
    elapsedMinutes: production.stats.duration / 60000,
  },
  originals: records.length,
  revisedOriginals: records.filter((r) => r.revision).length,
  nativeFrames: 240,
  independentUsedSourceFigures: 239,
  textures: 20,
  specialTimeSamples: count - contacts,
  specialContactSamples: contacts,
  basicTimeSamples: basic,
  basicContactSamples: basicContacts,
  originalCopiesIdentical: true,
  distTexturesIdentical: identical,
  userSaveModified: false,
};
await writeFile(proof + '/run-record.json', JSON.stringify(run, null, 2) + '\n');
const doc = `# 청하현 특별 모션 검증

2026-10-06. 보스4명·전용8행동·5원화 시점/8표시 방향·240논리 프레임. 노진 뒷모습 호위 회수1노출의 올바른 자세 재사용을 포함해239개 독립 사용 그림이다. 청하현 실제20행동 중12행동은 기존 기본 원화를 유지한다.

## 자동 검사

- 타입 검사·프로덕션 빌드 통과(183모듈). 전체 단위 ${unit.numPassedTests}개 통과: [결과](unit-results.json).
- 소스 브라우저9검사 통과: 특별 모션 Canvas/WebGL × 일반/움직임 감소4, 기본7인 회귀4, 소림→청하현 지역 전환1. 특별 시간 표본${count - contacts}개·접촉${contacts}개, 기본 상태${basic}개·접촉${basicContacts}개. 실제 Phaser 프레임 이름·잘라낸 사각형·8방향/반전·0.225배율·HP바 고정/7px 이상 간격·피격 중 공격 유지·저장 불변을 확인했다. 지역 전환은240프레임 등록을 확인했다.
- 프로덕션3검사 통과:1440×900·1366×768·1093×614. 각 특별20텍스처 로딩, 키보드 전투 이동, 보스4/행동8 선택, 정지/프레임 이동, 가로 넘침/실행 오류와 검토 캔버스의 전체 특별 프레임 무기 잘림을 확인했다. 총 브라우저12검사. [소스](source-browser-results.json) · [프로덕션](production-browser-results.json).
- 원본40장 경계·셀 연결 검사, 원본/선택 복사본 SHA-256 일치와 WebP20장/dist 바이트 일치. 원본 인물 픽셀1:1과 최소32픽셀 패딩: [내보내기](../../source/qingha-special-v1/export-review.json). 원본/프롬프트/실패 후보는 docs/source/qingha-special-v1에 보존했다.
- 독립 agent-browser에서 검토/홈 로딩,8캔버스와 보스/패턴/프레임 버튼·Vite 오류 표시 없음 확인: browser-gut-check.png. 실행 오류는 Playwright pageerror로 별도 수집했다.

## 직접 시각 검토

선택40원본과 발20시점 표240후보를 검토했다. 부츠를 제외한 낮은 무기나 옆 셀 인물 조각은 발 후보에 포함하지 않는다. 노진 뒷모습 호위3노출의 발 중심을 직접 보정해 저장했다. [접지 기록](../../source/qingha-special-v1/ground-visual-review.json).

실제 Canvas 준비/접촉/회수 표, WebGL 접촉/회수 표, 기본 적 Canvas/WebGL 걷기/접촉 비교, 프로덕션1440/1093 검토와1093 전투 캡처를 직접 확인했다. 손·무기·관절, 방향·몸 크기·발 위치·HP바 간격과 셀 침범을 검토했다. 캡처와 검사 조건의 확인이며 인간 실전 난이도·모든GPU·장시간 플레이는 별도 범위다.

## 실행 환경 기록

최초 단위 실행은 샌드박스 임시 캐시 rename EPERM으로0개 실행됐다. unit-sandbox-start-failure.json에 보존하고 정상 테스트 환경에서 전체를 재실행했다. assertion이나 시간 제한은 완화하지 않았다. 최초 dev 서버도 샌드박스 외부 독립 브라우저가 접근하지 못해 테스트 서버만 재시작했다. 최종 agent-browser/Playwright 연결은 정상이다. 초기 실행을 통과 수에 합산하지 않는다.

테스트 저장은 독립 브라우저 컨텍스트에만 생성했다. 실제 사용자 저장은 변경하지 않았다. 이번 작업은 로컬 빌드 적용이며 공개 서버 배포는 수행하지 않았다.
`;
await writeFile(proof + '/README.md', doc);
const root = 'docs/obsidian-sync/2026-10-06-qingha-special-v1';
let status = await readFile(root + '/notes/current-status.md', 'utf8');
status = status.replace(
  '청하현 특별 모션의 타입 검사·프로덕션 빌드를 통과했다. 최종 단위/브라우저 수와 육안 캡처 검토는 이번 실행 결과로 아래 근거에 기록한다.',
  `청하현 특별 모션의 타입 검사·프로덕션 빌드, 전체 단위${unit.numPassedTests}개, 소스 브라우저9개와 프로덕션3개(합계12개)가 통과했다. Canvas/WebGL×일반/움직임 감소, 기본7인 회귀, 지역 전환과3화면 크기를 포함한다.40원본·20시점240발 후보와 실제 전투 캡처는 별도 직접 검토했다.`,
);
await writeFile(root + '/notes/current-status.md', status);
let log = await readFile(root + '/notes/worklog-2026-10-06.md', 'utf8');
log += `\n청하현 최종 검증: 단위${unit.numPassedTests}개, 소스9개·프로덕션3개 통과. 특별시간${count - contacts}+접촉${contacts}, 기본상태${basic}+접촉${basicContacts}, 지역 전환240등록. 원본 복사40개/출력20개 해시 일치. 자동 검사와 직접 캡처 검토 범위를 구분한다.\n`;
await writeFile(root + '/notes/worklog-2026-10-06.md', log);
console.log(JSON.stringify(run));
