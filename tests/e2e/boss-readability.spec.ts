import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { seedRegion, observeScene } from './support/region';
const proof = 'docs/verification/boss-readability-v1';
async function webgl(page: any) {
  await page.addInitScript(() => {
    for (const proto of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
      const get = proto.getExtension;
      proto.getExtension = function (name: string) {
        return name === 'WEBGL_debug_renderer_info' ? null : get.call(this, name);
      };
    }
  });
}

for (const region of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
  for (const gpu of region === 4 || region === 9 ? [false, true] : [false])
    test(`보스 20%·185행동 방향/발점/HP바 R${region} ${gpu ? 'WebGL' : 'Canvas'}`, async ({
      page,
    }) => {
      test.setTimeout(120000);
      await mkdir(proof, { recursive: true });
      if (gpu) await webgl(page);
      await page.emulateMedia({ reducedMotion: region % 2 ? 'reduce' : 'no-preference' });
      const errors: string[] = [],
        failed: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('response', (r) => {
        if (r.status() >= 400 && new URL(r.url()).pathname.startsWith('/art/'))
          failed.push(r.url());
      });
      await seedRegion(page, region);
      await observeScene(page);
      const result = await page.evaluate(async () => {
        const w = window as any,
          s = w.regionScene,
          store = (await w.regionModule('/src/platform/store.ts')).gameStore;
        const { enemyAttack } = await w.regionModule('/src/domain/combat.ts');
        const { BOSS_KITS } = await w.regionModule('/src/domain/boss-melee.ts');
        store.paused = true;
        s.scene.pause();
        const run = store.state.run,
          before = JSON.stringify(run),
          failures: any[] = [],
          barHeights = new Map();
        let samples = 0,
          moves = 0;
        for (const original of run.enemies) {
          const kit = BOSS_KITS[original.bossId];
          for (const move of original.bossId ? Object.keys(kit.moves) : ['thrust']) {
            if (original.bossId) moves++;
            const spec = kit?.moves[move],
              states = [
                ['approach', 0],
                ['windup', 0.3],
                ['windup', 0.85],
                ['recover', 0.4],
                ...(spec?.contacts ?? [0]).map((c: number) => [
                  'strike',
                  c / (spec?.duration ?? 0.28),
                ]),
              ];
            for (let d = 0; d < 8; d++)
              for (const [state, p] of states) {
                const e = {
                  ...original,
                  id: 9900 + original.id,
                  move: original.bossId ? move : undefined,
                  state,
                  moving: false,
                  guardTime: 0,
                  armourTime: 0,
                  rageTime: 0,
                  aim: (d * Math.PI) / 4,
                  facing: (d * Math.PI) / 4,
                };
                const attack = enemyAttack(e),
                  duration =
                    state === 'windup'
                      ? attack.windup
                      : state === 'recover'
                        ? attack.recovery
                        : (spec?.duration ?? 0.28);
                e.timer = duration * (1 - (p as number));
                e.strike =
                  state === 'strike'
                    ? {
                        duration: spec?.duration ?? 0.28,
                        fromX: e.x,
                        fromY: e.y,
                        toX: e.x,
                        toY: e.y,
                        contactsDone: 0,
                      }
                    : undefined;
                s.motionClock.reset();
                s.drawEnemy(e);
                const a = s.actors.get(String(e.id)),
                  f = a.getData('authoredFrame'),
                  bar = a.getData('healthBar'),
                  size = e.bossId ? 0.27 : 0.225;
                samples++;
                const expectedX = a.flipX ? 1 - f.footX / f.width : f.footX / f.width;
                if (
                  Math.abs(a.scaleX - size) > 1e-9 ||
                  Math.abs(a.scaleY - size) > 1e-9 ||
                  a.rotation !== 0 ||
                  Math.abs(a.originX - expectedX) > 1e-9 ||
                  Math.abs(a.originY - f.footY / f.height) > 1e-9 ||
                  bar.renderedTop - bar.y - 5 < 6.9999 ||
                  a.texture.key === '__MISSING'
                )
                  failures.push({ boss: e.bossId, d, move, state, p, scale: a.scaleX, bar });
                const height = e.y - bar.y,
                  old = barHeights.get(e.id);
                if (old !== undefined && Math.abs(old - height) > 0.001)
                  failures.push({ boss: e.bossId, unstableBar: true });
                barHeights.set(e.id, height);
              }
          }
        }
        // Repaint a representative real windup with normal actors at their original size.
        s.graphics.clear();
        s.motionClock.reset();
        s.draw(run);
        return {
          samples,
          moves,
          failures,
          renderer: s.game.renderer.type,
          unchanged: before === JSON.stringify(run),
        };
      });
      expect(result.failures).toEqual([]);
      expect(result.unchanged).toBe(true);
      expect(result.renderer).toBe(gpu ? 2 : 1);
      expect(errors).toEqual([]);
      expect(failed).toEqual([]);
      await page.screenshot({ path: `${proof}/R${region}-${gpu ? 'webgl' : 'canvas'}.png` });
      await writeFile(
        `${proof}/R${region}-${gpu ? 'webgl' : 'canvas'}.json`,
        JSON.stringify({ ...result, errors, failed }, null, 2) + '\n',
      );
    });

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 1093, height: 614 },
])
  test(`경고·전투 국면·5언어·동작 감소 ${viewport.width}`, async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize(viewport);
    await seedRegion(page, 4);
    await observeScene(page);
    await page.evaluate(async () => {
      const w = window as any,
        store = (await w.regionModule('/src/platform/store.ts')).gameStore;
      store.paused = false;
      w.regionScene.scene.pause();
    });
    for (const locale of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW'])
      for (const phase of ['combat', 'pursuit', 'guard', 'enraged']) {
        const record = await page.evaluate(
          async ({ locale, phase }) => {
            const w = window as any,
              store = (await w.regionModule('/src/platform/store.ts')).gameStore,
              s = w.regionScene,
              r = store.state.run;
            const { setLanguage } = await w.regionModule('/src/platform/i18n.ts'),
              { enemyAttack } = await w.regionModule('/src/domain/combat.ts');
            setLanguage(locale);
            r.enemies = r.enemies.filter((e: any) => !e.bossId || e.bossId === '4-1');
            const e = r.enemies.find((e: any) => e.bossId);
            e.x = 960;
            e.y = 620;
            e.state = 'windup';
            e.move = 'slam';
            e.rageTime = phase === 'enraged' ? 2 : 0;
            e.guardTime = phase === 'guard' ? 2 : 0;
            e.armourTime = 0;
            e.pressure = {
              warning: phase === 'pursuit' ? 0.2 : 0,
              burst: phase === 'pursuit' ? 1 : 0,
              farTime: 0,
              cooldown: 1,
              lastDistance: 200,
            };
            e.timer = enemyAttack(e).windup * 0.2;
            store.notify();
            s.animationTime += 0.15;
            s.draw(r);
            return {
              phase: s.actors.get(String(e.id)).getData('combatPhase'),
              tell: s.actors.get(String(e.id)).getData('attackTell'),
            };
          },
          { locale, phase },
        );
        await expect(page.locator('.boss-panel')).toHaveAttribute('data-boss-phase', phase);
        expect(record.phase).toBe(phase);
        expect(record.tell.shape).toBe('circle');
        const boxes = await page
          .locator('.boss-panel,.boss-heading,.boss-phase,.boss-health')
          .evaluateAll((nodes) =>
            nodes.map((n) => {
              const b = n.getBoundingClientRect();
              return { x: b.x, right: b.right, y: b.y, bottom: b.bottom, w: b.width };
            }),
          );
        for (const b of boxes) {
          expect(b.x).toBeGreaterThanOrEqual(0);
          expect(b.right).toBeLessThanOrEqual(viewport.width);
          expect(b.y).toBeGreaterThanOrEqual(0);
          expect(b.w).toBeGreaterThan(0);
        }
      }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(
      await page.locator('.boss-phase').evaluate((n) => getComputedStyle(n).animationName),
    ).toBe('none');
    await page.screenshot({ path: `${proof}/hud-${viewport.width}.png` });
  });

