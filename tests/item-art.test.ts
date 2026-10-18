import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {runtimeAssetPresent as existsSync} from './support/runtime-asset';
import { ITEM_CATALOGUE, makeLootItem } from '../src/domain/items';
import { bossReward } from '../src/domain/boss-loot';
import { makeItem, makeWeapon } from '../src/domain/content';
import { dedicatedItemArt, ITEM_ARTWORK, itemArtView } from '../src/platform/item-art';

describe('dedicated item artwork', () => {
  it('covers every normal definition and all 40 workbook boss rewards with different files', () => {
    const items = [
      ...ITEM_CATALOGUE.map((d) => makeLootItem(d.id, d.id, 'ground')),
      ...Array.from({ length: 40 }, (_, i) =>
        bossReward(`${Math.floor(i / 4)}-${(i % 4) + 1}`, `boss-${i}`)!,
      ),
    ];
    expect(items).toHaveLength(92);
    const art = items.map((i) => dedicatedItemArt(i)!);
    expect(art.every(Boolean)).toBe(true);
    expect(new Set(art.map((a) => a.src)).size).toBe(92);
    for (const entry of art) {
      expect(existsSync(`public${entry.src}`)).toBe(true);
      const [x, y, w, h] = entry.bounds;
      expect(w).toBeGreaterThan(0);
      expect(h).toBeGreaterThan(0);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x + w).toBeLessThanOrEqual(entry.width);
      expect(y + h).toBeLessThanOrEqual(entry.height);
    }
    const audit = JSON.parse(readFileSync('docs/source/item-art-v2-audit.json', 'utf8'));
    expect(new Set(audit.map((a: any) => a.sourceSha256)).size).toBe(92);
  });
  it('recognizes old name-only saves and boss provenance without rewriting items', () => {
    const examples = [
      makeItem('robe', 'robe', 'general'),
      makeItem('ore', 'ore', 'general'),
      makeWeapon('fan', 'fan', 'weapon'),
      bossReward('9-4', 'boss')!,
      makeItem('sword', 'old-sword', 'weapon'),
    ];
    delete examples[3].templateId;
    const copy = structuredClone(examples);
    expect(examples.map((i) => dedicatedItemArt(i)?.id)).toEqual([
      'gear-robe-0',
      'material-0',
      'weapon-fan-0',
      'boss-9-4',
      'weapon-sword-1',
    ]);
    expect(examples).toEqual(copy);
    expect(dedicatedItemArt({ ...examples[0], templateId: 'future-item' })).toBeUndefined();
  });
  it('rotates the crop and source around the same centre, including wide gauntlets', () => {
    for (const id of ['weapon-sword-0', 'weapon-staff-2', 'weapon-gauntlet-2', 'manual-training']) {
      const art = ITEM_ARTWORK[id];
      const [x, y, w, h] = art.bounds;
      expect(itemArtView(art, false)).toEqual({
        viewBox: art.bounds.join(' '),
        transform: undefined,
      });
      const rotated = itemArtView(art, true),
        [rx, ry, rw, rh] = rotated.viewBox.split(' ').map(Number);
      expect([rw, rh]).toEqual([h, w]);
      expect(rx + rw / 2).toBe(x + w / 2);
      expect(ry + rh / 2).toBe(y + h / 2);
      expect(rotated.transform).toBe(`rotate(-90 ${x + w / 2} ${y + h / 2})`);
    }
  });
});
