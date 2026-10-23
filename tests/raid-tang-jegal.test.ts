import { expect, it } from 'vitest';
import {
  createRaid,
  nextRaidFloor,
  expirePersonalRaid,
  returnRaidPlayer,
} from '../src/raid/engine';
import { stepCombat } from '../src/pvp/engine';
import { neutralInput } from '../src/pvp/model';
import { pvpFighter } from '../src/pvp/rules';
import { makeWeapon, maximumHp, ART_WEAPONS } from '../src/domain/content';
import { emptyGame, startRun, tick } from '../src/domain/game';
import { techniqueStats } from '../src/domain/techniques';
import { addJegalFormation } from '../src/domain/tang-jegal';
import type { Formation } from '../src/domain/model';
import { PvpDatabase } from '../src/pvp/server/database';
import { reserveFighter, savePersonalRaid } from '../src/online/raid-persistence';

function fixture(id: 'tang' | 'jegal', combo = 0, level = 5, party = 1) {
  const f = pvpFighter('mystic', 0, id);
  f.arts = [{ id, level, combo, gauge: 0, defenseCd: 0 }];
  f.items = [makeWeapon(ART_WEAPONS[id], 'owned', 'weapon', 100)];
  f.bindings = { [id]: 'owned' };
  f.hp = maximumHp(f);
  const m = createRaid(
    'technique-case',
    Array.from({ length: party }, () => ({ name: id, preset: 'mystic' as const, fighter: f })),
  );
  m.phase = 'fighting';
  m.boss.clock = 1000;
  for (const a of m.players) {
    a.fighter.x = a.seat === 4 ? 650 : 580;
    a.fighter.y = 420;
  }
  m.players[4].fighter.hp = m.players[4].maxHp = 100000;
  return m;
}
function steps(m: ReturnType<typeof fixture>, n: number) {
  for (let i = 0; i < n; i++) stepCombat(m, []);
}
function basic(m: ReturnType<typeof fixture>) {
  m.players[0].fighter.cooldown = 0;
  stepCombat(m, [{ ...neutralInput(), attack: true }]);
}
function local(f: ReturnType<typeof fixture>['players'][0]['fighter']) {
  const s = emptyGame();
  startRun(s, '강호 동작 비교', 123);
  const r = s.run!;
  r.fighter = structuredClone(f);
  r.offers = [];
  r.fighter.trainingPoints = r.fighter.deferredTrainingPoints = 0;
  r.fighter.augmentOffers = [];
  const enemy = r.enemies[0];
  Object.assign(enemy, {
    x: 1500,
    y: 420,
    hp: 100000,
    maxHp: 100000,
    state: 'windup',
    timer: 1000,
    xp: 0,
  });
  r.enemies = [enemy];
  return r;
}

for (const id of ['tang', 'jegal'] as const)
  for (const level of [1, 3, 5])
    for (const combo of [0, 1])
      it(`${id} Lv${level} combo${combo}: actual Gangho and owned raid accept the same preparation/damage/projectile plan`, () => {
        const m = fixture(id, combo, level),
          r = local(m.players[0].fighter);
        m.players[4].fighter.x = 1100;
        basic(m);
        tick(r, { ...neutralInput(), attack: true }, 1 / 60);
        expect(m.attacks).toHaveLength(1 + (id === 'tang' && level >= 3 && combo === 1 ? 2 : 0));
        expect(m.attacks[0].damage).toBeCloseTo(
          r.attacks[0].damage * (m.attacks.length === 3 ? 0.6 : 1),
        );
        expect(m.attacks[0].angle).toBeCloseTo(
          r.attacks[0].angle - (m.attacks.length === 3 ? 0.18 : 0),
        );
        // Move during preparation: launch must use the hand origin at contact, not the initial one.
        m.players[0].fighter.x += 20;
        r.fighter.x += 20;
        for (let i = 0; i < 5; i++) {
          stepCombat(m, []);
          tick(r, neutralInput(), 1 / 60);
        }
        if (id === 'jegal' && level >= 3 && combo === 1) {
          expect(m.attacks[0].shape).toBe('sector');
          expect(m.attacks[0].x).toBe(r.fighter.x);
          expect(r.projectiles).toHaveLength(0);
        } else {
          expect(r.projectiles).toHaveLength(m.attacks.length);
          m.attacks.forEach((a, i) => {
            const p = r.projectiles[i];
            expect(a.x).toBeCloseTo(p.x);
            expect(a.y).toBeCloseTo(p.y);
            expect(a.speed).toBeCloseTo(Math.hypot(p.vx, p.vy));
            expect(a.radius).toBe(p.radius);
            expect(a.life).toBeCloseTo(p.life);
          });
        }
      });

