import { expect, it } from 'vitest';
import { APPEARANCES, recruitAppearances } from '../src/domain/appearances';
import { characterPortrait, characterCombatImages } from '../src/platform/character-art';
import { messages } from '../src/platform/messages';

it('offers three different cosmetic identities and reaches every design', () => {
  let seed = 123;
  const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32;
  const counts = Array(10).fill(0);
  for (let n = 0; n < 10000; n++) {
    const ids = recruitAppearances(random);
    expect(new Set(ids).size).toBe(3);
    for (const id of ids) counts[id]++;
  }
  for (const count of counts) expect(count).toBeGreaterThan(2700);
  for (const appearance of APPEARANCES) {
    expect(characterPortrait({ appearance: appearance.id })).toContain(
      `portrait-${appearance.id}.webp`,
    );
    const manifest = characterCombatImages({ appearance: appearance.id });
    const group = Math.floor(appearance.id / 5);
    expect(manifest['hero-roster-directions']).toContain(`directions-${group}.webp`);
    expect(manifest['hero-roster-actions']).toContain(`actions-${group}.webp`);
    for (let i = group * 5; i < group * 5 + 5; i++)
      expect(manifest[`hero-slash-${i}`]).toBe(`/art/hero-slash-v1/hero-${i}.webp`);
    expect(Object.keys(manifest)).toHaveLength(group === 1 ? 8 : 7);
    expect(messages[appearance.name].every(Boolean)).toBe(true);
  }
});

it('preserves legacy portraits rather than reinterpreting old identities', () => {
  for (const portrait of [0, 1, 2] as const)
    expect(characterPortrait({ portrait })).toBe(
      `/art/character-polish-v1/recruit-${portrait}.webp`,
    );
  expect(characterCombatImages({})).toEqual({ 'hero-slash-0': '/art/hero-slash-v1/hero-0.webp' });
});
