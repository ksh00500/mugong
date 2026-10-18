import { describe, expect, it } from 'vitest';
import { authoredEnemyArt, authoredEnemyFrame, ZHUGE_FAMILY_ART } from '../src/game/authored-enemy';
import { enemyAttack } from '../src/domain/combat';
import type { Enemy } from '../src/domain/model';
import { regionArtManifest } from '../src/platform/region-art';

describe('whole Zhuge authored family', () => {
  it('selects all ordinary roles and all four bosses without affecting other regions', () => {
    const cases = [
      { kind: 'archer', role: 'engineer' },
      { kind: 'spear', role: 'gatekeeper' },
      { kind: 'archer', role: 'crossbow' },
      ...[1, 2, 3, 4].map((n) => ({ kind: 'chief', bossId: `9-${n}` })),
    ] as Enemy[];
    expect(new Set(cases.map((e) => authoredEnemyArt(e, 9)?.id)).size).toBe(7);
    expect(cases.map((e) => authoredEnemyArt(e, 9)?.id)).toEqual([
      'engineer',
      'gatekeeper',
      'crossbow',
      'yanggi',
      'mukyeon',
      'jingwal',
      'zhugehyeon',
    ]);
    expect(authoredEnemyArt({ kind: 'chief', bossId: '9-2', role: 'engineer' }, 9)?.id).toBe(
      'mukyeon',
    );
    for (const e of cases) expect(authoredEnemyArt(e, 6)?.id).not.toBe(authoredEnemyArt(e, 9)?.id);
  });
  it('loads its native family and installed special sheets for the region', () => {
    const manifest = regionArtManifest(9);
    expect(Object.keys(manifest)).toHaveLength(60);
    expect(
      Object.values(manifest).filter((path) => path.startsWith('/art/zhuge-family-v1/')),
    ).toHaveLength(35);
    for (const key of ['region-actors-9', 'region-direction-9', 'region-motion-9', 'region-rear-9'])
      expect(manifest).not.toHaveProperty(key);
  });
  it('keeps one pixel scale and padded source rectangles in all views and states', () => {
    const views = [2, 1, 0, 1, 2, 3, 4, 3],
      flips = [false, false, false, true, true, true, false, false];
    for (const art of ZHUGE_FAMILY_ART.characters) {
      expect(art.frames).toHaveLength(60);
      expect(art.pixelScale).toBe(0.225);
      for (const f of art.frames) {
        // Corrected southeast sources have spacious sheets of their own.
        const sibling = art.frames.find((g) => g.texture === f.texture)!;
        expect([f.width, f.height]).toEqual([sibling.width, sibling.height]);
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
      ['thrust', 'sweep', 'stance', 'combo'],
      ['fan', 'combo', 'stance', 'thrust'],
      ['thrust', 'combo', 'sweep', 'dash', 'stance'],
      ['stance', 'fan', 'hazard', 'combo', 'sweep'],
    ];
    for (let n = 0; n < 4; n++)
      for (const move of moves[n]) {
        const enemy = {
          kind: 'chief',
          bossId: `9-${n + 1}`,
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
              authoredEnemyArt(enemy, 9)!,
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
