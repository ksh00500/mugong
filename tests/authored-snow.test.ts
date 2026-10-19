import { describe, expect, it } from 'vitest';
import { authoredEnemyArt, authoredEnemyFrame, SNOW_FAMILY_ART } from '../src/game/authored-enemy';
import { enemyAttack } from '../src/domain/combat';
import type { Enemy } from '../src/domain/model';
import { regionArtManifest } from '../src/platform/region-art';

describe('whole Snow authored family', () => {
  it('keeps the snow commander separate from the Shaolin abbot frame map', () => {
    const abbot = authoredEnemyArt({ kind: 'chief', bossId: '4-4' }, 4)!;
    const commander = authoredEnemyArt({ kind: 'chief', bossId: '3-1' }, 3)!;
    expect(abbot.id).toBe('mujin');
    expect(commander.id).toBe('mokjin');
    for (let d = 0; d < 8; d++) {
      expect(authoredEnemyFrame(abbot, d, 'strike', 0.35, 0).frame.texture).toContain(
        'shaolin-family-mujin-',
      );
      expect(authoredEnemyFrame(commander, d, 'strike', 0.35, 0).frame.texture).toContain(
        'snow-family-mujin-',
      );
    }
  });
  it('selects all ordinary roles and all four bosses without affecting other regions', () => {
    const cases = [
      { kind: 'spear', role: 'icehunter' },
      { kind: 'archer', role: 'iceweaver' },
      { kind: 'archer', role: 'bowman' },
      ...[1, 2, 3, 4].map((n) => ({ kind: 'chief', bossId: `3-${n}` })),
    ] as Enemy[];
    expect(new Set(cases.map((e) => authoredEnemyArt(e, 3)?.id)).size).toBe(7);
    expect(cases.map((e) => authoredEnemyArt(e, 3)?.id)).toEqual([
      'snowhunter',
      'snowweaver',
      'snowbowman',
      'mokjin',
      'xuelan',
      'baixue',
      'hanxue',
    ]);
    expect(authoredEnemyArt({ kind: 'chief', bossId: '3-2', role: 'icehunter' }, 3)?.id).toBe(
      'xuelan',
    );
    for (const e of cases) expect(authoredEnemyArt(e, 6)?.id).not.toBe(authoredEnemyArt(e, 3)?.id);
  });
  it('loads 35 basic sheets, 5 Mokjin sheets, 18 completion sheets and floor', () => {
    const manifest = regionArtManifest(3);
    expect(Object.keys(manifest)).toHaveLength(59);
    expect(
      Object.values(manifest).filter((path) => path.startsWith('/art/snow-family-v1/')),
    ).toHaveLength(30);
    expect(Object.values(manifest).filter(path => path.startsWith('/art/native-size-v1/'))).toHaveLength(5);
    for (const key of ['region-actors-3', 'region-direction-3', 'region-motion-3', 'region-rear-3'])
      expect(manifest).not.toHaveProperty(key);
  });
  it('keeps one pixel scale and padded source rectangles in all views and states', () => {
    const views = [2, 1, 0, 1, 2, 3, 4, 3],
      flips = [false, false, false, true, true, true, false, false];
    for (const art of SNOW_FAMILY_ART.characters) {
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
      ['thrust', 'dash', 'sweep', 'slam', 'combo'],
      ['fan', 'hazard', 'stance', 'thrust'],
      ['stance', 'dash', 'combo', 'slam'],
      ['fan', 'stance', 'hazard', 'sweep', 'combo'],
    ];
    for (let n = 0; n < 4; n++)
      for (const move of moves[n]) {
        const enemy = {
          kind: 'chief',
          bossId: `3-${n + 1}`,
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
              authoredEnemyArt(enemy, 3)!,
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
