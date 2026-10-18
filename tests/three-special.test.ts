import { describe, it, expect } from 'vitest';
import { THREE_SPECIAL_ART, bossSpecialFrame, bossHealthClearance } from '../src/game/boss-special';
import { authoredEnemyArt } from '../src/game/authored-enemy';
import { enemyAttack } from '../src/domain/combat';
import { regionArtManifest } from '../src/platform/region-art';
import { runtimeAssetPresent } from './support/runtime-asset';
import type { Enemy } from '../src/domain/model';

describe('Desert, Hyeolma and Zhuge special installation', () => {
  it('loads 12 bosses / 24 actions / 750 logical frames only in their own region', () => {
    expect(THREE_SPECIAL_ART.characters).toHaveLength(12);
    expect(THREE_SPECIAL_ART.characters.flatMap((a) => a.moves)).toHaveLength(24);
    expect(THREE_SPECIAL_ART.characters.reduce((n, a) => n + a.frames.length, 0)).toBe(750);
    for (const art of THREE_SPECIAL_ART.characters) {
      const region = Number(art.bossId.split('-')[0]),
        manifest = regionArtManifest(region);
      const e = { id: 71, kind: 'chief', bossId: art.bossId, pattern: 0, guardTime: 0 } as Enemy;
      const basic = authoredEnemyArt(e, region)!;
      expect(art.pixelScale).toBe(basic.pixelScale);
      for (const f of art.frames) {
        expect(runtimeAssetPresent('public' + manifest[f.texture])).toBe(true);
        expect(
          Math.min(
            f.bounds.left,
            f.bounds.top,
            f.width - f.bounds.right,
            f.height - f.bounds.bottom,
          ),
        ).toBeGreaterThanOrEqual(32);
        expect(
          bossHealthClearance(e, region, basic.healthClearance) -
            (f.footY - f.bounds.top) * art.pixelScale,
        ).toBeGreaterThanOrEqual(15.99999);
        expect(f.footX).toBeGreaterThanOrEqual(f.bounds.left);
        expect(f.footX).toBeLessThanOrEqual(f.bounds.right);
        expect(f.footY).toBeLessThanOrEqual(f.bounds.bottom);
      }
      for (const move of art.moves) {
        const profile = enemyAttack({ ...e, move } as Enemy),
          timing = profile.melee ?? { duration: 0.18, contacts: [0] };
        for (let d = 0; d < 8; d++)
          for (const [hit, t] of timing.contacts.entries()) {
            const selection = bossSpecialFrame(
              e,
              region,
              d,
              move,
              'strike',
              t / timing.duration,
              timing,
            )!;
            expect(selection.frame).toMatchObject({ move, pose: 2 });
            expect(selection.motion.contact).toBe(hit);
            expect(selection.view).toBe([2, 1, 0, 1, 2, 3, 4, 3][d]);
            expect(selection.flip).toBe([false, false, false, true, true, true, false, false][d]);
          }
        expect(
          bossSpecialFrame(e, region === 9 ? 8 : 9, 0, move, 'strike', 0, timing),
        ).toBeUndefined();
        expect(bossSpecialFrame(e, region, 0, move, 'hurt', 0, timing)).toBeUndefined();
        expect(bossSpecialFrame(e, region, 0, move, 'death', 0, timing)).toBeUndefined();
      }
    }
  });
  it('keeps Naya second contact through its follow-through and recovery', () => {
    const e = {
      id: 7,
      bossId: '7-2',
      kind: 'chief',
      pattern: 0,
      move: 'combo',
      guardTime: 0,
    } as Enemy;
    const timing = enemyAttack(e).melee!;
    expect(timing.contacts).toHaveLength(2);
    for (let d = 0; d < 8; d++) {
      const first = bossSpecialFrame(
        e,
        7,
        d,
        'combo',
        'strike',
        timing.contacts[0] / timing.duration,
        timing,
      )!;
      const second = bossSpecialFrame(
        e,
        7,
        d,
        'combo',
        'strike',
        timing.contacts[1] / timing.duration,
        timing,
      )!;
      expect(second.frame.texture).not.toBe(first.frame.texture);
      expect(second.frame.texture).toBe('three-special-desert-naya-left');
      expect(second.motion.cycle).toBe(1);
      const reload = bossSpecialFrame(
        e,
        7,
        d,
        'combo',
        'strike',
        (timing.contacts[1] - 0.12) / timing.duration,
        timing,
      )!;
      expect(reload.frame.name).toContain('cycle-1-1');
      expect('provenance' in reload.frame && reload.frame.provenance).toBe(
        'guard-reload-before-left-contact',
      );
      expect(bossSpecialFrame(e, 7, d, 'combo', 'recover', 0.05, timing)?.frame.texture).toBe(
        second.frame.texture,
      );
    }
  });
  it('uses the exact basic READY pixels and ground root at the special loop ends', () => {
    for (const art of THREE_SPECIAL_ART.characters) {
      const basic = authoredEnemyArt(
        { bossId: art.bossId, kind: 'chief' },
        Number(art.bossId.split('-')[0]),
      )!;
      for (const f of art.frames.filter((f) => f.pose === 0 || f.pose === 5)) {
        const b = basic.frames.find(
          (g) => g.view === f.view && g.kind === 'locomotion' && g.pose === 0,
        )!;
        expect(f.bounds.right - f.bounds.left).toBe(b.bounds.right - b.bounds.left);
        expect(f.bounds.bottom - f.bounds.top).toBe(b.bounds.bottom - b.bounds.top);
        expect(f.footX - f.bounds.left).toBe(b.footX - b.bounds.left);
        expect(f.footY - f.bounds.top).toBe(b.footY - b.bounds.top);
      }
    }
  });
});
