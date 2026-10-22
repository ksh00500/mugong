import { describe, it, expect } from 'vitest';
import { runtimeAssetPresent as existsSync } from './support/runtime-asset';
import { BOSS_KITS } from '../src/domain/boss-melee';
import { bossSpecialArt, bossSpecialFrame, bossHealthClearance } from '../src/game/boss-special';
import { BOSS_REMAINING_ART } from '../src/game/boss-special-data';
import { bossMotionClock } from '../src/game/boss-motion';
import { bossMotionCycle } from '../src/game/boss-motion-cycle';
import { regionArtManifest } from '../src/platform/region-art';
import type { Enemy } from '../src/domain/model';

describe('remaining four-region boss choreography', () => {
  it('covers all 41 remaining actions and all 73 kit actions in these regions', () => {
    expect(BOSS_REMAINING_ART.characters).toHaveLength(16);
    expect(BOSS_REMAINING_ART.characters.reduce((n, c) => n + c.moves.length, 0)).toBe(41);
    let all = 0;
    for (const art of BOSS_REMAINING_ART.characters) {
      const region = Number(art.bossId.split('-')[0]);
      const enemy = { id: 123, bossId: art.bossId, guardTime: 0 } as Enemy;
      expect(new Set(bossSpecialArt(enemy, region)!.moves)).toEqual(
        new Set(Object.keys(BOSS_KITS[art.bossId].moves)),
      );
      all += Object.keys(BOSS_KITS[art.bossId].moves).length;
      for (const move of art.moves) {
        const timing =
          BOSS_KITS[art.bossId].moves[move as keyof (typeof BOSS_KITS)[string]['moves']]!;
        const before = JSON.stringify({ enemy, timing });
        for (let d = 0; d < 8; d++)
          for (const [cycle, t] of timing.contacts.entries()) {
            const selected = bossSpecialFrame(
              enemy,
              region,
              d,
              move,
              'strike',
              t / timing.duration,
              timing,
            )!;
            expect(selected).toBeDefined();
            expect(selected.frame).toMatchObject({ move, pose: 2, cycle });
            expect(selected.motion).toMatchObject({ contact: cycle, cycle });
            expect(selected.view).toBe([2, 1, 0, 1, 2, 3, 4, 3][d]);
            expect(selected.flip).toBe([false, false, false, true, true, true, false, false][d]);
          }
        expect(JSON.stringify({ enemy, timing })).toBe(before);
      }
      for (const f of art.frames) {
        expect(
          Math.min(
            f.bounds.left,
            f.bounds.top,
            f.width - f.bounds.right,
            f.height - f.bounds.bottom,
          ),
        ).toBeGreaterThanOrEqual(32);
        expect(
          bossHealthClearance(enemy, region, 0) - (f.footY - f.bounds.top) * 0.225,
        ).toBeGreaterThanOrEqual(15.999);
        expect(f.choreographySource).not.toMatch(/^b[45]$/);
        expect(f.footX).toBeGreaterThan(0);
        expect(f.footY).toBeLessThan(f.height);
        expect(regionArtManifest(region)).toHaveProperty(f.texture);
      }
    }
    expect(all).toBe(73);
    for (const path of Object.values(BOSS_REMAINING_ART.textures))
      expect(existsSync('public' + path)).toBe(true);
  });
  it('keeps previous-hand follow-through then loads the next hit and recovers the last', () => {
    const timing = { duration: 1.3, contacts: [0.1, 0.6, 1.1] };
    const sample = (p: number) =>
      bossMotionCycle(
        bossMotionClock('combo', 'strike', p / timing.duration, timing)!,
        'strike',
        p / timing.duration,
        timing,
      );
    expect(sample(0.2)).toBe(0);
    expect(sample(0.4)).toBe(1);
    expect(sample(0.7)).toBe(1);
    expect(sample(0.9)).toBe(2);
    expect(
      bossMotionCycle(bossMotionClock('combo', 'recover', 0.1, timing)!, 'recover', 0.1, timing),
    ).toBe(2);
    for (const art of BOSS_REMAINING_ART.characters.filter((c) => c.moves.includes('combo'))) {
      const contacts = art.frames.filter((f) => f.move === 'combo' && f.view === 0 && f.pose === 2);
      expect(new Set(contacts.map((f) => f.texture + '/' + f.sourceFrame)).size).toBe(
        contacts.length,
      );
    }
  });
});
