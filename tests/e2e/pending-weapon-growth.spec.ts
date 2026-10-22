import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { seedRegion, observeScene } from './support/region';
const proof = 'docs/verification/pending-weapon-growth-v1';

test('연속 성장 후보를 마우스로 선택하고 저장 뒤 새 후보가 다시 눌린다', async ({ page }) => {
  await mkdir(proof, { recursive: true });
  await seedRegion(page, 2);
  await page.evaluate(async () => {
    const { gameStore: store } = await (window as any).regionModule('/src/platform/store.ts');
    const r = store.state.run;
    r.fighter.arts = ['shaolin', 'jegal', 'tianmo', 'samja'].map((id, n) => ({
      id,
      level: [2, 4, 2, 1][n],
      gauge: 0,
      combo: 0,
      defenseCd: 0,
    }));
    r.fighter.level = 14;
    r.fighter.spent = r.spent = 8;
    r.offers = ['shaolin', 'jegal', 'tianmo'].map((art) => ({ art, type: 'upgrade' }));
    store.paused = true;
    store.notify();
  });
  const traces = [];
  for (let step = 0; step < 6; step++) {
    const card = page.locator('.choice-card:visible').first();
    await expect(card).toBeEnabled();
    traces.push(
      await card.evaluate((el) => ({
        disabled: (el as HTMLButtonElement).disabled,
        inert: !!el.closest('[inert]'),
        label: el.textContent,
      })),
    );
    if (!step) await page.screenshot({ path: `${proof}/growth.png` });
    await card.locator('.choose-label').click();
    await expect
      .poll(() =>
        page.evaluate(async () => {
          const { gameStore: store } = await (window as any).regionModule('/src/platform/store.ts');
          return store.state.run.spent;
        }),
      )
      .toBe(9 + step);
  }
  await expect(page.locator('.growth')).toHaveCount(0);
  await writeFile(`${proof}/growth-clicks.json`, JSON.stringify(traces, null, 2));
});

for (const [width, height] of [
  [1440, 900],
  [1366, 768],
  [1093, 614],
]) {
  test(`상점 → 획득 물품 → 수납·사용·꺼내기·폐기 ${width}×${height}`, async ({ page }) => {
    await mkdir(proof, { recursive: true });
    await page.setViewportSize({ width, height });
    await seedRegion(page, 0);
    await page.evaluate(async () => {
      const { gameStore: store } = await (window as any).regionModule('/src/platform/store.ts');
      const r = store.state.run;
      r.phase = 'prep';
      r.wave = 4;
      r.gold = 1000;
      r.enemies = [];
      r.offers = [];
      r.fighter.hp = 60;
      store.notify();
    });
    await page.getByRole('button', { name: '정비 상인', exact: true }).click();
    await page.locator('.market-purchase button').click();
    await page.getByRole('button', { name: '정비 상인 닫기' }).click();
    await page.getByRole('button', { name: '가방과 획득 물품' }).click();
    await expect(page.locator('.board-section')).toHaveCount(0);
    const purchased = page.locator('.ground-section [data-item-id*="vendor-"]').first();
    await expect(purchased).toBeVisible();
    await purchased.click();
    await page.getByRole('button', { name: '사용', exact: true }).click();
    await expect(purchased).toHaveCount(0);
    await page.locator('.bag-grid.weapon .bag-item').first().click();
    await page.getByRole('button', { name: '획득 물품으로', exact: true }).click();
    const pending = page.locator('.ground-section .item-tile').first();
    await pending.click();
    await page.getByRole('button', { name: '무장 가방에 수납', exact: true }).click();
    await expect(pending).toHaveCount(0);
    await page.locator('.bag-grid.weapon .bag-item').first().click();
    await page.getByRole('button', { name: '획득 물품으로', exact: true }).click();
    await page.getByRole('button', { name: '무인의 가방 닫기' }).click();
    await expect(page.locator('.inventory-workspace')).toHaveCount(0);
    await page.getByRole('button', { name: '가방과 획득 물품' }).click();
    await page.locator('.ground-section .item-tile').first().click();
    await page.getByRole('button', { name: '폐기', exact: true }).click();
    await page
      .getByRole('alertdialog', { name: '물품 폐기 확인' })
      .getByRole('button', { name: '폐기', exact: true })
      .click();
    await expect(page.locator('.ground-section .item-tile')).toHaveCount(0);
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await page.screenshot({ path: `${proof}/bag-${width}.png` });
    expect(
      await page
        .locator('.inventory-workspace')
        .evaluate((el) => el.scrollHeight <= el.clientHeight + 2),
    ).toBe(true);
  });
}

