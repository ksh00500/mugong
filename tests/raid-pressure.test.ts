import { expect, it } from 'vitest';
import { createRaid, stepRaid } from '../src/raid/engine';
import { stepCombat } from '../src/pvp/engine';
import { pvpFighter } from '../src/pvp/rules';
import { neutralInput } from '../src/pvp/model';
import { techniqueStats } from '../src/domain/techniques';
import { ART_IDS, ART_WEAPONS, makeWeapon } from '../src/domain/content';

it('a melee boss closes distance rather than wasting its ready turn beyond its reach', () => {
  const m = createRaid('reach', [{ name: '대상', preset: 'shadow' }]);
  m.phase = 'fighting';
  m.boss.clock = 0;
  m.players[0].fighter.x = 400;
  m.players[4].fighter.x = 700;
  m.players[0].fighter.y = m.players[4].fighter.y = 420;
  stepRaid(m, []);
  expect(m.boss.phase).toBe('approach');
  expect(m.attacks).toHaveLength(0);
  expect(m.players[4].fighter.x).toBeLessThan(697);
  for (let tick = 0; tick < 120 && m.boss.phase === 'approach'; tick++) stepRaid(m, []);
  expect(m.boss.pattern).toBe('cleave');
  expect(m.boss.phase).toBe('windup');
  expect(Math.abs(m.players[4].fighter.x - 400)).toBeLessThanOrEqual(210);
});

it('distant pursuit can lead to a locked charge but keeps its full warning and dodge window', () => {
  const m = createRaid('pursuit', [{ name: '대상', preset: 'shadow' }]);
  m.phase = 'fighting';
  const f = m.players[0].fighter,
    b = m.players[4].fighter;
  Object.assign(f, { x: 90, y: 420 });
  Object.assign(b, { x: 1190, y: 420 });
  m.boss.clock = 0;
  for (let tick = 0; tick < 100 && m.boss.phase === 'approach'; tick++) stepRaid(m, []);
  expect(m.boss.phase).toBe('windup');
  expect(m.boss.pattern).toBe('charge');
  const aim = m.boss.aim,
    hp = f.hp,
    x = b.x;
  // The player moves off the announced line; the boss must not rotate after warning.
  for (let tick = 0; tick < 60; tick++) stepRaid(m, [{ ...neutralInput(), dy: 0.8 }]);
  expect(m.boss.phase).toBe('windup');
  expect(m.boss.aim).toBe(aim);
  expect(b.x).toBe(x);
  expect(f.hp).toBe(hp);
  for (let tick = 0; tick < 90; tick++) stepRaid(m, []);
  expect(m.boss.phase).toBe('recover');
  expect(f.hp).toBe(hp);
});

it('old durable approach snapshots without the new optional pursuit counter remain finite', () => {
  const m = createRaid('old-snapshot', [{ name: '대상', preset: 'shadow' }]);
  m.phase = 'fighting';
  delete m.boss.pursuitTime;
  for (let tick = 0; tick < 90; tick++) stepRaid(m, []);
  const recovered = JSON.parse(JSON.stringify(m));
  for (let tick = 0; tick < 90; tick++) stepRaid(recovered, []);
  expect(Number.isFinite(recovered.players[4].fighter.x)).toBe(true);
  expect(Number.isFinite(recovered.boss.clock)).toBe(true);
});

for (const art of ART_IDS)
  it(`personal ${art}: early ultimate requests cannot bypass the learned level`, () => {
    const fighter = pvpFighter('sword', 0, '소유 무인');
    const minimum = techniqueStats(art, 1).ultimateLevel;
    fighter.arts = [
      { id: art, level: Math.max(0, minimum - 1), gauge: 100, combo: 0, defenseCd: 0 },
    ];
    fighter.items = [makeWeapon(ART_WEAPONS[art], 'owned-weapon', 'weapon')];
    fighter.bindings = { [art]: 'owned-weapon' };
    const m = createRaid('unlock', [{ name: fighter.name, preset: 'sword', fighter }]);
    const a = m.players[0];
    stepCombat(m, [{ ...neutralInput(), ultimate: true }]);
    expect(a.fighter.arts[0].gauge).toBe(100);
    expect(m.effects.some((e) => e.kind === 'ultimate')).toBe(false);
    expect(m.attacks).toHaveLength(0);
    a.fighter.arts[0].level = minimum;
    stepCombat(m, [{ ...neutralInput(), ultimate: true }]);
    expect(a.fighter.arts[0].gauge).toBe(0);
    expect(m.effects.some((e) => e.kind === 'ultimate')).toBe(true);
  });

it('an unbound personal weapon blocks defense and ultimate without consuming their resources', () => {
  const fighter = pvpFighter('sword', 0, '무장 해제');
  fighter.items = [];
  fighter.bindings = {};
  fighter.arts[0].gauge = 100;
  const m = createRaid('unarmed', [{ name: fighter.name, preset: 'sword', fighter }]);
  const a = m.players[0],
    x = a.fighter.x;
  stepCombat(m, [{ ...neutralInput(), defense: true }]);
  stepCombat(m, [{ ...neutralInput(), ultimate: true }]);
  expect(a.fighter.arts[0].gauge).toBe(100);
  expect(a.fighter.arts[0].defenseCd).toBe(0);
  expect(a.fighter.x).toBe(x);
  expect(m.effects).toHaveLength(0);
});

it('carrying an unrelated sword cannot enable an unbound dart art; binding darts enables the basic attack', () => {
  const fighter = pvpFighter('shadow', 0, '암기 무인');
  fighter.items.push(makeWeapon('sword', 'unrelated-sword', 'weapon'));
  delete fighter.bindings!.tang;
  fighter.arts[0].gauge = 100;
  const m = createRaid('bindings', [{ name: fighter.name, preset: 'shadow', fighter }]);
  const a = m.players[0];
  for (const intent of ['attack', 'defense', 'ultimate'] as const)
    stepCombat(m, [{ ...neutralInput(), [intent]: true }]);
  expect(m.attacks).toHaveLength(0);
  expect(m.effects).toHaveLength(0);
  expect(a.fighter.arts[0].gauge).toBe(100);
  expect(a.fighter.arts[0].defenseCd).toBe(0);
  a.fighter.bindings!.tang = 'pvp-0-tang';
  stepCombat(m, [{ ...neutralInput(), attack: true }]);
  expect(m.attacks.some((at) => at.art === 'tang' && at.owner === 0)).toBe(true);
});
