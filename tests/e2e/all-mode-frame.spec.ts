import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { seedRegion, observeScene } from './support/region';
const stage = process.env.MUGONG_ALL_FRAME_STAGE ?? 'after',
  proof = `.local-preview/all-frame-${stage}`;

for (const scenario of ['local', 'online', 'pvp', 'raid', 'pvp-webgl', 'raid-webgl'] as const)
  test(`${scenario}: real scene draw cadence and frame cost, isolated authority`, async ({
    page,
  }) => {
    const mode = scenario.replace('-webgl', '') as 'local' | 'online' | 'pvp' | 'raid';
    if (scenario.endsWith('webgl'))
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
    page.on('console', (message) => {
      if (/Texture .*has no frame/.test(message.text())) errors.push(message.text());
    });
    if (mode === 'local' || mode === 'online') {
      await seedRegion(page, 0);
      await observeScene(page);
      await page.evaluate(async (online) => {
        const w = window as any,
          s = w.regionScene,
          store = (await w.regionModule('/src/platform/store.ts')).gameStore;
        s.scene.pause();
        store.lastRequestedSave = Infinity;
        store.paused = false;
        store.busy = false;
        Object.defineProperty(store, 'online', { value: online, configurable: true });
        if (online) store.advance = () => {};
        w.testScene = s;
        w.testStore = store;
        w.seed = structuredClone(store.state);
        w.seed.run.fighter.x = 600;
        w.seed.run.fighter.y = 500;
      }, mode === 'online');
    } else {
      await page.route('**/__frame-arena.html', (r) =>
        r.fulfill({
          contentType: 'text/html',
          body: '<html><body style="margin:0"><div id="arena" style="width:100vw;height:100vh"></div></body></html>',
        }),
      );
      await page.goto('/__frame-arena.html');
      await page.evaluate(async (raid) => {
        const load = (p: string) => import(/* @vite-ignore */ p),
          w = window as any;
        const [
          { Arena, mountPvpArena },
          { createPvpMatch },
          { createRaid },
          { PvpControls },
          { prepareRaidArtwork },
        ] = await Promise.all([
          load('/src/pvp/arena.ts'),
          load('/src/pvp/engine.ts'),
          load('/src/raid/engine.ts'),
          load('/src/pvp/controls.ts'),
          load('/src/raid/art.ts'),
        ]);
        const original = Arena.prototype.update;
        Arena.prototype.update = function (...args: any[]) {
          w.testScene = this;
          return original.apply(this, args);
        };
        const participants = Array.from({ length: raid ? 4 : 2 }, (_, i) => ({
          name: '프레임' + i,
          preset: 'sword',
        }));
        w.world = raid
          ? createRaid('frame-raid', participants)
          : createPvpMatch('frame-pvp', 'friendly', participants);
        w.world.phase = 'fighting';
        for (const a of w.world.players) {
          a.fighter.x = 300 + a.seat * 130;
          a.fighter.y = 400;
          a.fighter.action = 'walk';
          a.fighter.actionTime = 0;
        }
        const client = {
          getSnapshot: () => ({
            seat: 0,
            connected: true,
            room: { seats: participants.map((p) => ({ ...p, ack: 0 })), match: w.world },
          }),
          send: () => false,
        };
        w.testControls = new PvpControls(client, () => false);
        w.stop = mountPvpArena(
          document.getElementById('arena')!,
          client,
          w.testControls,
          () => (w.ready = true),
          () => (w.failed = true),
          () => {},
          raid ? await prepareRaidArtwork() : undefined,
        );
      }, mode === 'raid');
      await page.waitForFunction(() => !!(window as any).ready);
      await page.waitForFunction(() => !!(window as any).testScene);
      await page.evaluate(() => {
        const w = window as any;
        w.testScene.scene.pause();
        w.seed = structuredClone(w.world);
      });
    }
    if (stage === 'baseline')
      await page.evaluate((mode) => {
        const s = (window as any).testScene;
        if (mode === 'online') s.networkPresentation.sample = (run: unknown) => run;
        if (mode === 'pvp' || mode === 'raid') s.presentation.sample = (world: unknown) => world;
      }, mode);
    const schedule = await page.evaluate((mode) => {
      const w = window as any,
        s = w.testScene,
        rows = [];
      for (const hz of [60, 120, 144, 240]) {
        if (w.testStore) {
          w.testStore.state = structuredClone(w.seed);
          s.activeRun = '';
          s.accumulator = 0;
          s.keys.clear();
          if (mode === 'local') s.keys.add('d');
        } else w.world = structuredClone(w.seed);
        const poses = [],
          authorities = [],
          costs = [];
        for (let n = 0; n < hz; n++) {
          const now = (n * 1000) / hz,
            publication =
              mode === 'online' ? Math.floor((now + 0.001) / 100) : Math.floor((now + 0.001) / 50);
          if (mode !== 'local') {
            const snapshot = structuredClone(w.seed.run ?? w.seed),
              elapsed = publication * (mode === 'online' ? 0.1 : 0.05);
            if (mode === 'online') {
              snapshot.elapsed += elapsed;
              snapshot.fighter.x += elapsed * 260;
              snapshot.fighter.action = 'walk';
              snapshot.fighter.actionTime = 0;
              // New source object only on publication, as with JSON network snapshots.
              if (w.publication !== publication) w.testStore.state = { ...w.seed, run: snapshot };
            } else {
              snapshot.tick += publication * 3;
              for (const a of snapshot.players) a.fighter.x += elapsed * 260;
              if (w.publication !== publication) w.world = snapshot;
            }
            w.publication = publication;
          }
          const authority = mode === 'local' || mode === 'online' ? w.testStore.state.run : w.world,
            hash = JSON.stringify(authority),
            at = performance.now();
          s.update(now, 1000 / hz);
          costs.push(performance.now() - at);
          poses.push(w.testStore ? s.actors.get('hero').x : s.actors[1].x);
          if (mode !== 'local' && JSON.stringify(authority) !== hash)
            throw Error('Presentation mutated server state');
          authorities.push(
            w.testStore ? w.testStore.state.run.fighter.x : w.world.players[1].fighter.x,
          );
        }
        const warm = poses.slice(Math.ceil(hz * 0.25)),
          changes = warm.slice(1).filter((x, i) => Math.abs(x - warm[i]) > 0.01).length;
        rows.push({
          hz,
          frames: warm.length - 1,
          changes,
          changeRatio: changes / (warm.length - 1),
          maxJump: Math.max(...warm.slice(1).map((x, i) => Math.abs(x - warm[i]))),
          drawCpuMs: costs.reduce((a, b) => a + b, 0),
          authorityX: authorities.at(-1),
        });
        w.publication = undefined;
      }
      return rows;
    }, mode);
    if (stage === 'after' || stage === 'final')
      for (const row of schedule) {
        expect(row.changeRatio).toBeGreaterThan(0.96);
        expect(row.maxJump).toBeLessThanOrEqual(280 / row.hz + 0.1);
      }
    await page.evaluate((mode) => {
      const w = window as any,
        s = w.testScene;
      w.costs = [];
      w.frames = [];
      w.sampleStart = performance.now();
      w.nextPublish = 0;
      w.publication = undefined;
      if (w.testStore) {
        w.testStore.state = structuredClone(w.seed);
        s.activeRun = '';
        s.accumulator = 0;
        s.keys.clear();
        if (mode === 'local') s.keys.add('d');
      } else w.world = structuredClone(w.seed);
      const update = s.sys.sceneUpdate;
      s.sys.sceneUpdate = function (time: number, delta: number) {
        const now = performance.now(),
          age = (now - w.sampleStart) / 1000;
        if (mode !== 'local' && now >= w.nextPublish) {
          w.nextPublish = now + (mode === 'online' ? 100 : 50);
          const snapshot = structuredClone(w.seed.run ?? w.seed),
            offset = Math.min(age, 2.5) * 130;
          if (mode === 'online') {
            snapshot.elapsed += age;
            snapshot.fighter.x += offset;
            snapshot.fighter.action = 'walk';
            w.testStore.state = { ...w.seed, run: snapshot };
          } else {
            snapshot.tick += Math.round(age * 60);
            for (const a of snapshot.players) a.fighter.x += offset;
            w.world = snapshot;
          }
        }
        const at = performance.now();
        update.call(this, time, delta);
        w.costs.push(performance.now() - at);
        w.frames.push(now);
      };
      s.scene.resume();
    }, mode);
    await page.waitForTimeout(3000);
    const perf = await page.evaluate(() => {
      const w = window as any;
      suspend();
      function suspend() {
        w.testScene.scene.pause();
      }
      const p95 = (a: number[]) => a.sort((a, b) => a - b)[Math.floor(a.length * 0.95)],
        times = w.frames as number[];
      return {
        frames: times.length,
        seconds: (times.at(-1)! - times[0]) / 1000,
        fps: ((times.length - 1) * 1000) / (times.at(-1)! - times[0]),
        intervalP95: p95(times.slice(1).map((t, i) => t - times[i])),
        drawP95: p95(w.costs),
        renderer: w.testScene.game.renderer.type,
      };
    });
    await mkdir(proof, { recursive: true });
    await page.screenshot({ path: `${proof}/${scenario}.png` });
    let graphics: unknown = null;
    if (scenario.endsWith('webgl')) {
      graphics = await page.evaluate(() => {
        const w = window as any,
          canvas = w.testScene.game.canvas as HTMLCanvasElement;
        const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
        const attributes = gl?.getContextAttributes();
        w.testScene.game.renderer.emit('losewebgl');
        w.testControls.action('defense');
        return {
          attributes,
          failed: w.failed === true,
          rendering: w.testControls.rendering,
          defense: w.testControls.input.defense,
        };
      });
      expect((graphics as any).attributes.alpha).toBe(false);
      expect((graphics as any).attributes.antialias).toBe(false);
      expect((graphics as any).failed).toBe(true);
      expect((graphics as any).rendering).toBe(false);
      expect((graphics as any).defense).toBe(false);
    }
    await writeFile(
      `${proof}/${scenario}.json`,
      JSON.stringify(
        { mode, scenario, stage, syntheticNetwork: true, schedule, perf, graphics, errors },
        null,
        2,
      ),
    );
    expect(errors).toEqual([]);
    if (mode === 'pvp' || mode === 'raid') {
      expect(await page.evaluate(() => indexedDB.databases())).toEqual([]);
      await page.evaluate(() => (window as any).stop());
    }
  });
