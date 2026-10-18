import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sharp = require(process.env.MUGONG_SHARP_PATH || 'sharp');
const plan = JSON.parse(await readFile('docs/source/item-art-v2-prompts.json', 'utf8'));
const metadata = {};
const audit = [];
const previous = new Map(
  JSON.parse(await readFile('docs/source/item-art-v2-audit.json', 'utf8').catch(() => '[]')).map(
    (item) => [item.id, item],
  ),
);
const partial = process.argv.includes('--partial');
await mkdir('public/art/items-v2', { recursive: true });
for (const item of plan.items) {
  if (partial && !(await stat(item.source).catch(() => null))) continue;
  const original = await readFile(item.source);
  const sourceSha256 = createHash('sha256').update(original).digest('hex');
  // Delivery sizing and encoding only. The generated PNG remains untouched.
  const file = `public${item.delivery}`;
  const cached = previous.get(item.id);
  const existing =
    cached?.src === item.delivery && cached?.sourceSha256 === sourceSha256
      ? await readFile(file).catch(() => null)
      : null;
  const deliverySha256 = existing && createHash('sha256').update(existing).digest('hex');
  if (
    existing &&
    existing.length === cached.bytes &&
    (!cached.deliverySha256 || cached.deliverySha256 === deliverySha256)
  ) {
    metadata[item.id] = {
      src: cached.src,
      width: cached.width,
      height: cached.height,
      bounds: cached.bounds,
    };
    audit.push({ ...cached, deliverySha256 });
    continue;
  }
  await sharp(original)
    .resize({ width: 512, height: 512, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 88, alphaQuality: 100, effort: 6 })
    .toFile(file);
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let left = info.width,
    top = info.height,
    right = -1,
    bottom = -1,
    clear = 0;
  for (let y = 0; y < info.height; y++)
    for (let x = 0; x < info.width; x++) {
      const a = data[(y * info.width + x) * 4 + 3];
      if (a === 0) clear++;
      if (a < 12) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  if (right < left || clear / (info.width * info.height) < 0.25)
    throw new Error(`Missing artwork or transparent background: ${item.id}`);
  const pad = Math.max(3, Math.ceil(Math.max(right - left, bottom - top) * 0.015));
  left = Math.max(0, left - pad);
  top = Math.max(0, top - pad);
  right = Math.min(info.width - 1, right + pad);
  bottom = Math.min(info.height - 1, bottom + pad);
  metadata[item.id] = {
    src: item.delivery,
    width: info.width,
    height: info.height,
    bounds: [left, top, right - left + 1, bottom - top + 1],
  };
  audit.push({
    id: item.id,
    name: item.name,
    sourceSha256,
    deliverySha256: createHash('sha256')
      .update(await readFile(file))
      .digest('hex'),
    bytes: (await stat(file)).size,
    transparentFraction: clear / (info.width * info.height),
    ...metadata[item.id],
  });
}
if (new Set(audit.map((e) => e.sourceSha256)).size !== audit.length)
  throw new Error('Dedicated items share identical source artwork');
await writeFile('src/platform/item-art-manifest.json', JSON.stringify(metadata, null, 2) + '\n');
await writeFile('docs/source/item-art-v2-audit.json', JSON.stringify(audit, null, 2) + '\n');
console.log(
  JSON.stringify({
    items: audit.length,
    deliveryBytes: audit.reduce((sum, e) => sum + e.bytes, 0),
  }),
);
{
  await mkdir('docs/verification/item-art-v2', { recursive: true });
  const entries = plan.items
    .filter((item) => metadata[item.id])
    .map((item) => ({ id: item.id, name: item.name, ...metadata[item.id] }));
  await writeFile(
    'docs/verification/item-art-v2/gallery.html',
    `<!doctype html>
<html lang="ko"><meta charset="utf-8"><title>무공 물품 전용 그림 검토</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f7f0df;color:#2c382e;font:18px system-ui}
header,footer{height:68px;padding:16px 28px;display:flex;align-items:center;justify-content:space-between}
header b{font-size:24px}main{height:calc(100vh - 136px);padding:0 28px;display:grid;grid-template-columns:repeat(6,1fr);grid-template-rows:repeat(4,minmax(0,1fr));gap:12px}
article{min-height:0;background:#fff9eb;border-radius:12px;display:grid;grid-template-rows:minmax(0,1fr) 26px;padding:8px 12px;position:relative}
article>.large{width:100%;height:100%;min-height:0}article>.small{position:absolute;bottom:40px;right:8px;width:36px;height:36px}
article span{text-align:center;font-size:16px}button{font:inherit;border:1px solid #ae9b71;background:#fff9eb;border-radius:8px;padding:8px 20px;color:#2c382e}
</style><header><b>무공 · 물품 전용 그림</b><span id="range"></span></header><main></main>
<footer><button id="prev">이전</button><span>원본 비율 · 오른쪽 아래 36px 검토</span><button id="next">다음</button></footer>
<script>
const entries=${JSON.stringify(entries)};let page=Number(new URLSearchParams(location.search).get('page'))||0;
const draw=a=>'<svg class="large" viewBox="'+a.bounds.join(' ')+'"><image href="'+a.src+'" width="'+a.width+'" height="'+a.height+'"/></svg>';
async function render(){document.documentElement.dataset.ready='false';const subset=entries.slice(page*24,(page+1)*24);
document.querySelector('main').innerHTML=subset.map(a=>'<article>'+draw(a)+draw(a).replace('class="large"','class="small"')+'<span>'+a.name+'</span></article>').join('');
document.querySelector('#range').textContent=(page*24+1)+'–'+Math.min((page+1)*24,entries.length)+' / '+entries.length;
await Promise.all(subset.map(a=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>im.decode().then(resolve,reject);im.onerror=reject;im.src=a.src})));document.documentElement.dataset.ready='true';}
document.querySelector('#prev').onclick=()=>{page=Math.max(0,page-1);render()};document.querySelector('#next').onclick=()=>{page=Math.min(Math.ceil(entries.length/24)-1,page+1);render()};render();
</script></html>`,
  );
}
