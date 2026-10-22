import { describe, it, expect } from 'vitest';
import { BOSS_KITS } from '../src/domain/boss-melee';
import { bossSpecialArt, bossSpecialFrame, bossHealthClearance } from '../src/game/boss-special';
import { TOMB_BAMBOO_SPECIAL_ART } from '../src/game/boss-special-data';
import { authoredEnemyArt } from '../src/game/authored-enemy';
import { regionArtManifest } from '../src/platform/region-art';
import { runtimeAssetPresent } from './support/runtime-asset';
import type { Enemy } from '../src/domain/model';

describe('Tomb and Bamboo special action art', () => {
  it('selects sixteen actions and their real contact in all eight directions', () => {
    expect(TOMB_BAMBOO_SPECIAL_ART.characters).toHaveLength(8);
    expect(TOMB_BAMBOO_SPECIAL_ART.characters.reduce((n, a) => n + a.frames.length, 0)).toBe(480);
    for (const a of TOMB_BAMBOO_SPECIAL_ART.characters) {
      const region = Number(a.bossId.split('-')[0]),
        e = { id: 100, bossId: a.bossId, kind: 'chief', guardTime: 0 } as Enemy;
      expect(a.moves).toHaveLength(2);
      expect(a.frames).toHaveLength(60);
      expect(a.pixelScale).toBe(0.225);
      expect(bossSpecialArt(e, region)?.id).toBe(a.id);
      for (const move of a.moves) {
        const spec = BOSS_KITS[a.bossId].moves[move as keyof (typeof BOSS_KITS)[string]['moves']]!;
        expect(spec.contacts).toHaveLength(1);
        for (let d = 0; d < 8; d++) {
          const s = bossSpecialFrame(
            e,
            region,
            d,
            move,
            'strike',
            spec.contacts[0] / spec.duration,
            spec,
          )!;
          expect(s.frame).toMatchObject({ move, pose: 2 });
          expect(s.motion).toMatchObject({ cycle: 0, contact: 0 });
          expect(s.view).toBe([2, 1, 0, 1, 2, 3, 4, 3][d]);
          expect(s.flip).toBe([false, false, false, true, true, true, false, false][d]);
          for (const action of ['windup', 'strike', 'recover'] as const)
            for (const p of [0, 0.2, 0.5, 0.8, 1])
              expect(bossSpecialFrame(e, region, d, move, action, p, spec)).toBeDefined();
        }
        expect(bossSpecialFrame(e, region, 0, move, 'hurt', 0.5, spec)).toBeUndefined();
        expect(bossSpecialFrame(e, region, 0, move, 'death', 0.5, spec)).toBeUndefined();
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
          bossHealthClearance(e, region, authoredEnemyArt(e, region)!.healthClearance) -
            (f.footY - f.bounds.top) * 0.225,
        ).toBeGreaterThanOrEqual(15.999);
        const url = regionArtManifest(region)[f.texture];
        expect(url).toBeTruthy();
        expect(runtimeAssetPresent('public' + url)).toBe(true);
        if (f.pose === 0 || f.pose === 5) {
          const ready = authoredEnemyArt(e, region)!.frames.find(
            (g) => g.view === f.view && g.kind === 'locomotion' && g.pose === 0,
          )!;
          expect([f.texture, f.x, f.y, f.footX, f.footY]).toEqual([
            ready.texture,
            ready.x,
            ready.y,
            ready.footX,
            ready.footY,
          ]);
        }
      }
      const unused = Object.keys(BOSS_KITS[a.bossId].moves).filter((m) => !a.moves.includes(m));
      for (const move of unused) {
        const spec = BOSS_KITS[a.bossId].moves[move as keyof (typeof BOSS_KITS)[string]['moves']]!;
        expect(bossSpecialFrame(e, region, 0, move, 'strike', 0.5, spec)).toBeDefined();
      }
    }
  });
  it('holds Seokmun shield only during actual guard and lets other activations recover', () => {
    for (const a of TOMB_BAMBOO_SPECIAL_ART.characters.filter((a) => a.moves.includes('stance'))) {
      const region = Number(a.bossId.split('-')[0]),
        e = { id: 123, bossId: a.bossId, kind: 'chief', guardTime: 0 } as Enemy,
        spec = BOSS_KITS[a.bossId].moves.stance!;
      expect(bossSpecialFrame(e, region, 0, 'stance', 'idle', 0, spec)).toBeUndefined();
      expect(bossSpecialFrame(e, region, 0, 'stance', 'recover', 0.8, spec)?.motion.phase).toBe(
        'ready',
      );
      if (a.bossId === '6-2')
        for (let d = 0; d < 8; d++)
          expect(
            bossSpecialFrame({ ...e, guardTime: 1 }, region, d, 'dash', 'idle', 0, spec)?.motion,
          ).toMatchObject({ move: 'stance', phase: 'hold', pose: 2 });
    }
  });
  it('loads only each region special sheets and preserves all other regions', () => {
    expect(Object.keys(TOMB_BAMBOO_SPECIAL_ART.textures)).toHaveLength(40);
    for (const region of [5, 6])
      expect(
        Object.keys(regionArtManifest(region)).filter((k) => k.startsWith('tomb-bamboo-')),
      ).toHaveLength(20);
    for (const region of [0, 1, 2, 3, 4, 7, 8, 9])
      expect(Object.keys(regionArtManifest(region)).some((k) => k.startsWith('tomb-bamboo-'))).toBe(
        false,
      );
  });
});
