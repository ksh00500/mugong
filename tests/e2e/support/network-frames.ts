import { expect, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
export const observeNetworkFrames = process.env.MUGONG_ALL_FRAME_OBSERVE === '1';
export async function startNetworkFrames(page: Page, kind: 'gangho' | 'arena', seat = 0) {
  if (!observeNetworkFrames) return;
  await page.evaluate(
    async ({ kind, seat }) => {
      const w = window as any,
        path = kind === 'gangho' ? '/src/game/CombatScene.ts' : '/src/pvp/arena.ts';
      const load = (path: string) =>
        import(
          /* @vite-ignore */ performance
            .getEntriesByType('resource')
            .map((e) => e.name)
            .find((u) => new URL(u).pathname === path) ?? path
        );
      const module = await load(path),
        Scene = kind === 'gangho' ? module.CombatScene : module.Arena;
      const method = kind === 'gangho' ? 'draw' : 'actor';
      const original = Scene.prototype[method];
      Scene.prototype[method] = function (...args: any[]) {
        w.networkScene = this;
        return original.apply(this, args);
      };
      if (kind === 'gangho') w.networkStore = (await load('/src/platform/store.ts')).gameStore;
      w.networkKind = kind;
      w.networkSeat = seat;
    },
    { kind, seat },
  );
  await page.waitForFunction(() => !!(window as any).networkScene);
  await page.evaluate(() => {
    const w = window as any,
      s = w.networkScene,
      original = s.sys.sceneUpdate;
    w.networkFrames = [];
    s.sys.sceneUpdate = function (t: number, d: number) {
      const at = performance.now();
      original.call(this, t, d);
      const fighter =
        w.networkStore?.state.run?.fighter ??
        s.client.getSnapshot().room?.match?.players[w.networkSeat]?.fighter;
      const image = w.networkStore ? s.actors.get('hero') : s.actors[w.networkSeat];
      if (fighter && image)
        w.networkFrames.push({
          at,
          cpu: performance.now() - at,
          x: image.x,
          y: image.y,
          authorityX: fighter.x,
          authorityY: fighter.y,
        });
    };
  });
}
export async function stopNetworkFrames(page: Page, tag: string) {
  if (!observeNetworkFrames) return;
  const samples = await page.evaluate(
    () =>
      (window as any).networkFrames as {
        at: number;
        cpu: number;
        x: number;
        y: number;
        authorityX: number;
        authorityY: number;
      }[],
  );
  const start = samples[0].at;
  const warm = samples.filter((s) => s.at >= start + 150);
  const drawSteps = warm
    .slice(1)
    .filter((s, i) => Math.hypot(s.x - warm[i].x, s.y - warm[i].y) > 0.01).length;
  const stateSteps = warm
    .slice(1)
    .filter(
      (s, i) =>
        Math.hypot(s.authorityX - warm[i].authorityX, s.authorityY - warm[i].authorityY) > 0.01,
    ).length;
  await mkdir('.local-preview/all-online-source/frames', { recursive: true });
  await writeFile(
    `.local-preview/all-online-source/frames/${tag}.json`,
    JSON.stringify(
      { realHttpWs: true, frames: warm.length, drawSteps, stateSteps, samples },
      null,
      2,
    ),
  );
  expect(stateSteps).toBeGreaterThan(0);
  expect(drawSteps).toBeGreaterThan(stateSteps * 1.5);
}
