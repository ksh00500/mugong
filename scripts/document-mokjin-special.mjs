import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
const root = 'docs/source/snow-special-v1';
for (const id of ['mokjin-front-dash', 'mokjin-front-right-dash']) {
  const path = root + '/' + id + '.record.json';
  const r = JSON.parse(await readFile(path));
  r.revision = 1;
  r.rejectedCandidate = root + '/' + id + '-candidate-v1.png';
  await writeFile(path, JSON.stringify(r, null, 2) + '\n');
}
await writeFile(
  root + '/xuelan-front-hazard-candidate-v1.candidate.json',
  JSON.stringify(
    {
      id: 'xuelan-front-hazard',
      status: 'unfinished boss; not installed',
      original:
        'C:/Users/user/.codex/generated_images/01a0e1f0-638e-7b20-9e28-1f0d4d39d935/exec-68c0c811-696a-407b-86a8-e1790d6a2e0b.png',
      source: root + '/xuelan-front-hazard-candidate-v1.png',
      reference: root + '/references/xuelan-front.png',
      promptFile: root + '/xuelan-front-hazard.prompt.txt',
      tool: 'built-in imagegen',
    },
    null,
    2,
  ) + '\n',
);
await writeFile(
  root + '/README.md',
  `# 설산 목진 특별 원화\n\n2026-10-06. 내장 imagegen으로 제작한 목진(3-1)의 돌진창·빙판 파쇄 2행동만 선택·적용한다. 5시점×2행동×6노출=60개의 독립 그림, PNG10개와 WebP5개다. 기본 원화의 READY를 네이티브 크기로 잘라 신원·무기·시점 기준으로 입력했다. 선택 파일과 원래 생성 경로는 generation-records.json, 실제 입력과 프롬프트는 promptset.md에 기록한다.\n\n정면 돌진의 옆 방향 창과 앞대각선 돌진의 이웃 인물 연결 후보는 제외하고 재제작했다. 후보2개와 프롬프트를 보존했다. 출력은 각 인물 구성 픽셀을 원본 RGBA1:1로 복사하고 32px 이상 여백을 둔다. 발60좌표는5검토 표에서 부츠 중간과 낮은 발바닥을 보고 직접 지정했다. 표를 만들 때만0.5배 표시했으며 게임 원화는 리샘플링하지 않는다. 모든 기본·특별 게임 표시 배율은0.225다.\n\n설란·백설노괴·한설의6행동 원화30개는 미완성이다. 설란 정면 빙구 시안1개 제작 후 내장 도구가 usage_limit_reached(429)를 반환했다. 이 시안은 게임에 연결하지 않는다. 원래 전체 계획20시점은 generation-planned-jobs.json, 선택한 목진5시점은 generation-jobs.json에 분리한다. 나머지 프롬프트와 신원 기준은 보존한다. 다음은 설란이다.\n\n## 재검증 명령\n\nMUGONG_SHARP_PATH를 사용 가능한 sharp 모듈 경로로 지정한 뒤 아래 순서로 실행한다. 초기 생성 준비 스크립트는 기존 파일을 덮어쓰지 않도록 초기화 때만 사용한다.\n\n- node --experimental-strip-types scripts/analyze-tianjian-special.mjs snow\n- node --experimental-strip-types scripts/export-boss-special.mjs snow-special\n- node --experimental-strip-types scripts/review-snow-special-ground.mjs\n- node --experimental-strip-types scripts/boss-special-review.mjs snow\n- node scripts/audit-snow-special.mjs\n\n[적용 범위](../../snow-special-v1.md) · [검증](../../verification/snow-special-v1/README.md).\n`,
);
await writeFile(
  'docs/snow-special-v1.md',
  `# 설산 목진 특별 모션\n\n2026-10-06. 남은 목록 맨 위인 설산에서 첫 보스 **설원창객 목진(3-1)**을 로컬 적용했다. 설산 전체 특별 모션 완료는 아니다.\n\n| 전용 모션 | 실제 동작 연결 | 원화 기준 |\n| --- | --- | --- |\n| 빙판 돌진창 | 준비0.92초, 공격0.4초/접촉0.34초, 회복0.95초 | 한 창의 두 분리된 잡기 위치, 앞발로 체중 이동 후 창 밀기, 정면·대각선 목표 방향 유지 |\n| 창끝 빙판 파쇄 | 준비1.05초, 공격0.55초/접촉0.28초, 회복1초 | 창을 들어 힘 싣기, 앞쪽 바닥 찍기, 버티기 후 회수 |\n\n각 모션은 준비·힘 싣기·접촉·후속·회수·대기6노출이다. 5원화 시점/좌우 반전8표시 방향, PNG10개·독립 그림60개·무손실WebP5개. 목진의 나머지 찌르기·횡소·연격은 기존 기본 원화이며 설산 실제18행동 중16행동은 기본 원화를 유지한다. 선택한 그림에 자세 재사용은 없다.\n\n원본 구성 픽셀을1:1로 복사하고 기본·특별 표시 배율0.225와 출력32픽셀 이상 투명 여백을 유지한다. 프레임별 몸 맞춤 축소나 변형은 없다. 발 좌표60개는 검토 표를 보고 저장했다. HP바는 모든 기본·특별 자세의 최대 높이에 고정 여유를 더한다. 보스 피격이 공격 자세를 교체하지 않는다. 피해·AI·스킬 수치와 사용자 저장은 바꾸지 않았다.\n\n설란의 얼음 구슬/빙사, 백설노괴의 숨고르기/잠복 장타, 한설의 빙풍/퇴로 봉쇄 프롬프트와20신원 기준을 준비했으나 이미지 생성 도구가 사용량 한도429를 반환해 나머지 원화 제작은 멈췄다. 설란 시안1개는 미완성 후보이며 미적용이다. 다음 작업은 **설란**부터 계속한다.\n\n- [로컬 검토](http://127.0.0.1:5173/art/snow-special-v1/review.html)\n- [내장 imagegen 선택 원본·정확한 프롬프트](source/snow-special-v1/promptset.md)\n- [자동 검사와 직접 캡처 검토](verification/snow-special-v1/README.md)\n\n이번 적용은 로컬 프로덕션 빌드다. 공개 서버 배포를 수행하지 않았다.\n`,
);
for (const name of ['DESIGN.md', 'UX.md']) {
  const s = await readFile(name, 'utf8');
  const at = s.indexOf('\n');
  await writeFile(
    name,
    s.slice(0, at + 1) +
      '\n2026-10-06 설산 목진의 돌진창·빙판 파쇄2종을5시점/8방향·60프레임으로 로컬 연결했다. 원본 픽셀1:1, 고정0.225, 최소32px 여백과 검토된 발좌표/고정 HP바를 유지한다. 이미지 생성 사용량 한도로 설란·백설노괴·한설은 미완성이다. [범위와 남은 작업](docs/snow-special-v1.md).\n' +
      s.slice(at + 1),
  );
}
const bundle = 'docs/obsidian-sync/2026-10-06-snow-special-v1/notes';
await mkdir(bundle, { recursive: true });
const vault = 'C:/Users/user/Documents/AI-Memory/projects/murim-roguelike/murim-roguelike';
for (const n of [
  'README',
  'project-overview',
  'current-status',
  'decisions',
  'art-and-assets',
  'gameplay-systems',
  'architecture',
  'known-issues',
  'backlog',
  'worklog-2026-10-06',
])
  await copyFile(vault + '/' + n + '.md', bundle + '/' + n + '.md');
console.log('Source scope, repository docs and ten unmodified vault snapshots prepared');
