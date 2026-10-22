import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const sharp = createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH ?? 'sharp');
const ms = JSON.parse(
  await readFile('docs/verification/monk-scale-v2/source-measurements.json', 'utf8'),
);
const entries = ms.filter(
  (m) =>
    m.path === '/art/animation-rebuild-v2/region-4.webp' && ['4-0', '4-1', '4-4'].includes(m.frame),
);
const layers = [];
for (const [c, m] of entries.entries()) {
  const b = m.bounds,
    w = b.right - b.left,
    h = b.bottom - b.top;
  const img = await sharp('public' + m.path)
    .extract({ left: b.left, top: b.top, width: w, height: 70 })
    .resize(w * 3, 210)
    .png()
    .toBuffer();
  layers.push({ input: img, left: c * 700, top: 0 });
  let svg = '<svg width="700" height="260">';
  for (let x = 0; x < w; x += 10)
    svg += `<path d="M${x * 3} 0V210" stroke="white" opacity=".3"/><text x="${x * 3}" y="230" fill="white" font-size="16">${x}</text>`;
  for (let y = 0; y < 70; y += 10)
    svg += `<path d="M0 ${y * 3}H660" stroke="white" opacity=".3"/><text x="0" y="${y * 3 + 15}" fill="white" font-size="16">${y}</text>`;
  svg += `<text x="10" y="255" fill="white" font-size="20">${m.frame}</text></svg>`;
  layers.push({ input: Buffer.from(svg), left: c * 700, top: 0 });
}
await sharp({ create: { width: 2100, height: 260, channels: 4, background: '#637267' } })
  .composite(layers)
  .png()
  .toFile('docs/verification/monk-scale-v2/head-detail.png');
