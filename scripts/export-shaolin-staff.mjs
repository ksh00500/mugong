import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { figureExtractor, copyFigurePixels } from '../src/game/motion-layout.ts';

// Atlas packing only: source RGBA pixels are copied at 1:1, never resized.
const sharp = createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH ?? 'sharp');
const root = 'docs/source/shaolin-staff-v1';
const out = 'public/art/shaolin-staff-v1';
const jobs = JSON.parse(await readFile(`${root}/generation-jobs.json`, 'utf8'));
const cell = { width: 704, height: 576, padding: 32 };
// Authored ground points in each original 512px source cell. Feet, not weapon tips,
// determine the origin. These points are translated during packing, never fitted.
const anchors = {
  'front-locomotion': [[260,459],[232,480],[231,480],[228,430],[246,405],[250,417]],
  'front-combat': [[273,458],[271,466],[264,483],[270,451],[263,435],[280,430]],
  'front-right-locomotion': [[260,468],[267,460],[273,468],[257,431],[258,423],[252,419]],
  'front-right-combat': [[251,461],[249,464],[236,482],[240,449],[259,430],[259,432]],
  'right-locomotion': [[260,480],[319,484],[315,482],[249,431],[254,419],[249,416]],
  'right-combat': [[207,447],[224,451],[203,449],[189,416],[239,422],[259,406]],
  'rear-right-locomotion': [[208,466],[169,473],[256,445],[259,367],[234,393],[245,379]],
  'rear-right-combat': [[208,443],[210,447],[173,443],[180,391],[230,388],[198,385]],
  'back-locomotion': [[246,470],[265,431],[243,480],[227,437],[244,427],[258,413]],
  'back-combat': [[247,475],[239,459],[239,489],[227,469],[238,450],[244,452]],
};
await mkdir(out, { recursive: true });
const frames = [];
const reports = [];
for (const job of jobs) {
  const png = await readFile(`${root}/${job.source}`);
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.width !== 1536 || info.height !== 1024) throw Error(`${job.id}: unexpected source`);
  const source = new Uint8ClampedArray(data.buffer, data.byteOffset, data.length);
  const extract = figureExtractor(source, info.width, info.height);
  const output = new Uint8ClampedArray(cell.width * 3 * cell.height * 2 * 4);
  const used = new Set();
  const sheet = [];
  for (let pose = 0; pose < 6; pose++) {
    const sx = (pose % 3) * 512, sy = Math.floor(pose / 3) * 512;
    const figure = extract({ left: sx, top: sy, right: sx + 512, bottom: sy + 512 });
    if (used.has(figure.id)) throw Error(`${job.id}/${pose}: shared figure`);
    used.add(figure.id);
    const width = figure.right - figure.left, height = figure.bottom - figure.top;
    if (width + 64 > cell.width || height + 64 > cell.height) throw Error(`${job.id}/${pose}: insufficient padding`);
    if (figure.left <= 0 || figure.top <= 0 || figure.right >= info.width || figure.bottom >= info.height)
      throw Error(`${job.id}/${pose}: clipped original`);
    const x = (pose % 3) * cell.width, y = Math.floor(pose / 3) * cell.height;
    copyFigurePixels(source, output, info.width, cell.width * 3, figure, x + 32, y + 32, figure.members);
    const [ax, ay] = anchors[job.id][pose];
    const frame = {
      name: `${job.view}-${job.kind}-${pose}`, texture: `shaolin-staff-${job.id}`,
      view: job.view, kind: job.kind, pose, x, y, width: cell.width, height: cell.height,
      footX: ax + sx - figure.left + 32, footY: ay + sy - figure.top + 32,
      bounds: { left: 32, top: 32, right: width + 32, bottom: height + 32 },
      source: job.source, sourceBounds: { left: figure.left, top: figure.top, right: figure.right, bottom: figure.bottom },
    };
    frames.push(frame); sheet.push(frame);
    // Verify every solid source member survived the export byte-for-byte.
    for (const p of figure.members) {
      const px = p % info.width, py = Math.floor(p / info.width);
      const dest = ((y + 32 + py - figure.top) * cell.width * 3 + x + 32 + px - figure.left) * 4;
      for (let channel = 0; channel < 4; channel++)
        if (source[p * 4 + channel] !== output[dest + channel]) throw Error('RGBA copy mismatch');
    }
  }
  await sharp(Buffer.from(output.buffer), { raw: { width: cell.width * 3, height: cell.height * 2, channels: 4 } })
    .webp({ lossless: true }).toFile(`${out}/${job.id}.webp`);
  reports.push({ id: job.id, sha256: createHash('sha256').update(png).digest('hex'), solidPixelsPreserved: true,
    frames: sheet.map(f => ({ name: f.name, sourceBounds: f.sourceBounds, foot: [f.footX,f.footY], padding: [32,32,cell.width-f.bounds.right,cell.height-f.bounds.bottom] })) });
}
const pixelScale = 0.225;
const living = frames.filter(f => !(f.kind === 'locomotion' && f.pose === 5));
const metadata = { version: 1, id: 'shaolin-staffguard', pixelScale, cell,
  healthClearance: Math.max(...living.map(f => (f.footY - f.bounds.top) * pixelScale)) + 16,
  frames };
await writeFile('src/game/shaolin-staff-frames.json', JSON.stringify(metadata, null, 2) + '\n');
await writeFile(`${root}/export-review.json`, JSON.stringify(reports, null, 2) + '\n');
console.log(JSON.stringify({ frames: frames.length, pixelScale, clearance: metadata.healthClearance,
  minPadding: Math.min(...reports.flatMap(r => r.frames.flatMap(f => f.padding))) }));
