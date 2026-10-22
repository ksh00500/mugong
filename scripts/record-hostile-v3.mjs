import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = 'docs/source/hostile-consistency-v3',
  rows = [];
const rearExport = JSON.parse(
  await readFile('docs/verification/hostile-consistency-v3/rear-export.json', 'utf8'),
);
for (const name of await readdir(root))
  if (name.endsWith('.png')) {
    const base = name.replace('.png', ''),
      publicFile = `public/art/hostile-consistency-v3/${base}.webp`;
    const source = await readFile(`${root}/${name}`),
      delivery = await readFile(publicFile).catch(() => undefined);
    if (!delivery) continue;
    rows.push({
      id: base,
      source: `${root}/${name}`,
      sourceSHA256: createHash('sha256').update(source).digest('hex'),
      prompt: `${root}/${base}.prompt.txt`,
      delivery: publicFile,
      deliverySHA256: createHash('sha256').update(delivery).digest('hex'),
      repairedRows: [
        ...new Set(
          rearExport
            .filter((frame) => frame.file === name && frame.source !== name)
            .map((frame) => frame.source),
        ),
      ].map((source) => ({
        source: `${root}/${source}`,
        prompt: `${root}/${source.replace('.png', '.prompt.txt')}`,
      })),
    });
  }
await writeFile(
  `${root}/production.json`,
  JSON.stringify(
    {
      version: 'hostile-consistency-v3',
      date: '2026-10-04',
      provider: 'Built-in imagegen; source reference atlases retained',
      processing:
        'Lossless WebP export; rear component isolation and atlas repacking, no recoloring or procedural raster repainting',
      entries: rows,
    },
    null,
    2,
  ) + '\n',
);
const file = 'src/platform/character-identities.json',
  entries = JSON.parse(await readFile(file, 'utf8'));
for (const entry of entries) {
  if (entry.id === 'hero') continue;
  let name =
    entry.region >= 0 ? `region-${entry.region}` : entry.id === 'role:rider' ? 'cavalry' : 'roles';
  if (['boss:2-1', 'boss:4-4', 'region:4:slot:2'].includes(entry.id)) name = 'identity';
  entry.review = '2026-10-04';
  entry.version = 'hostile-consistency-v3';
  entry.scope = '앞/옆/뒤 팔레트와 외형 비교; 뒤쪽 준비/접촉 원화; 반응 크기는 별도 보정';
  entry.directionSource = `public/art/hostile-consistency-v3/${name}-directions.webp`;
  entry.rearSource = `public/art/hostile-consistency-v3/${name}-rear.webp`;
  if (name.startsWith('region-') && [1, 9].includes(entry.region))
    entry.actionSource = `public/art/hostile-consistency-v3/${name}-actions.webp`;
  entry.evidence = `docs/verification/hostile-consistency-v3/calibrated/${name === 'roles' ? 'role' : name}-actions.png`;
  entry.calibration = 'src/platform/anatomical-landmarks.json';
  entry.result =
    '공유 팔레트/도구/복장 비교판 검토; 8방향 동작 경로 자동 확인. 해부학 크기는 수동 추정 기준이며 전 프레임 자연스러움의 자동 인증이 아님.';
}
await writeFile(file, JSON.stringify(entries, null, 2) + '\n');
console.log(`${rows.length} exported sources recorded; ${entries.length} identity records updated`);
