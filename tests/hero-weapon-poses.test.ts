import { describe, it, expect } from 'vitest';
import { WEAPON_STYLES } from '../src/domain/items';
import {
  heroWeaponPose,
  heroAttackExposure,
  HERO_ATTACK_EXPOSURES,
} from '../src/game/hero-weapon-poses';
import { STRIKE_TIMING } from '../src/domain/combat';

describe('authored weapon placements', () => {
  it('covers all 7,200 placements with explicit finite source grips and poses', () => {
    let count = 0;
    for (let a = 0; a < 10; a++)
      for (const style of WEAPON_STYLES)
        for (let d = 0; d < 8; d++)
          for (const [kind, frames] of [
            ['direction', 1],
            ['actions', 6],
            ['attack', 8],
          ] as const)
            for (let f = 0; f < frames; f++) {
              const p = heroWeaponPose(a, style, d, kind, f);
              expect(p.hand.every((n) => n > 0 && n < 1)).toBe(true);
              expect(Number.isFinite(p.angle)).toBe(true);
              expect(p.lengthScale).toBe(1);
              expect([-1, 1]).toContain(p.layer);
              count++;
            }
    expect(count).toBe(7200);
    expect(() => heroWeaponPose(10, 'sword', 0, 'attack', 0)).toThrow('Missing authored');
    expect(() => heroWeaponPose(0, 'sword', 8, 'attack', 0)).toThrow('Missing authored');
  });
  it('holds the contact drawing across actual damage time and then settles', () => {
    expect(heroAttackExposure(0.0849)).toBe(2);
    expect(heroAttackExposure(STRIKE_TIMING.contact)).toBe(3);
    expect(heroAttackExposure(0.14)).toBe(4);
    expect(heroAttackExposure(0.26)).toBe(7);
    expect(HERO_ATTACK_EXPOSURES.at(-1)).toBeLessThan(STRIKE_TIMING.duration);
    for (let a = 0; a < 10; a++)
      for (const s of WEAPON_STYLES)
        for (let d = 0; d < 8; d++) {
          const hit = heroWeaponPose(a, s, d, 'attack', 3),
            hold = heroWeaponPose(a, s, d, 'attack', 4);
          const error = hit.angle - (d * Math.PI) / 4;
          expect(Math.atan2(Math.sin(error), Math.cos(error))).toBeCloseTo(0);
          expect(hit.row).toBe(1);
          expect(hold.angle).toBe(hit.angle);
          expect(hold.hand).toEqual(hit.hand);
          expect(heroWeaponPose(a, s, d, 'attack', 7).hand).toEqual(
            heroWeaponPose(a, s, d, 'direction').hand,
          );
        }
  });
  it('cuts from above to below on both side views, rather than making an uppercut', () => {
    for (let a = 0; a < 10; a++)
      for (const s of ['sword', 'dao'] as const)
        for (const d of [0, 4]) {
          const ready = heroWeaponPose(a, s, d, 'attack', 0),
            follow = heroWeaponPose(a, s, d, 'attack', 5);
          expect(Math.sin(ready.angle)).toBeLessThan(0);
          expect(Math.sin(follow.angle)).toBeGreaterThan(0);
          expect(ready.row).toBe(0);
          expect(follow.row).toBe(2);
        }
  });
  it('uses weapon-specific follow-through instead of six identical sword swings', () => {
    const at = (style: (typeof WEAPON_STYLES)[number], frame: number) =>
      heroWeaponPose(0, style, 0, 'attack', frame);
    expect(at('sword', 5).row).toBe(2);
    expect(at('staff', 5).row).toBe(1);
    expect(at('gauntlet', 5).row).toBe(1);
    expect(at('dart', 4).opacity).toBe(0);
    expect(at('dart', 6).opacity).toBe(1);
    expect(at('fan', 1).spread).toBeLessThan(at('fan', 3).spread);
    expect(heroAttackExposure(0.28 - (0.28 - 0.055))).toBe(2);
    expect(at('staff', 1).angle).not.toBe(at('sword', 1).angle);
  });
});
