import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';

const proof = 'docs/verification/combat-feel-v1';
await mkdir(`${proof}/video`, { recursive: true });
const baseURL = 'http://127.0.0.1:5181/';
let server;
try {
  await fetch(baseURL);
} catch {
  server = spawn(
    process.execPath,
    ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5181', '--strictPort'],
    { stdio: 'ignore', windowsHide: true },
  );
  for (let n = 0; n < 60; n++) {
    try {
      await fetch(baseURL);
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}
const browser = await chromium.launch();
const context = await browser.newContext({
  locale: 'ko-KR',
  viewport: { width: 1093, height: 614 },
  recordVideo: { dir: `${proof}/video`, size: { width: 1093, height: 614 } },
});
const page = await context.newPage();
const errors = [];
let completed = false;
page.on('pageerror', (error) => errors.push(error.message));
try {
  await page.goto(baseURL);
  await page.locator('.home-scene').waitFor();
  // All fixture state lives in this private Playwright browser, never the user's browser.
  await page.evaluate(async () => {
    const path = '/src/domain/game.ts';
    const { emptyGame, startRun, spawnWave } = await import(path);
    const state = emptyGame();
    startRun(state, '연출 검증', 123);
    const r = state.run;
    r.wave = 1;
    spawnWave(r);
    r.fighter.arts = ['huashan', 'wudang', 'tianmo', 'samja'].map((id) => ({
      id,
      level: 5,
      gauge: 100,
      combo: 0,
      defenseCd: 0,
    }));
    r.fighter.bindings = Object.fromEntries(
      r.fighter.arts.map((art) => [art.id, r.fighter.items[0].id]),
    );
    r.enemies = [r.enemies[0]];
    Object.assign(r.enemies[0], {
      kind: 'sword',
      elite: false,
      x: 1025,
      y: 650,
      hp: 10000,
      maxHp: 10000,
      state: 'approach',
      timer: 1.8,
      aim: Math.PI,
      pattern: 0,
      xp: 0,
    });
    const db = await new Promise((resolve) => {
      const request = indexedDB.open('mugong-local-v1', 1);
      request.onsuccess = () => resolve(request.result);
    });
    await new Promise((resolve) => {
      const tx = db.transaction('saves', 'readwrite');
      tx.objectStore('saves').put(state, 'current');
      tx.oncomplete = resolve;
    });
    db.close();
  });
  await page.reload();
  await page.locator('.game-canvas[data-ready="true"]').waitFor();
  const point = async (x, y) => {
    const rect = await page.locator('.game-canvas canvas').boundingBox();
    return { x: rect.x + (rect.width * x) / 1920, y: rect.y + (rect.height * y) / 1080 };
  };
  let aim = await point(1025, 615);
  await page.mouse.move(aim.x, aim.y);
  await page.mouse.down();
  await page.waitForTimeout(1100);
  await page.mouse.up();
  await page.getByRole('button', { name: '무당태극검법 전환', exact: true }).click();
  await page.waitForFunction(
    async () => {
      const path = '/src/platform/store.ts';
      const { gameStore } = await import(path);
      const e = gameStore.state.run.enemies[0];
      return e.state === 'windup' && e.timer < 0.22;
    },
    undefined,
    { timeout: 8000 },
  );
  await page.keyboard.press('Space');
  await page.waitForFunction(
    async () => {
      const path = '/src/platform/store.ts';
      const { gameStore } = await import(path);
      const f = gameStore.state.run.fighter;
      return f.arts[f.active].id === 'wudang' && f.invulnerable > 0 && f.hp === 120;
    },
    undefined,
    { timeout: 5000 },
  );
  await page.screenshot({ path: `${proof}/active-counter.png` });
  aim = await point(1025, 615);
  await page.mouse.move(aim.x, aim.y);
  await page.mouse.down();
  await page.waitForTimeout(750);
  await page.mouse.up();
  await page.getByRole('button', { name: '화산매화검법 전환', exact: true }).click();
  await page.keyboard.press('Space');
  await page.keyboard.down('a');
  await page.waitForTimeout(450);
  await page.keyboard.up('a');
  await page.mouse.down();
  await page.waitForTimeout(800);
  await page.mouse.up();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${proof}/active-play.png` });
  await writeFile(
    `${proof}/video-result.json`,
    JSON.stringify(
      {
        errors,
        fixture: 'private Playwright',
        counter: true,
        renderer: await page.locator('.game-canvas').getAttribute('data-renderer'),
      },
      null,
      2,
    ),
  );
  completed = true;
} finally {
  await context.close();
  if (completed) await page.video()?.saveAs(`${proof}/combat-preview.webm`);
  await browser.close();
  server?.kill();
}
if (errors.length) throw new Error(errors.join('\n'));
