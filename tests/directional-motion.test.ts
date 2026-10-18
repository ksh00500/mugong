import { describe, expect, it } from 'vitest';
import {
  directionIndex,
  MOTION_DIRECTIONS,
  MotionClock,
  rigPoint,
  sampleRig,
  type MotionAction,
} from '../src/game/directional-motion';
import { figureBounds, motionLayout } from '../src/game/motion-layout';

describe('directional continuous animation', () => {
  it('covers eight directions including independent rear views and mirrored left views', () => {
    for (let n = 0; n < 8; n++) expect(directionIndex((n * Math.PI) / 4)).toBe(n);
    expect(directionIndex(-Math.PI / 4)).toBe(7);
    expect(directionIndex(2 * Math.PI)).toBe(0);
    expect(MOTION_DIRECTIONS[2]).toEqual({ view: 0, flip: false });
    expect(MOTION_DIRECTIONS[6]).toEqual({ view: 4, flip: false });
    expect(MOTION_DIRECTIONS[4]).toEqual({ view: 2, flip: true });
  });
  it('does not flicker at a direction boundary', () => {
    expect(directionIndex(Math.PI / 8 + 0.01, 0)).toBe(0);
    expect(directionIndex(Math.PI / 8 - 0.01, 1)).toBe(1);
    expect(directionIndex(Math.PI / 4, 0)).toBe(1);
  });
  it('advances gait by walked distance, freezes with the scene clock, and ignores teleports', () => {
    const clock = new MotionClock();
    expect(clock.sample('a', 0, 0, 0, 0, true).gait).toBe(0);
    expect(clock.sample('a', 21, 0, 0, 1, true).gait).toBeCloseTo(0.25);
    expect(clock.sample('a', 42, 0, Math.PI, 1, true)).toEqual({ direction: 0, gait: 0.25 });
    expect(clock.sample('a', 1000, 0, Math.PI, 2, true)).toEqual({ direction: 4, gait: 0.25 });
    expect(clock.sample('a', 1021, 0, Math.PI, 3, false).gait).toBeCloseTo(0.25);
    clock.delete('a');
    expect(clock.sample('a', 1021, 0, 0, 3, true).gait).toBe(0);
    clock.reset();
  });
  it('walk cycles loop continuously and deform limbs independently', () => {
    const start = sampleRig('walk', 0, 0, 0),
      end = sampleRig('walk', 0, 1, 0);
    for (const key of Object.keys(start) as (keyof typeof start)[])
      expect(start[key]).toBeCloseTo(end[key], 10);
    const pose = sampleRig('walk', 0, 0.25, 0);
    const left = rigPoint(0.25, 0.95, pose, 0),
      right = rigPoint(0.75, 0.95, pose, 0);
    expect(left.x - 0.25).toBeLessThan(0);
    expect(right.x - 0.75).toBeGreaterThan(0);
    expect(rigPoint(0.5, 0.2, pose, 0).y).not.toBe(left.y - 0.75);
    const a = sampleRig('walk', 0, 0.4999, 0),
      b = sampleRig('walk', 0, 0.5001, 0);
    expect(Math.abs(a.stride - b.stride)).toBeLessThan(0.001);
  });
  it('backs away with a reversed gait while keeping its aim toward the target', () => {
    const clock = new MotionClock();
    clock.sample('archer', 500, 500, 0, 0, true);
    const cycle = clock.sample('archer', 479, 500, 0, 1, true);
    expect(cycle.direction).toBe(0);
    expect(cycle.gait).toBeCloseTo(0.75);
  });
  it('has finite, restrained geometry throughout every action and direction', () => {
    const actions: MotionAction[] = [
      'idle',
      'walk',
      'windup',
      'strike',
      'recover',
      'ultimate',
      'defense',
      'hurt',
      'death',
    ];
    for (const action of actions)
      for (let direction = 0; direction < 8; direction++)
        for (let i = 0; i <= 20; i++) {
          const pose = sampleRig(action, i / 20, i / 20, i / 20);
          for (const x of [0, 0.25, 0.5, 0.75, 1])
            for (const y of [0, 0.25, 0.5, 0.75, 1]) {
              const point = rigPoint(x, y, pose, direction);
              expect(Number.isFinite(point.x + point.y)).toBe(true);
              expect(point.x).toBeGreaterThanOrEqual(-0.55);
              expect(point.x).toBeLessThanOrEqual(1.55);
              expect(point.y).toBeGreaterThanOrEqual(-0.06);
              expect(point.y).toBeLessThanOrEqual(1.06);
            }
        }
  // 37,800 geometry samples / 189,000 assertions also run on shared CI workers.
  }, 15_000);
  it('reduced motion stops decorative displacement but preserves the dead state', () => {
    for (const action of [
      'walk',
      'windup',
      'strike',
      'recover',
      'hurt',
      'ultimate',
      'defense',
    ] as MotionAction[]) {
      expect(rigPoint(0.2, 0.4, sampleRig(action, 0.5, 0.25, 1, true), 0)).toEqual({
        x: 0.2,
        y: 0.4,
      });
    }
    expect(sampleRig('death', 0, 0, 0, true).collapse).toBe(1);
  });
  it('death collapses about the ground without changing foot position', () => {
    const pose = sampleRig('death', 1, 0, 0);
    expect(rigPoint(0.5, 1, pose, 0)).toEqual({ x: 0.5, y: 1 });
    expect(rigPoint(0.5, 0, pose, 0).y).toBeCloseTo(0.74);
  });
  it('attack keyframes join continuously at anticipation, contact and recovery', () => {
    for (const [a, ap, b, bp] of [
      ['windup', 1, 'strike', 0],
      ['strike', 1, 'recover', 0],
      ['recover', 1, 'idle', 0],
    ] as const) {
      const from = sampleRig(a, ap, 0, 0),
        to = sampleRig(b, bp, 0, 0);
      for (const key of Object.keys(from) as (keyof typeof from)[])
        expect(from[key]).toBeCloseTo(to[key], 10);
    }
  });
  it('extracts five-column direction plates without dropping a character', () => {
    const width = 100,
      height = 140,
      pixels = new Uint8Array(width * height * 4);
    for (let row = 0; row < 7; row++)
      for (let col = 0; col < 5; col++)
        for (let y = row * 20 + 3; y < row * 20 + 17; y++)
          for (let x = col * 20 + 5; x < col * 20 + 15; x++) pixels[(y * width + x) * 4 + 3] = 255;
    const cells = motionLayout(pixels, width, height, 7, 5);
    expect(cells).toHaveLength(35);
    expect(cells.every((cell) => figureBounds(pixels, width, cell).area === 140)).toBe(true);
  });
});
