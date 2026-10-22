import { expect, it } from 'vitest';
import {
  combatCrowding,
  offscreenThreats,
  COMBAT_LAYERS,
  decorativeOpacity,
} from '../src/game/combat-clarity';
import { ARTS } from '../src/domain/content';
import { emptyGame, startRun } from '../src/domain/game';
function fixture() {
  const s = emptyGame();
  startRun(s, '가독성 검사', 123);
  return s.run!;
}
it('only known player decoration fades; regional boss colours, contacts and uncrowded effects stay clear', () => {
  for (const color of [0xf4e0af, ...Object.values(ARTS).map((a) => a.color)]) {
    expect(decorativeOpacity({ kind: 'burst', color }, true)).toBe(0.55);
    expect(decorativeOpacity({ kind: 'burst', color }, false)).toBe(1);
    expect(decorativeOpacity({ kind: 'hit', color }, true)).toBe(1);
  }
  for (const color of [
    0xd6513e, 0xb99c70, 0xc54867, 0xcdae68, 0x78bbac, 0xe4ce8d, 0xcbb79b, 0x80976a, 0xe4a066,
    0xb5d38b,
  ])
    expect(decorativeOpacity({ kind: 'burst', color }, true)).toBe(1);
});
it('draw priority keeps warnings over friendly effects and hostile shots', () => {
  expect(COMBAT_LAYERS.warning).toBeGreaterThan(COMBAT_LAYERS.friendly);
  expect(COMBAT_LAYERS.warning).toBeGreaterThan(COMBAT_LAYERS.hostileShot);
  expect(COMBAT_LAYERS.status).toBeGreaterThan(COMBAT_LAYERS.warning);
});
it('crowded presentation is derived without modifying damage, actors, saved clocks or RNG', () => {
  const r = fixture();
  r.enemies.forEach((e) => (e.state = 'approach'));
  expect(combatCrowding(r)).toBe(false);
  r.enemies[0].state = r.enemies[1].state = 'windup';
  const before = structuredClone(r);
  expect(combatCrowding(r)).toBe(true);
  offscreenThreats(r, { left: 0, top: 0, right: 1920, bottom: 1080 });
  expect(r).toEqual(before);
});
it('edge cues include only active offscreen ranged threats, bounded to six and actual camera edges', () => {
  const r = fixture(),
    base = r.enemies[0];
  r.fighter.x = 960;
  r.fighter.y = 530;
  r.enemies = Array.from({ length: 10 }, (_, n) => ({
    ...base,
    id: n,
    role: 'bowman',
    kind: 'archer',
    x: 2100 + n * 100,
    y: 400,
    state: 'windup',
  }));
  const view = { left: 0, top: 0, right: 1920, bottom: 1080 };
  expect(offscreenThreats(r, view)).toHaveLength(6);
  for (const e of offscreenThreats(r, view)) {
    expect(e.x).toBeLessThanOrEqual(1920 - 55);
    expect(e.y).toBeGreaterThanOrEqual(55);
  }
  r.enemies.forEach((e) => (e.state = 'recover'));
  expect(offscreenThreats(r, view)).toHaveLength(0);
  r.enemies[0].state = 'windup';
  r.enemies[0].x = 1000;
  expect(offscreenThreats(r, view)).toHaveLength(0);
  r.enemies[0].x = 2100;
  r.enemies[0].hp = 0;
  expect(offscreenThreats(r, view)).toHaveLength(0);
});
