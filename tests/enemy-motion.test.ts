import { describe, it, expect } from 'vitest';
import { enemyPose } from '../src/game/enemy-motion';
import {
  copyFigurePixels,
  figureBounds,
  figureExtractor,
  motionLayout,
} from '../src/game/motion-layout';

describe('enemy animation follows combat state', () => {
  it('uses anticipation before contact, then attack, then the original idle pose', () => {
    expect(enemyPose('windup', 0, 0, 100, false, false)).toBe(2);
    expect(enemyPose('strike', 0, 0, 100, false, false)).toBe(3);
    expect(enemyPose('recover', 0, 0, 100, false, false)).toBeNull();
  });
  it('prioritizes death over impact and resumes the underlying state after a short hit reaction', () => {
    expect(enemyPose('windup', 0, 0, 0.05, false, false)).toBe(4);
    expect(enemyPose('windup', 0, 0, 0.12, false, false)).toBe(2);
    expect(enemyPose('strike', 0, 0, 0.01, true, false)).toBe(5);
  });
  it('stops the walk loop with reduced motion but preserves meaningful state changes', () => {
    expect(enemyPose('approach', 0, 0, 100, false, false)).toBe(0);
    expect(enemyPose('approach', 0.13, 0, 100, false, false)).toBe(1);
    expect(enemyPose('approach', 0.13, 0, 100, false, true)).toBe(0);
    expect(enemyPose('strike', 0.13, 0, 100, false, true)).toBe(3);
    expect(enemyPose('recover', 0.13, 0, 0.05, false, true)).toBe(4);
  });
});

describe('generated motion sheet boundaries', () => {
  it('packs connected pixels and their antialias border without copying unrelated figures', () => {
    const source = Uint8ClampedArray.from({ length: 8 * 8 * 4 }, (_, i) => (i * 13) % 256);
    // Transparent edge pixels must retain their hidden RGB too.
    source[(1 * 8 + 1) * 4 + 3] = 0;
    source[(2 * 8 + 1) * 4 + 3] = 73;
    const output = new Uint8ClampedArray(new ArrayBuffer(10 * 10 * 4 + 8), 8);
    output.fill(17);
    copyFigurePixels(
      source,
      output,
      8,
      10,
      { left: 1, top: 1, right: 6, bottom: 6 },
      3,
      2,
      Uint32Array.of(2 * 8 + 2, 2 * 8 + 3, 3 * 8 + 2),
    );
    const selected = new Set([
      '1,1',
      '2,1',
      '3,1',
      '4,1',
      '1,2',
      '2,2',
      '3,2',
      '4,2',
      '1,3',
      '2,3',
      '3,3',
      '4,3',
      '1,4',
      '2,4',
      '3,4',
    ]);
    for (let y = 0; y < 10; y++)
      for (let x = 0; x < 10; x++) {
        const sx = x - 2,
          sy = y - 1;
        const expected = selected.has(`${sx},${sy}`)
          ? source.slice((sy * 8 + sx) * 4, (sy * 8 + sx + 1) * 4)
          : Uint8ClampedArray.of(17, 17, 17, 17);
        expect(output.slice((y * 10 + x) * 4, (y * 10 + x + 1) * 4)).toEqual(expected);
      }
  });
  it('clips the border to its source cell and leaves adjacent packed frames untouched', () => {
    const source = new Uint8ClampedArray(4 * 4 * 4).fill(191);
    const output = new Uint8ClampedArray(6 * 6 * 4);
    copyFigurePixels(
      source,
      output,
      4,
      6,
      { left: 2, top: 2, right: 4, bottom: 4 },
      1,
      1,
      Uint32Array.of(2 * 4 + 2, 3 * 4 + 3),
    );
    for (let y = 0; y < 6; y++)
      for (let x = 0; x < 6; x++)
        expect(output[(y * 6 + x) * 4]).toBe(x >= 1 && x <= 2 && y >= 1 && y <= 2 ? 191 : 0);
  });
  it('recovers connected boots beyond a crop without collecting another pose', () => {
    const width = 60,
      pixels = new Uint8ClampedArray(width * 60 * 4);
    for (let y = 10; y < 45; y++)
      for (let x = 10; x < 35; x++) pixels[(y * width + x) * 4 + 3] = 255;
    for (let y = 0; y < 5; y++) for (let x = 10; x < 35; x++) pixels[(y * width + x) * 4 + 3] = 255;
    const extract = figureExtractor(pixels, width, 60);
    const frame = extract({ left: 0, top: 5, right: 60, bottom: 40 });
    expect(frame.bottom).toBe(46);
    expect(frame.top).toBe(9);
    expect(frame.area).toBe(875);
    expect(extract({ left: 0, top: 5, right: 60, bottom: 40 })).toEqual(frame);
  });
  it('finds figures across an uneven column instead of cutting them at equal widths', () => {
    const width = 600,
      height = 200,
      pixels = new Uint8ClampedArray(width * height * 4);
    const columns = [
      [10, 65],
      [88, 158],
      [180, 246],
      [268, 334],
      [360, 426],
      [452, 592],
    ];
    for (const top of [10, 110])
      for (const [left, right] of columns)
        for (let y = top; y < top + 65; y++)
          for (let x = left; x <= right; x++) pixels[(y * width + x) * 4 + 3] = 255;
    const cells = motionLayout(pixels, width, height, 2);
    expect(cells).toHaveLength(12);
    for (let row = 0; row < 2; row++)
      for (let col = 0; col < 6; col++) {
        const figure = figureBounds(pixels, width, cells[row * 6 + col]);
        expect(figure.left).toBeLessThanOrEqual(columns[col][0]);
        expect(figure.right).toBeGreaterThan(columns[col][1]);
        expect(figure.area).toBe((columns[col][1] - columns[col][0] + 1) * 65);
      }
  });
  it('excludes detached neighbouring fragments and rejects empty frames', () => {
    const width = 60,
      pixels = new Uint8ClampedArray(width * 60 * 4);
    for (let y = 10; y < 45; y++)
      for (let x = 10; x < 35; x++) pixels[(y * width + x) * 4 + 3] = 255;
    for (let y = 20; y < 25; y++)
      for (let x = 48; x < 52; x++) pixels[(y * width + x) * 4 + 3] = 255;
    const frame = figureBounds(pixels, width, { left: 0, top: 0, right: 60, bottom: 60 });
    expect(frame.right).toBe(36);
    expect(frame.members).toHaveLength(875);
    expect(() => figureBounds(pixels, width, { left: 40, top: 40, right: 60, bottom: 60 })).toThrow(
      'missing a figure',
    );
  });
});