it('three Tang darts all damage but apply at most two poison stacks per target and sequence, including after JSON restore', () => {
  const m = fixture('tang', 1),
    boss = m.players[4];
  basic(m);
  steps(m, 6);
  expect(boss.poison).toBe(2);
  expect(boss.ownedPoisonVolleys?.[0].hits).toBe(2);
  const first = boss.damageTaken!;
  expect(first).toBeCloseTo(m.players[0].damageDealt!);
  const loaded = JSON.parse(JSON.stringify(m));
  basic(loaded);
  steps(loaded, 6);
  expect(loaded.players[4].poison).toBe(3);
  basic(loaded);
  steps(loaded, 6);
  expect(loaded.players[4].poison).toBe(5);
  steps(loaded, 190);
  expect(loaded.players[4].poison).toBe(0);
  expect(loaded.players[4].ownedPoisonVolleys).toHaveLength(0);
});

it('interleaved party volleys have independent poison limits and never poison teammates', () => {
  const m = fixture('tang', 1, 5, 2);
  stepCombat(
    m,
    [0, 1].map(() => ({ ...neutralInput(), attack: true })),
  );
  steps(m, 6);
  expect(m.players[4].poison).toBe(4);
  expect(m.players[4].ownedPoisonVolleys?.map((v) => v.hits)).toEqual([2, 2]);
  expect(m.players[0].poison).toBe(0);
  expect(m.players[1].poison).toBe(0);
});

it('Tang ultimate detonates each in-range poisoned enemy using its own stacks, consumes half, and grants no gauge', () => {
  const m = fixture('tang'),
    f = m.players[0].fighter,
    b = m.players[4];
  b.poison = 5;
  b.poisonClock = 3;
  b.ownedPoison = { damage: 2, level: 4, pulse: 0.5 };
  const other = structuredClone(b),
    clean = structuredClone(b);
  other.seat = 5;
  other.poison = 3;
  other.fighter.x = 670;
  clean.seat = 6;
  clean.poison = clean.poisonClock = 0;
  clean.ownedPoison = undefined;
  m.players.push(other, clean);
  f.arts[0].gauge = 100;
  const hp = b.fighter.hp;
  stepCombat(m, [{ ...neutralInput(), ultimate: true }]);
  expect(hp - b.fighter.hp).toBeCloseTo(techniqueStats('tang', 5, f).ultimateDamage * 5);
  expect(b.poison).toBe(2);
  expect(other.poison).toBe(1);
  expect(hp - other.fighter.hp).toBeCloseTo(techniqueStats('tang', 5, f).ultimateDamage * 3);
  expect(clean.damageTaken ?? 0).toBe(0);
  expect(f.arts[0].gauge).toBe(0);
  const noPoison = fixture('tang');
  noPoison.players[0].fighter.arts[0].gauge = 100;
  stepCombat(noPoison, [{ ...neutralInput(), ultimate: true }]);
  expect(noPoison.players[4].damageTaken ?? 0).toBe(0);
  const distant = fixture('tang');
  distant.players[4].fighter.x = 1000;
  distant.players[4].poison = 3;
  distant.players[4].poisonClock = 3;
  distant.players[4].ownedPoison = { damage: 2, level: 4, pulse: 0.5 };
  distant.players[0].fighter.arts[0].gauge = 100;
  stepCombat(distant, [{ ...neutralInput(), ultimate: true }]);
  expect(distant.players[4].poison).toBe(3);
  expect(distant.players[4].damageTaken ?? 0).toBe(0);
});

it('Jegal A creates heaven, B creates earth on actual contact and links two pulses without pulling a boss', () => {
  const m = fixture('jegal'),
    a = m.players[0],
    b = m.players[4];
  basic(m);
  steps(m, 6);
  expect(a.ownedFormations?.map((n) => n.kind)).toEqual(['heaven']);
  expect(a.ownedFormations?.[0].pulses).toBe(0);
  const x = b.fighter.x;
  basic(m);
  steps(m, 6);
  expect(a.ownedFormations?.map((n) => n.kind)).toEqual(['heaven', 'earth']);
  expect(a.ownedFormations?.map((n) => n.pulses)).toEqual([2, 2]);
  expect(b.fighter.x).toBe(x);
  const hp = b.fighter.hp,
    gauge = a.fighter.arts[0].gauge;
  steps(m, 70);
  expect(hp - b.fighter.hp).toBeCloseTo(a.ownedFormations!.reduce((n, f) => n + f.damage * 2, 0));
  expect(a.fighter.arts[0].gauge).toBe(gauge);
  expect(a.ownedFormations?.map((n) => n.pulses)).toEqual([0, 0]);
});

