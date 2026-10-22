import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { seedRegion, observeScene } from './support/region';
const proof = 'docs/verification/regional-identity-v1';
for (const [width, height] of [
  [1440, 900],
  [1366, 768],
  [1093, 614],
])
  for (const locale of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW'])
    test(`성장 그림·문구·선택과 가방 옆 자동 정리 ${width} ${locale}`, async ({ page }) => {
      await mkdir(proof, { recursive: true });
      await page.setViewportSize({ width, height });
      await seedRegion(page, 0);
      await page.evaluate(async (locale) => {
        const { gameStore: store } = await (window as any).regionModule('/src/platform/store.ts');
        const { setLanguage } = await (window as any).regionModule('/src/platform/i18n.ts');
        setLanguage(locale);
        const r = store.state.run;
        r.fighter.arts = [];
        r.fighter.level = 1;
        r.fighter.spent = r.spent = 0;
        r.offers = ['gaebang', 'shaolin', 'jegal'].map((art) => ({ art, type: 'learn' }));
        store.paused = true;
        store.notify();
      }, locale);
      const cards = page.locator('.choice-card');
      await expect(cards.first()).toBeEnabled();
      const boxes = await cards.evaluateAll((nodes) =>
        nodes
          .flatMap((node) => [node, ...node.querySelectorAll('h3,p,.art-glyph,.choose-label')])
          .map((node) => ({
            rect: node.getBoundingClientRect().toJSON(),
            overflow: node.scrollWidth > node.clientWidth + 2,
          })),
      );
      for (const { rect, overflow } of boxes) {
        expect(rect.x).toBeGreaterThanOrEqual(0);
        expect(rect.y).toBeGreaterThanOrEqual(0);
        expect(rect.right).toBeLessThanOrEqual(width);
        expect(rect.bottom).toBeLessThanOrEqual(height);
        expect(overflow).toBe(false);
      }
      const card = cards.first(),
        before = await card.boundingBox();
      await card.hover();
      expect((await card.boundingBox())!.y).toBe(before!.y);
      expect(await card.locator('.art-glyph').getAttribute('viewBox')).toBe('0 627 627 627');
      if (locale === 'ko') await page.screenshot({ path: `${proof}/growth-${width}.png` });
      await card.click();
      await expect(cards).toHaveCount(0);
      await page.evaluate(async () => {
        const { gameStore: store } = await (window as any).regionModule('/src/platform/store.ts');
        const r = store.state.run;
        r.phase = 'loot';
        r.enemies = [];
        r.offers = [];
        store.paused = false;
        store.openBag(true);
        store.notify();
      });
      const arrange = page.locator('.bag-arrange');
      await expect(arrange).toBeVisible();
      await page.evaluate(() =>
        Promise.all(
          document
            .getAnimations()
            .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
            .map((animation) => animation.finished.catch(() => {})),
        ),
      );
      const bag = await page.locator('.bag-grid.weapon').boundingBox(),
        button = await arrange.boundingBox();
      expect(button!.height).toBeGreaterThanOrEqual(44);
      expect(button!.y).toBeLessThan(bag!.y);
      expect(bag!.y - button!.y - button!.height).toBeLessThan(120);
      expect(button!.y + button!.height).toBeLessThanOrEqual(height);
      const header = await page.locator('.general-column .bag-usage-heading').boundingBox();
      expect(Math.abs(button!.x + button!.width / 2 - header!.x - header!.width / 2)).toBeLessThan(
        2,
      );
      await arrange.click();
      await expect(arrange).toBeEnabled();
      if (locale === 'ko') await page.screenshot({ path: `${proof}/bag-${width}.png` });
    });

for (const region of [1, 7])
  test(`${region}: 독병 비행·기마 방향과 실제 전투 표시`, async ({ page }) => {
    await mkdir(proof, { recursive: true });
    await seedRegion(page, region);
    await observeScene(page);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const result = await page.evaluate(async (region) => {
      const { gameStore: store } = await (window as any).regionModule('/src/platform/store.ts');
      const { spawnWave, tick } = await (window as any).regionModule('/src/domain/game.ts');
      const scene = (window as any).regionScene,
        r = store.state.run;
      r.wave = 3;
      spawnWave(r);
      r.fighter.x = 960;
      r.fighter.y = 670;
      store.rendererReady = false;
      store.paused = false;
      const poses = [];
      if (region === 7) {
        const rider = r.enemies.find((e: any) => e.role === 'rider');
        rider.x = 960;
        rider.y = 480;
        for (let direction = 0; direction < 8; direction++) {
          rider.facing = (direction * Math.PI) / 4;
          rider.state = 'approach';
          scene.animationTime += 1;
          scene.draw(r);
          const image = scene.actors.get(String(rider.id));
          const mesh = scene.continuousActors.get(String(rider.id))?.mesh;
          poses.push({
            visible: mesh?.visible && mesh.getData('mounted'),
            texture: image.texture.key,
            frame: image.frame.name,
            finite: Number.isFinite(image.x + image.y + image.displayWidth + image.rotation),
          });
        }
      } else {
        const thrower = r.enemies.find((e: any) => e.role === 'bombardier');
        Object.assign(thrower, {
          x: 800,
          y: 400,
          state: 'windup',
          timer: 0,
          targetX: 1000,
          targetY: 550,
          aim: 0,
        });
        tick(r, { dx: 0, dy: 0, aim: 0, attack: false, ultimate: false, defense: false }, 1 / 60);
        scene.draw(r);
        poses.push({
          bomb: r.projectiles.some((p: any) => p.visual === 'poison-bomb' && p.landing),
          zones: r.zones.length,
        });
      }
      store.notify();
      return poses;
    }, region);
    if (region === 7)
      for (const pose of result) {
        expect(pose.visible && pose.finite).toBe(true);
        expect(pose.texture).toBe('desert-cavalry');
        expect(['0', '1', '2', '3', '4']).toContain(pose.frame);
      }
    else expect(result[0]).toMatchObject({ bomb: true, zones: 0 });
    await page.screenshot({ path: `${proof}/region-${region}.png` });
    expect(errors).toEqual([]);
    await writeFile(`${proof}/region-${region}.json`, JSON.stringify(result, null, 2));
  });

for (const [region, phase, pattern, feature] of [
  [1, 2, 1, 'burst'],
  [1, 4, 0, 'poison'],
  [7, 2, 0, 'returning'],
  [7, 4, 0, 'dash'],
] as const)
  test(`지역 보스 ${region}-${phase}: ${feature} 예고와 실행`, async ({ page }) => {
    await mkdir(proof, { recursive: true });
    await seedRegion(page, region);
    await observeScene(page);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.evaluate(
      async ({ region, phase, pattern }) => {
        const { gameStore: store } = await (window as any).regionModule('/src/platform/store.ts');
        const { enemyAttack } = await (window as any).regionModule('/src/domain/combat.ts');
        const r = store.state.run;
        r.enemies = [
          {
            ...r.enemies[3],
            bossId: `${region}-${phase}`,
            x: 820,
            y: 400,
            hp: 10000,
            maxHp: 10000,
            pattern,
            move: undefined,
            state: 'windup',
            aim: 0,
            targetX: 1100,
            targetY: 400,
            skillClock: 100,
          },
        ];
        r.projectiles = [];
        r.effects = [];
        r.zones = [];
        r.encounters = [];
        r.fighter.x = 1100;
        r.fighter.y = 400;
        r.fighter.invuln = 5;
        r.enemies[0].timer = enemyAttack(r.enemies[0]).windup * 0.4;
        store.rendererReady = false;
        store.paused = false;
        store.notify();
        (window as any).regionScene.draw(r);
      },
      { region, phase, pattern },
    );
    await page.screenshot({ path: `${proof}/boss-${region}-${phase}-warning.png` });
    const result = await page.evaluate(async () => {
      const { gameStore: store } = await (window as any).regionModule('/src/platform/store.ts');
      const { tick } = await (window as any).regionModule('/src/domain/game.ts');
      const r = store.state.run,
        enemy = r.enemies[0];
      enemy.timer = 0;
      tick(r, { dx: 0, dy: 0, aim: 0, attack: false, ultimate: false, defense: false }, 1 / 60);
      if (enemy.strike) {
        const duration = enemy.strike.duration;
        for (let n = 0; n < Math.ceil(duration * 60) - 1; n++)
          tick(r, { dx: 0, dy: 0, aim: 0, attack: false, ultimate: false, defense: false }, 1 / 60);
      }
      (window as any).regionScene.draw(r);
      return {
        x: enemy.x,
        delayed: r.projectiles.filter((p: any) => p.delay > 0).length,
        poison: r.projectiles.some((p: any) => p.landing?.kind === 'poison'),
        returning: r.projectiles.some((p: any) => p.returnAt > 0),
        state: enemy.state,
      };
    });
    await page.screenshot({ path: `${proof}/boss-${region}-${phase}-execution.png` });
    expect(result.state).toBe('strike');
    if (feature === 'burst') expect(result.delayed).toBe(2);
    if (feature === 'poison') expect(result.poison).toBe(true);
    if (feature === 'returning') expect(result.returning).toBe(true);
    if (feature === 'dash') expect(result.x).toBeGreaterThan(1250);
    expect(errors).toEqual([]);
    await writeFile(`${proof}/boss-${region}-${phase}.json`, JSON.stringify(result, null, 2));
  });
