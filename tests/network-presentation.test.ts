import { expect, it } from 'vitest';
import { SnapshotMotion } from '../src/game/snapshot-motion';
import { NetworkPresentation } from '../src/game/network-presentation';
import { ArenaPresentation } from '../src/pvp/presentation';
import { emptyGame, startRun } from '../src/domain/game';
import { createPvpMatch } from '../src/pvp/engine';
import { createRaid } from '../src/raid/engine';
import { FIELD } from '../src/domain/content';

function run() {
  const s = emptyGame();
  startRun(s, '표시 사본', 777);
  const r = s.run!;
  r.offers = [];
  r.fighter.action = 'walk';
  r.fighter.actionTime = 0;
  r.fighter.x = 600;
  r.fighter.y = 500;
  return r;
}
function world() {
  const m = createPvpMatch('display', 'friendly', [
    { name: 'a', preset: 'sword' },
    { name: 'b', preset: 'monk' },
  ]);
  m.phase = 'fighting';
  for (const a of m.players) {
    a.fighter.action = 'walk';
    a.fighter.actionTime = 0;
  }
  return m;
}
for (const hz of [60, 120, 144, 240])
  for (const rate of [10, 20])
    it(`${rate}Hz snapshots at ${hz}Hz drawing fill frame gaps and correct publication jitter without writing authority`, () => {
      const view = new SnapshotMotion(1 / rate),
        positions: number[] = [];
      for (let n = 0; n < hz; n++) {
        const now = (n * 1000) / hz,
          tick = Math.floor((now + 0.001) / (1000 / rate)),
          source = { x: 600 + (tick * 260) / rate, y: 500, hp: 90 };
        const original = { ...source };
        view.begin('fight', tick / rate, now);
        positions.push(view.body('hero', source, 'walk').x);
        view.end();
        expect(source).toEqual(original);
      }
      const warm = positions.slice(Math.ceil(hz * 0.25));
      expect(warm.slice(1).every((x, i) => x > warm[i])).toBe(true);
      expect(Math.max(...warm.slice(1).map((x, i) => x - warm[i]))).toBeLessThan(280 / hz + 0.1);
    });

it('limits missing packets to one publication interval and snaps after a long gap/rewound clock', () => {
  const p = new SnapshotMotion(0.1);
  p.begin('fight', 0, 0);
  p.body('a', { x: 100, y: 100 }, 'walk');
  p.end();
  p.begin('fight', 0.1, 100);
  p.body('a', { x: 126, y: 100 }, 'walk');
  p.end();
  p.begin('fight', 0.1, 1000);
  expect(p.body('a', { x: 126, y: 100 }, 'walk').x).toBe(152);
  p.end();
  p.begin('fight', 0.2, 1100);
  expect(p.body('a', { x: 152, y: 100 }, 'walk').x).toBe(152);
  p.end();
  p.begin('fight', 0, 0);
  expect(p.body('a', { x: 50, y: 100 }, 'walk').x).toBe(50);
});

it('Gangho keeps latest HP/choices, extrapolates only drawings, and ignores pause, death, defense, teleport and a new wave', () => {
  const a = run(),
    view = new NetworkPresentation();
  view.sample(a, 0, true);
  const b = structuredClone(a);
  b.elapsed += 0.1;
  b.fighter.x += 26;
  b.fighter.hp -= 20;
  view.sample(b, 100, true);
  const hash = JSON.stringify(b),
    draw = view.sample(b, 150, true)!;
  expect(draw.fighter.x).toBeCloseTo(b.fighter.x + 13);
  expect(draw.fighter.hp).toBe(b.fighter.hp);
  expect(JSON.stringify(b)).toBe(hash);
  expect(view.sample(b, 160, false)).toBe(b);
  for (const reason of ['dead', 'defense', 'teleport', 'wave'] as const) {
    const p = new NetworkPresentation();
    p.sample(a, 0, true);
    p.sample(b, 100, true);
    const c = structuredClone(b);
    c.elapsed += 0.1;
    c.fighter.x += reason === 'teleport' ? 145 : 26;
    if (reason === 'dead') c.fighter.hp = 0;
    if (reason === 'defense') c.fighter.action = 'defense';
    if (reason === 'wave') c.wave++;
    p.sample(c, 200, true);
    expect(p.sample(c, 250, true)!.fighter.x).toBe(c.fighter.x);
  }
});

it('preparation walking uses packet time even when combat elapsed is unchanged', () => {
  const a = run();
  a.phase = 'prep';
  const view = new NetworkPresentation();
  view.sample(a, 0, true);
  const b = structuredClone(a);
  b.fighter.x += 26;
  view.sample(b, 100, true);
  expect(view.sample(b, 150, true)!.fighter.x).toBeCloseTo(b.fighter.x + 13);
});

it('online movement never draws past the fixed world boundary while waiting for the next packet', () => {
  const a = run(),
    p = new NetworkPresentation();
  a.fighter.x = FIELD.right - 26;
  p.sample(a, 0, true);
  const b = structuredClone(a);
  b.elapsed += 0.1;
  b.fighter.x = FIELD.right;
  p.sample(b, 100, true);
  expect(p.sample(b, 180, true)!.fighter.x).toBe(FIELD.right);
});

