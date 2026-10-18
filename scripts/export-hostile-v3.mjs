import { createRequire } from 'node:module';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { motionLayout, figureExtractor } from '../src/game/motion-layout.ts';
const sharp = createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH);
const root = 'docs/source/hostile-consistency-v3',
  target = 'public/art/hostile-consistency-v3',
  report = [];
for (const name of await readdir(root)) {
  if (!/(directions|rear|actions)\.png$/.test(name)) continue;
  const file = root + '/' + name;
  if (!name.endsWith('-rear.png')) {
    await sharp(file)
      .webp({ lossless: true })
      .toFile(target + '/' + name.replace('.png', '.webp'));
    continue;
  }
  const rows = name.startsWith('roles')
    ? 4
    : name.startsWith('identity')
      ? 3
      : name.startsWith('cavalry')
        ? 1
        : 7;
  const cols = await readFile(file.replace('.png', '.cols.txt'), 'utf8')
    .then(Number)
    .catch(() => 4);
  const original = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const cells = motionLayout(original.data, original.info.width, original.info.height, rows, cols),
    extract = figureExtractor(original.data, original.info.width, original.info.height);
  const chosen = cols === 6 ? [4, 5, 2, 3] : [0, 1, 2, 3],
    parts = [];
  for (let row = 0; row < rows; row++) {
    const region = name.match(/^region-(\d+)-rear/);
    const repairName = region ? `repair-${region[1]}-${row}.png` : '';
    const repair = repairName
      ? await sharp(root + '/' + repairName)
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true })
          .catch(() => undefined)
      : undefined;
    const { data, info } = repair ?? original;
    const repairCells = repair ? motionLayout(data, info.width, info.height, 1, 4) : undefined;
    const repairExtract = repair ? figureExtractor(data, info.width, info.height) : undefined;
    for (const [outputCol, col] of chosen.entries()) {
      const f = repairExtract
        ? repairExtract(repairCells[outputCol])
        : extract(cells[row * cols + col]);
      if (f.area < 100) throw Error(`${name}/${row}/${col}: empty figure`);
      const w = f.right - f.left,
        h = f.bottom - f.top,
        raw = Buffer.alloc(w * h * 4);
      for (const p of f.members)
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const x = (p % info.width) + dx,
              y = Math.floor(p / info.width) + dy;
            if (x < f.left || x >= f.right || y < f.top || y >= f.bottom) continue;
            const at = (y * info.width + x) * 4;
            data.copy(raw, ((y - f.top) * w + x - f.left) * 4, at, at + 4);
          }
      parts.push({ raw, w, h });
      report.push({
        file: name,
        row,
        col,
        source: repair ? repairName : name,
        width: w,
        height: h,
        sourceEdge:
          f.top <= 1 || f.left <= 1 || f.right >= info.width - 1 || f.bottom >= info.height - 1,
      });
    }
  }
  const cw = Math.max(...parts.map((p) => p.w)) + 32,
    ch = Math.max(...parts.map((p) => p.h)) + 32;
  const layers = parts.map((p, i) => ({
    input: p.raw,
    raw: { width: p.w, height: p.h, channels: 4 },
    left: (i % 4) * cw + Math.round((cw - p.w) / 2),
    top: Math.floor(i / 4) * ch + ch - p.h - 16,
  }));
  await sharp({
    create: { width: 4 * cw, height: rows * ch, channels: 4, background: '#00000000' },
  })
    .composite(layers)
    .webp({ lossless: true })
    .toFile(target + '/' + name.replace('.png', '.webp'));
}
await writeFile(
  'docs/verification/hostile-consistency-v3/rear-export.json',
  JSON.stringify(report, null, 2),
);
console.log(
  'Exported atlas frames: ' +
    report.length +
    '; source-edge cases: ' +
    report
      .filter((p) => p.sourceEdge)
      .map((p) => `${p.file}/${p.row}/${p.col}`)
      .join(', '),
);
