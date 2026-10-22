import { expect, it } from 'vitest';
import { emptyGame, startRun, tick, command, spawnWave } from '../src/domain/game';
import {
  combatReport,
  recordDamage,
  trackCombatWave,
  finishCombatWave,
} from '../src/domain/combat-report';
import { decodeCurrentSave } from '../src/platform/save-migrations';
const input = { dx: 0, dy: 0, aim: 0, attack: false, defense: false, ultimate: false };
function fixture() {
  const s = emptyGame();
  startRun(s, '전투 기록', 123);
  s.run!.offers = [];
  return s;
}
it('records an actual projectile kill before inventory destruction and persists its cause on claim', () => {
  const s = fixture(),
    r = s.run!,
    f = r.fighter;
  f.hp = 2;
  f.invulnerable = 0;
  f.augmentOffers = [];
  r.enemies.forEach((e) => {
    e.x = 1400;
    e.y = 700;
    e.state = 'recover';
    e.timer = 10;
  });
  r.projectiles = [
    {
      x: f.x,
      y: f.y - 32,
      vx: 0,
      vy: 0,
      damage: 100,
      friendly: false,
      life: 1,
      radius: 40,
      hits: [],
      owner: r.enemies[0].id,
    },
  ];
  tick(r, input, 1 / 60);
  expect(r.phase).toBe('dead');
  expect(r.combatReport!.fatal).toMatchObject({
    hpAfter: 0,
    amount: 2,
    source: { kind: 'projectile' },
  });
  expect(r.fighter.items).toEqual([]);
  expect(decodeCurrentSave(s)).not.toBeNull();
  expect(command(s, { type: 'claim' }, 12345)).toBe(true);
  expect(s.family.journeys![0].combatReport!.fatal!.source.kind).toBe('projectile');
  expect(decodeCurrentSave(s)).not.toBeNull();
});
it('records actual field/status damage but not invulnerable attempts', () => {
  const s = fixture(),
    r = s.run!,
    f = r.fighter;
  r.enemies.forEach((e) => {
    e.x = 1500;
    e.y = 700;
    e.state = 'recover';
    e.timer = 10;
  });
  f.invulnerable = 1;
  r.zones = [{ id: 8, kind: 'fire', x: f.x, y: f.y, radius: 100, life: 2, warning: 0, pulse: 0 }];
  tick(r, input, 1 / 60);
  expect(combatReport(r).damageTaken).toBe(0);
  f.invulnerable = 0;
  r.zones[0].pulse = 0;
  tick(r, input, 1 / 60);
  expect(combatReport(r).hits.at(-1)!.source).toMatchObject({ kind: 'field', label: '화염 장판' });
  f.invulnerable = 0;
  f.poisonTime = 3;
  f.fieldTick = 0.8;
  r.zones = [];
  tick(r, input, 1 / 60);
  expect(combatReport(r).hits.at(-1)!.source.kind).toBe('status');
});
it('bounded recent hits retain cumulative damage and unique measured wave durations', () => {
  const s = fixture(),
    r = s.run!;
  trackCombatWave(r);
  for (let n = 0; n < 20; n++) {
    r.elapsed = n;
    recordDamage(r, 2, { kind: 'field', label: '독 장판' });
  }
  expect(combatReport(r).hits).toHaveLength(12);
  expect(combatReport(r).damageTaken).toBe(40);
  finishCombatWave(r);
  finishCombatWave(r);
  expect(combatReport(r).waves).toHaveLength(1);
  expect(combatReport(r).waves[0]).toMatchObject({ wave: 1, seconds: 19, damageTaken: 40 });
  r.wave = 5;
  spawnWave(r);
  r.offers = [];
  trackCombatWave(r);
  r.elapsed += 10;
  finishCombatWave(r);
  expect(combatReport(r).waves.at(-1)).toMatchObject({ wave: 5, seconds: 10, damageTaken: 0 });
});
it('old saves are accepted without fabricating earlier damage; malformed reports are rejected', () => {
  const s = fixture(),
    r = s.run!;
  delete r.combatReport;
  r.elapsed = 50;
  expect(decodeCurrentSave(s)).not.toBeNull();
  expect(combatReport(r).startedAt).toBe(50);
  const valid = structuredClone(s);
  expect(decodeCurrentSave(valid)).not.toBeNull();
  for (const edit of [
    (v: any) => (v.damageTaken = NaN),
    (v: any) => (v.hits = Array(13).fill({})),
    (v: any) => (v.fatal = { hpAfter: 1 }),
    (v: any) => (v.attacks = { unknown: 1 }),
    (v: any) => (v.waves = [{ wave: 30, seconds: 1, damageTaken: 0 }]),
  ]) {
    const bad = structuredClone(valid);
    edit(bad.run!.combatReport);
    expect(decodeCurrentSave(bad)).toBeNull();
  }
});
