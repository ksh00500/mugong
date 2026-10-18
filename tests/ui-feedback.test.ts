import { describe, it, expect } from 'vitest';
import { HealthTrail, healthRatio } from '../src/game/health-trail';
import { CameraImpulse } from '../src/game/camera-impulse';

describe('resource feedback preserves the authoritative live value', () => {
  it('removes actual HP immediately, holds the white loss, then settles without undershoot', () => {
    const bar = new HealthTrail();
    bar.update(100, 100, 0, 'hero');
    expect(bar.update(65, 100, 1, 'hero')).toMatchObject({ ratio: 0.65, trail: 1, phase: 'hit' });
    expect(bar.sample(1.12)).toMatchObject({ ratio: 0.65, trail: 1, phase: 'hold' });
    expect(bar.sample(1.4).trail).toBeGreaterThan(0.65);
    expect(bar.sample(1.4).trail).toBeLessThan(1);
    expect(bar.sample(1.61)).toMatchObject({
      ratio: 0.65,
      trail: 0.65,
      phase: 'idle',
      active: false,
    });
  });
  it('does not restart old damage when rapid new hits arrive', () => {
    const bar = new HealthTrail();
    bar.update(100, 100, 0);
    bar.update(80, 100, 1);
    bar.update(60, 100, 1.4);
    expect(bar.sample(1.4).trail).toBeLessThan(1);
    expect(bar.sample(1.7).trail).toBeLessThan(0.8);
    expect(bar.sample(2.01)).toMatchObject({ ratio: 0.6, trail: 0.6, active: false });
  });
  it('healing clears pending loss instead of inventing another white hit', () => {
    const bar = new HealthTrail();
    bar.update(100, 100, 0);
    bar.update(20, 100, 1);
    expect(bar.update(55, 100, 1.1)).toMatchObject({ ratio: 0.55, trail: 0.55, phase: 'heal' });
    expect(bar.sample(1.5)).toMatchObject({ phase: 'idle', active: false });
  });
  it('rebases different fighters, bosses and maximum-health changes', () => {
    const bar = new HealthTrail();
    bar.update(100, 100, 0, 'first');
    bar.update(30, 100, 0.1, 'first');
    expect(bar.update(10, 100, 0.2, 'second')).toMatchObject({
      ratio: 0.1,
      trail: 0.1,
      phase: 'idle',
    });
    expect(bar.update(10, 200, 0.3, 'second')).toMatchObject({
      ratio: 0.05,
      trail: 0.05,
      phase: 'idle',
    });
  });
  it('reduced motion shows the live number and live fill with no trailing animation', () => {
    const bar = new HealthTrail();
    bar.update(100, 100, 0);
    bar.update(20, 100, 1);
    expect(bar.sample(1.01, true)).toMatchObject({
      ratio: 0.2,
      trail: 0.2,
      phase: 'idle',
      flash: 0,
      active: false,
    });
  });
  it('uses proportions for critical health and sanitizes invalid resources', () => {
    const bar = new HealthTrail();
    expect(bar.update(70, 280, 0).level).toBe('critical');
    expect(bar.update(100, 280, 1).level).toBe('low');
    expect(healthRatio(-12, 100)).toBe(0);
    expect(healthRatio(200, 100)).toBe(1);
    expect(healthRatio(10, 0)).toBe(0);
    expect(healthRatio(NaN, 100)).toBe(0);
  });
});

describe('bounded presentation camera impulse', () => {
  it('never leaves its screen-pixel envelope under repeated area hits', () => {
    const camera = new CameraImpulse();
    for (let n = 0; n < 1000; n++) {
      const now = n / 60;
      camera.add(0.6, now);
      const offset = camera.sample(now);
      expect(Math.abs(offset.x)).toBeLessThanOrEqual(4.335);
      expect(Math.abs(offset.y)).toBeLessThanOrEqual(2.818);
    }
  });
  it('uses repeatable smooth noise and decays independently of frame subdivisions', () => {
    const a = new CameraImpulse(),
      b = new CameraImpulse();
    a.add(0.7, 1);
    b.add(0.7, 1);
    a.sample(1.04);
    a.sample(1.08);
    expect(a.sample(1.12)).toEqual(b.sample(1.12));
    const first = b.sample(1.12),
      close = b.sample(1.12001);
    expect(Math.abs(close.x - first.x)).toBeLessThan(0.01);
    expect(a.sample(1.4)).toEqual({ x: 0, y: 0, trauma: 0 });
  });
  it('supports zero strength and resets without a camera rebase', () => {
    const camera = new CameraImpulse();
    camera.add(0.7, 1);
    expect(camera.sample(1.01, 0).x).toBe(0);
    camera.reset(1.02);
    expect(camera.sample(1.03)).toEqual({ x: 0, y: 0, trauma: 0 });
  });
});
