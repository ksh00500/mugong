import { expect, it } from 'vitest';
import { emptyGame, startRun, spawnWave, tick } from '../src/domain/game';
import { makeLootItem, refinePreview } from '../src/domain/items';
import { bossReward } from '../src/domain/boss-loot';
import { decodeCurrentSave } from '../src/platform/save-migrations';
import { isGameSave } from '../src/platform/save-validation';
import { enemyAttack } from '../src/domain/combat';
import type { BoundFighter } from '../src/domain/model';

it('작은 장비 수치에도 품질/등급 차이가 남고 강화에서 부동소수점 꼬리가 생기지 않는다', () => {
  const low = makeLootItem('gear-robe-0', 'a', 'general', 70);
  const high = makeLootItem('gear-robe-0', 'b', 'general', 90);
  const rare = makeLootItem('gear-robe-2', 'c', 'general', 70);
  expect(low.power).toBe(0.7);
  expect(high.power).toBe(0.9);
  expect(rare.power).toBe(2.1);
  expect(refinePreview(rare)?.power).toBe(3.1);
  expect(bossReward('4-2', 'rare')!.power).toBeLessThan(bossReward('4-4', 'heroic')!.power);
});

it('기존 둥근 스탯을 한 번만 보정하고 원본/진행/강화 이득/사용자 정의 스탯은 보존한다', () => {
  const s = emptyGame();
  startRun(s, '기존', 777);
  const i = makeLootItem('gear-robe-2', 'old', 'general', 83);
  delete i.statRevision;
  i.power = 3; // quality73: rounded2 + one fixed upgrade
  i.upgrades = 1;
  const custom = { ...i, id: 'custom', power: 23 };
  s.family.warehouse = [i, custom];
  const before = structuredClone(s);
  const decoded = decodeCurrentSave(s)!;
  expect(decoded.family.warehouse[0].power).toBe(3.2);
  expect(decoded.family.warehouse[1].power).toBe(23);
  expect(decoded.run).toMatchObject(s.run!);
  expect(s).toEqual(before);
  expect(isGameSave(decoded)).toBe(true);
  expect(decodeCurrentSave(decoded)).toEqual(decoded);
});

for (const wave of [5, 10, 15, 20])
  it(`${wave}웨이브 보스가 성장한 궁극+첫 공격에 사라지지 않고 읽을 수 있는 준비를 유지한다`, () => {
    const s = emptyGame();
    startRun(s, '검증', 123);
    const r = s.run!;
    r.wave = wave;
    spawnWave(r);
    r.offers = [];
    const e = r.enemies[0], f = r.fighter as BoundFighter;
    f.arts = [{ id: 'huashan', level: 5, gauge: 100, combo: 0, defenseCd: 0 }];
    f.active = 0;
    const weapon = makeLootItem('weapon-sword-2', 'sword', 'weapon', 100);
    f.items = [weapon, { ...makeLootItem('gear-charm-2', 'charm', 'general'), place: 'equipped' }];
    f.bindings = { huashan: weapon.id };
    f.x = e.x - 60; f.y = e.y; f.facing = 0;
    const hp = e.hp;
    tick(r, { dx: 0, dy: 0, aim: 0, attack: false, ultimate: true, defense: false }, 1 / 60);
    for (let n = 0; n < 48; n++)
      tick(r, { dx: 0, dy: 0, aim: 0, attack: true, ultimate: false, defense: false }, 1 / 60);
    expect(e.hp).toBeLessThan(hp);
    expect(e.hp).toBeGreaterThan(hp * 0.5);
    expect(enemyAttack(e).windup).toBeGreaterThanOrEqual(0.4);
  });
