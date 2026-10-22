// Diagnostic contact sheets only; packed game art is never modified here.
import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
const sharp = createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH ?? 'sharp');
const { characters } = JSON.parse(await readFile('src/game/qingha-family-frames.json', 'utf8'));
const root = 'docs/verification/qingha-family-v1/contact';
await mkdir(root, { recursive: true });
for (const c of characters) {
  const cw = 150,
    ch = 175,
    scale = 0.3,
    composite = [];
  const labels = [];
  for (const f of c.frames) {
    const x = f.sourcePose * cw,
      y = f.view * ch;
    const b = await sharp(
      `public/art/qingha-family-v1/${f.texture.replace('qingha-family-', '')}.webp`,
    )
      .extract({ left: f.x, top: f.y, width: f.width, height: f.height })
      .resize(Math.round(f.width * scale), Math.round(f.height * scale))
      .png()
      .toBuffer();
    const left = Math.round(x + 75 - f.footX * scale),
      top = Math.round(y + 149 - f.footY * scale);
    composite.push({ input: b, left, top });
    labels.push(
      `<text x="${x + 5}" y="${y + 14}" font-size="12">view${f.view} p${f.sourcePose}</text><path d="M${x + 65},${y + 149}h20 M${x + 75},${y + 145}v8" stroke="#df3427" fill="none"/>`,
    );
  }
  composite.push({
    input: Buffer.from(
      `<svg width="${cw * 12}" height="${ch * 5}"><g font-family="sans-serif" fill="#253829">${labels.join('')}</g></svg>`,
    ),
    left: 0,
    top: 0,
  });
  await sharp({ create: { width: cw * 12, height: ch * 5, channels: 4, background: '#eee6d5' } })
    .composite(composite)
    .png()
    .toFile(`${root}/${c.id}.png`);
}
console.log('7 diagnostic contact sheets');
