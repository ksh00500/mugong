import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { observeScene, seedRegion } from './support/region';

for (const [region, phase, hint, art] of [
  [7, 1, '모래 · 이동 속도 감소', 'sand'],
  [5, 1, '연막 · 공격 속도 감소', 'smoke'],
  [3, 3, '냉기 누적 · 회피 또는 온기로 해제', 'cold'],
  [6, 1, '화상 · 지속 피해', 'fire'],
  [4, 1, '취기 · 이동과 공격 속도 감소', 'brew'],
] as const)
  test(`실제 전투 구역 그림·상태·이탈: ${art}`, async ({ page }) => {
    const proof = 'docs/verification/field-effects-v2';
    await mkdir(proof, { recursive: true });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await seedRegion(page, region);
    await observeScene(page);
    const result = await page.evaluate(
      async ({ region, phase }) => {
        const load = (window as any).regionModule;
        const { gameStore: store } = await load('/src/platform/store.ts');
        const { signatureCast, stepEncounters, encounterMovementFactor, encounterAttackRecovery } =
          await load('/src/domain/boss-encounters.ts');
        const { tick } = await load('/src/domain/game.ts');
        const r = store.state.run,
          f = r.fighter,
          e = r.enemies[3];
        store.rendererReady = false;
        r.enemies = [e];
        e.bossId = `${region}-${phase}`;
        Object.assign(e, { x: 1450, y: 400, state: 'recover', timer: 100, skillClock: 0 });
        Object.assign(f, {
          x: 850,
          y: 520,
          cooldown: 1,
          invulnerable: 0,
          poisonTime: 0,
          burnTime: 0,
          fieldTick: 0,
        });
        r.zones = [];
        r.encounterObjects = [];
        r.projectiles = [];
        signatureCast(r, e);
        stepEncounters(r, 1.21, (amount: number) => {
          f.hp -= amount;
        });
        const before = { x: f.x, hp: f.hp, cooldown: f.cooldown };
        tick(r, { dx: 1, dy: 0, aim: 0, attack: false, ultimate: false, defense: false }, 1 / 30);
        (window as any).regionScene.draw(r);
        store.notify();
        const images = (window as any).regionScene.paintedZones.pool
          .filter((i: any) => i.visible)
          .map((i: any) => i.frame.name);
        const active = {
          movement: encounterMovementFactor(r),
          attack: encounterAttackRecovery(r),
          hp: f.hp,
          distance: f.x - before.x,
          cooldown: f.cooldown,
          images,
        };
        f.x = 1750;
        const outside = {
          movement: encounterMovementFactor(r),
          attack: encounterAttackRecovery(r),
        };
        f.x = before.x;
        (window as any).regionScene.draw(r);
        store.notify();
        return { before, active, outside };
      },
      { region, phase },
    );
    expect(result.active.images).toContain(art);
    expect(result.outside).toEqual({ movement: 1, attack: 1 });
    if (art === 'sand') expect(result.active.distance).toBeCloseTo((265 * 0.55) / 30);
    if (art === 'smoke' || art === 'brew')
      expect(result.active.cooldown).toBeCloseTo(1 - 0.65 / 30);
    await expect(page.locator('.field-caption')).toHaveText(hint);
    await page.screenshot({ path: `${proof}/${art}.png` });
    expect(errors).toEqual([]);
    await writeFile(`${proof}/${art}.json`, JSON.stringify({ result, errors }, null, 2));
  });
