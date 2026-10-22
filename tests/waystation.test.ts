import { expect, it } from 'vitest';
import { emptyGame, startRun, spawnWave, tick } from '../src/domain/game';
import {
  isWalkablePreparation,
  nearestWaystationStop,
  WAYSTATION_BOUNDS,
  WAYSTATION_STOPS,
} from '../src/domain/waystation';
import { isGameSave } from '../src/platform/save-validation';
const idle = { dx: 0, dy: 0, aim: 0, attack: false, ultimate: false, defense: false };
function fixture(wave = 4) {
  const state = emptyGame();
  startRun(state, '쉼터 검사', 123);
  const run = state.run!;
  run.wave = wave;
  spawnWave(run);
  run.offers = [];
  return { state, run, f: run.fighter };
}
it('first rest moves at equal axial/diagonal speed with the actual movement facing', () => {
  const a = fixture(),
    b = fixture();
  tick(a.run, { ...idle, dx: 1 }, 1 / 60);
  tick(b.run, { ...idle, dx: 1, dy: -1 }, 1 / 60);
  expect(a.f.x - 960).toBeCloseTo(Math.hypot(b.f.x - 960, b.f.y - 650));
  expect(b.f.facing).toBeCloseTo(-Math.PI / 4);
  expect(b.f.action).toBe('walk');
  tick(b.run, idle, 1 / 60);
  expect(b.f.action).toBe('idle');
});
it('rest does not consume combat time, advance projectiles, attack, heal or change resources', () => {
  const { state, run, f } = fixture();
  const elapsed = run.elapsed,
    gold = run.gold,
    hp = f.hp;
  const before = structuredClone(run);
  for (let i = 0; i < 120; i++)
    tick(run, { ...idle, dx: 1, attack: true, ultimate: true, defense: true }, 1 / 60);
  expect(run.elapsed).toBe(elapsed);
  expect(run.gold).toBe(gold);
  expect(f.hp).toBe(hp);
  expect(run.attacks).toEqual(before.attacks);
  expect(run.projectiles).toEqual(before.projectiles);
  expect(f.arts).toEqual(before.fighter.arts);
  expect(run.enemies).toHaveLength(0);
  expect(isGameSave(state)).toBe(true);
});
it('courtyard bounds and solid NPC feet prevent walking into stalls and people', () => {
  const { run, f } = fixture();
  for (let i = 0; i < 600; i++) tick(run, { ...idle, dx: -1, dy: 1 }, 1 / 60);
  expect(f.x).toBe(WAYSTATION_BOUNDS.left);
  expect(f.y).toBe(WAYSTATION_BOUNDS.bottom);
  f.x = 490;
  f.y = 530;
  for (let i = 0; i < 60; i++) tick(run, { ...idle, dy: -1 }, 1 / 60);
  expect(Math.hypot(f.x - 490, f.y - 480)).toBeGreaterThanOrEqual(38 - 0.01);
});
it('interaction selects only a nearby stop and all four rest waves allow movement', () => {
  expect(nearestWaystationStop({ x: 960, y: 650 })).toBeUndefined();
  for (const stop of WAYSTATION_STOPS)
    expect(nearestWaystationStop({ x: stop.x, y: stop.y + 95 })?.id).toBe(stop.id);
  for (const wave of [9, 14, 19]) {
    const { run, f } = fixture(wave);
    const x = f.x;
    expect(isWalkablePreparation(run)).toBe(true);
    tick(run, { ...idle, dx: 1 }, 1 / 60);
    expect(f.x).toBeGreaterThan(x);
  }
});
it('growth choices stop rest movement and restored positions remain valid', () => {
  const { state, run, f } = fixture();
  run.offers = [{ art: 'samja', type: 'learn' }];
  tick(run, { ...idle, dx: 1 }, 1 / 60);
  expect(f.x).toBe(960);
  run.offers = [];
  tick(run, { ...idle, dx: 1 }, 1 / 60);
  const restored = structuredClone(state);
  expect(isGameSave(restored)).toBe(true);
  expect(restored.run!.fighter.x).toBe(f.x);
});
