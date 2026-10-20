import { test, expect, type Page, type Locator } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { seedRegion, observeScene } from './support/region';
import { seedLoadingRun } from './support/loading';

const proof = process.env.MUGONG_HIGH_PROOF ?? 'docs/verification/ui-high-v1';
const compiled = !!process.env.MUGONG_HIGH_COMPILED;
test.beforeAll(async () => {
  await mkdir(proof, { recursive: true });
});
async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${proof}/${name}.png`, animations: 'disabled' });
}
async function fits(el: Locator, page: Page) {
  const b = await el.boundingBox();
  expect(b).not.toBeNull();
  const v = page.viewportSize()!;
  expect(b!.x).toBeGreaterThanOrEqual(0);
  expect(b!.y).toBeGreaterThanOrEqual(0);
  expect(b!.x + b!.width).toBeLessThanOrEqual(v.width + 1);
  expect(b!.y + b!.height).toBeLessThanOrEqual(v.height + 1);
}
async function fixture(page: Page) {
  await seedRegion(page, 0);
  await observeScene(page);
  await page.evaluate(async () => {
    const w = window as any;
    w.highStore = (await w.regionModule('/src/platform/store.ts')).gameStore;
    const { spawnWave } = await w.regionModule('/src/domain/game.ts');
    const { makeLootItem } = await w.regionModule('/src/domain/items.ts');
    w.regionScene.scene.pause();
    const s = w.highStore,
      r = s.state.run,
      f = r.fighter;
    r.wave = 4;
    spawnWave(r);
    r.gold = 150;
    f.hp = 90;
    f.arts = [{ id: 'huashan', level: 3, gauge: 0, combo: 0, defenseCd: 2.4 }];
    f.active = 0;
    f.items = [
      makeLootItem('weapon-sword-1', 'high-sword', 'weapon', 80),
      makeLootItem('medicine-small', 'high-med', 'general'),
      makeLootItem('gear-robe-1', 'high-robe', 'ground'),
      makeLootItem('material-0', 'high-ore', 'general'),
    ];
    f.items[0].x = 0;
    f.items[0].y = 0;
    f.items[1].x = 0;
    f.items[1].y = 0;
    f.items[3].x = 1;
    f.items[3].y = 0;
    f.items[3].count = 5;
    f.bindings = { huashan: 'high-sword' };
    s.notify();
    w.regionScene.draw(r);
    await s.persist();
  });
  await expect(page.locator('.prep-stop')).toBeVisible();
}
async function state(page: Page) {
  return page.evaluate(() => {
    const r = (window as any).highStore.state.run;
    return {
      gold: r.gold,
      hp: r.fighter.hp,
      items: r.fighter.items.map((i: any) => ({
        id: i.id,
        place: i.place,
        count: i.count,
        rotated: i.rotated,
      })),
      stock: r.supplies?.map((s: any) => s.stock),
    };
  });
}

if (!compiled)
  for (const [width, height] of [
    [1440, 900],
    [1366, 768],
    [1093, 614],
  ]) {
    test(`high UI: preparation, comparison, bag actions and conditions ${width}`, async ({
      page,
    }) => {
      test.setTimeout(120000);
      await page.setViewportSize({ width, height });
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await fixture(page);
      await expect(page.locator('.prep-boss-moves li')).toHaveCount(2);
      await expect(page.locator('.prep-service button.primary')).toHaveCount(0);
      await fits(page.locator('.prep-actions button.primary'), page);
      await shot(page, `prep-${width}`);
      await page.getByRole('button', { name: '정비 상인', exact: true }).click();
      const market = page.locator('.rest-market');
      await market.locator('.market-stock-select').nth(1).click();
      await expect(market.locator('.equipment-comparison')).toBeVisible();
      await expect(market.locator('button.primary')).toHaveCount(1);
      const buying = market.locator('.market-purchase button');
      await fits(buying, page);
      const before = await state(page);
      await buying.click();
      await expect.poll(async () => (await state(page)).gold).toBeLessThan(before.gold);
      await expect.poll(async () => (await state(page)).stock![1]).toBe(before.stock![1] - 1);
      expect((await state(page)).items.filter((i: any) => i.place === 'ground').length).toBe(2);
      await shot(page, `market-${width}`);
      await page.keyboard.press('Escape');
      await expect(page.getByRole('button', { name: '정비 상인', exact: true })).toBeFocused();
      await page.getByRole('button', { name: '가방과 획득 물품', exact: true }).click();
      const bag = page.locator('.inventory-workspace');
      await bag.locator('[data-item-id="high-robe"]').first().click();
      await expect(bag.locator('.item-actions button.primary')).toHaveText('착용');
      await expect(bag.locator('.item-footprint')).toHaveCount(1);
      await bag.getByRole('button', { name: '착용', exact: true }).click();
      await expect
        .poll(async () => (await state(page)).items.find((i: any) => i.id === 'high-robe')?.place)
        .toBe('equipped');
      await bag.getByRole('button', { name: '일반 가방에 수납', exact: true }).click();
      await expect
        .poll(async () => (await state(page)).items.find((i: any) => i.id === 'high-robe')?.place)
        .toBe('general');
      await bag.locator('[data-item-id="high-med"]').first().click();
      const hp = (await state(page)).hp;
      await bag.getByRole('button', { name: '사용', exact: true }).click();
      await expect.poll(async () => (await state(page)).hp).toBeGreaterThan(hp);
      await bag.locator('[data-item-id="high-sword"]').first().click();
      await bag.getByRole('button', { name: '일반 가방에 수납', exact: true }).click();
      await expect
        .poll(async () => (await state(page)).items.find((i: any) => i.id === 'high-sword')?.place)
        .toBe('general');
      await bag.getByRole('button', { name: '무장 가방에 수납', exact: true }).click();
      await expect
        .poll(async () => (await state(page)).items.find((i: any) => i.id === 'high-sword')?.place)
        .toBe('weapon');
      await bag.locator('[data-item-id="high-sword"]').first().focus();
      await page.keyboard.press('r');
      await expect
        .poll(
          async () => (await state(page)).items.find((i: any) => i.id === 'high-sword')?.rotated,
        )
        .toBe(true);
      await shot(page, `bag-${width}`);
      await page.keyboard.press('Escape');
      await page.evaluate(async () => {
        const w = window as any,
          s = w.highStore,
          r = s.state.run;
        r.wave = 5;
        (await w.regionModule('/src/domain/game.ts')).spawnWave(r);
        r.offers = [];
        r.fighter.capturedTime = 0.6;
        r.fighter.freezeTime = 1.2;
        r.fighter.poisonTime = 3.4;
        r.fighter.coldTime = 2;
        r.fighter.coldStacks = 3;
        s.notify();
        w.regionScene.draw(r);
      });
      const conditions = page.locator('.combat-conditions');
      await expect(conditions).toBeVisible();
      await expect(conditions.locator('> ul > li')).toHaveCount(2);
      await conditions.locator('.condition-toggle').focus();
      await page.keyboard.press('Enter');
      await expect(conditions.locator('.condition-toggle')).toHaveAttribute(
        'aria-expanded',
        'true',
      );
      await expect(conditions.locator('[data-condition="coldTime"]')).toContainText('×3');
      const clipped = await conditions.locator('li').evaluateAll((elements) =>
        elements.flatMap((el) => {
          const box = el.getBoundingClientRect();
          const problems: string[] = [];
          for (let parent = el.parentElement; parent; parent = parent.parentElement) {
            const style = getComputedStyle(parent),
              bounds = parent.getBoundingClientRect();
            if (
              style.overflowY !== 'visible' &&
              (box.top < bounds.top - 1 || box.bottom > bounds.bottom + 1)
            )
              problems.push(parent.className);
            if (
              style.overflowX !== 'visible' &&
              (box.left < bounds.left - 1 || box.right > bounds.right + 1)
            )
              problems.push(parent.className);
          }
          return problems;
        }),
      );
      expect(clipped).toEqual([]);
      await fits(conditions, page);
      await writeFile(
        `${proof}/conditions-${width}.json`,
        JSON.stringify(
          await conditions.evaluate((el) => ({
            html: el.outerHTML,
            rect: el.getBoundingClientRect().toJSON(),
            ancestors: Array.from(
              (function* (node: Element | null) {
                while (node) {
                  yield node;
                  node = node.parentElement;
                }
              })(el),
            ).map((e) => ({
              class: e.className,
              overflow: getComputedStyle(e).overflow,
              clip: getComputedStyle(e).clip,
              clipPath: getComputedStyle(e).clipPath,
              contain: getComputedStyle(e).contain,
              z: getComputedStyle(e).zIndex,
              rect: e.getBoundingClientRect().toJSON(),
            })),
            hit: (() => {
              const li = el.querySelector('.condition-more li')!,
                b = li.getBoundingClientRect();
              return document
                .elementsFromPoint(b.x + 10, b.y + 10)
                .map((e) => ({ tag: e.tagName, class: e.className }));
            })(),
            children: Array.from(el.querySelectorAll('li,.condition-more,.condition-toggle')).map(
              (e) => ({
                text: e.textContent,
                rect: e.getBoundingClientRect().toJSON(),
                display: getComputedStyle(e).display,
                visibility: getComputedStyle(e).visibility,
                position: getComputedStyle(e).position,
                overflow: getComputedStyle(e).overflow,
              }),
            ),
          })),
          null,
          2,
        ),
      );
      await shot(page, `conditions-${width}`);
      await page.evaluate(() => {
        const w = window as any,
          f = w.highStore.state.run.fighter;
        f.capturedTime = f.freezeTime = f.poisonTime = f.coldTime = 0;
        w.highStore.notify();
      });
      await expect(conditions).toHaveCount(0);
      await page.reload();
      await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'true', {
        timeout: 30000,
      });
      const persisted = await page.evaluate(async () => {
        const w = window as any;
        return (await w.regionModule('/src/platform/store.ts')).gameStore.state.run.fighter.items;
      });
      expect(persisted.find((i: any) => i.id === 'high-robe').place).toBe('general');
      expect(errors).toEqual([]);
    });
  }

if (!compiled)
  test('high UI: five languages, settings persistence, disabled reasons and warehouse totals', async ({
    page,
  }) => {
    test.setTimeout(150000);
    await page.setViewportSize({ width: 1093, height: 614 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await fixture(page);
    await page.evaluate(() => {
      const s = (window as any).highStore;
      s.state.run.gold = 0;
      s.notify();
    });
    await page.getByRole('button', { name: '정비 상인', exact: true }).click();
    await expect(page.locator('.market-purchase button')).toBeDisabled();
    await expect(page.locator('#market-purchase-reason')).toContainText('부족');
    const scans = [];
    for (const locale of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW']) {
      await page.evaluate(
        async (locale) =>
          (await (window as any).regionModule('/src/platform/i18n.ts')).setLanguage(locale),
        locale,
      );
      await expect(page.locator('.app-shell')).toHaveAttribute('data-locale', locale);
      await fits(page.locator('.market-purchase button'), page);
      scans.push({ locale, market: await page.locator('.rest-market').innerText() });
      await shot(page, `market-small-${locale}`);
    }
    await page.evaluate(async () => {
      const w = window as any;
      (await w.regionModule('/src/platform/i18n.ts')).setLanguage('ko');
    });
    await page.keyboard.press('Escape');
    await page.evaluate(() => {
      const w = window as any,
        s = w.highStore,
        r = s.state.run,
        f = structuredClone(r.fighter);
      s.state.run = null;
      s.state.family.roster = [f];
      f.expiresAt = Date.now() + 7 * 86400000;
      s.state.selectedId = f.id;
      s.screen = 'lobby';
      s.bagOpen = false;
      s.paused = false;
      s.state.family.warehouse = f.items.map((i: any) => ({ ...i, place: 'warehouse' }));
      s.notify();
    });
    await page.getByRole('button', { name: '창고', exact: true }).click();
    await expect(page.locator('.warehouse-toolbar')).toContainText('4종 · 총 8개');
    await shot(page, 'warehouse-small');
    await page.keyboard.press('Escape');
    const opener = page.getByRole('button', { name: '설정', exact: true });
    await opener.click();
    const settings = page.getByRole('dialog', { name: '설정', exact: true });
    await settings.getByRole('switch', { name: /전투 HUD 큰 글씨/ }).click();
    await settings.getByRole('switch', { name: /높은 대비/ }).click();
    for (const locale of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW']) {
      await page.locator('#game-language').selectOption(locale);
      await expect(page.locator('.app-shell')).toHaveAttribute('data-locale', locale);
      await fits(page.locator('#game-language'), page);
      await shot(page, `settings-small-${locale}`);
    }
    await page.locator('#game-language').selectOption('ko');
    await page.getByRole('tab', { name: '소리', exact: true }).focus();
    await page.keyboard.press('Enter');
    const mute = settings.getByRole('switch', { name: '음소거', exact: true });
    await mute.click();
    await expect(mute).toHaveAttribute('aria-checked', 'true');
    await expect(mute).toHaveText('음소거사용 중');
    await shot(page, 'settings-audio-small');
    await page.keyboard.press('Escape');
    await expect(opener).toBeFocused();
    await page.evaluate(async () => {
      await (window as any).highStore.persist();
    });
    await page.reload();
    await expect(page.locator('.app-shell')).toHaveAttribute('data-large-hud', 'true');
    await expect(page.locator('.app-shell')).toHaveAttribute('data-high-contrast', 'true');
    await page.getByRole('button', { name: '설정', exact: true }).click();
    await page.getByRole('tab', { name: '소리', exact: true }).click();
    await expect(page.getByRole('switch', { name: '음소거', exact: true })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await writeFile(`${proof}/languages.json`, JSON.stringify(scans, null, 2));
  });

if (!compiled)
  test('high UI: scene setup is indeterminate and blocks simulation', async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width: 1093, height: 614 });
    await page.route('**/src/game/mount.ts*', async (route) => {
      const response = await route.fetch();
      let body = await response.text();
      body = body.replace('export function mountGame(', 'function originalMountGame(');
      body +=
        '\nexport function mountGame(parent,images,onReady,...args){return originalMountGame(parent,images,()=>setTimeout(onReady,6000),...args)}';
      await route.fulfill({ response, body });
    });
    await seedLoadingRun(page, 0, 1, 6, false);
    const setup = page.locator('.asset-loading[data-stage="scene"]');
    await expect(setup).toBeVisible({ timeout: 30000 });
    const meter = setup.getByRole('progressbar');
    await expect(meter).not.toHaveAttribute('aria-valuenow', /.+/);
    await expect(meter).toHaveAttribute('data-indeterminate', 'true');
    await page.keyboard.press('d');
    expect(
      await page.evaluate(
        async () =>
          (await (window as any).regionModule('/src/platform/store.ts')).gameStore.state.run
            .elapsed,
      ),
    ).toBe(0);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(meter.locator('i')).toHaveCSS('animation-name', 'none');
    await shot(page, 'loading-scene-small');
    await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'true', {
      timeout: 30000,
    });
  });

if (!compiled)
  for (const failure of ['images', 'engine', 'scene', 'graphics'] as const)
    test(`high UI: actual ${failure} failure classification and retry`, async ({ page }) => {
      test.setTimeout(90000);
      let fail = true;
      if (failure === 'images')
        await page.route('**/art/regions-v1/0-floor.webp', async (route) => {
          if (fail) await route.abort();
          else await route.continue();
        });
      else
        await page.route('**/src/game/mount.ts*', async (route) => {
          if (failure === 'engine' && fail) {
            await route.abort();
            return;
          }
          const response = await route.fetch();
          let body = await response.text();
          if (failure === 'scene' || failure === 'graphics') {
            body = body.replace('export function mountGame(', 'function originalMountGame(');
            body +=
              failure === 'scene'
                ? '\nexport function mountGame(...args){if(!window.highRetried)throw Error("scene test");return originalMountGame(...args)}'
                : '\nexport function mountGame(parent,images,onReady,onLost,...args){if(!window.highRetried){setTimeout(()=>onLost("graphics"),200);return ()=>{}}return originalMountGame(parent,images,onReady,onLost,...args)}';
          }
          await route.fulfill({ response, body });
        });
      const fixture = await seedLoadingRun(page, 0, 1, 6, false);
      const error = page.locator(`.asset-loading[data-error="true"][data-failure="${failure}"]`);
      await expect(error).toBeVisible({ timeout: 30000 });
      await shot(page, `loading-failure-${failure}`);
      const before = await page.evaluate(async () => {
        const s = (await (window as any).regionModule('/src/platform/store.ts')).gameStore;
        return { id: s.state.run.id, elapsed: s.state.run.elapsed };
      });
      expect(before.id).toBe(fixture.run!.id);
      expect(before.elapsed).toBe(0);
      fail = false;
      await page.evaluate(() => {
        (window as any).highRetried = true;
      });
      await error.getByRole('button', { name: '다시 시도', exact: true }).click();
      await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'true', {
        timeout: 30000,
      });
    });

test('high UI: recovery exports the original and keeps the latest dead result', async ({
  page,
}) => {
  test.skip(compiled, 'The source failure injection uses the imported storage module.');
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1093, height: 614 });
  await seedLoadingRun(page, 0, 1, 6);
  const original = await page.evaluate(async () => {
    const w = window as any,
      { writeSave } = await w.regionModule('/src/platform/storage.ts');
    const s = (await w.regionModule('/src/platform/store.ts')).gameStore;
    s.paused = true;
    s.rendererReady = false;
    await s.persist();
    const state = structuredClone(s.state);
    state.run.phase = 'dead';
    state.run.fighter.hp = 0;
    state.run.fighter.items = [];
    await writeSave(state);
    const bad = { version: 1, broken: 'ui-high-original' };
    const q = indexedDB.open('mugong-local-v1', 1);
    const db = await new Promise<IDBDatabase>((resolve) => {
      q.onsuccess = () => resolve(q.result);
    });
    await new Promise<void>((resolve) => {
      const tx = db.transaction('saves', 'readwrite');
      tx.objectStore('saves').put(bad, 'current');
      tx.oncomplete = () => resolve();
    });
    db.close();
    return bad;
  });
  await page.reload();
  const recovery = page.locator('.save-recovery');
  await expect(recovery).toBeVisible();
  await expect(recovery.locator('.recovery-steps > li')).toHaveCount(2);
  await fits(recovery.getByRole('button', { name: '최신 검증 사본으로 복구' }), page);
  await shot(page, 'recovery-small');
  const downloading = page.waitForEvent('download');
  await recovery.getByRole('button', { name: '저장 원본 내보내기' }).click();
  await (await downloading).saveAs(`${proof}/original-export.json`);
  await recovery.getByRole('button', { name: '최신 검증 사본으로 복구' }).click();
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'true', {
    timeout: 30000,
  });
  await expect(page.locator('.death-result')).toBeVisible();
  const result = await page.evaluate(async () => {
    const w = window as any,
      { readSave } = await w.regionModule('/src/platform/storage.ts');
    const save = await readSave();
    const q = indexedDB.open('mugong-local-v1', 1),
      db = await new Promise<IDBDatabase>((r) => {
        q.onsuccess = () => r(q.result);
      });
    const original = await new Promise<any>((r) => {
      const request = db.transaction('saves').objectStore('saves').get('unreadable-original');
      request.onsuccess = () => r(request.result);
    });
    db.close();
    return { phase: save.run.phase, hp: save.run.fighter.hp, original: original.state };
  });
  expect(result).toEqual({ phase: 'dead', hp: 0, original });
  await writeFile(`${proof}/recovery.json`, JSON.stringify(result, null, 2));
});

if (compiled)
  test('compiled high UI: preparation, purchase and settings work from the build', async ({
    page,
  }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width: 1093, height: 614 });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await seedLoadingRun(page, 0, 4, 6);
    await page.evaluate(async () => {
      const q = indexedDB.open('mugong-local-v1', 1),
        db = await new Promise<IDBDatabase>((r) => {
          q.onsuccess = () => r(q.result);
        });
      await new Promise<void>((r) => {
        const tx = db.transaction('saves', 'readwrite'),
          s = tx.objectStore('saves'),
          q = s.get('current');
        q.onsuccess = () => {
          q.result.run.gold = 150;
          s.put(q.result, 'current');
        };
        tx.oncomplete = () => r();
      });
      db.close();
    });
    await page.reload();
    await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'true', {
      timeout: 30000,
    });
    await expect(page.locator('.prep-stop')).toBeVisible();
    await expect(page.locator('.prep-boss-moves li')).toHaveCount(2);
    await fits(page.locator('.prep-actions button.primary'), page);
    await page.getByRole('button', { name: '정비 상인', exact: true }).click();
    await expect(page.locator('.market-purchase button')).toBeVisible();
    await fits(page.locator('.market-purchase button'), page);
    await page.locator('.market-stock-select').nth(1).click();
    await expect(page.locator('.equipment-comparison')).toBeVisible();
    await page.locator('.market-purchase button').click();
    await expect(page.locator('.rest-market-status')).toContainText('130전');
    await expect(page.locator('.market-purchase button')).toBeDisabled();
    await shot(page, 'compiled-market-small');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: '가방과 획득 물품', exact: true }).click();
    await expect(page.locator('.inventory-workspace')).toBeVisible();
    await page.keyboard.press('Escape');
    expect(errors).toEqual([]);
  });
