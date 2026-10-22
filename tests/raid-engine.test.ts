import { it, expect } from 'vitest';
import {
  createRaid,
  stepRaid,
  nextRaidFloor,
  returnRaidPlayer,
  raidMedicine,
  raidScale,
  cancelRaidCountdown,
} from '../src/raid/engine';
import { stepCombat } from '../src/pvp/engine';
import { neutralInput } from '../src/pvp/model';
import { parseRaidMessage } from '../src/raid/protocol';
const party = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ name: `동료 ${i}`, preset: 'shadow' as const }));
it('return during the next-floor countdown reopens rest and recalculates the party only on the new start', () => {
  const m = createRaid('cancel', party(2));
  expect(cancelRaidCountdown(m)).toBe(false);
  m.phase = 'fighting';
  m.players[4].fighter.hp = 0;
  stepRaid(m, []);
  nextRaidFloor(m);
  expect(m.floor).toBe(2);
  expect(cancelRaidCountdown(m)).toBe(true);
  expect(m.floor).toBe(1);
  expect(m.cleared).toBe(1);
  returnRaidPlayer(m, 1);
  nextRaidFloor(m);
  expect(m.floor).toBe(2);
  expect(m.scaledFor).toBe(1);
});
for (const n of [1, 2, 3, 4])
  it(`${n} players: snapshots use fixed HP scaling and deaths never rescale the current floor`, () => {
    const m = createRaid('scale', party(n));
    expect(m.scaledFor).toBe(n);
    expect(m.players[4].maxHp).toBe(Math.round(1600 * raidScale(n)));
    const max = m.players[4].maxHp;
    m.players[0].fighter.hp = 0;
    stepRaid(m, []);
    expect(m.players[4].maxHp).toBe(max);
  });
it('allies neither take damage nor block a swept ranged attack; damage attribution uses actual lost HP', () => {
  const m = createRaid('teams', party(2));
  m.phase = 'fighting';
  m.players[0].fighter.x = 400;
  m.players[1].fighter.x = 600;
  m.players[4].fighter.x = 800;
  for (const p of m.players) p.fighter.y = 420;
  m.players[4].fighter.hp = 3;
  for (let i = 0; i < 60; i++) stepCombat(m, [{ ...neutralInput(), attack: true, aim: 0 }]);
  expect(m.players[1].fighter.hp).toBe(240);
  expect(m.players[4].fighter.hp).toBe(0);
  expect(m.players[0].damageDealt).toBeCloseTo(3);
  expect(m.players[1].damageDealt ?? 0).toBe(0);
});
it('clear, medicine, partial return and next floor keep HP; a departed player cannot be revived or targeted', () => {
  const m = createRaid('floors', party(3));
  m.phase = 'fighting';
  m.players[0].fighter.hp = 100;
  m.players[4].fighter.hp = 0;
  stepRaid(m, []);
  expect(m.phase).toBe('rest');
  expect(m.cleared).toBe(1);
  expect(m.players[0].fighter.hp).toBe(100);
  expect(raidMedicine(m, 0)).toBe(true);
  expect(m.players[0].fighter.hp).toBe(175);
  expect(m.medicine[0]).toBe(1);
  expect(returnRaidPlayer(m, 1)).toBe(true);
  expect(nextRaidFloor(m)).toBe(true);
  expect(m.scaledFor).toBe(2);
  expect(m.players[0].fighter.hp).toBe(175);
  expect(m.players[1].inactive).toBe(true);
  expect(raidMedicine(m, 0)).toBe(false);
  expect(returnRaidPlayer(m, 0)).toBe(false);
});
it('all five floors end in a single complete result without resetting HP, gauge or consumables', () => {
  const m = createRaid('five', party(1));
  m.players[0].fighter.hp = 200;
  m.players[0].fighter.arts[0].gauge = 25;
  for (let floor = 1; floor <= 5; floor++) {
    m.phase = 'fighting';
    m.players[4].fighter.hp = 0;
    stepRaid(m, []);
    expect(m.cleared).toBe(floor);
    if (floor < 5) {
      expect(m.phase).toBe('rest');
      expect(nextRaidFloor(m)).toBe(true);
    }
  }
  expect(m.phase).toBe('finished');
  expect(m.result).toBe('complete');
  expect(m.players[0].fighter.hp).toBe(200);
  expect(m.players[0].fighter.arts[0].gauge).toBe(25);
  expect(nextRaidFloor(m)).toBe(false);
  const epoch = m.epoch;
  stepRaid(m, []);
  expect(m.epoch).toBe(epoch);
});
it('simultaneous boss and last-player KO is a wipe, never a free clear', () => {
  const m = createRaid('double', party(1));
  m.phase = 'fighting';
  m.players[0].fighter.hp = m.players[4].fighter.hp = 1;
  for (const [owner, target] of [
    [0, 4],
    [4, 0],
  ]) {
    const f = m.players[target].fighter;
    m.attacks.push({
      id: ++m.sequence,
      owner,
      art: 'shaolin',
      shape: 'burst',
      x: f.x,
      y: f.y - 34,
      angle: 0,
      range: 50,
      arc: 1,
      damage: 5,
      delay: 0.001,
      life: 0.2,
      speed: 0,
      radius: 10,
      heal: 0,
      poison: false,
    });
  }
  stepRaid(m, []);
  expect(m.result).toBe('wipe');
  expect(m.cleared).toBe(0);
});
it('windups lock the actual marked position and do not hit before the announced delay', () => {
  const m = createRaid('marks', party(2));
  m.phase = 'fighting';
  m.floor = 2;
  m.boss.cycle = 1;
  m.boss.clock = 0;
  stepRaid(m, []);
  expect(m.boss.pattern).toBe('marks');
  expect(m.attacks.filter((a) => a.owner === 4)).toHaveLength(2);
  const mark = m.attacks[0],
    x = mark.x;
  m.players[0].fighter.x += 250;
  for (let i = 0; i < 30; i++) stepRaid(m, []);
  expect(mark.x).toBe(x);
  expect(m.players[0].fighter.hp).toBe(240);
  expect(m.players[1].fighter.hp).toBe(240);
});
it('stale party revisions, forged stats and unrelated duel commands cannot parse as raid actions', () => {
  expect(parseRaidMessage({ type: 'ready', revision: 1 })).toEqual({ type: 'ready', revision: 1 });
  for (const v of [
    { type: 'ready' },
    { type: 'ready', revision: 1, damage: 999 },
    { type: 'queue', preset: 'sword' },
    { type: 'ready', revision: NaN },
    { type: 'input', ...neutralInput(), seq: 0, epoch: 1, hp: 999 },
  ])
    expect(parseRaidMessage(v)).toBeNull();
});
