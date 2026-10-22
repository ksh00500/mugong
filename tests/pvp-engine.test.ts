import { expect, it } from 'vitest';
import { createPvpMatch, stepPvp, finishPvp } from '../src/pvp/engine';
import { PVP_PRESETS, PVP_RULES, pvpFighter } from '../src/pvp/rules';
import { neutralInput, type PresetId, type PvpInput } from '../src/pvp/model';
import { hasWeapon } from '../src/domain/inventory';
import { parsePvpMessage } from '../src/pvp/protocol';
const start = (preset: PresetId = 'sword') => {
  const m = createPvpMatch('test', 'friendly', [
    { name: '검증 일', preset },
    { name: '검증 이', preset: 'sword' },
  ]);
  m.phase = 'fighting';
  m.players[0].fighter.x = 580;
  m.players[1].fighter.x = 660;
  return m;
};
const attacking = (aim = 0): PvpInput => ({ ...neutralInput(), attack: true, aim });
it('countdown rejects attacks and movement and enters a fresh input epoch', () => {
  const m = start();
  m.phase = 'countdown';
  const x = m.players[0].fighter.x;
  for (let n = 0; n < 180; n++)
    stepPvp(m, [{ ...attacking(), dx: 1, defense: true }, attacking(Math.PI)]);
  expect(m.phase).toBe('fighting');
  expect(m.players[0].fighter.x).toBe(x);
  expect(m.attacks).toEqual([]);
  expect(m.players.map((p) => p.fighter.hp)).toEqual([240, 240]);
  expect(m.epoch).toBe(2);
});
for (const preset of Object.keys(PVP_PRESETS) as PresetId[])
  for (const art of PVP_PRESETS[preset].arts) {
    it(`${preset}/${art}: server loadout is armed and an actual attack causes damage and charges its own gauge`, () => {
      const m = start(preset),
        f = m.players[0].fighter;
      f.active = f.arts.findIndex((a) => a.id === art);
      expect(hasWeapon(f, art)).toBe(true);
      for (let n = 0; n < 80; n++) stepPvp(m, [attacking(), neutralInput()]);
      expect(m.players[1].fighter.hp).toBeLessThan(240);
      expect(f.arts[f.active].gauge).toBeGreaterThan(0);
      expect(f.arts.filter((a) => a.id !== art).every((a) => a.gauge === 0)).toBe(true);
    });
    it(`${preset}/${art}: ultimate spends gauge once and defense has a real cooldown`, () => {
      const m = start(preset),
        f = m.players[0].fighter;
      f.active = f.arts.findIndex((a) => a.id === art);
      f.arts[f.active].gauge = 100;
      stepPvp(m, [{ ...neutralInput(), ultimate: true }, neutralInput()]);
      expect(f.arts[f.active].gauge).toBe(0);
      stepPvp(m, [{ ...neutralInput(), defense: true }, neutralInput()]);
      expect(f.arts[f.active].defenseCd).toBeGreaterThan(0);
    });
  }
it('same-tick lethal contacts are draws and lifesteal cannot revive a defeated attacker', () => {
  const m = start('shadow');
  m.players[0].fighter.active = 1;
  m.players.forEach((p) => (p.fighter.hp = 1));
  for (let n = 0; n < 12; n++) stepPvp(m, [attacking(), attacking(Math.PI)]);
  expect(m.players.map((p) => p.fighter.hp)).toEqual([0, 0]);
  expect(m.phase).toBe('interval');
  expect(m.roundWinner).toBeNull();
  expect(m.wins).toEqual([0, 0]);
});
it('movement is diagonal-normalized and respects field bounds', () => {
  const m = start();
  m.players[1].fighter.x = 1000;
  const f = m.players[0].fighter,
    x = f.x,
    y = f.y;
  stepPvp(m, [{ ...neutralInput(), dx: 1, dy: 1 }, neutralInput()]);
  expect(Math.hypot(f.x - x, f.y - y)).toBeCloseTo(PVP_RULES.speed / 60);
  for (let n = 0; n < 900; n++) stepPvp(m, [{ ...neutralInput(), dx: 1, dy: 1 }, neutralInput()]);
  expect(f.x).toBe(PVP_RULES.right);
  expect(f.y).toBe(PVP_RULES.bottom);
});
it('five tied rounds terminate and a finalized result cannot change', () => {
  const m = start();
  for (let round = 1; round <= 5; round++) {
    m.phase = 'fighting';
    m.roundTicks = 1;
    stepPvp(m, [neutralInput(), neutralInput()]);
    if (round < 5) for (let n = 0; n < 360; n++) stepPvp(m, [neutralInput(), neutralInput()]);
  }
  expect(m.phase).toBe('finished');
  expect(m.winner).toBeNull();
  finishPvp(m, 0, 'surrender');
  expect(m.winner).toBeNull();
});
it('poison ticks do not trigger counters or generate repeated gauge', () => {
  const m = start('shadow');
  const f = m.players[1].fighter;
  f.active = 1;
  f.guard = 2;
  f.facing = Math.PI;
  m.players[1].poison = 3;
  m.players[1].poisonClock = 2;
  stepPvp(m, [neutralInput(), neutralInput()]);
  expect(m.players[0].fighter.hp).toBe(240);
  expect(m.players[0].fighter.arts[0].gauge).toBe(0);
  expect(f.hp).toBe(234);
});
it('the protocol rejects spoofed damage, non-finite numbers, oversized aim and extra fields', () => {
  const input = { type: 'input', epoch: 1, seq: 1, ...neutralInput() };
  expect(parsePvpMessage(input)).not.toBeNull();
  for (const value of [
    { ...input, damage: 999 },
    { ...input, dx: NaN },
    { ...input, aim: Infinity },
    { ...input, aim: 4 },
    { ...input, switch: '1' },
    { ...input, seq: -1 },
    { type: 'victory' },
    { type: 'join', code: 'AAAAAA', preset: '__proto__' },
  ])
    expect(parsePvpMessage(value)).toBeNull();
});
it('presets and starting resources are deterministic and never share mutable state', () => {
  const a = pvpFighter('sword', 0, '검증'),
    b = pvpFighter('sword', 0, '검증');
  a.hp = 0;
  a.arts[0].gauge = 100;
  expect(b.hp).toBe(240);
  expect(b.arts[0].gauge).toBe(0);
});
