import { expect, it } from 'vitest';
import { emptyGame, startRun, spawnWave, command, tick } from '../src/domain/game';
import { maximumHp } from '../src/domain/content';
import { healingOffer } from '../src/domain/preparation';
import { encounterHp } from '../src/domain/balance';
import { makeLootItem } from '../src/domain/items';
import { isGameSave } from '../src/platform/save-validation';
import type { BoundFighter } from '../src/domain/model';

function fixture(wave = 4) {
  const state = emptyGame();
  startRun(state, '정비 검증', 123);
  const r = state.run!,
    f = r.fighter;
  r.wave = wave;
  r.offers = [];
  spawnWave(r);
  r.gold = 100;
  return { state, r, f };
}
for (const wave of [4, 9, 14, 19])
  it(`${wave}웨이브는 전투가 없는 정비이며 다음 진행은 실제 보스다`, () => {
    const { state, r } = fixture(wave);
    expect(r.phase).toBe('prep');
    expect(r.enemies).toHaveLength(0);
    expect(r.supplies).toHaveLength(3);
    expect(command(state, { type: 'next' })).toBe(true);
    expect(r.wave).toBe(wave + 1);
    expect(r.phase).toBe('combat');
    expect(r.enemies[0].hp).toBe(encounterHp(Math.floor(wave / 5), true));
    expect(isGameSave(state)).toBe(true);
  });
it('the physician heals above 120 HP using growth/equipment maximum, including partial recovery', () => {
  const { state, r, f } = fixture();
  f.level = 10;
  f.growth = { constitution: 1, strength: 1, agility: 1, inner: 1 };
  f.hp = maximumHp(f) - 50;
  expect(f.hp).toBeGreaterThan(120);
  expect(healingOffer(f, r.gold)).toMatchObject({ available: true, amount: 45, price: 12 });
  expect(command(state, { type: 'heal' })).toBe(true);
  expect(f.hp).toBe(maximumHp(f) - 5);
  expect(r.gold).toBe(88);
  expect(command(state, { type: 'heal' })).toBe(true);
  expect(f.hp).toBe(maximumHp(f));
  expect(r.gold).toBe(76);
  const full = structuredClone(state);
  expect(command(state, { type: 'heal' })).toBe(false);
  expect(state).toEqual(full);
});
it('insufficient funds and combat phases cannot charge or heal', () => {
  const { state, r, f } = fixture();
  f.hp = 20;
  r.gold = 11;
  const poor = structuredClone(state);
  expect(command(state, { type: 'heal' })).toBe(false);
  expect(state).toEqual(poor);
  r.phase = 'combat';
  r.gold = 100;
  const combat = structuredClone(state);
  expect(command(state, { type: 'heal' })).toBe(false);
  expect(state).toEqual(combat);
});
it('supply stock and refinement costs survive a saved reload without refreshing', () => {
  const { state, r, f } = fixture();
  f.items.push({ ...makeLootItem('material-0', 'mat', 'general'), count: 4 });
  const first = r.supplies![0];
  expect(command(state, { type: 'buySupply', templateId: first.templateId })).toBe(true);
  const copy = structuredClone(state);
  expect(copy.run!.supplies![0].stock).toBe(2);
  expect(command(copy, { type: 'refine', id: copy.run!.fighter.items[0].id })).toBe(true);
  expect(copy.run!.fighter.items[0].upgrades).toBe(1);
  expect(copy.run!.gold).toBe(r.gold - 12);
  expect(r.supplies![0].stock).toBe(2);
  expect(f.items[0].upgrades ?? 0).toBe(0);
});
it('more enemies preserve the fixed wave XP budget and the current save is not rescaled', () => {
  for (const wave of [1, 2, 3, 6, 11, 18]) {
    const { state, r } = fixture();
    r.wave = wave;
    spawnWave(r);
    expect(r.enemies.length).toBe(4 + Math.floor(wave / 3) + Math.floor((wave - 1) / 5));
    expect(r.enemies.reduce((sum, e) => sum + e.xp, 0)).toBe(r.xpBudget[wave - 1]);
    const hp = r.enemies[0].hp;
    structuredClone(state);
    expect(r.enemies[0].hp).toBe(hp);
  }
});
it('stationary-target combat takes more attacks than the previous 70% HP setting', () => {
  const results: number[] = [];
  for (const factor of [0.7, 1]) {
    const { r, f } = fixture();
    r.wave = 1;
    spawnWave(r);
    r.offers = [];
    f.arts = [{ id: 'huashan', level: 1, gauge: 0, combo: 0, defenseCd: 0 }];
    (f as BoundFighter).bindings = { huashan: f.items[0].id };
    const e = r.enemies[0];
    r.enemies = [e];
    Object.assign(e, {
      hp: Math.round(e.maxHp * factor),
      x: f.x + 80,
      y: f.y,
      state: 'windup',
      timer: 100,
      xp: 0,
    });
    let frames = 0;
    while (e.hp > 0 && frames++ < 1800)
      tick(r, { dx: 0, dy: 0, aim: 0, attack: true, ultimate: false, defense: false }, 1 / 60);
    expect(e.hp).toBeLessThanOrEqual(0);
    results.push(frames);
  }
  expect(results[1]).toBeGreaterThan(results[0]);
});
