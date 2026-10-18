import { describe, expect, it } from 'vitest';
import { authoredEnemyArt, authoredEnemyFrame, TOMB_FAMILY_ART } from '../src/game/authored-enemy';
import { enemyAttack } from '../src/domain/combat';
import type { Enemy } from '../src/domain/model';
import { regionArtManifest } from '../src/platform/region-art';

describe('whole Tomb authored family', () => {
  it('selects all ordinary roles and all four bosses without affecting other regions', () => {
    const cases = [
      { kind: 'spear', role: 'trapper' },
      { kind: 'spear', role: 'guard' },
      { kind: 'archer', role: 'crossbow' },
      ...[1, 2, 3, 4].map((n) => ({ kind: 'chief', bossId: `6-${n}` })),
    ] as Enemy[];
    expect(new Set(cases.map((e) => authoredEnemyArt(e, 6)?.id)).size).toBe(7);
    expect(cases.map((e) => authoredEnemyArt(e, 6)?.id)).toEqual([
      'tombtrapper',
      'tombguard',
      'tombcrossbow',
      'jeokho',
      'seokmun',
      'gwakgi',
      'wolryeong',
    ]);
    expect(authoredEnemyArt({ kind: 'chief', bossId: '6-2', role: 'trapper' }, 6)?.id).toBe(
      'seokmun',
    );
    for (const e of cases) expect(authoredEnemyArt(e, 5)?.id).not.toBe(authoredEnemyArt(e, 6)?.id);
  });
  it('loads only its 35 native character sheets and floor for the region', () => {
    const manifest = regionArtManifest(6);
    expect(Object.keys(manifest)).toHaveLength(36);
    expect(
      Object.values(manifest).filter((path) => path.startsWith('/art/tomb-family-v1/')),
    ).toHaveLength(35);
    for (const key of ['region-actors-6', 'region-direction-6', 'region-motion-6', 'region-rear-6'])
      expect(manifest).not.toHaveProperty(key);
  });
  it('keeps one pixel scale and padded source rectangles in all views and states', () => {
    const views = [2, 1, 0, 1, 2, 3, 4, 3],
      flips = [false, false, false, true, true, true, false, false];
    for (const art of TOMB_FAMILY_ART.characters) {
      expect(art.frames).toHaveLength(60);
      expect(art.pixelScale).toBe(0.225);
      for (const f of art.frames) {
        expect([f.width, f.height]).toEqual([art.cell.width, art.cell.height]);
        expect(
          Math.min(
            f.bounds.left,
            f.bounds.top,
            f.width - f.bounds.right,
            f.height - f.bounds.bottom,
          ),
        ).toBeGreaterThanOrEqual(32);
        if (!(f.kind === 'locomotion' && f.pose === 5))
          expect(
            art.healthClearance - (f.footY - f.bounds.top) * art.pixelScale,
          ).toBeGreaterThanOrEqual(15.99999);
      }
      for (let d = 0; d < 8; d++)
        for (const action of [
          'idle',
          'walk',
          'windup',
          'strike',
          'recover',
          'hurt',
          'death',
        ] as const) {
          const selected = authoredEnemyFrame(art, d, action, 0.35, 0.5);
          expect([selected.view, selected.flip]).toEqual([views[d], flips[d]]);
          expect(selected.frame.view).toBe(views[d]);
        }
    }
  });
  it('exposes every first, second and third boss contact in every direction', () => {
    const moves = [
      ['slash', 'thrust', 'slam', 'stance', 'dash'],
      ['stance', 'dash', 'slam', 'sweep', 'hazard'],
      ['stance', 'fan', 'slash', 'slam'],
      ['combo', 'dash', 'thrust', 'stance', 'fan'],
    ];
    for (let n = 0; n < 4; n++)
      for (const move of moves[n]) {
        const enemy = {
          kind: 'chief',
          bossId: `6-${n + 1}`,
          pattern: 0,
          move,
          x: 0,
          y: 0,
          aim: 0,
        } as Enemy;
        const melee = enemyAttack(enemy).melee!;
        expect(melee).toBeTruthy();
        for (const contact of melee.contacts)
          for (let d = 0; d < 8; d++) {
            const selected = authoredEnemyFrame(
              authoredEnemyArt(enemy, 6)!,
              d,
              'strike',
              contact / melee.duration,
              0,
              true,
              melee,
            );
            expect(selected.frame.kind).toBe('combat');
            expect(selected.frame.pose).toBe(2);
          }
      }
  });
});
