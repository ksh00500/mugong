import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const sharp = createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH ?? 'sharp');
const family = process.argv[2] ?? 'tianjian';
if (!['shaolin', 'zhuge', 'tianjian', 'dokmu', 'hyeolma', 'desert', 'qingha', 'snow', 'bamboo', 'tomb'].includes(family)) throw Error('Unknown family');
const document = JSON.parse(await readFile(`src/game/${family}-family-frames.json`, 'utf8'));
const characters = Array.isArray(document) ? document : document.characters;
const reports = [];
for (const character of characters) {
  for (const view of [...new Set(character.frames.map((f) => f.view))]) {
    const frames = character.frames.filter((f) => f.view === view);
    const sheetId = frames[0].texture.slice(`${family}-family-`.length);
    const file = `public/art/${family}-family-v1/${sheetId}.webp`;
    const { data, info } = await sharp(file)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    let visiblePixels = 0;
    for (const f of frames) {
      for (let y = 0; y < f.height; y++) {
        for (let x = 0; x < f.width; x++) {
          const alpha = data[((f.y + y) * info.width + f.x + x) * 4 + 3];
          if (alpha === 0) continue;
          visiblePixels++;
          if (x < f.bounds.left || x >= f.bounds.right || y < f.bounds.top || y >= f.bounds.bottom)
            throw Error(`${file}/${f.name}: encoded visible pixel outside saved figure bounds`);
        }
      }
    }
    reports.push({
      file,
      width: info.width,
      height: info.height,
      frames: frames.length,
      visiblePixels,
      transparentPadding: true,
    });
  }
}
await writeFile(
  `docs/source/${family}-family-v1/encoded-atlas-review.json`,
  JSON.stringify(reports, null, 2) + '\n',
);
console.log(
  JSON.stringify({
    sheets: reports.length,
    frames: reports.reduce((sum, r) => sum + r.frames, 0),
    transparentPadding: true,
  }),
);
