import { describe, expect, it } from 'vitest';
import { ARTS, xpThreshold } from '../src/domain/content';
import {
  command,
  eligibleOffers,
  offerAvailability,
  emptyGame,
  rollOffers,
  startRun,
} from '../src/domain/game';
import { decodeCurrentSave } from '../src/platform/save-migrations';
import { isGameSave } from '../src/platform/save-validation';
import type { ArtId } from '../src/domain/model';

function fixture(levels: number[], points: number, lobby = false) {
  const state = emptyGame();
  startRun(state, '수련 후보 검사', 123);
  const run = state.run!,
    fighter = run.fighter;
  Object.assign(fighter, {
    progressionVersion: 2,
    growth: { constitution: 1, strength: 1, agility: 1, inner: 1 },
    level: 50,
    xp: xpThreshold(50),
    spent: 50,
    augments: ['iron', 'tempo', 'resolve'],
    augmentOffers: [],
    trainingPoints: points,
  });
  fighter.arts = (['huashan', 'wudang', 'tianmo', 'samja'] as ArtId[]).map((id, i) => ({
    id,
    level: levels[i],
    gauge: 0,
    combo: 0,
    defenseCd: 0,
  }));
  run.spent = 50;
  run.offers = [];
  if (lobby) {
    state.run = null;
    state.family.roster = [fighter];
    state.selectedId = fighter.id;
    expect(command(state, { type: 'openTraining' })).toBe(true);
  } else rollOffers(run);
  return { state, fighter, offers: state.run?.offers ?? state.family.training!.offers };
}

describe('무공 후보 수', () => {
  it('만렙이 없어도 비용 조건으로 두 개가 남는 경우를 정확하게 설명한다', () => {
    const { fighter, offers } = fixture([2, 3, 2, 4], 2);
    expect(offers).toHaveLength(2);
    expect(fighter.arts.every((a) => a.level < ARTS[a.id].max)).toBe(true);
    const rows = offerAvailability(fighter);
    expect(rows.find((r) => r.offer.art === 'wudang')!.reasons).toEqual(['cost']);
    expect(rows.find((r) => r.offer.art === 'samja')!.reasons).toEqual(['cost']);
    expect(rows.find((r) => r.offer.art === 'shaolin')!.reasons).toContain('limit');
    fighter.trainingPoints = 3;
    expect(eligibleOffers(fighter)).toHaveLength(3);
    fighter.trainingPoints = 0;
    expect(eligibleOffers(fighter)).toHaveLength(0);
  });
  for (const lobby of [false, true]) {
    for (const count of [1, 2, 3]) {
      it(`${lobby ? '로비' : '전투'}: 최대 성급 외의 ${count}개만 제시하고 저장 복원한다`, () => {
        const levels = [5, 5, 5, 10];
        for (let i = 0; i < count; i++) levels[i] = 4;
        const { state, fighter, offers } = fixture(levels, 4, lobby);
        expect(eligibleOffers(fighter)).toHaveLength(count);
        expect(offers).toHaveLength(count);
        expect(new Set(offers.map((o) => o.art)).size).toBe(count);
        expect(isGameSave(state)).toBe(true);
        const restored = decodeCurrentSave(state)!;
        expect(restored.run?.offers ?? restored.family.training!.offers).toEqual(offers);
        expect(command(restored, { type: 'choose', offer: offers[0] })).toBe(true);
        const selected = restored.run?.fighter ?? restored.family.roster[0];
        expect(selected.trainingPoints).toBe(0);
        expect(selected.arts.find((a) => a.id === offers[0].art)!.level).toBe(5);
      });
    }
  }
  for (const count of [1, 2]) {
    it(`수련 1점으로 구매할 수 있는 ${count}개만 제시하며 비용 이상은 제외한다`, () => {
      const levels = [2, 2, 2, 2];
      for (let i = 0; i < count; i++) levels[i] = 1;
      const { fighter, offers } = fixture(levels, 1);
      expect(offers).toHaveLength(count);
      expect(offers.every((o) => fighter.arts.find((a) => a.id === o.art)!.level === 1)).toBe(true);
      expect(fighter.arts.every((a) => a.level < ARTS[a.id].max)).toBe(true);
    });
  }
});
