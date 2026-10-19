import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { seedLoadingRun } from './support/loading';
import { observeScene } from './support/region';
import artIndex from '../../src/platform/region-art-manifests.json' with { type: 'json' };
const proof = 'docs/verification/loading-v2';
test.beforeAll(async () => {
  await mkdir(proof, { recursive: true });
});

test('새 모집·출전 선읽기는 구형 적 그림을 받지 않고 실제 조작으로 이어진다', async ({ page }) => {
  test.setTimeout(90000);
  const requests: string[] = [],
    errors: string[] = [];
  page.on('request', (r) => requests.push(new URL(r.url()).pathname));
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('.home-scene')).toBeVisible();
  expect(requests.some((p) => p.includes('/game/mount.ts'))).toBe(false);
  await page.getByRole('button', { name: '새 무인으로 출전 →' }).hover();
  await page.getByRole('button', { name: '새 무인으로 출전 →' }).click();
  await page.getByRole('button', { name: '모집권 1장 사용' }).click();
  await page.locator('.recruitment-select').first().click();
  await page.getByRole('button', { name: '강호에 나서기 →' }).click();
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'true', {
    timeout: 30000,
  });
  await page.locator('.choice-card').first().click();
  await page.keyboard.press('Tab');
  await expect(page.locator('.inventory-workspace')).toBeVisible();
  await page.keyboard.press('Escape');
  expect(
    requests.some((p) =>
      /enemy-atlas-v1|roles-directions|identity-directions|identity-rear/.test(p),
    ),
  ).toBe(false);
  expect(errors).toEqual([]);
  await writeFile(
    `${proof}/new-run.json`,
    JSON.stringify(
      { requests, errors, engineDeferred: true, realRecruitment: true, bag: true },
      null,
      2,
    ),
  );
});

test('그림 완료 뒤 실제 장면 준비 단계·5언어·입력 차단', async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1093, height: 614 });
  await page.route('**/src/game/mount.ts*', async (route) => {
    const response = await route.fetch();
    let body = await response.text();
    body = body.replace('export function mountGame(', 'function originalMountGame(');
    body +=
      '\nexport function mountGame(parent,images,onReady,...args){return originalMountGame(parent,images,()=>setTimeout(onReady,3000),...args)}';
    await route.fulfill({ response, body });
  });
  await seedLoadingRun(page, 4, 1, 6, false);
  await expect(page.getByRole('heading', { name: '전투 화면을 구성하고 있습니다.' })).toBeVisible({
    timeout: 30000,
  });
  await expect(page.locator('.loading-count')).toHaveText('그림 준비 완료');
  await page.keyboard.press('d');
  expect(
    await page.evaluate(async () => {
      const w = window as any;
      return (await w.regionModule('/src/platform/store.ts')).gameStore.state.run.elapsed;
    }),
  ).toBe(0);
  for (const locale of ['en', 'ja', 'zh-CN', 'zh-TW', 'ko']) {
    await page.evaluate(async (locale) => {
      const w = window as any;
      (await w.regionModule('/src/platform/i18n.ts')).setLanguage(locale);
    }, locale);
    await expect(page.locator('.app-shell')).toHaveAttribute('data-locale', locale);
    await expect(page.locator('.loading-card h2')).toBeVisible();
    if (locale === 'en') await page.screenshot({ path: `${proof}/scene-stage-en.png` });
  }
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'true', {
    timeout: 30000,
  });
});

test('10지역 일반 적과 각 단계 보스의 실제 그림이 준비된다', async ({ browser, baseURL }) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  const rows = [];
  for (let region = 0; region < 10; region++) {
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await seedLoadingRun(page, region, 1);
    await observeScene(page);
    const report = await page.evaluate(async (region) => {
      const w = window as any,
        scene = w.regionScene,
        s = (await w.regionModule('/src/platform/store.ts')).gameStore;
      scene.scene.pause();
      const { runArtManifest } = await w.regionModule('/src/platform/region-art.ts');
      const { spawnWave } = await w.regionModule('/src/domain/game.ts');
      const r = s.state.run;
      r.regionRoute = Array(4).fill(r.regionRoute[0]);
      const records = [];
      for (const wave of [1, 5, 10, 15, 20]) {
        r.wave = wave;
        spawnWave(r);
        r.offers = [];
        await scene.loadRegion(region, runArtManifest(r));
        scene.syncRegion(r);
        scene.draw(r);
        records.push({
          wave,
          actors: r.enemies.map((e: any) => ({
            id: e.id,
            bossId: e.bossId,
            texture: scene.actors.get(String(e.id)).texture.key,
            source: scene.actors.get(String(e.id)).getData('sourceFrame'),
          })),
        });
      }
      return { region, records };
    }, region);
    for (const record of report.records)
      for (const a of record.actors) {
        expect(a.texture).not.toBe('__MISSING');
        expect(a.source).toBeTruthy();
      }
    rows.push(report);
    await context.close();
  }
  expect(errors).toEqual([]);
  await writeFile(`${proof}/regions.json`, JSON.stringify(rows, null, 2));
});