test('6종 연결 무기가 팔방·공격 자세에서 실제 물품 그림으로 표시된다', async ({ page }) => {
  await mkdir(proof, { recursive: true });
  await seedRegion(page, 2);
  await observeScene(page);
  const results = [];
  for (const [style, art] of [
    ['sword', 'samja'],
    ['dao', 'tianmo'],
    ['gauntlet', 'shaolin'],
    ['staff', 'gaebang'],
    ['dart', 'tang'],
    ['fan', 'jegal'],
  ]) {
    results.push(
      await page.evaluate(
        async ({ style, art }) => {
          const { gameStore: store } = await (window as any).regionModule('/src/platform/store.ts');
          const { makeLootItem } = await (window as any).regionModule('/src/domain/items.ts');
          store.paused = false;
          store.rendererReady = false;
          const f = store.state.run.fighter,
            scene = (window as any).regionScene;
          f.arts = [{ id: art, level: 5, gauge: 0, combo: 0, defenseCd: 0 }];
          f.active = 0;
          const item = makeLootItem(`weapon-${style}-2`, 'bound', 'weapon');
          f.items = [item];
          f.bindings = { [art]: item.id };
          store.notify();
          const frames = [];
          for (let dir = 0; dir < 8; dir++)
            for (const [action, time] of [
              ['idle', 0],
              ['attack', 0.24],
              ['attack', 0.16],
            ]) {
              f.facing = (dir * Math.PI) / 4;
              f.action = action;
              f.actionTime = time;
              scene.animationTime += 1;
              scene.draw(store.state.run);
              const weapon = scene.heldWeapon.image;
              frames.push({
                visible: weapon.visible,
                texture: weapon.texture.key,
                style: weapon.getData('style'),
                finite: Number.isFinite(weapon.x + weapon.y + weapon.rotation),
              });
            }
          return { style, frames };
        },
        { style, art },
      ),
    );
    await page.screenshot({ path: `${proof}/weapon-${style}.png` });
  }
  for (const result of results)
    for (const frame of result.frames) {
      expect(frame.visible && frame.finite).toBe(true);
      expect(frame.style).toBe(result.style);
      expect(frame.texture).toBe(`held-weapon-${result.style}-2`);
    }
  await writeFile(`${proof}/weapons.json`, JSON.stringify(results, null, 2));
});

test('보스 전용 권갑·봉·검도 연결한 물품 그대로 표시된다', async ({ page }) => {
  await seedRegion(page, 2);
  await observeScene(page);
  for (const [id, art, style] of [
    ['4-4', 'shaolin', 'gauntlet'],
    ['5-2', 'gaebang', 'staff'],
    ['2-1', 'samja', 'sword'],
  ]) {
    const result = await page.evaluate(
      async ({ id, art }) => {
        const { gameStore: store } = await (window as any).regionModule('/src/platform/store.ts');
        const { bossReward } = await (window as any).regionModule('/src/domain/boss-loot.ts');
        store.paused = false;
        store.rendererReady = false;
        const f = store.state.run.fighter;
        const item = bossReward(id, 'bound-boss');
        item.place = 'weapon';
        item.x = 0;
        item.y = 0;
        f.items = [item];
        f.active = 0;
        f.arts = [{ id: art, level: 5, gauge: 0, combo: 0, defenseCd: 0 }];
        f.bindings = { [art]: item.id };
        store.notify();
        const frames = [];
        for (let dir = 0; dir < 8; dir++) {
          f.facing = (dir * Math.PI) / 4;
          f.action = 'attack';
          f.actionTime = 0.16;
          (window as any).regionScene.draw(store.state.run);
          const image = (window as any).regionScene.heldWeapon.image;
          frames.push({
            visible: image.visible,
            texture: image.texture.key,
            style: image.getData('style'),
          });
        }
        return frames;
      },
      { id, art },
    );
    for (const frame of result) {
      expect(frame.visible).toBe(true);
      expect(frame.style).toBe(style);
      expect(frame.texture).toBe(`held-boss-${id}`);
    }
    await page.screenshot({ path: `${proof}/boss-weapon-${style}.png` });
  }
});
