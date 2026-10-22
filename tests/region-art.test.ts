import { describe, expect, it } from 'vitest';
import {runtimeAssetPresent as existsSync} from './support/runtime-asset';
import { REGIONS } from '../src/domain/campaign';
import {
  enemyArtSlot,
  enemyDirectionFlip,
  regionArtIndex,
  regionArtManifest,
} from '../src/platform/region-art';

describe('regional combat art', () => {
  it('corrects the actual rear-diagonal artwork without reversing front and side views', () => {
    expect(enemyDirectionFlip(0, 0, 3, false)).toBe(false);
    expect(enemyDirectionFlip(0, 1, 3, false)).toBe(false);
    expect(enemyDirectionFlip(2, 0, 3, false)).toBe(false);
    expect(enemyDirectionFlip(5, 6, 3, false)).toBe(true);
    expect(enemyDirectionFlip(5, 6, 3, true)).toBe(false);
    expect(enemyDirectionFlip(5, 6, 2, false)).toBe(false);
    expect(enemyDirectionFlip(6, 3, 3, false)).toBe(false);
    expect(enemyDirectionFlip(6, 6, 3, false)).toBe(true);
  });
  it('has a floor and seven-actor atlas for each source region', () => {
    for (let index = 0; index < REGIONS.length; index++) {
      expect(regionArtIndex({ wave: 1, regionRoute: [REGIONS[index].name] })).toBe(index);
      for (const path of Object.values(regionArtManifest(index)))
        expect(existsSync(`public${path}`)).toBe(true);
      for (let phase = 1; phase <= 4; phase++)
        expect(enemyArtSlot({ kind: 'chief', bossId: `${index}-${phase}` })).toBe(phase + 2);
    }
  });
  it('keeps the original art for old routes and the three existing combat roles', () => {
    expect(regionArtIndex({ wave: 1 })).toBe(-1);
    expect(regionArtManifest(-1)).toEqual({});
    expect(enemyArtSlot({ kind: 'sword' })).toBe(0);
    expect(enemyArtSlot({ kind: 'spear' })).toBe(1);
    expect(enemyArtSlot({ kind: 'archer' })).toBe(2);
  });
});
