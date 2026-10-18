import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';

// Read-only alpha measurements and browser review boards; generated artwork is unchanged.
const root = 'docs/source/shaolin-motion-v1';
const sharp = createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH ?? 'sharp');
const manifest = JSON.parse(await readFile(root + '/manifest.json', 'utf8'));
const reports = [];
const images = [];
for (const job of manifest.characters) {
  const png = await readFile(root + '/' + job.path);
  images.push({ ...job, url: 'data:image/png;base64,' + png.toString('base64') });
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.width !== 1536 || info.height !== 1024) throw new Error(job.id + ': unexpected canvas');
  let clear = 0, partial = 0;
  const cells = [];
  for (let i = 0; i < 6; i++) {
    const ox = (i % 3) * 512, oy = Math.floor(i / 3) * 512;
    let left = 512, top = 512, right = -1, bottom = -1, pixels = 0;
    for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
      const alpha = data[((oy + y) * info.width + ox + x) * 4 + 3];
      if (alpha === 0) clear++;
      else if (alpha < 128) partial++;
      if (alpha < 128) continue;
      pixels++;
      left = Math.min(left, x); top = Math.min(top, y);
      right = Math.max(right, x); bottom = Math.max(bottom, y);
    }
    const padding = [left, top, 511 - right, 511 - bottom];
    cells.push({ pose: job.labels[i], bounds: [left, top, right, bottom], opaquePixels: pixels, padding, minPadding: Math.min(...padding), touchesEdge: padding.includes(0) });
  }
  reports.push({ id: job.id, size: [info.width, info.height], sha256: createHash('sha256').update(png).digest('hex'), transparentFraction: clear / (info.width * info.height), partialFraction: partial / (info.width * info.height), cells });
}
const style = '<style>*{box-sizing:border-box}body{margin:0;background:#ece6d7;color:#26382e;font-family:Arial,sans-serif}header{padding:20px;font-size:22px;background:#faf7ee}section{background:#faf7ee;border-top:2px solid #b9bbaa}.row{display:grid;grid-template-columns:repeat(6,256px)}.cell{width:256px;height:280px;border-right:1px solid #c9c6b9}label{display:block;height:24px;padding:4px 8px;font-size:14px}.art{position:relative;width:256px;height:256px;overflow:hidden}.art img{position:absolute;width:768px;height:512px;max-width:none}.art:after{content:"";position:absolute;inset:16px;border:1px dashed #c3cbbf;pointer-events:none}</style>';
const rowHtml = (job) => '<section><h3 style="margin:0;padding:10px 16px">' + job.name + '</h3><div class="row">' + job.labels.map((label, i) => '<div class="cell"><label>' + (i + 1) + ' · ' + label + '</label><div class="art"><img src="' + job.url + '" style="left:' + -(i % 3) * 256 + 'px;top:' + -Math.floor(i / 3) * 256 + 'px"></div></div>').join('') + '</div></section>';
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1536, height: 2400 } });
  const header = '<header>소림 · 일반 적 3종 + 보스 4종 · 각 6개 대표 자세 · 모두 동일한 미리보기 배율</header>';
  const html = '<!doctype html><meta charset="utf-8">' + style + header + images.map(rowHtml).join('');
  await page.setContent(html);
  await page.locator('img').evaluateAll(async (imgs) => Promise.all(imgs.map(img => img.decode())));
  await page.locator('body').screenshot({ path: root + '/overview.png' });
  let savedHtml = html;
  for (const job of images) savedHtml = savedHtml.replaceAll(job.url, job.path);
  await writeFile(root + '/overview.html', savedHtml);
  for (const job of images) {
    await page.setContent('<!doctype html><meta charset="utf-8">' + style + '<header>' + job.name + ' · 6개 대표 자세</header>' + rowHtml(job));
    await page.locator('img').evaluateAll(async (imgs) => Promise.all(imgs.map(img => img.decode())));
    await page.locator('body').screenshot({ path: root + '/' + job.id + '-preview.png' });
  }
} finally { await browser.close(); }
await writeFile(root + '/alpha-review.json', JSON.stringify(reports, null, 2) + '\n');
console.log(JSON.stringify(reports.map(r => ({ id: r.id, transparent: +r.transparentFraction.toFixed(3), minPadding: Math.min(...r.cells.map(c => c.minPadding)), edgeCells: r.cells.filter(c => c.touchesEdge).map(c => c.pose) }))));
