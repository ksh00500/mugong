import { describe, expect, it } from 'vitest';
import { emptyGame, startRun } from '../src/domain/game';
import { ENEMY_ROLES, ROLE_PROFILES } from '../src/domain/region-enemies';
import { hostileDrawingPose } from '../src/game/hostile-pose';
import { BOSS_MELEE } from '../src/domain/boss-melee';
import { enemyAttack } from '../src/domain/combat';
import type { BossMove } from '../src/domain/campaign';
import {
  faceUnit,
  groundAnchor,
  poseReferenceHeight,
  matchedPoseHeight,
} from '../src/game/pose-calibration';

it('원화 사이의 큰 크기 차이도 공격 얼굴을 이동 얼굴과 같은 크기로 표시한다', () => {
  for (const face of [8, 12, 30]) {
    const reference = matchedPoseHeight(200, face, 100, 20);
    expect((80 / reference) * face).toBeCloseTo((80 / 100) * 20);
  }
  expect(matchedPoseHeight(200, 0, 100, 20)).toBe(200);
});

const game = emptyGame();
startRun(game, '검증', 1);
const base = game.run!.enemies[0];
it('모든 보스 근접 접촉 시계에서 준비와 타격을 구별하고 연속 피격이 덮지 않는다', () => {
  for (const [bossId, kit] of Object.entries(BOSS_MELEE))
    for (const move of Object.keys(kit.moves) as BossMove[]) {
      const enemy = { ...base, kind: 'chief' as const, bossId, move, state: 'strike' as const };
      const melee = enemyAttack(enemy).melee;
      if (!melee || !melee.contacts.length) continue;
      const duration = melee.duration ?? 0.28;
      enemy.strike = { fromX: 0, fromY: 0, toX: 0, toY: 0, duration, damage: 1, hit: false };
      for (let direction = 0; direction < 8; direction++) {
        const region = Number(bossId.split('-')[0]);
        enemy.timer = duration;
        if (melee.contacts[0] > 0.055)
          expect(hostileDrawingPose(enemy, direction, 0, false, region)).toBe(2);
        for (const contact of melee.contacts) {
          enemy.timer = duration - contact;
          expect(hostileDrawingPose(enemy, direction, 0, false, region)).toBe(3);
          expect(
            hostileDrawingPose({ ...enemy, staggerTime: 0.09 }, direction, 0, false, region),
          ).toBe(3);
        }
      }
    }
});
describe('all hostile drawing policies', () => {
  const actors = [
    ...ENEMY_ROLES.map((role) => ({
      ...base,
      role,
      kind: ROLE_PROFILES[role].kind,
      bossId: undefined,
    })),
    ...Array.from({ length: 40 }, (_, n) => ({
      ...base,
      bossId: `${Math.floor(n / 4)}-${(n % 4) + 1}`,
      kind: 'chief' as const,
    })),
  ];
  for (const enemy of actors)
    it(`${enemy.bossId ?? enemy.role}: action poses and rear views`, () => {
      const region = enemy.bossId ? Number(enemy.bossId.split('-')[0]) : 0;
      for (let d = 0; d < 8; d++) {
        expect(hostileDrawingPose({ ...enemy, state: 'windup' }, d, 100, false, region)).toBe(2);
        expect(hostileDrawingPose({ ...enemy, state: 'strike' }, d, 100, false, region)).toBe(3);
        expect(hostileDrawingPose({ ...enemy, state: 'recover' }, d, 100, false, region)).toBe(
          d < 5 ? 0 : null,
        );
        expect(
          hostileDrawingPose(
            { ...enemy, state: 'approach', staggerTime: 0.09 },
            d,
            0.15,
            false,
            region,
          ),
        ).toBe(!enemy.bossId && d < 5 ? 4 : null);
        expect(
          hostileDrawingPose({ ...enemy, state: 'windup', staggerTime: 0 }, d, 0.05, false, region),
        ).toBe(2);
        expect(
          hostileDrawingPose(
            { ...enemy, state: 'strike', staggerTime: 0.09 },
            d,
            0.05,
            false,
            region,
          ),
        ).toBe(3);
        expect(hostileDrawingPose(enemy, d, 0.15, true, region)).toBe(5);
        expect(
          hostileDrawingPose({ ...enemy, state: 'approach' }, d, 100, false, region),
        ).toBeNull();
      }
    });
});
it('normalizes larger faces without measuring a raised weapon', () => {
  const w = 80,
    pixels = new Uint8ClampedArray(w * w * 4);
  for (let y = 20; y < 30; y++)
    for (let x = 30; x < 40; x++) pixels.set([220, 175, 140, 255], (y * w + x) * 4);
  for (let y = 0; y < 60; y++) pixels.set([180, 180, 180, 255], (y * w + 10) * 4);
  expect(faceUnit(pixels, w, { left: 0, top: 0, right: w, bottom: w })).toBe(10);
  expect(poseReferenceHeight(100, 10, 12)).toBe(120);
  expect(poseReferenceHeight(100, 10, 0)).toBe(100);
  expect(poseReferenceHeight(100, 10, 50)).toBe(122);
});
it('anchors the boots rather than a lower blade or thin staff', () => {
  const w = 80,
    pixels = new Uint8ClampedArray(w * w * 4);
  for (let y = 55; y < 65; y++)
    for (let x = 25; x < 45; x++) pixels.set([70, 45, 25, 255], (y * w + x) * 4);
  for (let y = 50; y < 78; y++)
    for (let x = 65; x < 68; x++) pixels.set([90, 60, 30, 255], (y * w + x) * 4);
  for (let y = 50; y < 78; y++)
    for (let x = 4; x < 15; x++) pixels.set([190, 195, 200, 255], (y * w + x) * 4);
  expect(groundAnchor(pixels, w, { left: 0, top: 0, right: w, bottom: w })).toEqual({
    x: 35 / 80,
    y: 65 / 80,
  });
});

import { silhouetteUnit } from '../src/game/pose-calibration';
it('silhouette mass is stable when a body falls and excludes translucent shadows', () => {
  const w = 80,
    standing = new Uint8ClampedArray(w * w * 4),
    fallen = new Uint8ClampedArray(w * w * 4);
  for (let y = 10; y < 60; y++)
    for (let x = 10; x < 30; x++) {
      standing.set([80, 70, 60, 255], (y * w + x) * 4);
      fallen.set([80, 70, 60, 255], (x * w + y) * 4);
    }
  for (let x = 0; x < w; x++) fallen.set([0, 0, 0, 80], (70 * w + x) * 4);
  const cell = { left: 0, top: 0, right: w, bottom: w };
  expect(silhouetteUnit(standing, w, cell)).toBe(silhouetteUnit(fallen, w, cell));
  expect(silhouetteUnit(new Uint8ClampedArray(w * w * 4), w, cell)).toBe(0);
});
