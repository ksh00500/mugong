import { describe, it, expect } from 'vitest';
import { BOSS_KITS } from '../src/domain/boss-melee';
import { bossSpecialArt, bossSpecialFrame, bossHealthClearance } from '../src/game/boss-special';
import { SNOW_COMPLETE_ART, SNOW_SPECIAL_ART } from '../src/game/boss-special-data';
import { authoredEnemyArt } from '../src/game/authored-enemy';
import { regionArtManifest } from '../src/platform/region-art';
import { runtimeAssetPresent } from './support/runtime-asset';
import type { Enemy } from '../src/domain/model';

describe('complete Snow boss choreography', () => {
  it('covers the complete eighteen-action kit with distinct cycles at actual contacts', () => {
    let actions = 0,
      frames = 0;
    for (let n = 1; n <= 4; n++) {
      const e = { id: 99, bossId: `3-${n}`, kind: 'chief', guardTime: 0 } as Enemy;
      const a = bossSpecialArt(e, 3)!;
      expect(new Set(a.moves)).toEqual(new Set(Object.keys(BOSS_KITS[e.bossId!].moves)));
      expect(a.pixelScale).toBe(0.225);
      actions += a.moves.length;
      frames += a.frames.length;
      for (const move of a.moves) {
        const timing =
          BOSS_KITS[e.bossId!].moves[move as keyof (typeof BOSS_KITS)[string]['moves']]!;
        for (let d = 0; d < 8; d++)
          for (const [cycle, t] of timing.contacts.entries()) {
            const selected = bossSpecialFrame(
              e,
              3,
              d,
              move,
              'strike',
              t / timing.duration,
              timing,
            )!;
            expect(selected.frame).toMatchObject({ move, pose: 2 });
            expect(selected.motion).toMatchObject({ phase: 'contact', cycle, contact: cycle });
            expect(selected.view).toBe([2, 1, 0, 1, 2, 3, 4, 3][d]);
            expect(selected.flip).toBe([false, false, false, true, true, true, false, false][d]);
            const f = selected.frame;
            expect(
              bossHealthClearance(e, 3, authoredEnemyArt(e, 3)!.healthClearance) -
                (f.footY - f.bounds.top) * 0.225,
            ).toBeGreaterThanOrEqual(15.999);
          }
        for (const action of ['windup', 'strike', 'recover'] as const)
          for (let p = 0; p <= 1; p += 0.1)
            expect(bossSpecialFrame(e, 3, 0, move, action, p, timing)).toBeDefined();
      }
      for (const f of a.frames) {
        expect(
          Math.min(
            f.bounds.left,
            f.bounds.top,
            f.width - f.bounds.right,
            f.height - f.bounds.bottom,
          ),
        ).toBeGreaterThanOrEqual(32);
        expect(
          regionArtManifest(3)[f.texture as keyof ReturnType<typeof regionArtManifest>],
        ).toBeTruthy();
      }
    }
    expect(actions).toBe(18);
    expect(frames).toBe(630);
    expect(SNOW_COMPLETE_ART.characters.reduce((n, c) => n + c.frames.length, 0)).toBe(570);
  });
  it('preserves existing Mokjin dash/slam pixels and separates right/left palm contact sources', () => {
    for (const f of SNOW_SPECIAL_ART.characters[0].frames) {
      const a = bossSpecialArt({ bossId: '3-1' }, 3)!;
      expect(a.frames.find((g) => g.name === f.name)).toEqual(f);
    }
    const a = SNOW_COMPLETE_ART.characters.find((a) => a.id === 'baixue')!;
    for (let view = 0; view < 5; view++) {
      const first = a.frames.find((f) => f.name === `${view}-combo-cycle-0-2`)!;
      const second = a.frames.find((f) => f.name === `${view}-combo-cycle-1-2`)!;
      expect(first.texture).not.toBe(second.texture);
      expect(second.choreographySource).toBe('k:baixue-left');
    }
  });
  it('loads all eighteen new padded atlases only in Snow', () => {
    expect(Object.keys(SNOW_COMPLETE_ART.textures)).toHaveLength(18);
    for (const [key, url] of Object.entries(SNOW_COMPLETE_ART.textures)) {
      expect(regionArtManifest(3)).toHaveProperty(key, url);
      expect(runtimeAssetPresent('public' + url)).toBe(true);
      expect(regionArtManifest(4)).not.toHaveProperty(key);
    }
  });
});
