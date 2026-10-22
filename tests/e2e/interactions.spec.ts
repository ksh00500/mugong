import { test, expect, type Page, type Locator } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { command, emptyGame, grantXp, startRun } from '../../src/domain/game';
import { makeItem } from '../../src/domain/content';
import type { GameState } from '../../src/domain/model';

const publicBuild = !!process.env.MUGONG_DAYTONA_URL;
const proof = `docs/verification/interactions-v3/${publicBuild ? 'public' : 'local'}`;
test.beforeEach(async () => {
  await mkdir(proof, { recursive: true });
});

function fixture() {
  const state = emptyGame();
  startRun(state, '조작 검증', 123);
  state.run!.wave = 20;
  state.run!.phase = 'loot';
  state.run!.enemies = [];
  state.run!.fighter.items = [
    makeItem('sword', 'sword', 'weapon'),
    { ...makeItem('medicine', 'medicine', 'general'), x: 0, y: 0, count: 3 },
    { ...makeItem('robe', 'robe', 'general'), x: 8, y: 3 },
    { ...makeItem('ore', 'ore', 'general'), x: 4, y: 0 },
  ];
  command(state, { type: 'next' });
  state.family.warehouse.push(makeItem('boots', 'boots', 'warehouse'));
  return state;
}
async function seed(page: Page, state: GameState) {
  await page.goto('/');
  await expect(page.locator('.home-scene')).toBeVisible();
  await page.evaluate(async (state) => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const req = indexedDB.open('mugong-local-v1', 1);
      req.onsuccess = () => resolve(req.result);
    });
    await new Promise<void>((resolve) => {
      const tx = db.transaction('saves', 'readwrite');
      tx.objectStore('saves').put(state, 'current');
      tx.oncomplete = () => resolve();
    });
    db.close();
  }, state);
  await page.reload();
  await expect(
    page.locator(state.run ? '.game-canvas[data-ready="true"]' : '.home-scene'),
  ).toBeVisible();
}
async function saved(page: Page): Promise<GameState> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const req = indexedDB.open('mugong-local-v1', 1);
      req.onsuccess = () => resolve(req.result);
    });
    return new Promise<GameState>((resolve) => {
      const req = db.transaction('saves').objectStore('saves').get('current');
      req.onsuccess = () => {
        resolve(req.result);
        db.close();
      };
    });
  });
}
async function drag(page: Page, source: Locator, target: Locator) {
  const from = (await source.boundingBox())!,
    to = (await target.boundingBox())!;
  await page.mouse.move(from.x + from.width * 0.2, from.y + from.height * 0.2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width * 0.2 + 8, from.y + from.height * 0.2 + 8, {
    steps: 3,
  });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 10 });
  await page.mouse.move(to.x + to.width / 2 + 1, to.y + to.height / 2 + 1);
  await page.mouse.up();
}

