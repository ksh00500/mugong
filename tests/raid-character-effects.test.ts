import { expect, it } from 'vitest';
import { createRaid, nextRaidFloor, raidMedicine, stepRaid } from '../src/raid/engine';
import { stepCombat } from '../src/pvp/engine';
import { neutralInput } from '../src/pvp/model';
import { pvpFighter } from '../src/pvp/rules';
import { makeWeapon, makeItem, maximumHp, ART_WEAPONS } from '../src/domain/content';
import {
  fighterAttackPower,
  fighterMoveSpeed,
  fighterDamageTaken,
} from '../src/domain/fighter-combat-values';
import { techniqueStats } from '../src/domain/techniques';
import type { ArtId } from '../src/domain/model';
import type { TraitId } from '../src/domain/character';

function fixture(art: ArtId = 'huashan', innate?: TraitId) {
  const f = pvpFighter('sword', 0, '개인 효과 검사');
  f.arts = [{ id: art, level: 5, gauge: 0, combo: 0, defenseCd: 0 }];
  f.items = [makeWeapon(ART_WEAPONS[art], 'owned', 'weapon', 100)];
  f.bindings = { [art]: 'owned' };
  f.innate = innate;
  f.hp = maximumHp(f);
  const m = createRaid('effect-case', [{ name: f.name, preset: 'sword', fighter: f }]);
  m.phase = 'fighting';
  m.boss.clock = 1000;
  m.players[0].fighter.x = 580;
  m.players[4].fighter.x = 650;
  for (const a of m.players) a.fighter.y = 420;
  return m;
}
function basic(m: ReturnType<typeof fixture>) {
  m.players[0].fighter.cooldown = 0;
  const before = m.players[4].fighter.hp;
  stepCombat(m, [{ ...neutralInput(), attack: true }]);
  for (let i = 0; i < 10; i++) stepCombat(m, []);
  return before - m.players[4].fighter.hp;
}
function incoming(m: ReturnType<typeof fixture>, damage = 20) {
  const f = m.players[0].fighter;
  m.attacks.push({
    id: ++m.sequence,
    owner: 4,
    art: 'shaolin',
    shape: 'burst',
    x: f.x,
    y: f.y - 34,
    range: 10,
    arc: 1,
    angle: 0,
    damage,
    delay: 0.001,
    life: 0.1,
    speed: 0,
    radius: 10,
    heal: 0,
    poison: false,
  });
  stepCombat(m, []);
}
it('owned gear uses the same power, movement and armour values as Gangho, including equipped-only charms', () => {
  const m = fixture(),
    f = m.players[0].fighter;
  f.growth = { constitution: 1, strength: 1, agility: 1, inner: 1 };
  f.level = 10;
  f.items.push(
    { ...makeItem('charm', 'c', 'equipped'), power: 7 },
    { ...makeItem('boots', 'b', 'equipped'), power: 3 },
    { ...makeItem('robe', 'r', 'equipped'), power: 8 },
  );
  expect(fighterAttackPower(f)).toBe(31); //14 + 50*.1 + weapon5 + charm7
  expect(fighterMoveSpeed(f)).toBeCloseTo((265 + 30 + 24) * 1.08);
  expect(fighterDamageTaken(f, 20)).toBe(12);
  const x = f.x;
  stepCombat(m, [{ ...neutralInput(), dx: 1 }]);
  expect(f.x - x).toBeCloseTo(((265 + 30 + 24) * 1.08) / 60);
  const hp = f.hp;
  incoming(m);
  expect(hp - f.hp).toBe(12);
  f.items.find((i) => i.id === 'c')!.place = 'general';
  expect(fighterAttackPower(f)).toBe(24);
});
it('gambler and quickhands alter only a valid next basic and switch cooldown cannot be stacked', () => {
  const control = basic(fixture());
  const gambler = fixture('huashan', 'gambler');
  gambler.players[0].fighter.hp = 30;
  expect(basic(gambler)).toBeCloseTo(control * 1.2);
  const quick = fixture('huashan', 'quickhands'),
    f = quick.players[0].fighter;
  f.arts.push({ id: 'wudang', level: 5, gauge: 0, combo: 0, defenseCd: 0 });
  f.bindings!.wudang = 'owned';
  stepCombat(quick, [{ ...neutralInput(), switch: 1 }]);
  expect(f.traitState?.attackBoost).toBe(0.25);
  f.traitState!.attackBoost = 0;
  stepCombat(quick, [{ ...neutralInput(), switch: -1 }]);
  expect(f.traitState?.attackBoost).toBe(0);
  for (let i = 0; i < 241; i++) stepCombat(quick, []);
  stepCombat(quick, [{ ...neutralInput(), switch: 1 }]);
  basic(quick);
  expect(f.traitState?.attackBoost).toBe(0);
  expect(f.traitState?.switchCd).toBeGreaterThan(3);
});
it('focus bonuses apply on every third distinct basic sequence, never on the same attack twice', () => {
  const m = fixture('shaolin', 'focus');
  const first = basic(m),
    second = basic(m),
    third = basic(m);
  expect(second).toBeCloseTo(first);
  expect(third).toBeCloseTo(first * 1.15);
  expect(m.players[0].fighter.traitState?.hits).toBe(3);
});
it('calm charges after five untouched seconds and actual damage resets it', () => {
  const normal = fixture(),
    calm = fixture('huashan', 'calm');
  for (let i = 0; i < 301; i++) stepCombat(calm, []);
  basic(normal);
  basic(calm);
  expect(calm.players[0].fighter.arts[0].gauge).toBeCloseTo(
    normal.players[0].fighter.arts[0].gauge * 1.2,
  );
  incoming(calm);
  expect(calm.players[0].fighter.traitState?.untouched).toBe(0);
});
it('owned Wudang counter takes no HP loss, scales with inner power and grants the next-basic trait', () => {
  const m = fixture('wudang', 'counter'),
    f = m.players[0].fighter;
  const hp = f.hp,
    boss = m.players[4].fighter.hp,
    expected = techniqueStats('wudang', 5, f).counterDamage;
  stepCombat(m, [{ ...neutralInput(), defense: true }]);
  incoming(m);
  expect(f.hp).toBe(hp);
  expect(boss - m.players[4].fighter.hp).toBeCloseTo(expected);
  expect(f.traitState?.attackBoost).toBe(0.35);
  expect(f.invulnerable).toBeGreaterThan(0);
  basic(m);
  expect(f.traitState?.attackBoost).toBe(0);
});
it('flexible evasion arms the next contact but never staggers a control-immune raid boss', () => {
  const m = fixture('huashan', 'flexible'),
    f = m.players[0].fighter;
  stepCombat(m, [{ ...neutralInput(), defense: true, dx: -1 }]);
  expect(f.traitState?.staggerBoost).toBe(0.12);
  f.x = 580;
  f.actionTime = 0;
  basic(m);
  expect(f.traitState?.staggerBoost).toBe(0);
  expect(m.players[4].fighter.action).not.toBe('hurt');
});
it('unyielding prevents first death/overkill attribution, not the next death, and resets only on a new floor', () => {
  const m = fixture('huashan', 'unyielding'),
    a = m.players[0],
    f = a.fighter;
  incoming(m, 999);
  expect(f.hp).toBe(1);
  expect(f.traitState?.survived).toBe(true);
  expect(a.damageTaken).toBe(119);
  expect(m.players[4].damageDealt).toBeCloseTo(119);
  incoming(m, 999);
  expect(f.hp).toBe(1); //actual invulnerability
  f.invulnerable = 0;
  incoming(m, 999);
  stepRaid(m, []);
  expect(m.status[0]).toBe('dead');
  const next = fixture('huashan', 'unyielding');
  next.players[0].fighter.traitState = { survived: true };
  next.phase = 'rest';
  nextRaidFloor(next);
  expect(next.players[0].fighter.traitState).toEqual({});
});
it('momentum and kill supports reward one actual kill, never revive a dead owner', () => {
  const m = fixture('huashan', 'momentum'),
    f = m.players[0].fighter;
  f.arts.push(
    { id: 'tianmo', level: 4, gauge: 0, combo: 0, defenseCd: 0 },
    { id: 'jegal', level: 4, gauge: 0, combo: 0, defenseCd: 0 },
  );
  f.hp = 50;
  m.players[4].fighter.hp = 1;
  basic(m);
  expect(f.traitState?.momentum).toBeGreaterThan(1.8);
  expect(f.hp).toBe(52);
  expect(f.arts[0].gauge).toBeGreaterThan(8);
  const hp = f.hp;
  for (let i = 0; i < 15; i++) stepCombat(m, []);
  expect(f.hp).toBe(hp);
});
it('circulation heals on an accepted ultimate only; herbal and medicine augment stack on actual carried medicine', () => {
  const m = fixture('huashan', 'circulation'),
    f = m.players[0].fighter;
  f.hp = 50;
  f.arts[0].gauge = 100;
  stepCombat(m, [{ ...neutralInput(), ultimate: true }]);
  expect(f.hp).toBe(56);
  stepCombat(m, [{ ...neutralInput(), ultimate: true }]);
  expect(f.hp).toBe(56);
  const herbs = fixture('huashan', 'herbal'),
    h = herbs.players[0].fighter;
  herbs.phase = 'rest';
  h.hp = 10;
  h.augments = ['medicine'];
  h.items.push(makeItem('medicine', 'm', 'general'));
  expect(raidMedicine(herbs, 0)).toBe(true);
  expect(h.hp).toBeCloseTo(10 + 35 * 1.25 * 1.25);
});
it('growth augments and passive milestones contribute through shared values and real accepted actions', () => {
  const m = fixture(),
    f = m.players[0].fighter,
    power = fighterAttackPower(f),
    speed = fighterMoveSpeed(f);
  f.augments = ['might', 'swift', 'vigor', 'iron', 'tempo', 'resolve', 'reservoir'];
  expect(fighterAttackPower(f) - power).toBeCloseTo(4.5);
  expect(fighterMoveSpeed(f) - speed).toBeCloseTo(20 * 1.08);
  expect(maximumHp(f)).toBe(180);
  expect(fighterDamageTaken(f, 20)).toBeCloseTo(18);
  const c = techniqueStats('huashan', 5, f);
  expect(c.attackInterval).toBeCloseTo(0.4 * 0.92 * 0.9);
  stepCombat(m, [{ ...neutralInput(), defense: true }]);
  expect(f.arts[0].defenseCd).toBeCloseTo(c.defenseCooldown);
});
it('Tang support applies poison to a different basic art, caps at five and ticks at 0.5 seconds', () => {
  const m = fixture('shaolin'),
    f = m.players[0].fighter,
    b = m.players[4];
  f.arts.push({ id: 'tang', level: 4, gauge: 0, combo: 0, defenseCd: 0 });
  for (let i = 0; i < 6; i++) basic(m);
  expect(b.poison).toBe(5);
  expect(b.ownedPoison?.level).toBe(4);
  const before = b.fighter.hp,
    d = b.ownedPoison!.damage;
  b.ownedPoison!.pulse = 0.5;
  for (let i = 0; i < 31; i++) stepCombat(m, []);
  expect(before - b.fighter.hp).toBeCloseTo(d * 2);
  const loaded = JSON.parse(JSON.stringify(m));
  for (let i = 0; i < 190; i++) stepCombat(loaded, []);
  expect(loaded.players[4].poison).toBe(0);
  expect(loaded.players[4].ownedPoison).toBeUndefined();
});
