import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';

// Browser rendering preview only. The generated RGBA asset stays unchanged.
const root = 'docs/source/enemy-staff-pilot-v1';
const version = process.argv[2] || 'v1';
if (!['v1', 'v2', 'v3'].includes(version)) throw new Error(`Unknown pilot version: ${version}`);
const preview = version === 'v1' ? 'preview' : `preview-${version}`;
const png = await readFile(`${root}/staff-monk-six-poses-${version}.png`);
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1536, height: 1100 } });
  const labels = ['대기', '보행', '공격 준비', '횡 휘두르기', '앞 찌르기', '회수'];
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>
  *{box-sizing:border-box}body{margin:0;background:#ece6d7;color:#28372e;font-family:Arial,sans-serif}
  header{height:76px;padding:18px 24px;font-size:24px}
  main{position:relative;width:1536px;height:1024px;background:#faf7ee}
  img{position:absolute;width:1536px;height:1024px;inset:0}
  .cells{position:absolute;inset:0;display:grid;grid-template-columns:repeat(3,512px);grid-template-rows:repeat(2,512px)}
  .cell{border:1px solid #c9c6b9;position:relative;padding:16px;font-size:20px}
  .cell:after{content:'';position:absolute;inset:32px;border:1px dashed #bec6b9;pointer-events:none}
  </style><header>소림 봉 승려 · 한 인물의 6자세 · 생성 시안</header>
  <main><img src="data:image/png;base64,${png.toString('base64')}"><div class="cells">${labels.map((label) => `<div class="cell">${label}</div>`).join('')}</div></main>`);
  await page.locator('img').evaluate(async (image) => image.decode());
  await page.screenshot({ path: `${root}/${preview}.png` });
  await writeFile(`${root}/${preview}.html`, await page.content());
} finally {
  await browser.close();
}
