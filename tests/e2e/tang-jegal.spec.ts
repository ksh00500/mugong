import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

// Controlled actual Phaser scene + real shared engine. HTTP/WS is verified separately.
for (const [width, height, reduced] of [
  [1440, 900, false],
  [1366, 768, false],
  [1093, 614, true],
] as const)
  test(`owned Tang/Jegal actual fields, no new range outlines, expiry and reduced motion ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('**/__technique.html', (r) =>
      r.fulfill({
        contentType: 'text/html',
        body: '<html><body style="margin:0"><div id="arena" style="width:100vw;height:100vh"></div></body></html>',
      }),
    );
    await page.goto('/__technique.html');
    await page.evaluate(async () => {
      const load = (path: string) => import(/* @vite-ignore */ path),
        w = window as any;
      const [
        { Arena, mountPvpArena },
        { pvpFighter },
        { createRaid },
        { PvpControls },
        { prepareRaidArtwork },
        { stepCombat },
        { makeWeapon, ART_WEAPONS },
      ] = await Promise.all([
        load('/src/pvp/arena.ts'),
        load('/src/pvp/rules.ts'),
        load('/src/raid/engine.ts'),
        load('/src/pvp/controls.ts'),
        load('/src/raid/art.ts'),
        load('/src/pvp/engine.ts'),
        load('/src/domain/content.ts'),
      ]);
      const update = Arena.prototype.update;
      Arena.prototype.update = function (...args: any[]) {
        w.scene = this;
        return update.apply(this, args);
      };
      const f = pvpFighter('mystic', 0, '건곤진법');
      f.arts = [{ id: 'jegal', level: 5, gauge: 100, combo: 0, defenseCd: 0 }];
      f.items = [makeWeapon(ART_WEAPONS.jegal, 'fan', 'weapon', 100)];
      f.bindings = { jegal: 'fan' };
      w.world = createRaid('technique-render', [{ name: f.name, preset: 'mystic', fighter: f }]);
      w.world.phase = 'fighting';
      w.world.players[0].fighter.x = 580;
      w.world.players[0].fighter.y = 420;
      const neutral = () => ({
        dx: 0,
        dy: 0,
        aim: 0,
        attack: false,
        defense: false,
        ultimate: false,
        switch: 0,
      });
      stepCombat(w.world, [{ ...neutral(), ultimate: true }]);
      const client = {
        getSnapshot: () => ({
          seat: 0,
          connected: false,
          room: {
            seats: [{ name: f.name, preset: 'mystic', ack: 0 }, null, null, null],
            match: w.world,
          },
        }),
        send: () => false,
      };
      w.step = stepCombat;
      w.neutral = neutral;
      w.stop = mountPvpArena(
        document.getElementById('arena')!,
        client,
        new PvpControls(client, () => false),
        () => (w.ready = true),
        () => (w.failed = true),
        () => {},
        await prepareRaidArtwork(),
      );
    });
    await page.waitForFunction(() => !!(window as any).ready);
    await expect
      .poll(() =>
        page.evaluate(
          () => (window as any).scene?.ownedFields.images.filter((i: any) => i.visible).length,
        ),
      )
      .toBe(4);
    expect(
      await page.evaluate(() => {
        const s = (window as any).scene;
        const background = s.children.list.find((i: any) => i.texture?.key === 'arena');
        return s.ownedFields.images
          .slice(0, 4)
          .every((i: any) => i.depth > background.depth && i.depth < s.actors[0].depth);
      }),
    ).toBe(true);
    expect(
      await page.evaluate(() =>
        (window as any).scene.ownedFields.images
          .slice(0, 4)
          .map((i: any) => [i.texture.key, i.frame.name, i.displayWidth, i.depth]),
      ),
    ).toEqual(Array.from({ length: 4 }, () => ['owned-fields', '2', 210, -1]));
    await mkdir('.local-preview/tj-browser', { recursive: true });
    await page.screenshot({ path: `.local-preview/tj-browser/ultimate-${width}.png` });
    const result = await page.evaluate(() => {
      const w = window as any,
        s = w.scene,
        a = w.world.players[0];
      let arcs = 0,
        circles = 0;
      const arc = s.g.arc.bind(s.g),
        circle = s.g.strokeCircle.bind(s.g);
      s.g.arc = (...args: any[]) => {
        arcs++;
        return arc(...args);
      };
      s.g.strokeCircle = (...args: any[]) => {
        circles++;
        return circle(...args);
      };
      a.ownedFormations = [
        { x: 680, y: 420, life: 3, pulse: 0.6, damage: 12, pulses: 1, kind: 'earth' },
      ];
      w.world.effects = [];
      w.world.attacks = [
        {
          id: 101,
          owner: 0,
          art: 'jegal',
          shape: 'sector',
          x: 580,
          y: 386,
          angle: 0,
          range: 165,
          arc: 1.1,
          delay: 0.05,
          life: 0.1,
          ownedTechnique: { variant: 'b', level: 5 },
        },
      ];
      s.update(0, 16);
      const first = s.ownedFields.images[0].alpha;
      a.ownedFormations[0].pulse = 0.4;
      s.update(0, 16);
      const second = s.ownedFields.images[0].alpha;
      return {
        frame: s.ownedFields.images[0].frame.name,
        first,
        second,
        reduced: s.reduced,
        arcs,
        circles,
      };
    });
    expect(result.frame).toBe('3');
    expect(result.arcs).toBe(0);
    expect(result.circles).toBe(0);
    expect(result.reduced).toBe(reduced);
    if (reduced) expect(result.first).toBe(result.second);
    else expect(result.first).toBeGreaterThan(result.second);
    await page.screenshot({ path: `.local-preview/tj-browser/earth-${width}.png` });
    await page.evaluate(() => {
      const w = window as any;
      w.world.attacks = [];
      w.world.players[0].ownedFormations = [];
      w.world.effects = [
        { id: 110, kind: 'poison-burst', seat: 0, x: 760, y: 430, amount: 5, life: 0.3 },
      ];
    });
    await expect
      .poll(() => page.evaluate(() => (window as any).scene.ownedFields.images[0].frame.name))
      .toBe('1');
    await page.screenshot({ path: `.local-preview/tj-browser/poison-${width}.png` });
    await page.evaluate(() => {
      const w = window as any;
      w.world.effects = [];
    });
    await expect
      .poll(() =>
        page.evaluate(
          () => (window as any).scene.ownedFields.images.filter((i: any) => i.visible).length,
        ),
      )
      .toBe(0);
    expect(errors).toEqual([]);
    expect(await page.evaluate(() => indexedDB.databases())).toEqual([]);
    await page.evaluate(() => (window as any).stop());
  });
