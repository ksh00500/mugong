import { test, expect, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { seedRegion, observeScene } from './support/region';

const proof = 'docs/verification/combat-prep-v1';
async function fixture(page: Page, wave = 4) {
  await seedRegion(page, 0);
  await observeScene(page);
  await page.evaluate(async (wave) => {
    const w = window as any;
    w.prepStore = (await w.regionModule('/src/platform/store.ts')).gameStore;
    const { spawnWave } = await w.regionModule('/src/domain/game.ts');
    const { makeLootItem } = await w.regionModule('/src/domain/items.ts');
    w.regionScene.scene.pause();
    const r = w.prepStore.state.run,
      f = r.fighter;
    r.wave = wave;
    spawnWave(r);
    r.gold = 100;
    f.growth = { constitution: 1, strength: 1, agility: 1, inner: 1 };
    f.growthStartLevel = 0;
    f.hp = 150;
    f.items.push({ ...makeLootItem('material-0', 'prep-material', 'general'), count: 4 });
    w.prepStore.notify();
    w.regionScene.draw(r);
    await w.prepStore.persist();
  }, wave);
  await expect(page.locator('.prep-stop')).toBeVisible();
}
async function snapshot(page: Page) {
  return page.evaluate(async () => {
    const w = window as any;
    const s = (await w.regionModule('/src/platform/store.ts')).gameStore;
    const r = s.state.run;
    return {
      hp: r.fighter.hp,
      gold: r.gold,
      wave: r.wave,
      phase: r.phase,
      upgrades: r.fighter.items[0].upgrades ?? 0,
      stock: r.supplies?.[0].stock,
      material: r.fighter.items.find((i: any) => i.id === 'prep-material')?.count ?? 0,
      bossHp: r.enemies[0]?.maxHp,
    };
  });
}

for (const [width, height] of [
  [1440, 900],
  [1366, 768],
  [1093, 614],
]) {
  test(`정비 서비스·저장·가방·다음 보스 ${width}×${height}`, async ({ page }) => {
    test.setTimeout(90000);
    await mkdir(proof, { recursive: true });
    await page.setViewportSize({ width, height });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await fixture(page);
    const medic = page.getByRole('button', { name: '의원 · 회복 12전', exact: true });
    await expect(medic).toBeEnabled();
    await medic.click();
    await expect.poll(() => snapshot(page)).toMatchObject({ hp: 195, gold: 88 });
    const forge = page.getByRole('button', { name: '강화 · 12전 + 재료 2', exact: true });
    await forge.click();
    await expect.poll(() => snapshot(page)).toMatchObject({ upgrades: 1, material: 2, gold: 76 });
    await forge.click();
    await expect.poll(() => snapshot(page)).toMatchObject({ upgrades: 2, material: 0, gold: 64 });
    await expect(forge).toBeDisabled();
    await page.getByRole('button', { name: '정비 상인', exact: true }).click();
    const market = page.getByRole('dialog', { name: '정비 상인', exact: true });
    await expect(market).toBeVisible();
    await market
      .getByRole('button', { name: /구매 ·/ })
      .first()
      .click();
    await expect.poll(() => snapshot(page)).toMatchObject({ stock: 2 });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: '정비 상인', exact: true })).toBeFocused();
    await page.reload();
    await expect(page.locator('.prep-stop')).toBeVisible({ timeout: 30000 });
    await expect.poll(() => snapshot(page)).toMatchObject({ hp: 195, upgrades: 2, stock: 2 });
    await page.screenshot({ path: `${proof}/prep-${width}.png` });
    const boxes = await page
      .locator('.prep-stop button,.prep-stop select,.prep-next-boss')
      .evaluateAll((els) =>
        els.map((el) => ({
          ...el.getBoundingClientRect().toJSON(),
          overflow: el.scrollWidth > el.clientWidth + 2,
        })),
      );
    for (const b of boxes) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.right).toBeLessThanOrEqual(width);
      expect(b.bottom).toBeLessThanOrEqual(height);
      expect(b.overflow).toBe(false);
    }
    await page.getByRole('button', { name: '가방과 획득 물품', exact: true }).click();
    await expect(page.locator('.inventory-workspace')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: '가방과 획득 물품', exact: true })).toBeFocused();
    await page.getByRole('button', { name: '다음 5웨이브 →', exact: true }).click();
    await expect(page.getByRole('dialog', { name: '남은 물품 확인', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '남은 물품 두고 진행', exact: true }).click();
    await expect
      .poll(() => snapshot(page))
      .toMatchObject({ wave: 5, phase: 'combat', bossHp: 900 });
    expect(errors).toEqual([]);
  });
}

