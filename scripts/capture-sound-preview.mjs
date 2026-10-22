// Capture the actual game mixer in a fresh browser, without touching user saves.
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const proof = 'docs/verification/unification-v2';
const kinds = ['select', 'store', 'confirm', 'reject', 'slash', 'impact', 'evade', 'block', 'parry', 'hit', 'warning', 'level', 'death'];
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.addInitScript(() => {
    const Native = window.AudioContext;
    window.AudioContext = class extends Native {
      createDynamicsCompressor() {
        const limiter = super.createDynamicsCompressor();
        window.previewDestination = this.createMediaStreamDestination();
        limiter.connect(window.previewDestination);
        return limiter;
      }
    };
  });
  await page.goto('http://127.0.0.1:5173/');
  await page.locator('.home-scene').waitFor();
  await page.keyboard.press('Tab');
  await page.waitForFunction(() => !!window.previewDestination);
  const bytes = await page.evaluate(async kinds => {
    const api = await import('/src/' + 'platform/audio.ts');
    api.setAudioScene('off');
    api.setAudioPreferences({ muted: false, music: 0, ambient: 0 });
    const recorder = new MediaRecorder(window.previewDestination.stream, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 96000 });
    const chunks = [];
    const result = new Promise(resolve => {
      recorder.ondataavailable = event => chunks.push(event.data);
      recorder.onstop = async () => resolve([...new Uint8Array(await new Blob(chunks).arrayBuffer())]);
    });
    recorder.start();
    await new Promise(resolve => setTimeout(resolve, 300));
    for (const kind of kinds) {
      api.sound(kind);
      await new Promise(resolve => setTimeout(resolve, 650));
    }
    recorder.stop();
    return result;
  }, kinds);
  await mkdir(proof, { recursive: true });
  await writeFile(`${proof}/sound-preview.webm`, Buffer.from(bytes));
  await writeFile(`${proof}/sound-preview.json`, JSON.stringify({ kinds, intervalMs: 650, mixer: 'Actual game master/effects/compressor; default 75%/80%', bytes: bytes.length, isolated: true }, null, 2));
  console.log(JSON.stringify({ bytes: bytes.length, kinds }));
} finally {
  await browser.close();
}