for (const [width, height] of [
  [1440, 900],
  [1366, 768],
  [1093, 614],
]) {
  test(`로비 hover와 클릭 선택은 이동을 유발하지 않는다 ${width}×${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await seed(page, fixture());
    await page.evaluate(() => document.fonts.ready);
    const states = [];
    for (const name of ['출전', '가방', '창고', '기록', '소리 끄기', '설정']) {
      const button = page.getByRole('button', { name, exact: true });
      const before = (await button.boundingBox())!;
      await button.hover();
      await page.waitForTimeout(160);
      const after = (await button.boundingBox())!;
      expect(after).toEqual(before);
      const style = await button.evaluate((el) => {
        const s = getComputedStyle(el);
        return { transform: s.transform, background: s.background, shadow: s.boxShadow };
      });
      expect(style.transform).toBe('none');
      if (name === '출전') expect(style.shadow).toContain('inset');
      states.push({ name, before, after, ...style });
    }
    await page.screenshot({ path: `${proof}/lobby-hover-${width}.png`, animations: 'disabled' });
    await page.getByRole('button', { name: '가방', exact: true }).click();
    await page.locator('[data-item-id="sword"]').click();
    const cell = page.locator('.bag-grid.general [data-cell="25"]');
    const background = await cell.evaluate((el) => getComputedStyle(el).backgroundColor);
    await cell.hover();
    expect(await cell.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(background);
    await expect(page.locator('.placement-preview')).toHaveCount(0);
    await cell.click();
    expect((await saved(page)).family.roster[0].items.find((i) => i.id === 'sword')).toMatchObject({
      place: 'weapon',
      x: 0,
      y: 0,
    });
    expect(
      await page
        .locator('.bag-cell')
        .evaluateAll((cells) =>
          cells.every((el) => el.tagName === 'SPAN' && (el as HTMLElement).tabIndex < 0),
        ),
    ).toBe(true);
    await page.getByRole('button', { name: '일반 가방에 수납', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect
      .poll(
        async () => (await saved(page)).family.roster[0].items.find((i) => i.id === 'sword')?.place,
      )
      .toBe('general');
    await expect(page.getByRole('button', { name: '무장으로', exact: true })).toBeEnabled();
    await page.screenshot({ path: `${proof}/bag-buttons-${width}.png`, animations: 'disabled' });
    await writeFile(`${proof}/hover-${width}.json`, JSON.stringify(states, null, 2));
  });
}

test('드래그는 선택과 독립적으로 이동하고 충돌·경계·종류 제한 및 즉시 회전을 안내한다', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await seed(page, fixture());
  await page.getByRole('button', { name: '가방', exact: true }).click();
  const bag = page.locator('.bag-grid.general');
  const medicine = bag.locator('[data-item-id="medicine"]');
  // No prior selection: native drag must use the dragged item, not the previous selection.
  await drag(page, medicine, bag.locator('[data-cell="62"]'));
  await expect
    .poll(async () => (await saved(page)).family.roster[0].items.find((i) => i.id === 'medicine'))
    .toMatchObject({ count: 3, x: 2, y: 6 });
  expect(
    (await saved(page)).family.roster[0].items.filter((i) => i.kind === 'medicine'),
  ).toHaveLength(1);
  await drag(page, medicine, bag.locator('[data-cell="4"]'));
  await expect(page.locator('.inventory-status')).toContainText('다른 물품과 겹칩니다.');
  await drag(page, medicine, bag.locator('[data-cell="62"]'));
  await expect(page.locator('.inventory-status')).toContainText('가방에 수납했습니다.');
  await drag(page, medicine, page.locator('.inventory-status'));
  await expect(page.locator('.placement-preview')).toHaveCount(0);
  expect((await saved(page)).family.roster[0].items.find((i) => i.id === 'medicine')).toMatchObject(
    { count: 3, x: 2, y: 6 },
  );
  await drag(page, medicine, page.locator('.bag-grid.weapon [data-cell="3"]'));
  await expect(page.locator('.inventory-status')).toContainText(
    '이 가방에는 무기만 수납할 수 있습니다.',
  );
  const robe = bag.locator('[data-item-id="robe"]');
  await robe.click();
  await page.getByRole('button', { name: '회전', exact: true }).click();
  await expect(page.locator('.inventory-status')).toContainText('가방 경계를 벗어납니다.');
  expect((await saved(page)).family.roster[0].items.find((i) => i.id === 'robe')?.rotated).toBe(
    false,
  );
  await drag(page, robe, bag.locator('[data-cell="79"]'));
  await expect(page.locator('.inventory-status')).toContainText('가방 경계를 벗어납니다.');
  await drag(page, robe, bag.locator('[data-cell="32"]'));
  await expect
    .poll(async () => (await saved(page)).family.roster[0].items.find((i) => i.id === 'robe'))
    .toMatchObject({ x: 2, y: 3 });
  await robe.click();
  await page.keyboard.press('r');
  await expect
    .poll(async () => (await saved(page)).family.roster[0].items.find((i) => i.id === 'robe'))
    .toMatchObject({ x: 2, y: 3, rotated: true });
  await expect(robe).toHaveAttribute('title', '무명 도포 · 3×2');
  await expect(page.locator('.placement-preview')).toHaveCount(0);
  await page.locator('.warehouse-section [data-item-id="boots"]').click();
  await drag(page, robe, page.locator('.warehouse-section'));
  await expect
    .poll(async () => (await saved(page)).family.warehouse.some((i) => i.id === 'robe'))
    .toBe(true);
  await page.locator('.warehouse-section [data-item-id="robe"]').click();
  await page.getByRole('button', { name: '일반 가방에 수납', exact: true }).click();
  await expect
    .poll(async () => (await saved(page)).family.warehouse.some((i) => i.id === 'robe'))
    .toBe(false);
  await drag(page, bag.locator('[data-item-id="robe"]'), page.locator('.ground-section'));
  await expect
    .poll(
      async () => (await saved(page)).family.roster[0].items.find((i) => i.id === 'robe')?.place,
    )
    .toBe('ground');
  await page.getByRole('button', { name: '일반 가방에 수납', exact: true }).click();
  await expect
    .poll(
      async () => (await saved(page)).family.roster[0].items.find((i) => i.id === 'robe')?.place,
    )
    .toBe('general');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: '가방', exact: true })).toBeFocused();
  await page.reload();
  await page.getByRole('button', { name: '가방', exact: true }).click();
  expect((await saved(page)).family.roster[0].items.find((i) => i.id === 'medicine')).toMatchObject(
    { count: 3, x: 2, y: 6 },
  );
  expect(errors).toEqual([]);
  await page.screenshot({ path: `${proof}/drag-roundtrip.png`, animations: 'disabled' });
});

test('전투에서 가방·일시 정지로 진입하면 누르고 있던 공격과 이동을 비우고 관리 입력을 격리한다', async ({
  page,
}) => {
  test.skip(publicBuild, '실시간 입력 관찰은 독립 개발 브라우저에서만 실행');
  const state = emptyGame();
  startRun(state, '전투 조작 검증', 123);
  const run = state.run!;
  grantXp(run, 100);
  while (run.offers.length) command(state, { type: 'choose', offer: run.offers[0] });
  run.enemies = [
    {
      ...run.enemies[0],
      x: run.fighter.x + 70,
      y: run.fighter.y,
      hp: 10000,
      maxHp: 10000,
      xp: 0,
      timer: 100,
    },
  ];
  await seed(page, state);
  await page.evaluate(async () => {
    const path = ((window as any).interactionStoreUrl ??=
      performance
        .getEntriesByType('resource')
        .map((entry) => entry.name)
        .find((url) => new URL(url).pathname === '/src/platform/store.ts') ??
      '/src/platform/store.ts');
    const { gameStore } = await import(path);
    const advance = gameStore.advance.bind(gameStore);
    (window as any).interactionInputs = [];
    gameStore.advance = (input: any, ...rest: any[]) => {
      (window as any).interactionInputs.push({ ...input });
      return advance(input, ...rest);
    };
  });
  const canvas = (await page.locator('canvas').boundingBox())!;
  await page.mouse.move(canvas.x + canvas.width * 0.57, canvas.y + canvas.height * 0.6);
  await page.mouse.down();
  await page.keyboard.down('d');
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).interactionInputs.some((i: any) => i.attack && i.dx)),
    )
    .toBe(true);
  await page.keyboard.press('i');
  await expect(page.getByRole('dialog', { name: '가방 · 정보 확인' })).toBeVisible();
  await page.mouse.up();
  await page.keyboard.up('d');
  await page.locator('.bag-grid.weapon .item-tile').first().click();
  await expect(page.getByRole('button', { name: '일반 가방에 수납', exact: true })).toBeDisabled();
  const activeArt = page.locator('.art-fan button[aria-pressed="true"]');
  const active = await activeArt.getAttribute('data-technique');
  expect(active).toBeTruthy();
  await page.keyboard.press('q');
  await page.keyboard.press('e');
  await expect(activeArt).toHaveAttribute('data-technique', active!);
  await page.screenshot({ path: `${proof}/combat-bag.png`, animations: 'disabled' });
  await page.evaluate(() => {
    (window as any).interactionInputs = [];
  });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: '가방 · 정보 확인' })).toBeHidden();
  await expect
    .poll(() => page.evaluate(() => (window as any).interactionInputs.length))
    .toBeGreaterThan(3);
  expect(
    await page.evaluate(() =>
      (window as any).interactionInputs.some((i: any) => i.attack || i.dx || i.dy),
    ),
  ).toBe(false);
  await page.getByRole('button', { name: '일시 정지', exact: true }).click();
  await page.keyboard.press('e');
  await expect(activeArt).toHaveAttribute('data-technique', active!);
  await page.getByRole('button', { name: '계속하기', exact: true }).click();
  await page.keyboard.press('e');
  await expect(activeArt).not.toHaveAttribute('data-technique', active!);
  await page.keyboard.press('Space');
  await expect(page.locator('.defense-slot.active .cooldown-dial b')).not.toHaveText('');
  await page.screenshot({ path: `${proof}/combat-resumed.png` });
});
