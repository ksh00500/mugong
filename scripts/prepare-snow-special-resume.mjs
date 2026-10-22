import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// Preflight only: never promote unfinished images into the selected/runtime manifest.
const root = 'docs/source/snow-special-v1';
const output = root + '/resume-v2';
await mkdir(output, { recursive: true });
const planned = JSON.parse(await readFile(root + '/generation-planned-jobs.json'));
const selectedBytes = await readFile(root + '/generation-jobs.json');
const selected = JSON.parse(selectedBytes);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const pending = planned.filter((j) => !selected.some((s) => s.id === j.id));
if (pending.length !== 15 || selected.length !== 5) throw Error('Unexpected partial scope');
const defaults = (await readFile('src/domain/boss-kit.ts', 'utf8'))
  .split('export const attack =')[1]
  .split('...overrides')[0];
const kits = {
  '3-2': await readFile('src/domain/boss-wave5.ts', 'utf8'),
  '3-3': await readFile('src/domain/boss-wave3.ts', 'utf8'),
  '3-4': await readFile('src/domain/boss-wave5.ts', 'utf8'),
};
const aim = [
  'DOWN screen bottom towards viewer; foreshortened arms, no sideways contact',
  'DOWN-RIGHT screen southeast, front-right three-quarter; no pure east-facing contact',
  'RIGHT screen east, true side profile',
  'UP-RIGHT screen northeast, rear three-quarter; face turned away',
  'UP screen north, pure back view; no frontal face',
];
const moves = new Map(),
  sources = [];
for (const job of pending) {
  const kit = kits[job.bossId].split(`'${job.bossId}': {`)[1].split(/\n  '\d-\d':/)[0];
  for (let index = 0; index < job.sources.length; index++) {
    const source = job.sources[index],
      move = job.moves[index];
    const block = kit.split(new RegExp(`${move}: a\\(`))[1]?.split('}),')[0];
    if (!block) throw Error('Missing real kit: ' + source.id);
    const number = (key) =>
      Number(
        block.match(new RegExp(key + ': ([\\d.]+)'))?.[1] ??
          defaults.match(new RegExp(key + ': ([\\d.]+)'))?.[1],
      );
    const contacts = JSON.parse(
      '[' +
        (block.match(/contacts: \[([^\]]+)\]/)?.[1] ??
          defaults.match(/contacts: \[([^\]]+)\]/)?.[1]) +
        ']',
    );
    const timing = {
      bossId: job.bossId,
      character: job.character,
      move,
      name: block.match(/^'([^']+)'/)?.[1],
      windup: number('windup'),
      duration: number('duration'),
      recovery: number('recovery'),
      contacts,
      holdEligible: /mechanic: 'stance'/.test(block),
    };
    if (
      !timing.name ||
      contacts.some((t) => t < 0 || t > timing.duration) ||
      !Number.isFinite(timing.duration)
    )
      throw Error('Invalid production timing');
    moves.set(job.bossId + '/' + move, timing);
    let prompt = await readFile(root + '/' + source.prompt, 'utf8');
    prompt = prompt
      .replace(/\r?\nAIM CHECK:[^\r\n]*/g, '')
      .replace(
        'large lateral/overhead allowance for extended arms or spear',
        'large lateral/overhead allowance for connected arms and the original equipment',
      );
    const equipment =
      job.character === 'xuelan'
        ? 'ONE ice focus permanently in anatomical LEFT hand, RIGHT empty casting hand. No pole, blade, fan, second orb or throwing away the focus.'
        : job.character === 'baixue'
          ? 'BOTH hands EMPTY, connected fists/palms. No pole, blade, fan, orb or new held equipment.'
          : 'ONE crystalline OPEN fan permanently in anatomical RIGHT hand, rooted at the wrist/rivet. LEFT empty command hand. No pole, blade, orb or second fan.';
    prompt += `\nAIM CHECK: ${aim[job.view]}. Follow this facing through pelvis, chest, neck and wrists. ${equipment}\nCONTACT: ${timing.name}; the game uses windup ${timing.windup}s, strike ${timing.duration}s, contact at ${contacts.join('/')}s of strike, recovery ${timing.recovery}s. The six illustrated exposures are prepare, load, contact, follow-through, return, ready. This is an activation, NOT an indefinitely held guard. Keep the commanded equipment and coherent anatomy, no low-to-high uppercut.\nSCALE AND ALPHA: native reference is the anatomical ruler, not a thumbnail to enlarge. Do not grow the skull to fill a cell. Leave empty padding for pose travel; no shrink-to-fit contact. Opaque material edges with ZERO blue/cyan luminous outline, halo or emission. Transparent RGBA outside the silhouette.\n`;
    const promptPath = output + '/' + source.prompt;
    await writeFile(promptPath, prompt);
    sources.push({
      id: source.id,
      bossId: job.bossId,
      view: job.view,
      move,
      output: root + '/' + source.source,
      reference: job.reference,
      referenceSha256: hash(await readFile(job.reference)),
      prompt: promptPath,
      promptSha256: hash(Buffer.from(prompt)),
    });
  }
}
if (sources.length !== 30 || moves.size !== 6)
  throw Error('Expected 30 originals and six patterns');
