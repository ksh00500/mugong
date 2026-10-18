import { describe, expect, it } from 'vitest';
import { STAFF_ART, authoredStaffFrame, usesAuthoredStaff } from '../src/game/authored-enemy';
import { STRIKE_TIMING } from '../src/domain/combat';

describe('authored Shaolin staff animation', () => {
  it('limits the pilot to the ordinary Shaolin staff guard', () => {
    expect(usesAuthoredStaff({ kind: 'spear' }, 4)).toBe(true);
    expect(usesAuthoredStaff({ kind: 'spear' }, 3)).toBe(false);
    expect(usesAuthoredStaff({ kind: 'sword' }, 4)).toBe(false);
    expect(usesAuthoredStaff({ kind: 'spear', bossId: '4-1' }, 4)).toBe(false);
  });
  it('uses front, diagonal, side, rear diagonal and back drawings in every state', () => {
    const views = [2, 1, 0, 1, 2, 3, 4, 3],
      flips = [false, false, false, true, true, true, false, false];
    for (let direction = 0; direction < 8; direction++)
      for (const action of [
        'idle',
        'walk',
        'windup',
        'strike',
        'recover',
        'hurt',
        'death',
      ] as const) {
        const selected = authoredStaffFrame(direction, action, 0.5, 0.5);
        expect(selected.view).toBe(views[direction]);
        expect(selected.flip).toBe(flips[direction]);
        expect(selected.frame.view).toBe(selected.view);
      }
  });
  it('shows contact on the actual damage tick and keeps withdrawal before guard return', () => {
    expect(
      authoredStaffFrame(0, 'strike', STRIKE_TIMING.contact / STRIKE_TIMING.duration, 0).frame.pose,
    ).toBe(2);
    expect(authoredStaffFrame(0, 'strike', 0.8, 0).frame.pose).toBe(3);
    expect(authoredStaffFrame(0, 'recover', 0, 0).frame.pose).toBe(4);
    expect(authoredStaffFrame(0, 'recover', 1, 0).frame.pose).toBe(5);
    expect(
      [0, 0.25, 0.5, 0.75].map((gait) => authoredStaffFrame(0, 'walk', 0, gait).frame.pose),
    ).toEqual([1, 2, 3, 2]);
    expect(authoredStaffFrame(0, 'walk', 0, 0.5, true).frame.pose).toBe(0);
    expect(authoredStaffFrame(0, 'strike', 0.35, 0, true).frame.pose).toBe(2);
  });
  it('reserves padding and one living HP envelope including all raised weapons', () => {
    expect(new Set(STAFF_ART.frames.map((f) => f.name)).size).toBe(60);
    for (const f of STAFF_ART.frames) {
      expect(
        Math.min(f.bounds.left, f.bounds.top, f.width - f.bounds.right, f.height - f.bounds.bottom),
      ).toBeGreaterThanOrEqual(32);
      expect(f.footX).toBeGreaterThan(0);
      expect(f.footX).toBeLessThan(f.width);
      expect(f.footY).toBeGreaterThan(0);
      expect(f.footY).toBeLessThan(f.height);
      if (!(f.kind === 'locomotion' && f.pose === 5))
        expect(
          STAFF_ART.healthClearance - (f.footY - f.bounds.top) * STAFF_ART.pixelScale,
        ).toBeGreaterThanOrEqual(15.99999);
    }
  });
});
