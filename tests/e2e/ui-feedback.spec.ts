import { test, expect, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { seedRegion, observeScene } from './support/region';

const proof = 'docs/verification/ui-feedback-v1';
const player = '.player-panel .meter.health';

async function advance(page: Page, ms: number) {
  await page.clock.runFor(ms);
  await page.evaluate((ms) => {
    const w = window as any;
    w.regionScene.animationTime += ms / 1000;
    w.regionScene.draw(w.feedbackStore.state.run);
  }, ms);
}

async function fixture(page: Page) {
  await page.clock.install();
  await seedRegion(page, 0);
  await observeScene(page);
  await page.evaluate(async () => {
    const w = window as any;
    w.feedbackStore = (await w.regionModule('/src/platform/store.ts')).gameStore;
    const f = w.feedbackStore.state.run.fighter;
    const { maximumHp } = await w.regionModule('/src/domain/content.ts');
    f.hp = maximumHp(f);
    f.arts = ['huashan', 'wudang'].map((id) => ({
      id,
      level: 5,
      gauge: 100,
      combo: 0,
      defenseCd: 0,
    }));
    f.bindings = { huashan: f.items[0].id, wudang: f.items[0].id };
    f.active = 0;
    w.regionScene.scene.pause();
    w.feedbackStore.notify();
    w.regionScene.draw(w.feedbackStore.state.run);
  });
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 50));
  await page.clock.runFor(32);
  await expect(page.locator(player)).toHaveAttribute('data-feedback', 'idle');
}

async function health(page: Page, ratio: number) {
  await page.evaluate(async (ratio) => {
    const w = window as any,
      r = w.feedbackStore.state.run;
    const { maximumHp } = await w.regionModule('/src/domain/content.ts');
    r.fighter.hp = Math.round(maximumHp(r.fighter) * ratio);
    r.enemies.forEach((e: any) => (e.hp = e.maxHp * ratio));
    w.feedbackStore.notify();
    w.regionScene.draw(r);
  }, ratio);
  await advance(page, 16);
}

for (const [width, height] of [
  [1440, 900],
  [1366, 768],
  [1093, 614],
]) {
  test(`실제 HP·흰 잔량·회복·위험 상태 ${width}×${height}`, async ({ page }) => {
    test.setTimeout(90000);
    await mkdir(proof, { recursive: true });
    await page.setViewportSize({ width, height });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await fixture(page);
    await page.screenshot({ path: `${proof}/ready-${width}.png` });
    await health(page, 0.6);
    const snapshot = await page.locator(player).evaluate((el) => ({
      phase: (el as HTMLElement).dataset.feedback,
      actual: Number((el as HTMLElement).style.getPropertyValue('--meter-value')),
      trail: Number((el as HTMLElement).style.getPropertyValue('--meter-trail')),
      now: Number(el.getAttribute('aria-valuenow')),
      max: Number(el.getAttribute('aria-valuemax')),
      fill: getComputedStyle(el.querySelector('.meter-fill')!).transform,
    }));
    expect(snapshot.phase).toBe('hit');
    expect(snapshot.actual).toBeCloseTo(0.6, 1);
    expect(snapshot.now / snapshot.max).toBeCloseTo(0.6, 1);
    expect(snapshot.trail).toBe(1);
    await expect(page.locator('.boss-panel .meter')).toHaveAttribute('data-feedback', 'hit');
    const world = await page.evaluate(() => {
      const s = (window as any).regionScene;
      return [500, 503].map((id) => s.actors.get(String(id)).getData('healthTrail'));
    });
    for (const sample of world) {
      expect(sample.ratio).toBe(0.6);
      expect(sample.trail).toBe(1);
    }
    await page.screenshot({ path: `${proof}/damage-${width}.png` });
    await advance(page, 260);
    const draining = await page
      .locator(player)
      .evaluate((el) => Number((el as HTMLElement).style.getPropertyValue('--meter-trail')));
    expect(draining).toBeGreaterThan(snapshot.actual);
    expect(draining).toBeLessThan(1);
    await advance(page, 400);
    await expect(page.locator(player)).toHaveAttribute('data-feedback', 'idle');
    await health(page, 0.2);
    await expect(page.locator('.player-panel')).toHaveClass(/critical-health/);
    await expect(page.locator('.health-line small')).toHaveText('체력 · 위험');
    await advance(page, 650);
    await page.screenshot({ path: `${proof}/critical-${width}.png` });
    await health(page, 0.8);
    await expect(page.locator(player)).toHaveAttribute('data-feedback', 'heal');
    await page.screenshot({ path: `${proof}/heal-${width}.png` });
    await advance(page, 350);
    await expect(page.locator(player)).toHaveAttribute('data-feedback', 'idle');
    await expect(page.locator('.ultimate-ready')).toBeVisible();
    await expect(page.locator('.defense-slot.active')).toHaveAttribute('data-state', 'ready');
    const bounds = await page
      .locator('.player-panel,.boss-panel,.art-fan,.ultimate-panel,.defense-panel,.hud-actions')
      .evaluateAll((els) =>
        els.map((el) => ({
          class: el.className,
          ...el.getBoundingClientRect().toJSON(),
          overflow: el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2,
        })),
      );
    for (const box of bounds) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(width + 1);
      expect(box.bottom).toBeLessThanOrEqual(height + 1);
      expect(box.overflow, box.class).toBe(false);
    }
    await writeFile(
      `${proof}/feedback-${width}.json`,
      JSON.stringify({ snapshot, world, draining, bounds, errors }, null, 2),
    );
    expect(errors).toEqual([]);
  });
}

