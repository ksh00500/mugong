import { describe, expect, it } from 'vitest';
import { STRIKE_TIMING } from '../src/domain/combat';
import { WEAPON_STYLES } from '../src/domain/items';
import { heroAttackMotion, heroCutWeight, HERO_STROKE_HALF } from '../src/game/hero-attack-motion';
import { weaponAngle } from '../src/game/weapon-grips';
import { heroSlashGrip, heroSlashFlip, heroSlashRow } from '../src/game/hero-slash';
import { bladeSmear } from '../src/game/blade-smear';
import { bladeProjection, bladeTorsoRig } from '../src/game/blade-motion';

describe('player cut timing and direction', () => {
  it('crosses the aim at actual damage contact for all styles and eight directions', () => {
    const atHit = heroAttackMotion(STRIKE_TIMING.contact);
    expect(atHit.action).toBe('strike');
    expect(atHit.progress).toBeCloseTo(0.5);
    for (const style of WEAPON_STYLES)
      for (let d = 0; d < 8; d++) {
        const facing = (d * Math.PI) / 4;
        const angle = weaponAngle(style, facing, atHit.action, atHit.progress);
        expect(Math.atan2(Math.sin(angle - facing), Math.cos(angle - facing))).toBeCloseTo(0);
      }
  });
  it('does a fast downward cut on both side views instead of an uppercut', () => {
    for (const style of ['sword', 'dao'] as const)
      for (const facing of [0, Math.PI]) {
        const a = weaponAngle(style, facing, 'strike', 0),
          b = weaponAngle(style, facing, 'strike', 1);
        expect(Math.sin(a)).toBeLessThan(0);
        expect(Math.sin(b)).toBeGreaterThan(0);
      }
  });
  it('keeps the prepared blade ABOVE the wrist in every direction, including north', () => {
    for (const style of ['sword', 'dao'] as const)
      for (let d = 0; d < 8; d++) {
        const facing = (d * Math.PI) / 4;
        for (let i = 0; i <= 60; i++) {
          const ready = bladeProjection(facing, 'windup', i / 60);
          expect(ready.y).toBeLessThan(-0.6);
          expect(Math.abs(weaponAngle(style, facing, 'windup', i / 60) - ready.angle)).toBeLessThan(
            1e-8,
          );
        }
      }
    expect(heroSlashRow('strike', 0.1)).toBe(0);
    expect(heroSlashRow('strike', 0.5)).toBe(1);
    expect(heroSlashRow('strike', 0.8)).toBe(2);
    expect(heroSlashRow('strike', 0.8, false)).toBe(1);
  });
  it('foreshortens depth-facing blades instead of swinging a full-length sword upwards', () => {
    expect(bladeProjection(0, 'strike', 0.5).lengthScale).toBeCloseTo(1);
    expect(bladeProjection(Math.PI / 2, 'strike', 0.5).lengthScale).toBeCloseTo(0.38);
    expect(bladeProjection(-Math.PI / 2, 'strike', 0.5).lengthScale).toBeCloseTo(0.38);
    for (let d = 0; d < 8; d++)
      for (const action of ['windup', 'strike', 'recover'] as const)
        for (let i = 0; i <= 120; i++) {
          const v = bladeProjection((d * Math.PI) / 4, action, i / 120);
          expect(v.lengthScale).toBeGreaterThanOrEqual(0.18);
          expect(v.lengthScale).toBeLessThanOrEqual(1);
          expect(Math.hypot(v.x, v.y)).toBeCloseTo(v.lengthScale);
        }
  });
  it('lowers the blade during recovery without another upward swing', () => {
    for (let d = 0; d < 360; d++)
      expect(bladeProjection((d * Math.PI) / 180, 'strike', 1).y).toBeGreaterThan(0.1);
    for (let d = 0; d < 8; d++) {
      let last = bladeProjection((d * Math.PI) / 4, 'recover', 0).y;
      for (let i = 1; i <= 120; i++) {
        const next = bladeProjection((d * Math.PI) / 4, 'recover', i / 120).y;
        expect(next + 1e-6).toBeGreaterThanOrEqual(last);
        last = next;
      }
    }
  });
  it('turns and lowers the torso through the cut without lifting the attacking fist', () => {
    expect(bladeTorsoRig('strike', 0).twist).toBeLessThan(0);
    expect(bladeTorsoRig('strike', 1).twist).toBeGreaterThan(0);
    for (let i = 0; i <= 60; i++)
      expect(bladeTorsoRig('strike', i / 60).handLift).toBeLessThanOrEqual(0);
    expect(bladeTorsoRig('recover', 1)).toEqual({ twist: 0, lean: -0, crouch: 0, handLift: 0 });
  });
  it('keeps body weight continuous across contact even without a hit cue', () => {
    for (const boundary of [0, 0.04, 0.09, 0.14, 0.28]) {
      const a = heroCutWeight(boundary - 1e-8),
        b = heroCutWeight(boundary + 1e-8);
      expect(Math.abs(a.lunge - b.lunge)).toBeLessThan(1e-5);
      expect(Math.abs(a.turn - b.turn)).toBeLessThan(1e-5);
    }
    expect(heroCutWeight(0.09).lunge).toBe(6);
    expect(heroCutWeight(0.28)).toEqual({ lunge: 0, turn: 0 });
  });
  it('draws a small blade-length smear only during cuts, respecting reduced motion', () => {
    const hand = { x: 100, y: 150 };
    for (let d = 0; d < 8; d++)
      for (const style of ['sword', 'dao'] as const) {
        const ribbons = bladeSmear(style, (d * Math.PI) / 4, 'strike', 0.5, hand, 45, 0.03);
        expect(ribbons).toHaveLength(6);
        for (const ribbon of ribbons)
          for (const point of ribbon.points)
            expect(Math.hypot(point.x - hand.x, point.y - hand.y)).toBeLessThanOrEqual(45.00001);
        expect(bladeSmear(style, 0, 'strike', 0.5, hand, 45, 0, true)).toEqual([]);
        for (const action of ['idle', 'windup', 'recover', 'hurt', 'death'] as const)
          expect(bladeSmear(style, 0, action, 0.5, hand, 45, 0)).toEqual([]);
      }
    for (const style of ['staff', 'fan', 'dart', 'gauntlet'] as const)
      expect(bladeSmear(style, 0, 'strike', 0.5, hand, 45, 0)).toEqual([]);
  });
  it('owns no gameplay clock and clamps render samples at the phase boundaries', () => {
    expect(heroAttackMotion(-1)).toEqual({ action: 'windup', progress: 0 });
    expect(heroAttackMotion(1)).toEqual({ action: 'recover', progress: 1 });
    for (const boundary of [
      STRIKE_TIMING.contact - HERO_STROKE_HALF,
      STRIKE_TIMING.contact + HERO_STROKE_HALF,
    ]) {
      const left = heroAttackMotion(boundary - 1e-8),
        right = heroAttackMotion(boundary + 1e-8);
      for (const style of WEAPON_STYLES) {
        const a = weaponAngle(style, 0.7, left.action, left.progress),
          b = weaponAngle(style, 0.7, right.action, right.progress);
        expect(Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)))).toBeLessThan(1e-5);
      }
    }
  });
  it('has reviewed grips and mirrored rear views for all 150 new poses', () => {
    for (let i = 0; i < 10; i++)
      for (let row = 0; row < 3; row++) {
        for (let view = 0; view < 5; view++)
          for (const uv of heroSlashGrip(i, row, view)) {
            expect(uv).toBeGreaterThan(0);
            expect(uv).toBeLessThan(1);
          }
        expect(heroSlashFlip(i, row, 5)).not.toBe(heroSlashFlip(i, row, 7));
      }
    expect(() => heroSlashGrip(10, 0, 0)).toThrow('Unreviewed');
  });
});
