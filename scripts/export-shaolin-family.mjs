import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { figureExtractor, copyFigurePixels } from '../src/game/motion-layout.ts';
import { nativeSourceCell } from './native-source-cell.mjs';

// Packing only. Generated source pixels retain their size and RGBA values.
const sharp = createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH ?? 'sharp');
const familyName = process.argv[2] ?? 'shaolin';
if (!['shaolin', 'zhuge', 'tianjian', 'dokmu', 'hyeolma', 'desert', 'qingha', 'snow', 'bamboo', 'tomb'].includes(familyName))
  throw Error('Unknown native enemy family');
const root = `docs/source/${familyName}-family-v1`,
  out = `public/art/${familyName}-family-v1`;
const jobs = JSON.parse(await readFile(`${root}/generation-jobs.json`, 'utf8'));
let anchors;
try {
  anchors = JSON.parse(await readFile(`${root}/ground-anchors.json`, 'utf8'));
} catch {
  anchors = {};
}
const sheets = [];
const sources = new Map();
async function readSource(sourceFile) {
  if (sources.has(sourceFile)) return sources.get(sourceFile);
  const png = await readFile(`${root}/${sourceFile}`);
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const source = new Uint8ClampedArray(data.buffer, data.byteOffset, data.length);
  const value = { png, info, source, extract: figureExtractor(source, info.width, info.height) };
  sources.set(sourceFile, value);
  return value;
}
for (const job of jobs) {
  const used = new Set(),
    figures = [];
  const poseKeys = [];
  for (let pose = 0; pose < 12; pose++) {
    const sourceFile = job.poseSources?.[pose] ?? job.source;
    const { png, info, source, extract } = await readSource(sourceFile);
    // A long weapon can have its own spacious source grid. Source pixels stay
    // 1:1; the logical action index is independent from its source cell index.
    const layout = job.poseSourceCells?.[pose] ?? { columns: 4, rows: 3, index: pose };
    const cell = nativeSourceCell(layout, info.width, info.height),
      { left: sx, top: sy } = cell;
    const f = extract(cell);
    if (f.id < 0) throw Error(`${job.id}/${pose}: ambiguous connected figure; repair the source`);
    const figureKey = sourceFile + '/' + f.id;
    const alias = job.poseReuse?.[pose];
    const reused = Number.isInteger(alias) && alias < pose && poseKeys[alias] === figureKey;
    if (alias !== undefined && !reused)
      throw Error(`${job.id}/${pose}: invalid explicit pose reuse`);
    if (used.has(figureKey) && !reused) throw Error(`${job.id}/${pose}: shared figure`);
    poseKeys[pose] = figureKey;
    used.add(figureKey);
    if (f.left <= 0 || f.top <= 0 || f.right >= info.width || f.bottom >= info.height)
      throw Error(`${job.id}/${pose}: original clipped at sheet boundary`);
    figures.push({ ...f, png, info, source, sourceFile, sx, sy, layout });
    // Initial ground-point proposal uses the lowest solid band. A low weapon tip
    // can enter that band, so saved coordinates require review per drawing;
    // the game consumes only the exported points and never scans or fits a pose.
    if (!anchors[job.id]?.[pose]) {
      const xs = [...f.members]
        .filter((p) => Math.floor(p / info.width) >= f.bottom - 16)
        .map((p) => p % info.width)
        .sort((a, b) => a - b);
      const x =
        pose === 5
          ? (f.left + f.right) / 2
          : (xs[Math.floor(xs.length * 0.1)] + xs[Math.floor(xs.length * 0.9)]) / 2;
      (anchors[job.id] ??= [])[pose] = [Math.round(x - sx), f.bottom - 2 - sy];
    }
  }
  sheets.push({ job, figures });
}
await mkdir(out, { recursive: true });
const characters = [],
  reports = [];