test('카메라 강도·정지·조준 보정·고정 HUD·움직임 감소', async ({ page }) => {
  test.setTimeout(90000);
  await fixture(page);
  const report = await page.evaluate(async () => {
    const w = window as any,
      s = w.regionScene,
      store = w.feedbackStore;
    const { setShakePreference } = await w.regionModule('/src/platform/feedback-preferences.ts');
    setShakePreference('standard');
    const f = store.state.run.fighter;
    const before = JSON.stringify({ x: f.x, y: f.y, hp: f.hp, elapsed: store.state.run.elapsed });
    const hud = document.querySelector('.player-panel')!.getBoundingClientRect().toJSON();
    const camera = s.cameras.main,
      base = { x: camera.scrollX, y: camera.scrollY };
    s.feedback.receive(
      [{ kind: 'impact', target: 'hero', amount: 36, x: f.x, y: f.y, angle: 0, killed: false }],
      s.animationTime,
      false,
    );
    s.feedback.updateCamera(s.animationTime + 0.03, false);
    const offset = { ...s.feedback.cameraOffset },
      screen = { x: offset.x * camera.zoom, y: offset.y * camera.zoom };
    // Phaser recalculates its world matrix before pointer dispatch in the next frame.
    camera.preRender();
    const pointer = { x: 600, y: 280, leftButtonDown: () => false, rightButtonDown: () => false };
    const point = camera.getWorldPoint(pointer.x, pointer.y);
    s.input.emit('pointermove', pointer);
    const aimError = Math.abs(
      s.aim - Math.atan2(point.y - offset.y - (f.y - 35), point.x - offset.x - f.x),
    );
    const afterHud = document.querySelector('.player-panel')!.getBoundingClientRect().toJSON();
    s.feedback.updateCamera(s.animationTime + 1, false);
    const settled = { x: camera.scrollX - base.x, y: camera.scrollY - base.y };
    setShakePreference('off');
    s.feedback.receive(
      [{ kind: 'impact', target: 'hero', amount: 90, x: f.x, y: f.y, angle: 0 }],
      s.animationTime + 2,
      false,
    );
    s.feedback.updateCamera(s.animationTime + 2.03, false);
    const off = { ...s.feedback.cameraOffset };
    setShakePreference('standard');
    s.feedback.receive(
      [{ kind: 'impact', target: 'hero', amount: 90, x: f.x, y: f.y, angle: 0 }],
      s.animationTime + 3,
      false,
    );
    s.feedback.updateCamera(s.animationTime + 3.03, true);
    return {
      before,
      after: JSON.stringify({ x: f.x, y: f.y, hp: f.hp, elapsed: store.state.run.elapsed }),
      hud,
      afterHud,
      screen,
      aimError,
      settled,
      off,
      reduced: s.feedback.cameraOffset,
      nativeShake: camera.shakeEffect.isRunning,
    };
  });
  expect(Math.abs(report.screen.x) + Math.abs(report.screen.y)).toBeGreaterThan(0);
  expect(Math.abs(report.screen.x)).toBeLessThanOrEqual(4.335);
  expect(Math.abs(report.screen.y)).toBeLessThanOrEqual(2.818);
  expect(report.aimError).toBeLessThan(0.000001);
  expect(report.before).toBe(report.after);
  expect(report.hud).toEqual(report.afterHud);
  expect(Math.abs(report.settled.x) + Math.abs(report.settled.y)).toBeLessThan(0.000001);
  expect(report.off).toEqual({ x: 0, y: 0 });
  expect(report.reduced).toEqual({ x: 0, y: 0 });
  expect(report.nativeShake).toBe(false);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await health(page, 0.5);
  await expect(page.locator(`${player} .meter-trail`)).toHaveCSS('display', 'none');
  await expect(page.locator(player)).toHaveAttribute('data-feedback', 'idle');
  await writeFile(`${proof}/camera.json`, JSON.stringify(report, null, 2));
});