if (hash(selectedBytes) !== hash(await readFile(root + '/generation-jobs.json')))
  throw Error('Selected manifest changed');
const record = {
  status: 'prepared, NOT generated or installed',
  sources,
  moves: [...moves.values()],
  selectedManifestSha256: hash(selectedBytes),
  existingCandidate: {
    file: root + '/xuelan-front-hazard-candidate-v1.png',
    selected: false,
    review:
      'Viewer shows blue perimeter and larger apparent anatomy than reference; recheck alpha/material edges and native head size before selection.',
  },
};
await writeFile(output + '/manifest.json', JSON.stringify(record, null, 2) + '\n');
await writeFile(
  output + '/README.md',
  '# 설산 남은 세 보스 재개 묶음\n\n2026-10-06. 준비만 완료했으며 새 원화 생성·게임 적용은 하지 않았다. 내장 imagegen 재시도가 usage_limit_reached(429)를 반환했다. 도구 안내 초기화는 2026-10-07 00:09:53 KST이며 이후 성공을 보장하는 확인 결과는 아니다.\n\n15시점·30원화·6패턴의 정확한 프롬프트와 기준 이미지 SHA-256은 manifest.json에 있다. 기존 입력 프롬프트와 목진 선택 원화는 보존했다. 맨손/부채/구슬 프롬프트에서 창끝·봉 손잡이 지시를 제거하고 각 실제 kit의 접촉 시각과 방향을 명시했다.\n\n| 보스 | 모션 | 준비/공격/회수 초 | 접촉 초 |\n|---|---|---|---|\n' +
    [...moves.values()]
      .map(
        (m) =>
          `| ${m.character} | ${m.name} | ${m.windup}/${m.duration}/${m.recovery} | ${m.contacts.join('/')} |`,
      )
      .join('\n') +
    '\n\n재개: 각 prompt와 reference를 내장 imagegen에 전달 → 생성물을 프로젝트로 보존 → 6독립 인물/관절/손과 장비/방향/몸 크기/투명 경계 검토 → 30원화가 승인된 뒤에만 선택 manifest에 병합 → 원본 픽셀1:1 및 출력 여백32px/발 접지 좌표 직접 기록 → 게임 등록 → 실제 판정·피격 중 유지·8방향·HP바 검사 → Canvas/WebGL/움직임 감소/지역 전환/세 화면 크기 검증 → 문서와 옵시디언 갱신.\n\n기존 목진 2모션/60프레임만 게임에 연결된 상태를 유지한다. 나머지 보스의 기본 원화를 전용 모션 완료로 세지 않는다.\n',
);
console.log(
  JSON.stringify({
    preparedSources: sources.length,
    preparedMoves: moves.size,
    generated: 0,
    runtimeChanged: false,
    selectedManifestPreserved: true,
  }),
);
