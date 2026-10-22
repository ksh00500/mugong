import { describe, it, expect } from 'vitest';
import { enemyPixelScale, enemyBarClearance, enemyHealthBarY } from '../src/game/enemy-scale';

const standing = { height: 200, originY: 0.98, referenceHeight: 200, bodyUnit: 55, skullUnit: 60 };
describe('enemy anatomy and health bar', () => {
  it('matches a smaller rear strike and a larger front walking drawing to the same scalp', () => {
    for (const pose of [
      { ...standing, height: 180, referenceHeight: 190, bodyUnit: 40, skullUnit: 50 },
      { ...standing, height: 260, referenceHeight: 220, bodyUnit: 90, skullUnit: 75 },
    ]) {
      const size = enemyPixelScale(pose, standing, 80);
      expect(size.pixelScale * pose.skullUnit).toBe(24);
    }
  });
  it('keeps authored references for hair and hats, without changing target between views', () => {
    const ref = { ...standing, skullUnit: undefined };
    const pose = { ...ref, height: 150, bodyUnit: 44 };
    expect(enemyPixelScale(pose, ref, 80).pixelScale * pose.bodyUnit).toBe(22);
  });
  it('rejects a missing scalp measurement instead of switching to a different scale basis', () => {
    expect(() => enemyPixelScale({ ...standing, skullUnit: undefined }, standing, 80)).toThrow(
      'Missing scalp',
    );
  });
  it('reserves space for a raised weapon and accounts for a rig lifting it farther', () => {
    const raised = { ...standing, height: 300, originY: 1 };
    const clearance = enemyBarClearance([standing, raised], standing, 80);
    expect(clearance).toBe(132);
    expect(enemyHealthBarY(500, clearance, 382)).toBe(368);
    expect(enemyHealthBarY(500, clearance, 350)).toBe(338);
    expect(350 - (338 + 5)).toBe(7);
  });
});
