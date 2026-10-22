import { describe, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import { CombatFeedback } from '../src/game/feedback';

describe('combat feedback during camera teardown', () => {
  it('restores the unshaken scroll once, including repeated cleanup', () => {
    const camera = {
      scrollX: 103,
      scrollY: 198,
      zoom: 1,
      setScroll: vi.fn(function (this: { scrollX: number; scrollY: number }, x: number, y: number) {
        this.scrollX = x;
        this.scrollY = y;
      }),
      shakeEffect: { reset: vi.fn() },
    };
    const feedback = new CombatFeedback({ cameras: { main: camera } } as unknown as Phaser.Scene);
    feedback.cameraOffset = { x: 3, y: -2 };
    feedback.reset();
    feedback.reset();
    expect([camera.scrollX, camera.scrollY]).toEqual([100, 200]);
    expect(feedback.cameraOffset).toEqual({ x: 0, y: 0 });
  });

  it.each([{ cameras: { main: undefined } }, { cameras: undefined }])(
    'clears local feedback after Phaser has already released the camera: %j',
    (scene) => {
      const feedback = new CombatFeedback(scene as unknown as Phaser.Scene);
      feedback.cameraOffset = { x: 7, y: -4 };
      feedback.contact = 20;
      expect(() => {
        feedback.reset();
        feedback.updateCamera(21, false);
        feedback.reset();
      }).not.toThrow();
      expect(feedback.cameraOffset).toEqual({ x: 0, y: 0 });
      expect(feedback.contact).toBe(-100);
    },
  );
});
