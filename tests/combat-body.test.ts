import { describe, expect, it } from 'vitest';
import {
  combatBody,
  combatOrigin,
  bodyDistance,
  projectileHitsBody,
  sectorHitsBody,
} from '../src/domain/combat-body';
import { emptyGame, startRun, tick } from '../src/domain/game';
import { meleeHits } from '../src/domain/boss-melee';
import { attack } from '../src/domain/boss-kit';

const idle = { dx: 0, dy: 0, aim: 0, attack: false, ultimate: false, defense: false };
function fixture() {
  const state = emptyGame();
  startRun(state, '몸통 판정', 123);
  const r = state.run!;
  r.offers = [];
  r.fighter.x = 900;
  r.fighter.y = 600;
  const e = r.enemies[0];
  Object.assign(e, { x: 1050, y: 600, hp: 1000, maxHp: 1000, xp: 0, state: 'windup', timer: 100 });
  r.enemies = [e];
  return { r, f: r.fighter, e };
}
describe('feet coordinates and visible body collision are separate', () => {
  it('uses a torso origin without moving the simulation actor', () => {
    const actor = { x: 100, y: 200 };
    expect(combatOrigin(actor)).toEqual({ x: 100, y: 166 });
    expect(actor).toEqual({ x: 100, y: 200 });
  });
  for (const height of [20, 34, 60])
    it(`a fast bolt crosses the body at height ${height}`, () => {
      const actor = { x: 100, y: 200 };
      expect(
        projectileHitsBody({ x: 0, y: 200 - height }, { x: 200, y: 200 - height }, actor, 3),
      ).toBe(true);
      expect(
        projectileHitsBody({ x: 200, y: 200 - height }, { x: 0, y: 200 - height }, actor, 3),
      ).toBe(true);
    });
  it('does not hit empty padding above, below or beside the body', () => {
    const actor = { x: 100, y: 200 };
    for (const y of [110, 230])
      expect(projectileHitsBody({ x: 0, y }, { x: 200, y }, actor, 3)).toBe(false);
    expect(projectileHitsBody({ x: 125, y: 110 }, { x: 125, y: 200 }, actor, 3)).toBe(false);
  });
  it('handles vertical, diagonal and stationary segments without tunnelling', () => {
    const actor = { x: 100, y: 200 };
    expect(bodyDistance({ x: 100, y: 50 }, { x: 100, y: 220 }, actor)).toBe(0);
    expect(bodyDistance({ x: 0, y: 50 }, { x: 200, y: 260 }, actor)).toBe(0);
    expect(bodyDistance({ x: 100, y: 166 }, { x: 100, y: 166 }, actor)).toBe(0);
  });
  it('keeps the capsule fixed across facing and attack poses', () => {
    const actor = { x: 100, y: 200, kind: 'sword' };
    expect(combatBody({ ...actor, ...{ facing: 2, state: 'strike' } })).toEqual(combatBody(actor));
    expect(combatBody({ ...actor, bossId: '2-1' }).top.y).toBeLessThan(combatBody(actor).top.y);
    expect(combatBody({ ...actor, role: 'rider' }).top.y).toBeLessThan(combatBody(actor).top.y);
  });
  it('tests the body against finite weapon sectors, including their corners', () => {
    const source = { x: 0, y: 0 };
    expect(sectorHitsBody(source, { x: 80, y: 40 }, 0, 100, 0.2)).toBe(true);
    expect(sectorHitsBody(source, { x: 140, y: 0 }, 0, 100, 0.2)).toBe(false);
    expect(sectorHitsBody(source, { x: -80, y: 0 }, 0, 100, 0.2)).toBe(false);
    expect(sectorHitsBody(source, { x: 100, y: 100 }, 0, 100, 0.2)).toBe(false);
  });
  it('allows a thrust through a torso while preserving ground-based stomp boundaries', () => {
    const { e, f } = fixture();
    Object.assign(e, { x: 900, y: 600, aim: 0 });
    f.x = 1000;
    f.y = 640;
    expect(meleeHits(e, f, attack('찌르기', { shape: 'line', range: 150, width: 4 }))).toBe(true);
    expect(meleeHits(e, { x: 900, y: 719 }, attack('진각', { shape: 'circle', range: 100 }))).toBe(
      false,
    );
    expect(meleeHits(e, { x: 900, y: 717 }, attack('진각', { shape: 'circle', range: 100 }))).toBe(
      true,
    );
  });
});
describe('actual tick uses the shared body', () => {
  for (const friendly of [false, true])
    it(`${friendly ? 'player' : 'enemy'} projectile damages a torso crossed between frames`, () => {
      const { r, f, e } = fixture();
      const target = friendly ? e : f;
      const before = target.hp;
      r.projectiles = [
        {
          x: target.x - 90,
          y: target.y - 52,
          vx: 10800,
          vy: 0,
          life: 1,
          damage: 20,
          friendly,
          hits: [],
          radius: 2,
        },
      ];
      const cues: unknown[] = [];
      tick(r, idle, 1 / 60, (cue) => cues.push(cue));
      expect(target.hp).toBeLessThan(before);
      expect(cues).toContainEqual(
        expect.objectContaining({ kind: 'impact', target: friendly ? e.id : 'hero' }),
      );
      const after = target.hp;
      tick(r, idle, 1 / 60);
      expect(target.hp).toBe(after);
    });
  it('a visually clear miss and invulnerability still avoid damage', () => {
    const { r, f } = fixture();
    r.projectiles = [
      {
        x: f.x - 90,
        y: f.y - 95,
        vx: 10800,
        vy: 0,
        life: 1,
        damage: 20,
        friendly: false,
        hits: [],
        radius: 2,
      },
    ];
    tick(r, idle, 1 / 60);
    expect(f.hp).toBe(120);
    f.invulnerable = 1;
    r.projectiles = [
      {
        x: f.x - 90,
        y: f.y - 34,
        vx: 10800,
        vy: 0,
        life: 1,
        damage: 20,
        friendly: false,
        hits: [],
        radius: 2,
      },
    ];
    tick(r, idle, 1 / 60);
    expect(f.hp).toBe(120);
  });
});
