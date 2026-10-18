import { describe, it, expect } from 'vitest';
import { BOSS_KITS } from '../src/domain/boss-melee';
import {
  bossSpecialArt,
  bossSpecialFrame,
  bossHealthClearance,
  TOMB_BAMBOO_COMPLETE_ART,
  TOMB_BAMBOO_SPECIAL_ART,
} from '../src/game/boss-special';
import { authoredEnemyArt } from '../src/game/authored-enemy';
import { regionArtManifest } from '../src/platform/region-art';
import type { Enemy } from '../src/domain/model';
describe('complete Tomb and Bamboo action choreography', () => {
  it('covers all 39 kit actions and all 29 additional contact cycles without replacing major art', () => {
    expect(TOMB_BAMBOO_COMPLETE_ART.characters.reduce((n, a) => n + a.moves.length, 0)).toBe(23);
    expect(TOMB_BAMBOO_COMPLETE_ART.characters.reduce((n, a) => n + a.frames.length, 0)).toBe(870);
    for (const a of TOMB_BAMBOO_COMPLETE_ART.characters) {
      const region = Number(a.bossId.split('-')[0]),
        e = { id: 123, bossId: a.bossId, guardTime: 0 } as Enemy,
        merged = bossSpecialArt(e, region)!;
      expect([...merged.moves].sort()).toEqual(Object.keys(BOSS_KITS[a.bossId].moves).sort());
      const prior = TOMB_BAMBOO_SPECIAL_ART.characters.find((p) => p.id === a.id)!;
      expect(a.moves.some((m) => prior.moves.includes(m))).toBe(false);
      for (const f of prior.frames) expect(merged.frames.find((g) => g.name === f.name)).toEqual(f);
      for (const move of a.moves) {
        const spec = BOSS_KITS[a.bossId].moves[move as keyof (typeof BOSS_KITS)[string]['moves']]!;
        const contacts = [];
        for (let d = 0; d < 8; d++) {
          const names = [];
          for (const [n, t] of spec.contacts.entries()) {
            const f = bossSpecialFrame(e, region, d, move, 'strike', t / spec.duration, spec)!;
            expect(f.frame).toMatchObject({ move, pose: 2, cycle: n });
            expect(f.motion.cycle).toBe(n);
            names.push(f.frame.name);
            contacts.push(f.frame);
          }
          expect(new Set(names).size).toBe(spec.contacts.length);
          for (const action of ['windup', 'strike', 'recover'] as const)
            for (const p of [0, 0.2, 0.4, 0.6, 0.8, 1])
              expect(bossSpecialFrame(e, region, d, move, action, p, spec)).toBeDefined();
        }
        expect(contacts.length).toBe(8 * spec.contacts.length);
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
          bossHealthClearance(e, region, 0) - (f.footY - f.bounds.top) * 0.225,
        ).toBeGreaterThanOrEqual(15.999);
        if (f.pose === 0 || f.pose === 5) {
          const r = authoredEnemyArt(e, region)!.frames.find(
            (r) => r.view === f.view && r.kind === 'locomotion' && r.pose === 0,
          )!;
          expect([f.texture, f.x, f.y, f.footX, f.footY]).toEqual([
            r.texture,
            r.x,
            r.y,
            r.footX,
            r.footY,
          ]);
        }
      }
    }
  });
  it('loads four new sheets only for the matching region', () => {
    expect(Object.keys(TOMB_BAMBOO_COMPLETE_ART.textures)).toHaveLength(8);
    for (let r = 0; r < 10; r++)
      expect(
        Object.keys(regionArtManifest(r)).filter((k) => k.startsWith('tb-complete-')),
      ).toHaveLength([5, 6].includes(r) ? 4 : 0);
  });
  it('finishes the wall command and keeps only actual shield guard held', () => {
    const e = { id: 22, bossId: '6-2', guardTime: 0 } as Enemy,
      spec = BOSS_KITS['6-2'].moves.hazard!;
    expect(bossSpecialFrame(e, 6, 0, 'hazard', 'recover', 0.9, spec)?.frame.pose).toBe(5);
    expect(bossSpecialFrame(e, 6, 0, 'hazard', 'idle', 0, spec)).toBeUndefined();
    expect(
      bossSpecialFrame({ ...e, guardTime: 1 }, 6, 0, 'hazard', 'idle', 0, spec)?.motion.phase,
    ).toBe('hold');
  });
});
