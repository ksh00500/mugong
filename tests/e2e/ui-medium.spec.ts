import { test, expect, type Page, type Locator } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { emptyGame, startRun, spawnWave, command } from '../../src/domain/game';
import { REGIONS } from '../../src/domain/campaign';
import { xpThreshold } from '../../src/domain/content';
import { makeLootItem } from '../../src/domain/items';
import type { GameState, Fighter } from '../../src/domain/model';

const proof = process.env.MUGONG_MEDIUM_PROOF ?? 'docs/verification/ui-medium-v1/source';
const viewports = [
  [1440, 900],
  [1366, 768],
  [1093, 614],
];
test.beforeAll(async () => {
  await mkdir(proof, { recursive: true });
});
function fixture(phase: 'dead' | 'loot' = 'loot') {
  const state = emptyGame();
  startRun(state, '가나다라마바사아자차카타', 123);
  const r = state.run!,
    f = r.fighter;
  r.regionRoute = REGIONS.slice(0, 4).map((r) => r.name);
  r.wave = phase === 'dead' ? 7 : 20;
  spawnWave(r);
  r.phase = phase;
  r.enemies = [];
  r.offers = [];
  r.kills = 123456;
  r.elapsed = 125.8;
  r.gold = 77;
  f.level = f.spent = r.spent = 16;
  f.xp = xpThreshold(16);
  f.augments = ['swift'];
  f.augmentOffers = [];
  f.trainingPoints = 0;
  f.appearance = 6;
  f.hp = phase === 'dead' ? 0 : 80;
  f.items = [
    { ...makeLootItem('weapon-sword-1', 'medium-sword', 'weapon'), x: 0, y: 0 },
    { ...makeLootItem('medicine-small', 'medium-med', 'general'), x: 0, y: 0, count: 3 },
    { ...makeLootItem('material-0', 'medium-ore', 'general'), x: 1, y: 0, count: 5 },
    makeLootItem('gear-robe-1', 'medium-robe', 'equipped'),
    { ...makeLootItem('material-0', 'left-behind', 'ground'), count: 7 },
  ];
  state.family.silver = 1234;
  state.family.warehouse = [{ ...makeLootItem('material-0', 'kept-ore', 'warehouse'), count: 2 }];
  return state;
}
async function seed(page: Page, state: GameState) {
  await page.goto('/');
  await expect(page.locator('.home-scene')).toBeVisible({ timeout: 30000 });
  await page.evaluate(async (state) => {
    const db = await new Promise<IDBDatabase>((r, j) => {
      const q = indexedDB.open('mugong-local-v1', 1);
      q.onsuccess = () => r(q.result);
      q.onerror = () => j(q.error);
    });
    await new Promise<void>((r, j) => {
      const tx = db.transaction('saves', 'readwrite');
      tx.objectStore('saves').put(state, 'current');
      tx.oncomplete = () => r();
      tx.onerror = () => j(tx.error);
    });
    db.close();
  }, state);
  await page.reload({ waitUntil: 'domcontentloaded' });
}
async function saved(page: Page): Promise<GameState> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((r) => {
      const q = indexedDB.open('mugong-local-v1', 1);
      q.onsuccess = () => r(q.result);
    });
    return new Promise<GameState>((r) => {
      const q = db.transaction('saves').objectStore('saves').get('current');
      q.onsuccess = () => {
        r(q.result);
        db.close();
      };
    });
  });
}
async function fits(el: Locator, page: Page) {
  const b = await el.boundingBox(),
    v = page.viewportSize()!;
  expect(b).not.toBeNull();
  expect(b!.x).toBeGreaterThanOrEqual(-1);
  expect(b!.y).toBeGreaterThanOrEqual(-1);
  expect(b!.x + b!.width).toBeLessThanOrEqual(v.width + 1);
  expect(b!.y + b!.height).toBeLessThanOrEqual(v.height + 1);
  expect(await el.evaluate((e) => e.scrollWidth <= e.clientWidth + 2)).toBe(true);
}
async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${proof}/${name}.png`, animations: 'disabled' });
}
async function finish(page: Page) {
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'true', {
    timeout: 45000,
  });
  await expect(page.locator('.inventory-workspace')).toBeVisible();
  await page
    .locator('.inventory-workspace')
    .getByRole('button', { name: '귀환', exact: true })
    .click();
  const confirm = page.getByRole('dialog', { name: '남은 물품 확인', exact: true });
  await expect(confirm).toContainText('×7');
  await confirm.getByRole('button', { name: '남은 물품 두고 진행', exact: true }).click();
  await expect(page.locator('.journey-summary:not(.journey-death)')).toBeVisible();
}

for (const [width, height] of viewports) {
  test(`medium empty lobby, rules and keyboard ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    const guide = page.locator('.home-empty-copy button');
    await expect(guide).toBeVisible();
    await fits(guide, page);
    await fits(page.locator('.home-launch'), page);
    await expect(page.locator('.home-launch')).toHaveAttribute(
      'aria-describedby',
      'empty-roster-guidance',
    );
    await shot(page, `empty-${width}`);
    await guide.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.home-guide-rules')).toContainText('세가 창고로 옮겨집니다');
    await page.keyboard.press('Escape');
    await expect(guide).toBeFocused();
    await page.locator('.home-launch').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.recruitment-dialog')).toBeVisible();
  });
  test(`medium death claim preserves family and records visited route ${width}`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const initial = fixture('dead');
    await seed(page, initial);
    const dialog = page.locator('.journey-death');
    await expect(dialog).toBeVisible({ timeout: 45000 });
    await expect(dialog.locator('.journey-totals')).toContainText('123,456');
    await expect(dialog.locator('.journey-totals')).toContainText('2분 5초');
    await expect(dialog.locator('.journey-route')).toHaveText(
      initial.run!.regionRoute!.slice(0, 2).join(' → '),
    );
    await fits(dialog.locator('footer button'), page);
    await shot(page, `death-${width}`);
    await dialog.locator('footer button').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.home-scene')).toBeVisible();
    await expect.poll(async () => (await saved(page)).run).toBeNull();
    const state = await saved(page);
    expect(state.family.silver).toBe(1234);
    expect(state.family.warehouse).toEqual(initial.family.warehouse);
    expect(state.family.roster).toEqual([]);
    expect(state.family.deaths).toBe(1);
    expect(state.family.journeys![0]).toMatchObject({
      outcome: 'dead',
      wave: 7,
      kills: 123456,
      elapsed: 125.8,
      items: 0,
      gold: 0,
    });
    await page.locator('.home-launch').click();
    await expect(page.locator('.recruitment-dialog')).toBeVisible();
    expect(errors).toEqual([]);
    await writeFile(`${proof}/death-${width}.json`, JSON.stringify({ state, errors }, null, 2));
  });
  test(`medium actual victory, ground confirmation and retained bag ${width}`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await seed(page, fixture());
    await finish(page);
    const dialog = page.locator('.journey-summary');
    await expect(dialog.locator('.journey-totals')).toContainText('10개');
    await expect(dialog.locator('.journey-totals')).toContainText('77전');
    await expect(dialog.locator('.journey-totals')).toContainText('2분 5초');
    for (const button of await dialog.locator('footer button').all()) await fits(button, page);
    await shot(page, `victory-${width}`);
    await dialog.locator('footer .primary').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.inventory-workspace')).toBeVisible();
    await expect(page.locator('[data-item-id="medium-sword"]').first()).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.home-scene')).toBeVisible();
    const state = await saved(page),
      f = state.family.roster[0];
    expect(state.run).toBeNull();
    expect(state.family.silver).toBe(1311);
    expect(f.hp).toBe(80);
    expect(f.expiresAt! - f.bornAt!).toBe(7 * 86400000);
    expect(f.items.reduce((n, i) => n + i.count, 0)).toBe(10);
    expect(f.items.some((i) => i.id === 'left-behind')).toBe(false);
    await page.getByRole('button', { name: '창고', exact: true }).click();
    await expect(page.locator('.warehouse-toolbar')).toContainText('1종 · 총 2개');
    await page.keyboard.press('Escape');
    await page.reload();
    await expect(page.locator('.home-roster')).toContainText(f.name);
    expect(errors).toEqual([]);
    await writeFile(`${proof}/victory-${width}.json`, JSON.stringify({ state, errors }, null, 2));
  });
  test(`medium native art measurements for every appearance ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const state = fixture();
    command(state, { type: 'next' });
    const f = state.family.roster[0];
    state.family.roster = Array.from({ length: 11 }, (_, n) => ({
      ...structuredClone(f),
      id: `art-${n}`,
      appearance: n === 10 ? undefined : (n as Fighter['appearance']),
    }));
    state.selectedId = 'art-0';
    await seed(page, state);
    const rows = [];
    for (let n = 0; n < 11; n++) {
      const img = page.locator('.home-hero-image');
      await expect(img).toHaveAttribute(
        'src',
        n === 10 ? /portrait-v1.webp$/ : new RegExp(`lobby-${n}\\.webp$`),
      );
      await expect
        .poll(() =>
          img.evaluate(
            (e) => (e as HTMLImageElement).complete && (e as HTMLImageElement).naturalHeight > 0,
          ),
        )
        .toBe(true);
      const row = await img.evaluate((e) => {
        const i = e as HTMLImageElement,
          b = i.getBoundingClientRect();
        return {
          src: i.getAttribute('src'),
          width: i.naturalWidth,
          height: i.naturalHeight,
          attrWidth: Number(i.getAttribute('width')),
          attrHeight: Number(i.getAttribute('height')),
          box: b.toJSON(),
          scale: Math.min(b.width / i.naturalWidth, b.height / i.naturalHeight),
          fit: getComputedStyle(i).objectFit,
        };
      });
      expect(row.scale).toBeLessThanOrEqual(1.001);
      expect(row.attrWidth).toBe(row.width);
      expect(row.attrHeight).toBe(row.height);
      expect(row.fit).toBe('contain');
      rows.push(row);
      if (n === 6) await shot(page, `lobby-purple-${width}`);
      if (n < 10) await page.getByRole('button', { name: '명부 다음 무인', exact: true }).click();
    }
    await writeFile(`${proof}/art-measurements-${width}.json`, JSON.stringify(rows, null, 2));
  });
}

for (const [width, height] of viewports)
  test(`medium native Tab crosses transient stat tooltips and keeps focus in the bag ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    const state = fixture();
    command(state, { type: 'next' });
    state.family.roster[0].arts = ['huashan', 'wudang'].map((id) => ({
      id: id as 'huashan' | 'wudang',
      level: 3,
      gauge: 0,
      combo: 0,
      defenseCd: 0,
    }));
    await seed(page, state);
    const opener = page.getByRole('button', { name: '가방', exact: true });
    await opener.click();
    const con = page.getByRole('button', { name: '체질 설명', exact: true }),
      str = page.getByRole('button', { name: '근력 설명', exact: true });
    await con.focus();
    await expect(page.locator('.character-info-tooltip')).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(str).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(con).toBeFocused();
    const trace = [];
    for (
      let n = 0;
      n < 20 &&
      (await page.locator('.binding-list [data-technique="huashan"]:focus').count()) === 0;
      n++
    ) {
      await page.keyboard.press('Tab');
      trace.push(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')));
    }
    await expect(page.locator('.binding-list [data-technique="huashan"]')).toBeFocused();
    await expect(page.locator('.character-info-tooltip')).toHaveCount(0);
    await page.keyboard.down('Shift');
    await expect(page.locator('.quick-details')).toBeVisible();
    await page.keyboard.up('Shift');
    await expect(page.locator('.quick-details')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(opener).toBeFocused();
    await writeFile(`${proof}/tab-stat-tooltip-${width}.json`, JSON.stringify(trace, null, 2));
  });

test('medium empty bags and storage retain keyboard return focus', async ({ page }) => {
  await page.setViewportSize({ width: 1093, height: 614 });
  const state = fixture();
  command(state, { type: 'next' });
  state.family.roster[0].items = [];
  state.family.warehouse = [];
  await seed(page, state);
  const opener = page.getByRole('button', { name: '가방', exact: true });
  await opener.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.empty-detail')).toBeVisible();
  await expect(
    page.locator('.bag-grid.weapon [data-item-id],.bag-grid.general [data-item-id]'),
  ).toHaveCount(0);
  await fits(page.locator('.inventory-workspace .dialog-header button').last(), page);
  await shot(page, 'empty-bag-small');
  await page.keyboard.press('Escape');
  await expect(opener).toBeFocused();
  const warehouse = page.getByRole('button', { name: '창고', exact: true });
  await warehouse.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.empty-warehouse')).toBeVisible();
  await shot(page, 'empty-storage-small');
  await page.keyboard.press('Escape');
  await expect(warehouse).toBeFocused();
  expect((await saved(page)).family.roster[0].items).toEqual([]);
});

test('medium discard cancellation and confirmation preserve all other items', async ({ page }) => {
  await page.setViewportSize({ width: 1093, height: 614 });
  const state = fixture();
  command(state, { type: 'next' });
  const f = state.family.roster[0];
  f.items.push({ ...makeLootItem('material-0', 'discard-only', 'ground'), count: 2 });
  await seed(page, state);
  await page.getByRole('button', { name: '가방', exact: true }).click();
  await page.locator('[data-item-id="discard-only"]').first().click();
  const discard = page.locator('.item-actions').getByRole('button', { name: '폐기', exact: true });
  await discard.focus();
  await page.keyboard.press('Enter');
  const confirm = page.getByRole('alertdialog', { name: '물품 폐기 확인', exact: true });
  await expect(confirm).toBeVisible();
  await fits(confirm.locator('button.danger'), page);
  await shot(page, 'discard-confirm-small');
  await page.keyboard.press('Escape');
  await expect(discard).toBeFocused();
  expect((await saved(page)).family.roster[0].items).toHaveLength(5);
  await page.keyboard.press('Enter');
  await confirm.locator('button.danger').focus();
  await page.keyboard.press('Enter');
  await expect(confirm).toHaveCount(0);
  await expect.poll(async () => (await saved(page)).family.roster[0].items.length).toBe(4);
  expect((await saved(page)).family.roster[0].items).toEqual(
    f.items.filter((i) => i.id !== 'discard-only'),
  );
});

for (const locale of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW'])
  test(`medium translated empty and results with large HUD contrast reduced motion ${locale}`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width: 1093, height: 614 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(
      (locale) => localStorage.setItem('mugong-language-v1', locale),
      locale,
    );
    await page.goto('/');
    await expect(page.locator('.home-empty-copy')).toBeVisible();
    await fits(page.locator('.home-empty-copy button'), page);
    await fits(page.locator('.home-launch'), page);
    await page.locator('.home-header-end button').last().click();
    const switches = page.locator('.settings-dialog [role="switch"]:visible');
    // Enable both display switches; reduced motion comes from emulateMedia above.
    for (const switchEl of await switches.all())
      if ((await switchEl.getAttribute('aria-checked')) === 'false') await switchEl.click();
    await page.keyboard.press('Escape');
    await expect(page.locator('.app-shell')).toHaveAttribute('data-large-hud', 'true');
    await expect(page.locator('.app-shell')).toHaveAttribute('data-high-contrast', 'true');
    await shot(page, `empty-accessibility-${locale}`);
    const initial = fixture('dead');
    await seed(page, initial);
    const dialog = page.locator('.journey-death');
    await expect(dialog).toBeVisible({ timeout: 45000 });
    await fits(dialog.locator('footer button'), page);
    await shot(page, `death-accessibility-${locale}`);
    if (locale !== 'ko')
      expect((await dialog.innerText()).replaceAll(initial.run!.fighter.name, '')).not.toMatch(
        /[가-힣]{2,}/g,
      );
    await dialog.locator('footer button').click();
    await expect(page.locator('.home-scene')).toBeVisible();
    await seed(page, fixture());
    // Use structural selectors so the same actual return flow runs in all languages.
    await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'true', {
      timeout: 45000,
    });
    await page.locator('.inventory-workspace .inventory-next').click();
    await page.locator('.departure-confirm button.primary').click();
    const summary = page.locator('.journey-summary');
    await expect(summary).toBeVisible();
    for (const b of await summary.locator('footer button').all()) await fits(b, page);
    await shot(page, `victory-accessibility-${locale}`);
    if (locale !== 'ko')
      expect((await summary.innerText()).replaceAll(initial.run!.fighter.name, '')).not.toMatch(
        /[가-힣]{2,}/g,
      );
    await summary.locator('footer button').first().click();
    await expect(page.locator('.home-roster')).toBeVisible();
    expect(
      (await saved(page)).family.journeys!.filter((j) => j.outcome === 'victory'),
    ).toHaveLength(1);
  });
