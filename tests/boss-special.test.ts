import { describe, it, expect } from 'vitest';
import { runtimeAssetPresent as existsSync } from './support/runtime-asset';
import { BOSS_KITS } from '../src/domain/boss-melee';
import { bossMotionClock } from '../src/game/boss-motion';
import {
  bossSpecialFrame,
  bossHealthClearance,
  SHAOLIN_SPECIAL_ART,
  TIANJIAN_SPECIAL_ART,
  DOKMU_SPECIAL_ART,
  QINGHA_SPECIAL_ART,
  SNOW_SPECIAL_ART,
} from '../src/game/boss-special';
import { authoredEnemyArt } from '../src/game/authored-enemy';
import type { Enemy, EncounterObject } from '../src/domain/model';
import { regionArtManifest } from '../src/platform/region-art';

describe('boss special motion', () => {
  it('uses each actual contact across all 40 boss kits, including combo re-load', () => {
    expect(Object.keys(BOSS_KITS)).toHaveLength(40);
    for (const kit of Object.values(BOSS_KITS))
      for (const [move, timing] of Object.entries(kit.moves)) {
        const before = JSON.stringify(timing);
        timing!.contacts.forEach((t, contact) => {
          expect(bossMotionClock(move, 'strike', t / timing!.duration, timing!)).toMatchObject({
            pose: 2,
            contact,
            phase: 'contact',
          });
        });
        expect(JSON.stringify(timing)).toBe(before);
        if (timing!.contacts.length > 1) {
          const t = (timing!.contacts[0] + timing!.contacts[1]) / 2;
          expect(bossMotionClock(move, 'strike', t / timing!.duration, timing!)!.pose).toBe(1);
        }
      }
  });
  it('packs 240 padded native poses and selects all eight directions without warping', () => {
    for (const art of [
      ...SHAOLIN_SPECIAL_ART.characters,
      ...TIANJIAN_SPECIAL_ART.characters,
      ...DOKMU_SPECIAL_ART.characters,
      ...QINGHA_SPECIAL_ART.characters,
      ...SNOW_SPECIAL_ART.characters,
    ]) {
      const region = Number(art.bossId.split('-')[0]);
      expect(art.frames).toHaveLength(60);
      expect(art.pixelScale).toBe(0.225);
      const enemy = { id: 123, bossId: art.bossId, kind: 'chief', pattern: 0 } as Enemy;
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
          bossHealthClearance(enemy, region, authoredEnemyArt(enemy, region)!.healthClearance) -
            (f.footY - f.bounds.top) * art.pixelScale,
        ).toBeGreaterThanOrEqual(15.9999);
      }
      for (const move of art.moves)
        for (let d = 0; d < 8; d++) {
          const spec =
            BOSS_KITS[art.bossId].moves[move as keyof (typeof BOSS_KITS)[string]['moves']]!;
          for (const t of spec.contacts) {
            const selected = bossSpecialFrame(
              enemy,
              region,
              d,
              move,
              'strike',
              t / spec.duration,
              spec,
            )!;
            expect(selected.frame.pose).toBe(2);
            expect(selected.frame.move).toBe(move);
            expect(selected.view).toBe([2, 1, 0, 1, 2, 3, 4, 3][d]);
            expect(selected.flip).toBe([false, false, false, true, true, true, false, false][d]);
          }
        }
      expect(
        bossSpecialFrame(enemy, 5, 0, art.moves[0], 'strike', 0.5, {
          duration: 1,
          contacts: [0.5],
        }),
      ).toBeUndefined();
      expect(
        bossSpecialFrame(enemy, region, 0, art.moves[0], 'death', 0.5, {
          duration: 1,
          contacts: [0.5],
        }),
      ).toBeUndefined();
    }
    const special = Object.entries(regionArtManifest(4)).filter(([key]) =>
      key.startsWith('shaolin-special-'),
    );
    expect(special).toHaveLength(20);
    for (const [, path] of special) expect(existsSync('public' + path)).toBe(true);
    const tianjian = Object.entries(regionArtManifest(2)).filter(([key]) =>
      key.startsWith('tianjian-special-'),
    );
    expect(tianjian).toHaveLength(20);
    for (const [, path] of tianjian) expect(existsSync('public' + path)).toBe(true);
    const dokmu = Object.entries(regionArtManifest(1)).filter(([key]) =>
      key.startsWith('dokmu-special-'),
    );
    expect(dokmu).toHaveLength(20);
    for (const [, path] of dokmu) expect(existsSync('public' + path)).toBe(true);
    const qingha = Object.entries(regionArtManifest(0)).filter(([key]) =>
      key.startsWith('qingha-special-'),
    );
    expect(qingha).toHaveLength(20);
    for (const [, path] of qingha) expect(existsSync('public' + path)).toBe(true);
    const snow = Object.entries(regionArtManifest(3)).filter(([k]) =>
      k.startsWith('snow-special-'),
    );
    expect(snow).toHaveLength(5);
    for (const [, path] of snow) expect(existsSync('public' + path)).toBe(true);
  });
  it('shows follow-through even when the last contact reaches the strike end', () => {
    for (const kit of Object.values(BOSS_KITS))
      for (const [move, timing] of Object.entries(kit.moves)) {
        expect(bossMotionClock(move, 'recover', 0.05, timing!)?.phase).toBe('follow');
        expect(bossMotionClock(move, 'recover', 0.3, timing!)?.phase).toBe('return');
        expect(bossMotionClock(move, 'recover', 0.8, timing!)?.phase).toBe('ready');
      }
  });
  it('holds successful grabs and guards only while simulation states are active', () => {
    const timing = { duration: 0.25, contacts: [0.08] };
    const e = { id: 7, bossId: '4-2' } as Enemy;
    const object = { owner: 7, mechanic: 'grab', stage: 1, life: 0.3 } as EncounterObject;
    expect(
      bossSpecialFrame(e, 4, 6, 'grab', 'recover', 0.6, timing, [object])?.motion,
    ).toMatchObject({ phase: 'hold', pose: 3 });
    expect(
      bossSpecialFrame(e, 4, 6, 'grab', 'recover', 0.6, timing, [{ ...object, life: 0 }])?.motion
        .phase,
    ).toBe('ready');
    expect(
      bossSpecialFrame({ ...e, guardTime: 1 }, 4, 2, 'stance', 'idle', 0, timing)?.motion,
    ).toMatchObject({ phase: 'hold', pose: 2 });
    expect(
      bossSpecialFrame({ ...e, guardTime: 1 }, 4, 2, 'grab', 'windup', 0.8, timing)?.motion.move,
    ).toBe('grab');
    expect(bossSpecialFrame(e, 4, 2, 'stance', 'idle', 0, timing)).toBeUndefined();
  });
  it('selects the completed Snow signature activations and returns to ready', () => {
    for (const bossId of ['3-2', '3-3', '3-4']) {
      const timing = BOSS_KITS[bossId].moves.stance!;
      const e = { id: 7, bossId, guardTime: 0 } as Enemy;
      expect(bossSpecialFrame(e, 3, 2, 'stance', 'strike', 0.2, timing)?.frame.move).toBe('stance');
      expect(bossSpecialFrame(e, 3, 2, 'stance', 'recover', 0.8, timing)?.motion.phase).toBe(
        'ready',
      );
      expect(bossSpecialFrame(e, 3, 2, 'stance', 'idle', 0, timing)).toBeUndefined();
    }
  });
  it('returns poison rituals to ready without inventing a guard hold', () => {
    for (const bossId of ['1-1', '1-3', '1-4']) {
      const timing = BOSS_KITS[bossId].moves.stance!;
      const e = { id: 7, bossId, guardTime: 0 } as Enemy;
      expect(bossSpecialFrame(e, 1, 2, 'stance', 'recover', 0.8, timing)?.motion.phase).toBe(
        'ready',
      );
      expect(bossSpecialFrame(e, 1, 2, 'stance', 'idle', 0, timing)).toBeUndefined();
    }
  });
  it('returns Qingha command and escort flag to ready without a guard hold', () => {
    for (const [bossId, move] of [
      ['0-1', 'summon'],
      ['0-2', 'stance'],
    ] as const) {
      const timing = BOSS_KITS[bossId].moves[move]!;
      const enemy = { id: 7, bossId, guardTime: 0 } as Enemy;
      expect(bossSpecialFrame(enemy, 0, 2, move, 'recover', 0.8, timing)?.motion.phase).toBe(
        'ready',
      );
      expect(bossSpecialFrame(enemy, 0, 2, move, 'idle', 0, timing)).toBeUndefined();
    }
  });
});
