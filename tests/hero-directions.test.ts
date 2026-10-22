import { describe, expect, it } from 'vitest';
import { HERO_ROSTER_DIRECTIONS, heroDirection } from '../src/game/hero-directions';

describe('reviewed roster direction plates', () => {
  it('covers ten identities and eight sectors, with front/rear and mirrored diagonals', () => {
    expect(HERO_ROSTER_DIRECTIONS).toHaveLength(10);
    for (let appearance = 0; appearance < 10; appearance++) {
      expect(HERO_ROSTER_DIRECTIONS[appearance]).toHaveLength(8);
      expect(heroDirection(appearance, 2)).toEqual({ view: 2, flip: false });
      expect(heroDirection(appearance, 6)).toEqual({ view: 6, flip: false });
      for (const [right, left] of [
        [0, 4],
        [1, 3],
        [7, 5],
      ]) {
        expect(heroDirection(appearance, right).view).toBe(heroDirection(appearance, left).view);
        expect(heroDirection(appearance, right).flip).not.toBe(
          heroDirection(appearance, left).flip,
        );
      }
    }
  });
  it('respects the opposite source orientation of the second sheet', () => {
    for (let appearance = 0; appearance < 5; appearance++)
      expect(heroDirection(appearance, 7)).toEqual({ view: 5, flip: false });
    for (let appearance = 5; appearance < 10; appearance++)
      expect(heroDirection(appearance, 7)).toEqual({ view: 4, flip: true });
    expect(heroDirection(5, 0)).toEqual({ view: 7, flip: false });
    expect(() => heroDirection(10, 1)).toThrow('Unreviewed');
  });
});
