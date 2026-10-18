import { describe, expect, it } from 'vitest';
import { emptyGame, startRun } from '../src/domain/game';
import { hostileDrawingPose } from '../src/game/hostile-pose';

describe('native walking remains tied to movement', () => {
  const state = emptyGame();
  startRun(state, '동작 검증', 1);
  const enemy = { ...state.run!.enemies[0], state: 'approach' as const };
  it('alternates authored legs only for a moving front view', () => {
    expect(hostileDrawingPose(enemy, 2, 100, false, 0, { gait: 0.1, moving: true })).toBe(0);
    expect(hostileDrawingPose(enemy, 2, 100, false, 0, { gait: 0.7, moving: true })).toBe(1);
    expect(hostileDrawingPose(enemy, 2, 100, false, 0, { gait: 0.7, moving: false })).toBeNull();
    expect(hostileDrawingPose(enemy, 6, 100, false, 0, { gait: 0.7, moving: true })).toBeNull();
  });
  it('hit, death and attack take precedence over stepping', () => {
    expect(
      hostileDrawingPose({ ...enemy, staggerTime: 0.09 }, 2, 0.05, false, 0, {
        gait: 0.7,
        moving: true,
      }),
    ).toBe(4);
    expect(hostileDrawingPose(enemy, 2, 0.05, false, 0, { gait: 0.7, moving: true })).toBe(1);
    expect(hostileDrawingPose(enemy, 2, 100, true, 0, { gait: 0.7, moving: true })).toBe(5);
    expect(
      hostileDrawingPose({ ...enemy, state: 'windup' }, 2, 100, false, 0, {
        gait: 0.7,
        moving: true,
      }),
    ).toBe(2);
  });
  it('keeps directional stepping for a moving side recovery and mounted horse', () => {
    const recovering = { ...enemy, state: 'recover' as const };
    expect(
      hostileDrawingPose(recovering, 0, 100, false, 0, { gait: 0.7, moving: true }),
    ).toBeNull();
    expect(hostileDrawingPose(recovering, 0, 100, false, 0, { gait: 0.7, moving: false })).toBe(0);
    expect(
      hostileDrawingPose({ ...enemy, bossId: undefined, role: 'rider' }, 2, 100, false, 7, {
        gait: 0.7,
        moving: true,
      }),
    ).toBeNull();
  });
});
