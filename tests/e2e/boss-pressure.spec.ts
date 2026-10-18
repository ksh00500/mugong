import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { observeScene, seedRegion } from './support/region';
const proof = 'docs/verification/boss-pressure-v1';
for (const webgl of [false, true])
  test(`${webgl ? 'WebGL' : 'Canvas'}: 보스 추격 예고·준비·타격·고정 HP바와 저장`, async ({
    page,
  }) => {
    test.setTimeout(120000);
    if (webgl)
      await page.addInitScript(() => {
        for (const proto of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
          const get = proto.getExtension;
          proto.getExtension = function (name: string) {
            return name === 'WEBGL_debug_renderer_info' ? null : get.call(this, name);
          };
        }
      });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await seedRegion(page, 4);
    await observeScene(page);
    await mkdir(proof, { recursive: true });
    const result = await page.evaluate(async () => {
      const load = (window as any).regionModule;
      const { gameStore: store } = await load('/src/platform/store.ts');
      const { tick, emptyGame, startRun } = await load('/src/domain/game.ts');
      const { makeWeapon } = await load('/src/domain/content.ts');
      const { isGameSave } = await load('/src/platform/save-validation.ts');
      const scene = (window as any).regionScene;
      store.rendererReady = false;
      scene.scene.pause();
      const base = store.state.run.enemies[3],
        appearance = store.state.run.fighter.appearance;
      const state = emptyGame();
      startRun(state, '브라우저 추격 검증', 123);
      Object.assign(store.state, state);
      const run = state.run,
        f = run.fighter;
      f.appearance = appearance;
      run.regionRoute = ['폐사', '청하현', '독무곡', '천검산'];
      Object.assign(f, {
        level: 0,
        xp: 0,
        spent: 0,
        arts: [{ id: 'tang', level: 1, gauge: 0, combo: 0, defenseCd: 0 }],
        augments: [],
        augmentOffers: [],
        trainingPoints: 0,
        deferredTrainingPoints: 0,
        cooldown: 0,
      });
      const weapon = makeWeapon('dart', 'browser-pressure-dart', 'weapon');
      f.items = [weapon];
      f.bindings = { tang: weapon.id };
      run.offers = [];
      run.spent = 0;
      run.zones = [];
      run.encounterObjects = [];
      const rows: any[] = [],
        failures: any[] = [];
      (window as any).pressureCapture = undefined;
      for (let phase = 1; phase <= 4; phase++) {
        const e = {
          ...base,
          bossId: `4-${phase}`,
          id: 530 + phase,
          state: 'approach',
          timer: 0,
          move: undefined,
          strike: undefined,
          pattern: 0,
          x: 650,
          y: 530,
          hp: 100000,
          maxHp: 100000,
          skillClock: 0,
          xp: 0,
        };
        run.enemies = [e];
        run.projectiles = [];
        run.effects = [];
        run.attacks = [];
        run.encounterObjects = [];
        Object.assign(f, {
          x: 420,
          y: 300,
          hp: 120,
          actionTime: 0,
          invulnerable: 0,
          capturedTime: 0,
          slowTime: 0,
          cooldown: 0,
        });
        let point = 0,
          warnings = 0,
          strikes = 0,
          damage = 0;
        const points = [
          [1500, 300],
          [1500, 780],
          [420, 780],
          [420, 300],
        ];
        for (let n = 0; n < 60 * 20; n++) {
          const [x, y] = points[point],
            dx = x - f.x,
            dy = y - f.y;
          if (Math.hypot(dx, dy) < 12) point = (point + 1) % points.length;
          f.hp = 120;
          run.zoneClock = 0;
          tick(
            run,
            {
              dx,
              dy,
              aim: Math.atan2(e.y - f.y, e.x - f.x),
              attack: true,
              ultimate: false,
              defense: false,
            },
            1 / 60,
          );
          damage += Math.max(0, 120 - f.hp);
          const warning = e.pressure?.warning === 0.32;
          warnings += Number(warning);
          strikes += Number(e.state === 'strike');
          if (warning || n % 20 === 0) {
            scene.draw(run);
            const actor = scene.actors.get(String(e.id)),
              bar = actor.getData('healthBar');
            if (
              !actor.getData('nativePose') ||
              actor.scaleX !== 0.225 ||
              !Number.isFinite(actor.x + actor.y)
            )
              failures.push({ id: e.bossId, n });
            if (bar && actor.getData('authoredFrame')) {
              const frame = actor.getData('authoredFrame');
              const top = actor.y + (frame.bounds.top - frame.footY) * actor.scaleY;
              if (bar.y + bar.height > top - 6) failures.push({ id: e.bossId, n, top, bar });
            }
            if (warning && phase === 1 && !(window as any).pressureCapture)
              (window as any).pressureCapture = structuredClone(run);
          }
        }
        rows.push({
          id: e.bossId,
          warnings,
          strikes,
          damage,
          shots: f.attackSeq,
          validSave: isGameSave(state),
        });
      }
      const snapshot = (window as any).pressureCapture;
      Object.assign(run, snapshot);
      scene.draw(run);
      return { rows, failures, renderer: scene.game.renderer.type, captured: !!snapshot };
    });
    await page.screenshot({ path: `${proof}/${webgl ? 'webgl' : 'canvas'}-warning.png` });
    await writeFile(
      `${proof}/${webgl ? 'webgl' : 'canvas'}.json`,
      JSON.stringify({ ...result, errors }, null, 2),
    );
    expect(result.failures).toEqual([]);
    expect(result.captured).toBe(true);
    expect(result.rows.every((r: any) => r.warnings > 0 && r.strikes > 0 && r.validSave)).toBe(
      true,
    );
    expect(errors).toEqual([]);
  });