test('화면 설정 저장·키보드·5언어·고대비', async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1093, height: 614 });
  await page.goto('/');
  await expect(page.locator('.home-scene')).toBeVisible({ timeout: 45000 });
  await page.getByRole('button', { name: '화면 설정', exact: true }).click();
  await page.getByLabel('화면 흔들림', { exact: true }).selectOption('off');
  await expect(page.getByLabel('화면 흔들림', { exact: true })).toHaveValue('off');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: '화면 설정', exact: true })).toBeFocused();
  await page.reload();
  await page.getByRole('button', { name: '화면 설정', exact: true }).click();
  await expect(page.locator('#screen-shake')).toHaveValue('off');
  await page.getByRole('switch', { name: /높은 대비/ }).click();
  await page.getByRole('switch', { name: /큰 글씨/ }).click();
  await expect(page.locator('.app-shell')).toHaveAttribute('data-high-contrast', 'true');
  for (const lang of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW']) {
    await page.locator('#game-language').selectOption(lang);
    const out = await page
      .locator('.settings-dialog,.settings-dialog button,.settings-dialog select')
      .evaluateAll((els) =>
        els
          .filter((el) => {
            const b = el.getBoundingClientRect();
            return (
              b.width &&
              b.height &&
              (b.x < 0 ||
                b.y < 0 ||
                b.right > innerWidth + 1 ||
                b.bottom > innerHeight + 1 ||
                el.scrollWidth > el.clientWidth + 2)
            );
          })
          .map((el) => el.className),
      );
    expect(out, lang).toEqual([]);
    await page.screenshot({ path: `${proof}/settings-${lang}.png`, animations: 'disabled' });
  }
  await page.locator('#game-language').selectOption('ko');
  await page.locator('#screen-shake').focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#screen-shake')).toHaveValue('subtle');
  await page.keyboard.press('Escape');
  await page.screenshot({ path: `${proof}/lobby.png`, animations: 'disabled' });
});

test('가방 공통 체력·성장 선택 피드백과 키보드 복귀', async ({ page }) => {
  test.setTimeout(90000);
  await fixture(page);
  await page.clock.resume();
  await page.keyboard.press('Tab');
  await expect(page.locator('.inventory-workspace')).toBeVisible();
  await expect(page.locator('.inventory-workspace .meter.health')).toHaveAttribute(
    'aria-valuenow',
    '120',
  );
  for (const [width, height] of [
    [1440, 900],
    [1366, 768],
    [1093, 614],
  ]) {
    await page.setViewportSize({ width, height });
    await page.screenshot({ path: `${proof}/inventory-${width}.png`, animations: 'disabled' });
  }
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: '가방 Tab', exact: true })).toBeFocused();
  await page.evaluate(() => {
    const store = (window as any).feedbackStore,
      r = store.state.run;
    r.fighter.spent = r.spent = 15;
    r.fighter.arts[0].level = 2;
    r.fighter.trainingPoints = 2;
    r.fighter.deferredTrainingPoints = undefined;
    r.offers = [{ art: 'huashan', type: 'upgrade' }];
    store.notify();
  });
  const card = page.locator('.choice-card').first();
  await expect(card).toBeEnabled();
  for (const [width, height] of [
    [1440, 900],
    [1366, 768],
    [1093, 614],
  ]) {
    await page.setViewportSize({ width, height });
    const bounds = await page.locator('.growth').boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(height);
    await page.screenshot({ path: `${proof}/growth-${width}.png`, animations: 'disabled' });
  }
  await card.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.growth')).toHaveCount(0);
  const spent = await page.evaluate(() => (window as any).feedbackStore.state.run.spent);
  expect(spent).toBe(16);
});

test('WebGL 체력 잔량·고정 간격·동작 감소·장면 종료', async ({ page }) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    // Exercise Phaser's real WebGL renderer even on the test machine's SwiftShader.
    for (const proto of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
      const get = proto.getExtension;
      proto.getExtension = function (name: string) {
        return name === 'WEBGL_debug_renderer_info' ? null : get.call(this, name);
      };
    }
  });
  await fixture(page);
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-renderer', 'WebGL / AUTO');
  await health(page, 0.6);
  const report = await page.evaluate(() => {
    const s = (window as any).regionScene;
    return {
      renderer: s.game.renderer.constructor.name,
      actors: [500, 503].map((id) => ({
        health: s.actors.get(String(id)).getData('healthTrail'),
        bar: s.actors.get(String(id)).getData('healthBar'),
      })),
    };
  });
  expect(report.renderer).toMatch(/^WebGLRenderer\d*$/);
  for (const a of report.actors) {
    expect(a.health.ratio).toBe(0.6);
    expect(a.health.trail).toBe(1);
    expect(a.bar.height).toBe(5);
    expect(a.bar.clearance).toBeGreaterThanOrEqual(7);
  }
  await page.screenshot({ path: `${proof}/webgl-damage.png` });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await health(page, 0.3);
  const reduced = await page.evaluate(() =>
    (window as any).regionScene.actors.get('500').getData('healthTrail'),
  );
  expect(reduced.trail).toBe(reduced.ratio);
  expect(reduced.phase).toBe('idle');
  await page.evaluate(() => (window as any).regionScene.scene.stop());
  expect(errors).toEqual([]);
  await writeFile(`${proof}/webgl.json`, JSON.stringify({ ...report, reduced, errors }, null, 2));
});
