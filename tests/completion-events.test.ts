import { expect, it } from 'vitest';
import { emptyGame, startRun, spawnWave, command } from '../src/domain/game';
import { restEvent, ALL_REST_EVENT_KINDS } from '../src/domain/rest-event';
import { waystationApproach } from '../src/domain/waystation';
import { makeLootItem } from '../src/domain/items';
import { decodeCurrentSave } from '../src/platform/save-migrations';
import { workPose, WORK_CALIBRATION } from '../src/game/waystation-work';
it('all six new-journey trades consume exact costs once, including item stacks in different bags', () => {
  const seen = new Set();
  for (let seed = 1; seed < 60; seed++) {
    const s = emptyGame();
    startRun(s, '확장 기연', seed);
    const r = s.run!,
      f = r.fighter;
    r.wave = 14;
    spawnWave(r);
    r.offers = [];
    r.gold = 1000;
    f.hp = 120;
    Object.assign(f, waystationApproach('fortune', r));
    const offer = restEvent(r);
    seen.add(offer.kind);
    if (offer.itemCost)
      f.items.push({
        ...makeLootItem(offer.itemCost.templateId, 'payment', 'ground'),
        count: offer.itemCost.count,
      });
    const before = {
      hp: f.hp,
      gold: r.gold,
      count: f.items
        .filter((i) => i.templateId === offer.itemCost?.templateId)
        .reduce((a, i) => a + i.count, 0),
    };
    expect(command(s, { type: 'restEvent', choice: 'accept' })).toBe(true);
    expect(f.hp).toBe(before.hp - offer.hpCost);
    expect(r.gold).toBe(before.gold - offer.goldCost);
    expect(f.items.at(-1)).toMatchObject({
      templateId: offer.templateId,
      count: offer.count,
      place: 'ground',
    });
    if (offer.itemCost)
      expect(
        f.items
          .filter((i) => i.templateId === offer.itemCost!.templateId)
          .reduce((a, i) => a + i.count, 0),
      ).toBe(before.count - offer.itemCost.count);
    const loaded = decodeCurrentSave(s)!;
    expect(loaded).not.toBeNull();
    expect(command(loaded, { type: 'restEvent', choice: 'accept' })).toBe(false);
  }
  expect(seen).toEqual(new Set(ALL_REST_EVENT_KINDS));
});
it('old journey fate is stable while revision 2 can offer item trades that reject missing payment', () => {
  let checked = 0;
  for (let seed = 1; seed < 30; seed++) {
    const s = emptyGame();
    startRun(s, '기연', seed);
    const r = s.run!;
    r.wave = 4;
    spawnWave(r);
    r.offers = [];
    r.gold = 200;
    Object.assign(r.fighter, waystationApproach('fortune', r));
    const offer = restEvent(r);
    if (offer.itemCost) {
      r.fighter.items = [];
      const before = structuredClone(s);
      expect(command(s, { type: 'restEvent', choice: 'accept' })).toBe(false);
      expect(s).toEqual(before);
      checked++;
    }
    delete r.restEventRevision;
    expect(['herbalist', 'manuscript', 'salvage']).toContain(restEvent(r).kind);
  }
  expect(checked).toBeGreaterThan(0);
});
it('work uses held anticipation, quick contact and recovery with fixed body scales and authored foot anchors', () => {
  expect([0, 0.3, 0.65, 1, 1.4, 1.7].map((n) => workPose(n))).toEqual([0, 1, 2, 3, 0, null]);
  expect(workPose(0.3, true)).toBe(2);
  expect(workPose(2, true)).toBeNull();
  for (const c of Object.values(WORK_CALIBRATION)) {
    expect(c.feet).toHaveLength(4);
    expect(c.bodyHeight).toBeGreaterThan(600);
  }
});