it('formation placement is bounded per kind/caster and misses create nothing', () => {
  const nodes: Formation[] = [];
  for (let i = 0; i < 20; i++) addJegalFormation(nodes, i, 1, i % 2 ? 'heaven' : 'earth', 10, 3);
  expect(nodes).toHaveLength(4);
  expect(nodes.map((n) => n.x)).toEqual([16, 17, 18, 19]);
  const m = fixture('jegal', 1);
  m.players[4].fighter.x = 1100;
  basic(m);
  steps(m, 10);
  expect(m.players[0].ownedFormations ?? []).toHaveLength(0);
});

it('Jegal ultimate replaces only its owner fields, pulses seven times after .3s, and restores exact clocks without a replay', () => {
  const m = fixture('jegal', 0, 5, 2),
    a = m.players[0],
    b = m.players[4];
  a.fighter.arts[0].gauge = 100;
  m.players[1].ownedFormations = [
    { x: 100, y: 100, life: 4, pulse: 0.4, damage: 0, pulses: 0, kind: 'heaven' },
  ];
  stepCombat(m, [{ ...neutralInput(), ultimate: true }]);
  expect(a.ownedFormations).toHaveLength(4);
  expect(m.players[1].ownedFormations).toHaveLength(1);
  b.fighter.x = a.ownedFormations![0].x;
  b.fighter.y = a.ownedFormations![0].y;
  steps(m, 17);
  expect(b.damageTaken ?? 0).toBe(0);
  steps(m, 2);
  expect(a.ownedFormations![0].pulses).toBe(6);
  const loaded = JSON.parse(JSON.stringify(m));
  steps(m, 270);
  steps(loaded, 270);
  expect(loaded).toEqual(m);
  expect(b.damageTaken).toBeCloseTo(techniqueStats('jegal', 5, a.fighter).ultimateDamage * 7);
  expect(a.fighter.arts[0].gauge).toBe(0);
  steps(m, 20);
  expect(a.ownedFormations).toHaveLength(0);
});

it('death, lifetime expiry, return and a real next-floor boundary discard owned fields', () => {
  for (const reason of ['death', 'expiry', 'return', 'floor'] as const) {
    const m = fixture('jegal'),
      a = m.players[0];
    a.fighter.arts[0].gauge = 100;
    stepCombat(m, [{ ...neutralInput(), ultimate: true }]);
    if (reason === 'death') {
      a.fighter.hp = 0;
      stepCombat(m, []);
    }
    if (reason === 'expiry') {
      a.fighter.expiresAt = 1;
      expirePersonalRaid(m, 2);
    }
    if (reason === 'return') {
      m.phase = 'rest';
      returnRaidPlayer(m, 0);
    }
    if (reason === 'floor') {
      m.phase = 'rest';
      nextRaidFloor(m);
    }
    expect(a.ownedFormations).toBeUndefined();
  }
});

it('real SQLite checkpoints retain pending darts, per-caster poison limits and formation clocks without granting rewards twice', async () => {
  const db = new PvpDatabase(':memory:');
  try {
    const account = await db.register('techniquecase', 'isolated-technique-password', '저장 검사');
    const m = fixture('tang', 1),
      f = m.players[0].fighter;
    f.expiresAt = Date.now() + 86400000;
    const save = db.online.read(account.id);
    save.state.family.roster = [structuredClone(f)];
    db.online.write(account.id, save.revision, save.state);
    reserveFighter(db.online, account.id, f.id, 'CASEAA');
    basic(m);
    m.players[0].ownedFormations = [
      { x: 650, y: 420, life: 4, pulse: 0.2, damage: 12, pulses: 2, kind: 'heaven' },
    ];
    const members = [{ account: { id: account.id }, fighterId: f.id }, null, null, null];
    const serialize = (match: typeof m | null) => JSON.stringify(match);
    const committed = savePersonalRaid(db.online, 'CASEAA', members, m, serialize)!;
    const row = db.db.prepare('SELECT state FROM online_raids WHERE code=?').get('CASEAA')!;
    const loaded = JSON.parse(String(row.state));
    expect(loaded.attacks).toHaveLength(3);
    expect(loaded.players[0].ownedFormations[0].pulse).toBe(0.2);
    steps(committed, 8);
    steps(loaded, 8);
    expect(loaded).toEqual(committed);
    expect(loaded.players[4].poison).toBe(2);
    const again = savePersonalRaid(db.online, 'CASEAA', members, loaded, serialize)!;
    expect(again.players[4].ownedPoisonVolleys).toEqual(loaded.players[4].ownedPoisonVolleys);
    expect(db.online.read(account.id).state.family.silver).toBe(save.state.family.silver);
    expect(db.online.read(account.id).locked).toBe('CASEAA');
  } finally {
    db.close();
  }
});
