import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
// Isolated actual Phaser arena with controlled snapshots; server/SQLite flow is tested separately.
async function mount(page: any) {
  await page.route('**/__owned-art.html', (r: any) =>
    r.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><html><body style="margin:0"><div id="arena" style="width:100vw;height:100vh"></div></body></html>',
    }),
  );
  await page.goto('/__owned-art.html');
  await page.evaluate(async () => {
    const load = (path: string) => import(/* @vite-ignore */ path);
    const w = window as any;
    const [
      { Arena, mountPvpArena },
      { pvpFighter },
      { createRaid },
      { PvpControls },
      { prepareRaidArtwork },
    ] = await Promise.all([
      load('/src/pvp/arena.ts'),
      load('/src/pvp/rules.ts'),
      load('/src/raid/engine.ts'),
      load('/src/pvp/controls.ts'),
      load('/src/raid/art.ts'),
    ]);
    const update = Arena.prototype.update;
    Arena.prototype.update = function (...args: any[]) {
      w.testArena = this;
      return update.apply(this, args);
    };
    const f = pvpFighter('sword', 0, '초기 무인'),
      m = createRaid('render-case', [{ name: f.name, preset: 'sword', fighter: f }]);
    m.phase = 'rest';
    w.testSnapshot = {
      seat: 0,
      connected: true,
      room: {
        seats: [
          { name: f.name, preset: 'sword', fighter: m.players[0].fighter, ack: 0 },
          null,
          null,
          null,
        ],
        match: m,
      },
    };
    const client = { getSnapshot: () => w.testSnapshot, send: () => false };
    const controls = new PvpControls(client, () => false);
    w.stopArena = mountPvpArena(
      document.getElementById('arena')!,
      client,
      controls,
      () => (w.artReady = true),
      () => (w.artFailed = true),
      () => {},
      await prepareRaidArtwork(),
    );
  });
  await page.waitForFunction(() => !!(window as any).artReady);
}
for (const width of [1440, 1093])
  test(`late own rebind and late party member show actual cropped weapons ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 614 });
    const requests: string[] = [],
      errors: string[] = [];
    page.on('request', (r) => requests.push(new URL(r.url()).pathname));
    page.on('pageerror', (e) => errors.push(e.message));
    await mount(page);
    expect(requests.filter((p) => p === '/art/items-v2/boss-9-4.webp')).toHaveLength(0);
    await page.evaluate(async () => {
      const load = (path: string) => import(/* @vite-ignore */ path);
      const w = window as any,
        { bossReward } = await load('/src/domain/boss-loot.ts'),
        { pvpFighter } = await load('/src/pvp/rules.ts');
      const f = w.testSnapshot.room.match.players[0].fighter,
        fan = bossReward('9-4', 'late-fan')!;
      fan.place = 'weapon';
      f.items.push(fan);
      f.arts.push({ id: 'jegal', level: 5, gauge: 0, combo: 0, defenseCd: 0 });
      f.bindings.jegal = fan.id;
      f.active = f.arts.length - 1;
      const guest = pvpFighter('shadow', 1, '나중 합류'),
        blade = bossReward('7-4', 'late-dao')!;
      blade.place = 'weapon';
      guest.items = [blade];
      guest.active = 1;
      guest.bindings = { tianmo: blade.id };
      w.testSnapshot.room.seats[1] = { name: guest.name, preset: 'shadow', fighter: guest, ack: 0 };
      Object.assign(w.testSnapshot.room.match.players[1], {
        fighter: guest,
        inactive: false,
        personal: true,
      });
    });
    await expect
      .poll(() =>
        page.evaluate(() => {
          const load = (path: string) => import(/* @vite-ignore */ path);
          const w = window as any,
            s = w.testArena;
          return [0, 1].map((i) => ({
            visible: s.weapons[i].image.visible,
            key: s.weapons[i].image.texture.key,
            frame: s.weapons[i].image.frame.name,
          }));
        }),
      )
      .toEqual([
        { visible: true, key: 'held-boss-9-4', frame: 'held' },
        { visible: true, key: 'held-boss-7-4', frame: 'held' },
      ]);
    expect(requests.filter((p) => p === '/art/items-v2/boss-9-4.webp')).toHaveLength(1);
    expect(requests.filter((p) => p === '/art/items-v2/boss-7-4.webp')).toHaveLength(1);
    expect(errors).toEqual([]);
    expect(await page.evaluate(() => indexedDB.databases())).toEqual([]);
    await mkdir('.local-preview/owned-art', { recursive: true });
    await page.screenshot({ path: `.local-preview/owned-art/late-${width}.png` });
    await page.evaluate(() => (window as any).stopArena());
  });
test('late image failure reaches arena failure callback without showing the previous weapon', async ({
  page,
}) => {
  await mount(page);
  let requests = 0;
  await page.route('**/items-v2/boss-7-4.webp', (r) => {
    requests++;
    return r.abort();
  });
  await page.evaluate(async () => {
    const load = (path: string) => import(/* @vite-ignore */ path);
    const w = window as any,
      { bossReward } = await load('/src/domain/boss-loot.ts'),
      f = w.testSnapshot.room.match.players[0].fighter;
    const blade = bossReward('7-4', 'fail-blade')!;
    blade.place = 'weapon';
    f.items.push(blade);
    f.arts.push({ id: 'tianmo', level: 5, gauge: 0, combo: 0, defenseCd: 0 });
    f.bindings.tianmo = blade.id;
    f.active = f.arts.length - 1;
  });
  await page.waitForFunction(() => !!(window as any).artFailed);
  expect(await page.evaluate(() => (window as any).testArena.weapons[0].image.visible)).toBe(false);
  await page.waitForTimeout(150);
  expect(requests).toBeLessThanOrEqual(3);
  const attempts = requests;
  await page.waitForTimeout(150);
  expect(requests).toBe(attempts);
  await page.evaluate(() => (window as any).stopArena());
});