test('네 종류 경고·실제 상태 전환 효과·가방 복귀', async ({ page }) => {
  test.setTimeout(90000);
  await seedRegion(page, 1);
  await observeScene(page);
  const records = await page.evaluate(async () => {
    const w = window as any,
      s = w.regionScene,
      store = (await w.regionModule('/src/platform/store.ts')).gameStore;
    const { BOSS_KITS } = await w.regionModule('/src/domain/boss-melee.ts'),
      { enemyAttack } = await w.regionModule('/src/domain/combat.ts');
    s.scene.pause();
    const r = store.state.run,
      original = r.enemies.slice();
    r.enemies = r.enemies.filter((e: any) => !e.bossId);
    const cases = [];
    for (const [kind, pick] of [
      ['thrust', (m: any) => m.shape === 'line' && !m.shot && !m.zone && !m.dash],
      ['sweep', (m: any) => m.shape === 'circle' && !m.zone && !m.shot],
      ['projectile', (m: any) => !!m.shot],
      ['field', (m: any) => !!m.zone],
    ] as const) {
      let selected: any;
      for (const e of original.filter((e: any) => e.bossId))
        for (const [move, spec] of Object.entries(BOSS_KITS[e.bossId].moves))
          if (!selected && pick(spec)) selected = { ...e, move };
      if (!selected) throw Error('Missing warning ' + kind);
      selected.x = 960;
      selected.y = 620;
      selected.aim = -Math.PI / 2;
      selected.facing = -Math.PI / 2;
      selected.targetX = 960;
      selected.targetY = 380;
      selected.state = 'windup';
      selected.timer = enemyAttack(selected).windup * 0.2;
      r.enemies.push(selected);
      cases.push({ kind, id: selected.id });
    }
    (window as any).warningCases = r.enemies
      .filter((e: any) => e.bossId)
      .map((e: any) => ({ ...e }));
    r.enemies = r.enemies.filter((e: any) => !e.bossId);
    (window as any).showWarning = (n: number) => {
      r.enemies = r.enemies.filter((e: any) => !e.bossId);
      r.enemies.push({ ...w.warningCases[n] });
      store.notify();
      s.animationTime += 0.1;
      s.draw(r);
    };
    return cases;
  });
  for (let i = 0; i < records.length; i++) {
    await page.evaluate((i) => (window as any).showWarning(i), i);
    await expect(page.locator('.boss-panel')).toBeVisible();
    await page.screenshot({ path: `${proof}/tell-${records[i].kind}.png` });
  }
  // Real state change is presentation only; drawing it cannot grant invulnerability.
  const phase = await page.evaluate(async () => {
    const w = window as any,
      s = w.regionScene,
      store = (await w.regionModule('/src/platform/store.ts')).gameStore,
      r = store.state.run,
      e = r.enemies.find((e: any) => e.bossId);
    e.rageTime = 2;
    store.notify();
    s.draw(r);
    s.animationTime += 0.14;
    s.draw(r);
    return {
      phase: s.bossReadability.phases.get(e.id).phase,
      age: s.animationTime - s.bossReadability.phases.get(e.id).at,
    };
  });
  expect(phase.phase).toBe('enraged');
  expect(phase.age).toBeCloseTo(0.14);
  await expect(page.locator('.boss-panel')).toHaveAttribute('data-boss-phase', 'enraged');
  await page.screenshot({ path: `${proof}/phase-enraged.png` });
  await page.keyboard.press('Tab');
  await expect(page.locator('.inventory-workspace')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.inventory-workspace')).toHaveCount(0);
  await writeFile(
    `${proof}/tell-cases.json`,
    JSON.stringify({ records, phase, bagReturned: true, independentContext: true }, null, 2) + '\n',
  );
});
