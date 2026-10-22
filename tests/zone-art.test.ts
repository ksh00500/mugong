import { expect, it } from 'vitest';
import { emptyGame, startRun } from '../src/domain/game';
import type { EncounterObject } from '../src/domain/model';
import { encounterZoneArt } from '../src/game/zone-art';

it.each([
  ['1-2', 'mine', 'poison'],
  ['4-1', 'mine', 'brew'],
  ['6-1', 'mine', 'fire'],
  ['9-1', 'mine', 'gate'],
  ['9-3', 'mine', 'gate'],
  ['7-1', 'smoke', 'sand'],
  ['3-3', 'smoke', 'cold'],
  ['5-1', 'smoke', 'smoke'],
  ['8-3', 'tether', 'chain'],
  ['8-4', 'blood', 'blood'],
  ['8-4', 'seal', 'gate'],
  ['9-4', 'safe', 'safe'],
] as const)('보스 %s의 %s 구역을 %s 이미지로 구분한다', (bossId, kind, art) => {
  const state = emptyGame();
  startRun(state, '그림 검증', 123);
  const run = state.run!;
  run.regionRoute = [bossId.startsWith('1-') ? '독무곡' : '청하현', '설산', '혈마전', '팔진고성'];
  const enemy = run.enemies[0];
  enemy.bossId = bossId;
  const object: EncounterObject = {
    id: 1,
    owner: enemy.id,
    kind,
    x: 500,
    y: 500,
    radius: 85,
    warning: 0,
    life: 4,
    pulse: 1,
    hp: 0,
    maxHp: 0,
    aim: 0,
  };
  expect(encounterZoneArt(run, object)).toBe(art);
});