test('첫 로비는 미사용 그림을 기다리지 않고 필수 그림만 정확히 센다', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/symbols-v1.webp', async (route) => {
    await gate;
    await route.continue();
  });
  await page.route(/\/(boss-loot-v1|weapons-v2)\.png$/, (route) => route.abort());
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.loading-count')).toHaveText('4 / 5개 그림 준비');
  release();
  await expect(page.locator('.home-scene')).toBeVisible();
  await expect(page.locator('.asset-loading')).toHaveCount(0);
});
test('지연·실패 중에는 입력/시뮬레이션이 멈추고 재시도로 기존 여정을 연다', async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1093, height: 614 });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let fail = true;
  await page.route('**/3-floor.webp', async (route) => {
    await gate;
    if (fail) await route.fulfill({ status: 503, body: '' });
    else await route.continue();
  });
  const original = await seedLoadingRun(page, 3, 1, 6, false);
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'false');
  await page.keyboard.down('d');
  await page.waitForTimeout(150);
  await page.keyboard.up('d');
  await page.screenshot({ path: `${proof}/loading-1093.png` });
  release();
  await expect(page.getByRole('heading', { name: '화면을 준비하지 못했습니다' })).toBeVisible();
  const before = await page.evaluate(async () => {
    const w = window as any;
    const s = (await w.regionModule('/src/platform/store.ts')).gameStore;
    return {
      id: s.state.run.id,
      hp: s.state.run.fighter.hp,
      x: s.state.run.fighter.x,
      elapsed: s.state.run.elapsed,
    };
  });
  expect(before).toEqual({
    id: original.run!.id,
    hp: original.run!.fighter.hp,
    x: original.run!.fighter.x,
    elapsed: 0,
  });
  fail = false;
  await page.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'true', {
    timeout: 30000,
  });
  await observeScene(page);
  expect(
    await page.evaluate(async () => {
      const w = window as any;
      return (await w.regionModule('/src/platform/store.ts')).gameStore.state.run.id;
    }),
  ).toBe(original.run!.id);
});
test('정비 선읽기는 비차단이며 보스·지역 전환은 필수 그림이 준비된 뒤 재개한다', async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await seedLoadingRun(page, 3, 3, 6);
  await observeScene(page);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let held = 0;
  // Any required boss texture is sufficient to gate both warming and real entry.
  const bossImage = Object.values(artIndex.regions[3].bosses['3-1']!)[0];
  await page.route('**' + bossImage, async (route) => {
    held++;
    await gate;
    await route.continue();
  });
  await page.evaluate(async () => {
    const w = window as any,
      s = (await w.regionModule('/src/platform/store.ts')).gameStore;
    const { spawnWave } = await w.regionModule('/src/domain/game.ts');
    s.state.run.wave = 4;
    spawnWave(s.state.run);
    s.notify();
  });
  await expect(page.locator('.prep-stop')).toBeVisible();
  await expect.poll(() => held).toBeGreaterThan(0);
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: '다음 5웨이브 →', exact: true }).click();
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'false');
  release();
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'true', {
    timeout: 30000,
  });
  await page.evaluate(async () => {
    const w = window as any,
      s = (await w.regionModule('/src/platform/store.ts')).gameStore;
    const { spawnWave } = await w.regionModule('/src/domain/game.ts');
    s.state.run.wave = 6;
    spawnWave(s.state.run);
    s.notify();
  });
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-art-region', '0', {
    timeout: 30000,
  });
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'true');
  await page.screenshot({ path: `${proof}/region-transition.png` });
  expect(errors).toEqual([]);
});

for (const [appearance, webgl] of [
  [0, false],
  [6, true],
] as const)
  test(`선택 행의 모든 원본 픽셀·발좌표·신체 치수 보존 ${appearance}/${webgl ? 'WebGL' : 'Canvas'}`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    if (webgl)
      await page.addInitScript(() => {
        for (const proto of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
          const get = proto.getExtension;
          proto.getExtension = function (name: string) {
            return name === 'WEBGL_debug_renderer_info' ? null : get.call(this, name);
          };
        }
      });
    await seedLoadingRun(page, 4, 1, appearance);
    await observeScene(page);
    const rows = await page.evaluate(async (appearance) => {
      const w = window as any,
        scene = w.regionScene;
      scene.scene.pause();
      const { registerEnemyMotion } = await w.regionModule('/src/game/enemy-motion.ts');
      const rows = [];
      for (const [key, columns] of [
        ['hero-roster-directions', 8],
        ['hero-roster-actions', 6],
      ] as const) {
        const original = scene.textures.get(key);
        const clone = scene.textures.addImage('verify-full-' + key, original.source[0].image);
        const full = registerEnemyMotion(clone, [0, 1, 2, 3, 4], columns, columns === 6);
        const selected = scene.motionFrames.get(key);
        const digest = async (texture: string, name: string) => {
          const t = scene.textures.get(texture),
            f = t.get(name),
            canvas = t.source[0].image;
          const data = canvas
            .getContext('2d')
            .getImageData(f.cutX, f.cutY, f.cutWidth, f.cutHeight).data;
          return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data)), (x) =>
            x.toString(16).padStart(2, '0'),
          ).join('');
        };
        for (let pose = 0; pose < columns; pose++) {
          const name = `${appearance % 5}-${pose}`,
            a = selected.get(name),
            b = full.get(name);
          const { texture: at, ...am } = a,
            { texture: bt, ...bm } = b;
          rows.push({
            name,
            key,
            metadataEqual: JSON.stringify(am) === JSON.stringify(bm),
            selected: await digest(at, name),
            full: await digest(bt, name),
          });
        }
        rows.push({ key, selectedFrameCount: selected.size, expected: columns });
      }
      return rows;
    }, appearance);
    for (const row of rows) {
      if ('selected' in row) {
        expect(row.metadataEqual).toBe(true);
        expect(row.selected).toBe(row.full);
      } else expect(row.selectedFrameCount).toBe(row.expected);
    }
    await writeFile(`${proof}/row-parity-${appearance}.json`, JSON.stringify(rows, null, 2));
  });