for (const id of [...new Set(jobs.map((j) => j.character))]) {
  const selected = sheets.filter((s) => s.job.character === id);
  const cell = {
    width:
      Math.ceil(
        (Math.max(...selected.flatMap((s) => s.figures.map((f) => f.right - f.left))) + 64) / 32,
      ) * 32,
    height:
      Math.ceil(
        (Math.max(...selected.flatMap((s) => s.figures.map((f) => f.bottom - f.top))) + 64) / 32,
      ) * 32,
    padding: 32,
  };
  const frames = [];
  for (const { job, figures } of selected) {
    const output = new Uint8ClampedArray(cell.width * 4 * cell.height * 3 * 4),
      sheet = [];
    for (let sourcePose = 0; sourcePose < 12; sourcePose++) {
      const f = figures[sourcePose],
        x = (sourcePose % 4) * cell.width,
        y = Math.floor(sourcePose / 4) * cell.height;
      const { source, info, sx, sy, sourceFile, layout } = f;
      copyFigurePixels(source, output, info.width, cell.width * 4, f, x + 32, y + 32, f.members);
      const [ax, ay] = anchors[job.id][sourcePose];
      const kind = sourcePose < 6 ? 'locomotion' : 'combat',
        pose = sourcePose % 6;
      const frame = {
        name: `${job.view}-${kind}-${pose}`,
        texture: `${familyName}-family-${job.id}`,
        view: job.view,
        kind,
        pose,
        sourcePose,
        x,
        y,
        width: cell.width,
        height: cell.height,
        footX: ax + sx - f.left + 32,
        footY: ay + sy - f.top + 32,
        bounds: { left: 32, top: 32, right: f.right - f.left + 32, bottom: f.bottom - f.top + 32 },
        source: sourceFile,
        sourceCell: layout,
        sourceBounds: { left: f.left, top: f.top, right: f.right, bottom: f.bottom },
      };
      if (
        frame.footX <= 0 ||
        frame.footX >= cell.width ||
        frame.footY <= 0 ||
        frame.footY >= cell.height
      )
        throw Error(`${job.id}/${sourcePose}: invalid ground point`);
      for (const p of f.members) {
        const dest =
          ((y + 32 + Math.floor(p / info.width) - f.top) * cell.width * 4 +
            x +
            32 +
            (p % info.width) -
            f.left) *
          4;
        for (let c = 0; c < 4; c++)
          if (source[p * 4 + c] !== output[dest + c]) throw Error('RGBA mismatch');
      }
      frames.push(frame);
      sheet.push(frame);
    }
    await sharp(Buffer.from(output.buffer), {
      raw: { width: cell.width * 4, height: cell.height * 3, channels: 4 },
    })
      .webp({ lossless: true })
      .toFile(`${out}/${job.id}.webp`);
    reports.push({
      id: job.id,
      sources: [
        ...new Map(
          figures.map((f) => [
            f.sourceFile,
            { file: f.sourceFile, sha256: createHash('sha256').update(f.png).digest('hex') },
          ]),
        ).values(),
      ],
      solidPixelsPreserved: true,
      frames: sheet.map((f) => ({
        name: f.name,
        sourceBounds: f.sourceBounds,
        foot: [f.footX, f.footY],
        padding: [32, 32, cell.width - f.bounds.right, cell.height - f.bounds.bottom],
      })),
    });
  }
  const slot = selected[0].job.slot,
    pixelScale = 0.225;
  characters.push({
    id,
    slot,
    pixelScale,
    cell,
    healthClearance:
      Math.max(
        ...frames
          .filter((f) => !(f.kind === 'locomotion' && f.pose === 5))
          .map((f) => (f.footY - f.bounds.top) * pixelScale),
      ) + 16,
    frames,
  });
}
await writeFile(`${root}/ground-anchors.json`, JSON.stringify(anchors, null, 2) + '\n');
await writeFile(`${root}/export-review.json`, JSON.stringify(reports, null, 2) + '\n');
await writeFile(
  `src/game/${familyName}-family-frames.json`,
  JSON.stringify({ version: 1, characters }, null, 2) + '\n',
);
console.log(
  JSON.stringify(
    characters.map((c) => ({
      id: c.id,
      frames: c.frames.length,
      cell: c.cell,
      healthClearance: c.healthClearance,
    })),
  ),
);