test('4·9·14·19 정비와 다섯 언어의 작은 화면', async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1093, height: 614 });
  await fixture(page);
  const reports: unknown[] = [];
  for (const wave of [4, 9, 14, 19]) {
    await page.evaluate(async (wave) => {
      const w = window as any,
        r = w.prepStore.state.run;
      r.wave = wave;
      (await w.regionModule('/src/domain/game.ts')).spawnWave(r);
      w.prepStore.notify();
    }, wave);
    for (const locale of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW']) {
      await page.evaluate(async (locale) => {
        const w = window as any;
        (await w.regionModule('/src/platform/i18n.ts')).setLanguage(locale);
      }, locale);
      await expect(page.locator('.app-shell')).toHaveAttribute('data-locale', locale);
      await expect(page.locator('.region-label b')).toHaveCSS('line-height', '22.8px');
      expect((await page.locator('.region-label b').boundingBox())!.height).toBeLessThan(30);
      const bounds = await page.locator('.prep-stop button,.prep-stop select').evaluateAll((els) =>
        els.map((el) => ({
          text: el.textContent,
          ...el.getBoundingClientRect().toJSON(),
          overflow: el.scrollWidth > el.clientWidth + 2,
        })),
      );
      for (const b of bounds) {
        expect(b.bottom, `${wave}/${locale}/${b.text}`).toBeLessThanOrEqual(614);
        expect(b.right).toBeLessThanOrEqual(1093);
        expect(b.overflow, b.text ?? '').toBe(false);
      }
      reports.push({ wave, locale, bounds });
      if (wave === 19) await page.screenshot({ path: `${proof}/prep-small-${locale}.png` });
    }
  }
  await writeFile(`${proof}/layout.json`, JSON.stringify(reports, null, 2));
});

test('품절 재고·강화 불가·금전 부족·가득 찬 체력', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await fixture(page);
  await page.evaluate(async () => {
    const w = window as any,
      r = w.prepStore.state.run;
    r.supplies.forEach((s: any) => {
      s.stock = 0;
    });
    r.gold = 0;
    r.fighter.hp = (await w.regionModule('/src/domain/content.ts')).maximumHp(r.fighter);
    r.fighter.items = [];
    w.prepStore.notify();
    await w.prepStore.persist();
  });
  await expect(page.getByRole('button', { name: '의원 · 회복 12전', exact: true })).toBeDisabled();
  await expect(page.locator('#prep-equipment')).toBeDisabled();
  await expect(page.locator('.prep-stop')).toContainText('남은 재고 0개');
  await page.getByRole('button', { name: '정비 상인', exact: true }).click();
  await expect(page.locator('.rest-market-stock article')).toHaveCount(3);
  await expect(page.getByRole('button', { name: '품절', exact: true })).toHaveCount(3);
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(page.locator('.prep-stop')).toBeVisible({ timeout: 30000 });
  await expect(page.locator('.prep-stop')).toContainText('남은 재고 0개');
  await page.evaluate(async () => {
    const w = window as any;
    const s = (await w.regionModule('/src/platform/store.ts')).gameStore;
    s.state.run.fighter.hp -= 10;
    s.notify();
  });
  await expect(page.getByRole('button', { name: '의원 · 회복 12전', exact: true })).toBeDisabled();
  await expect(page.locator('.prep-service').first()).toContainText('금전 부족');
  expect(errors).toEqual([]);
});

for (const webgl of [false, true])
  test(`실제 렌더와 몸통 피격 ${webgl ? 'WebGL' : 'Canvas'}`, async ({ page }) => {
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
    await seedRegion(page, 0);
    await observeScene(page);
    const result = await page.evaluate(async () => {
      const w = window as any,
        s = (await w.regionModule('/src/platform/store.ts')).gameStore;
      const { tick } = await w.regionModule('/src/domain/game.ts');
      const { combatBody } = await w.regionModule('/src/domain/combat-body.ts');
      w.regionScene.scene.pause();
      const r = s.state.run,
        f = r.fighter;
      const before = f.hp;
      r.enemies.forEach((e: any) => {
        e.timer = 1000;
        e.speed = 0;
      });
      const shot = (y: number) => ({
        x: f.x - 90,
        y,
        vx: 10800,
        vy: 0,
        life: 1,
        damage: 20,
        friendly: false,
        hits: [],
        radius: 2,
      });
      const input = { dx: 0, dy: 0, aim: 0, attack: false, ultimate: false, defense: false };
      r.projectiles = [shot(f.y - 95)];
      tick(r, input, 1 / 60);
      const miss = f.hp;
      r.projectiles = [shot(f.y - 52)];
      tick(r, input, 1 / 60);
      const hit = f.hp;
      s.notify();
      w.regionScene.draw(r);
      const body = combatBody(f),
        g = w.regionScene.add.graphics().setDepth(999);
      g.lineStyle(2, 0x00ffff, 1);
      g.strokeRoundedRect(
        body.top.x - body.radius,
        body.top.y - body.radius,
        body.radius * 2,
        body.bottom.y - body.top.y + body.radius * 2,
        body.radius,
      );
      return { renderer: w.regionScene.game.renderer.constructor.name, before, miss, hit, body };
    });
    expect(result.miss).toBe(result.before);
    expect(result.hit).toBeLessThan(result.before);
    expect(result.renderer).toMatch(webgl ? /^WebGLRenderer\d*$/ : /^CanvasRenderer\d*$/);
    await page.screenshot({ path: `${proof}/body-${webgl ? 'webgl' : 'canvas'}.png` });
    await writeFile(
      `${proof}/body-${webgl ? 'webgl' : 'canvas'}.json`,
      JSON.stringify(result, null, 2),
    );
  });
