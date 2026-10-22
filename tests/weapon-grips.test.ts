import { describe, expect, it } from 'vitest';
import { HERO_GRIPS, heroGrip } from '../src/game/hero-grips';
import { SINGLE_WEAPON_FRAMES, WEAPON_GRIPS, weaponAngle } from '../src/game/weapon-grips';
import { ITEM_CATALOGUE, WEAPON_STYLES } from '../src/domain/items';
import { bossReward } from '../src/domain/boss-loot';
import type { MotionAction } from '../src/game/directional-motion';

describe('authored weapon attachment coverage', () => {
  it('reviews all 140 source poses and rejects an unknown character', () => {
    expect(HERO_GRIPS).toHaveLength(10);
    for (const [appearance, row] of HERO_GRIPS.entries()) {
      expect(row.directions).toHaveLength(8);
      expect(row.actions).toHaveLength(6);
      for (const point of [...row.directions, ...row.actions])
        for (const coordinate of point) {
          expect(coordinate).toBeGreaterThan(0);
          expect(coordinate).toBeLessThan(1);
        }
      expect(heroGrip(appearance, 4, 2)).toEqual(row.actions[2]);
      expect(heroGrip(appearance, 4, undefined)).toEqual(row.directions[4]);
    }
    expect(() => heroGrip(10, 0, undefined)).toThrow('Unreviewed');
  });
  it('covers every equippable item, including the needle box and named gauntlets', () => {
    const ids = [
      ...ITEM_CATALOGUE.filter((i) => i.kind === 'sword').map((i) => i.id),
      ...Array.from({ length: 40 }, (_, i) =>
        bossReward(`${Math.floor(i / 4)}-${(i % 4) + 1}`, 'test')!,
      )
        .filter((i) => i.kind === 'sword')
        .map((i) => i.templateId!),
    ];
    expect(ids).toHaveLength(28);
    expect(new Set([...Object.keys(WEAPON_GRIPS), ...Object.keys(SINGLE_WEAPON_FRAMES)])).toEqual(
      new Set(ids),
    );
    for (const id of ids) {
      const point = SINGLE_WEAPON_FRAMES[id]?.grip ?? WEAPON_GRIPS[id];
      for (const value of point) expect(value).toBeGreaterThan(0);
    }
    expect(SINGLE_WEAPON_FRAMES['boss-1-2'].texture).toBe('held-darts-isolated');
    expect(SINGLE_WEAPON_FRAMES['boss-4-4'].texture).toBe('held-gauntlets-isolated');
  });
  it('keeps rotation continuous across preparation, contact and recovery for every direction/style', () => {
    const difference = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
    for (const style of WEAPON_STYLES)
      for (let dir = 0; dir < 8; dir++) {
        const facing = (dir * Math.PI) / 4;
        expect(
          difference(
            weaponAngle(style, facing, 'windup', 1),
            weaponAngle(style, facing, 'strike', 0),
          ),
        ).toBeCloseTo(0, 8);
        expect(
          difference(
            weaponAngle(style, facing, 'strike', 1),
            weaponAngle(style, facing, 'recover', 0),
          ),
        ).toBeCloseTo(0, 8);
        expect(
          difference(
            weaponAngle(style, facing, 'recover', 1),
            weaponAngle(style, facing, 'idle', 0),
          ),
        ).toBeCloseTo(0, 8);
        // Blades enter a loaded key pose with the authored shoulder drawing.
        // Interpolating from the low idle blade created the unwanted upward lift.
        if (style !== 'sword' && style !== 'dao')
          expect(
            difference(
              weaponAngle(style, facing, 'idle', 0),
              weaponAngle(style, facing, 'windup', 0),
            ),
          ).toBeCloseTo(0, 8);
        for (const action of [
          'idle',
          'walk',
          'windup',
          'strike',
          'recover',
          'ultimate',
          'defense',
          'hurt',
          'death',
        ] as MotionAction[])
          for (let frame = 0; frame <= 60; frame++)
            expect(Number.isFinite(weaponAngle(style, facing, action, frame / 60))).toBe(true);
      }
  });
});