it('network projectile identities survive JSON snapshots, but new volleys/bounces/phase changes cannot reuse launch identity', () => {
  const a = run(),
    view = new NetworkPresentation();
  a.projectiles = [
    {
      x: 500,
      y: 400,
      vx: 600,
      vy: 0,
      life: 2,
      friendly: false,
      damage: 3,
      radius: 8,
      hits: [],
      owner: 100,
    },
  ];
  const first = view.sample(a, 0, true)!.projectiles[0];
  const b = structuredClone(a);
  b.elapsed += 0.1;
  b.projectiles[0].x += 60;
  b.projectiles[0].life -= 0.1;
  const second = view.sample(b, 100, true)!.projectiles[0];
  expect(second).toBe(first);
  expect(view.sample(b, 150, true)!.projectiles[0].x).toBe(590);
  const c = structuredClone(b);
  c.elapsed += 0.1;
  c.projectiles[0].life = 2;
  expect(view.sample(c, 200, true)!.projectiles[0]).not.toBe(first);
  const d = structuredClone(c);
  d.elapsed += 0.1;
  d.projectiles = [];
  view.sample(d, 300, true);
  expect(view.sample(d, 315, true)!.projectiles).toHaveLength(0);
});

it('projectiles do not launch early, travel beyond their remaining lifetime, or resurrect after authoritative removal', () => {
  const a = run(),
    view = new NetworkPresentation();
  a.projectiles = [
    {
      x: 500,
      y: 400,
      vx: 600,
      vy: 0,
      life: 0.02,
      delay: 0.1,
      friendly: false,
      damage: 3,
      radius: 8,
      hits: [],
    },
  ];
  view.sample(a, 0, true);
  expect(view.sample(a, 80, true)!.projectiles[0].x).toBe(500);
  const b = structuredClone(a);
  b.elapsed = 0.1;
  b.projectiles[0].delay = 0;
  view.sample(b, 100, true);
  expect(view.sample(b, 180, true)!.projectiles[0].x).toBe(512);
  const c = structuredClone(b);
  c.elapsed = 0.2;
  c.projectiles = [];
  expect(view.sample(c, 200, true)!.projectiles).toHaveLength(0);
});

it('arena smooths remote actors/projectiles/action clocks; current HP, attack confirmation and local prediction authority stay untouched', () => {
  const a = world(),
    view = new ArenaPresentation();
  a.players[1].fighter.action = 'attack';
  a.players[1].fighter.actionTime = 0.25;
  view.sample(a, 0, true);
  const b = structuredClone(a);
  b.tick += 3;
  b.players[1].fighter.x += 13;
  b.players[1].fighter.actionTime -= 0.05;
  b.players[1].fighter.hp -= 20;
  view.sample(b, 50, true);
  const hash = JSON.stringify(b),
    copy = view.sample(b, 75, true)!;
  expect(copy.players[1].fighter.x).toBeCloseTo(b.players[1].fighter.x + 6.5);
  expect(copy.players[1].fighter.actionTime).toBeCloseTo(0.175);
  expect(copy.players[1].fighter.hp).toBe(b.players[1].fighter.hp);
  expect(JSON.stringify(b)).toBe(hash);
  expect(copy.tick).toBe(b.tick);
  expect(copy.attacks).toHaveLength(0);
  expect(view.sample(b, 80, false)).toBe(b);
  b.phase = 'interval';
  expect(view.sample(b, 90, true)).toBe(b);
});

it('round/epoch/floor changes and inactive/dead seats never interpolate an old actor', () => {
  const a = world(),
    view = new ArenaPresentation();
  view.sample(a, 0, true);
  const b = structuredClone(a);
  b.tick += 3;
  b.players[1].fighter.x += 13;
  view.sample(b, 50, true);
  const c = structuredClone(b);
  c.epoch++;
  c.players[1].fighter.x += 13;
  view.sample(c, 100, true);
  expect(view.sample(c, 125, true)!.players[1].fighter.x).toBe(c.players[1].fighter.x);
  c.players[1].fighter.hp = 0;
  expect(view.sample(c, 135, true)!.players[1].fighter.x).toBe(c.players[1].fighter.x);
});

it('raid boss recovery clocks and actual formation/effect lifetime draw smoothly without creating contacts or mutating durable data', () => {
  const a = createRaid('raid-display', [{ name: 'a', preset: 'sword' }]);
  a.phase = 'fighting';
  a.boss.phase = 'recover';
  a.boss.clock = 0.5;
  a.players[0].ownedFormations = [
    { x: 400, y: 400, life: 4, pulse: 0.4, damage: 20, pulses: 2, kind: 'heaven' },
  ];
  a.effects = [{ id: 1, seat: 0, kind: 'hit', x: 500, y: 300, amount: 20, life: 0.3 }];
  const hash = JSON.stringify(a),
    view = new ArenaPresentation();
  view.sample(a, 0, true);
  const copy = view.sample(a, 25, true)!;
  expect(copy.boss.clock).toBeCloseTo(0.475);
  expect(copy.players[0].ownedFormations![0].pulses).toBe(2);
  expect(copy.effects[0].life).toBeCloseTo(0.275);
  expect(JSON.stringify(a)).toBe(hash);
});
