import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

// Decode the recorded renderer proof in Chromium. These are review screenshots,
// never a replacement for the alpha-preserving production artwork.
const root = 'docs/verification/hero-slash-v1';
const dense = process.argv.includes('--dense');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.route('http://mugong-proof.local/**', async route => {
    const batch = new URL(route.request().url()).pathname === '/0' ? 0 : 1;
    const body = await readFile(`${root}/continuous-${batch}.webm`);
    const range = /bytes=(\d+)-(\d*)/.exec(route.request().headers().range ?? '');
    const start = range ? Number(range[1]) : 0,
      end = range?.[2] ? Math.min(body.length - 1, Number(range[2])) : body.length - 1;
    await route.fulfill({ status: range ? 206 : 200, contentType: 'video/webm',
      headers: { 'accept-ranges': 'bytes', ...(range ? { 'content-range': `bytes ${start}-${end}/${body.length}` } : {}) },
      body: body.subarray(start, end + 1) });
  });
  const results = [];
  for (const batch of [0, 1]) {
    await page.goto(`http://mugong-proof.local/${batch}`);
    await page.waitForFunction(() => document.querySelector('video')?.readyState >= 2);
    const duration = await page.evaluate(() => {
      const v = document.querySelector('video'); v.pause(); v.controls = false;
      v.style.cssText = 'position:fixed;inset:0;width:1280px;height:720px;object-fit:contain';
      return v.duration;
    });
    const target = `${root}/${dense ? 'dense' : 'video'}-frames-${batch}`;
    await mkdir(target, { recursive: true });
    const times = Array.from({ length: dense ? 100 : 48 }, (_, n) => Math.max(0.01, duration - (dense ? 14.2 : 12.2) + n * (dense ? .04 : .25)));
    const decodedTimes = [];
    for (let n = 0; n < times.length; n++) {
      const { data, mediaTime } = await page.evaluate(async time => {
        const video = document.querySelector('video');
        const mediaTime = await new Promise(resolve => {
          video.requestVideoFrameCallback((_now, metadata) => resolve(metadata.mediaTime));
          video.currentTime = time;
        });
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth; canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        return { data: canvas.toDataURL('image/png').split(',')[1], mediaTime };
      }, times[n]);
      await writeFile(`${target}/${String(n).padStart(2, '0')}.png`, Buffer.from(data, 'base64'));
      decodedTimes.push(mediaTime);
    }
    results.push({ batch, duration, times, decodedTimes });
  }
  await writeFile(`${root}/${dense ? 'dense' : 'video'}-review.json`, JSON.stringify(results, null, 2));
} finally { await browser.close(); }
