import { expect, it } from 'vitest';
import { emptyGame, startRun, spawnWave, command, tick } from '../src/domain/game';
import { restEvent } from '../src/domain/rest-event';
import {
  waystationStops,
  waystationApproach,
  nearestWaystationStop,
  isWalkablePreparation,
  WAYSTATION_BOUNDS,
} from '../src/domain/waystation';
import { REGIONS } from '../src/domain/campaign';
import { decodeCurrentSave } from '../src/platform/save-migrations';
import { isGameSave } from '../src/platform/save-validation';
import { messages } from '../src/platform/messages';
const idle = { dx: 0, dy: 0, aim: 0, attack: false, defense: false, ultimate: false };
function fixture(wave = 4, seed = 123, region = 0) {
  const s = emptyGame();
  startRun(s, '기연 검사', seed);
  const r = s.run!;
  delete r.restEventRevision; // Historical revision-1 contract remains supported.
  r.regionRoute = REGIONS.filter((_, n) => n !== region)
    .slice(0, 4)
    .map((x) => x.name);
  r.regionRoute[Math.floor((wave - 1) / 5)] = REGIONS[region].name;
  r.wave = wave;
  spawnWave(r);
  r.offers = [];
  r.gold = 100;
  Object.assign(r.fighter, waystationApproach('fortune', r));
  return { s, r, f: r.fighter };
}
for (let region = 0; region < 10; region++)
  for (const wave of [4, 9, 14, 19])
    it(`${REGIONS[region].name} ${wave}: all stops are reachable with frozen combat and resources`, () => {
      const { s, r, f } = fixture(wave, 123, region);
      expect(isWalkablePreparation(r)).toBe(true);
      const before = {
        time: r.elapsed,
        seed: r.seed,
        gold: r.gold,
        hp: f.hp,
        items: structuredClone(f.items),
      };
      for (const stop of waystationStops(r)) {
        Object.assign(f, waystationApproach(stop.id, r));
        expect(nearestWaystationStop(f, r)?.id).toBe(stop.id);
        expect(f.x).toBeGreaterThanOrEqual(WAYSTATION_BOUNDS.left);
        expect(f.y).toBeLessThanOrEqual(WAYSTATION_BOUNDS.bottom);
        tick(r, { ...idle, dx: 1, attack: true, defense: true, ultimate: true }, 1 / 60);
      }
      expect({ time: r.elapsed, seed: r.seed, gold: r.gold, hp: f.hp, items: f.items }).toEqual(
        before,
      );
      expect(isGameSave(s)).toBe(true);
    });
it('three event types have visible exact costs and grant one reward only after a nearby choice', () => {
  const kinds = new Set<string>();
  for (let seed = 1; seed < 30; seed++) {
    const { s, r, f } = fixture(9, seed),
      e = restEvent(r);
    kinds.add(e.kind);
    const hp = f.hp,
      gold = r.gold,
      items = f.items.length;
    expect(messages[e.title]).toHaveLength(4);
    expect(messages[e.story]).toHaveLength(4);
    expect(command(s, { type: 'restEvent', choice: 'accept' })).toBe(true);
    expect(f.hp).toBe(hp - e.hpCost);
    expect(r.gold).toBe(gold - e.goldCost);
    expect(f.items).toHaveLength(items + 1);
    expect(f.items.at(-1)).toMatchObject({
      templateId: e.templateId,
      count: e.count,
      place: 'ground',
    });
    const saved = decodeCurrentSave(s)!;
    expect(saved).not.toBeNull();
    expect(saved.run!.restEvents).toHaveLength(1);
    const clone = structuredClone(saved);
    expect(command(saved, { type: 'restEvent', choice: 'accept' })).toBe(false);
    expect(saved).toEqual(clone);
    expect(command(saved, { type: 'restEvent', choice: 'leave' })).toBe(false);
  }
  expect(kinds.size).toBe(3);
});
it('a health trade leaves at least one actual HP, including fractional combat damage', () => {
  for (let seed = 1; seed < 30; seed++) {
    const { s, r, f } = fixture(4, seed);
    const event = restEvent(r);
    if (event.kind !== 'herbalist') continue;
    f.hp = event.hpCost + 0.5;
    const before = structuredClone(s);
    expect(command(s, { type: 'restEvent', choice: 'accept' })).toBe(false);
    expect(s).toEqual(before);
    f.hp = event.hpCost + 1;
    expect(command(s, { type: 'restEvent', choice: 'accept' })).toBe(true);
    expect(f.hp).toBe(1);
  }
});
it('event offer is stable across movement/RNG changes/reload; skipped events are not repeatable', () => {
  const { s, r } = fixture(),
    first = restEvent(r);
  r.seed = 99999;
  r.fighter.x += 10;
  expect(restEvent(r)).toEqual(first);
  expect(command(s, { type: 'restEvent', choice: 'leave' })).toBe(true);
  const loaded = decodeCurrentSave(s)!;
  expect(loaded).not.toBeNull();
  expect(command(loaded, { type: 'restEvent', choice: 'accept' })).toBe(false);
  r.wave = 9;
  spawnWave(r);
  expect(restEvent(r).record).toBeUndefined();
  expect(r.restEvents).toHaveLength(1);
});
it('unaffordable, remote, combat and pending-growth attempts do not charge or grant rewards', () => {
  for (let seed = 1; seed < 15; seed++) {
    const { s, r, f } = fixture(4, seed),
      e = restEvent(r);
    f.hp = e.hpCost || 120;
    r.gold = e.goldCost ? e.goldCost - 1 : 100;
    const before = structuredClone(s);
    expect(command(s, { type: 'restEvent', choice: 'accept' })).toBe(false);
    expect(s).toEqual(before);
  }
  for (const mode of ['remote', 'combat', 'growth']) {
    const { s, r, f } = fixture();
    if (mode === 'remote') f.x = 1600;
    if (mode === 'combat') r.phase = 'combat';
    if (mode === 'growth') r.offers = [{ art: 'samja', type: 'learn' }];
    const before = structuredClone(s);
    expect(command(s, { type: 'restEvent', choice: 'accept' })).toBe(false);
    expect(s).toEqual(before);
  }
});
it('old saves without events remain unchanged while malformed/duplicate/future records are rejected', () => {
  const { s } = fixture();
  expect(decodeCurrentSave(s)!.run!.restEvents).toBeUndefined();
  for (const events of [
    [{ wave: 9, kind: 'salvage', choice: 'accept' }],
    [{ wave: 4, kind: 'unknown', choice: 'accept' }],
    [{ wave: 4, kind: 'salvage', choice: 'bad' }],
    [
      { wave: 4, kind: 'salvage', choice: 'leave' },
      { wave: 4, kind: 'salvage', choice: 'leave' },
    ],
  ]) {
    const raw = structuredClone(s);
    (raw.run as any).restEvents = events;
    expect(decodeCurrentSave(raw)).toBeNull();
  }
});
