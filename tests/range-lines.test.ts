import { expect, it } from 'vitest';
import { BossReadability } from '../src/game/boss-readability';
import { CombatClarity } from '../src/game/combat-clarity';
import { BOSS_KITS } from '../src/domain/boss-melee';
import { ROLE_PROFILES } from '../src/domain/region-enemies';
import { emptyGame, startRun } from '../src/domain/game';
import type { Enemy } from '../src/domain/model';

it('all boss actions and ordinary roles draw no ground range/landing outlines and preserve state', () => {
  const calls: string[] = [],
    layers: unknown[] = [];
  const scene = {
    game: { canvas: { parentElement: null } },
    add: {
      graphics() {
        const g = new Proxy(
          {},
          {
            get:
              (_target, name) =>
              (..._args: unknown[]) => {
                calls.push(String(name));
                return g;
              },
          },
        );
        layers.push(g);
        return g;
      },
    },
    cameras: { main: { worldView: { x: 0, y: 0, right: 1920, bottom: 1080 } } },
  } as any;
  const clarity = new CombatClarity(scene),
    boss = new BossReadability(scene, () => ({ y: 330 }));
  const state = emptyGame();
  startRun(state, '범위선 회귀', 123);
  const run = state.run!,
    base = run.enemies[0];
  run.enemies = [];
  for (const [bossId, kit] of Object.entries(BOSS_KITS))
    for (const move of Object.keys(kit.moves))
      run.enemies.push({
        ...base,
        id: run.enemies.length,
        bossId,
        kind: 'chief',
        move: move as Enemy['move'],
        state: 'windup',
        timer: 0.1,
        x: 800,
        y: 500,
      });
  const bosses = run.enemies.length;
  expect(bosses).toBe(185);
  for (const [role, profile] of Object.entries(ROLE_PROFILES))
    run.enemies.push({
      ...base,
      id: run.enemies.length,
      bossId: undefined,
      kind: profile.kind,
      role,
      state: 'windup',
      timer: 0.1,
      x: 800,
      y: 500,
    } as Enemy);
  run.zones = [
    { id: 1, owner: 0, kind: 'poison', x: 700, y: 700, radius: 180, life: 5, warning: 1, pulse: 0 },
  ];
  run.encounterObjects = [
    {
      id: 2,
      owner: 0,
      kind: 'mine',
      x: 900,
      y: 700,
      radius: 180,
      life: 5,
      warning: 1,
      pulse: 0,
      hp: 0,
      maxHp: 0,
      aim: 0,
    },
  ];
  run.projectiles = [
    {
      x: 700,
      y: 400,
      vx: 1,
      vy: 1,
      radius: 10,
      life: 1,
      friendly: false,
      hits: [],
      damage: 1,
      landing: { x: 1000, y: 700, radius: 180, kind: 'poison' },
    },
  ];
  const before = structuredClone(run);
  clarity.draw(run);
  boss.draw(run, 1, false);
  boss.draw(run, 1.1, true);
  expect(run).toEqual(before);
  expect(layers).toHaveLength(2); // Direction edge layer plus HP-adjacent marks; no ground layer.
  expect(calls).toContain('fillRect'); // Keep actual preparation feedback at the HP bar.
  expect(calls.filter((n) => /arc|stroke|circle|ellipse|line|path/i.test(n))).toEqual([]);
  clarity.draw(null);
  boss.draw(null, 2, false);
  clarity.destroy();
  boss.destroy();
});
