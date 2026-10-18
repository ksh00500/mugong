import type Phaser from 'phaser';
import { silhouetteUnit } from './pose-calibration';
import { copyFigurePixels, figureExtractor, motionLayout, type MotionCell } from './motion-layout';
import { anatomicalUnit } from './anatomical-calibration';

export type CharacterFrame = MotionCell & {
  width: number;
  height: number;
  footY: number;
  bodyUnit: number;
  scaleCorrection: number;
  nominalX: number;
  nominalY: number;
  nominalWidth: number;
  nominalHeight: number;
};

/** Preserve authored hand coordinates while excluding neighbouring figures.
 * The originals remain unchanged; the runtime texture contains one connected
 * character per calibrated cell, including its antialiased edge. */
export function registerCharacterSheet(
  texture: Phaser.Textures.Texture,
  rows: number,
  cols: number,
) {
  const source = texture.source[0],
    canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(source.image as HTMLImageElement, 0, 0);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const cells = motionLayout(pixels, canvas.width, canvas.height, rows, cols);
  const extract = figureExtractor(pixels, canvas.width, canvas.height);
  const figures = cells.map((cell) => extract(cell));
  const expanded = cells.map((cell, i) => ({
    left: Math.min(cell.left, figures[i].left),
    top: Math.min(cell.top, figures[i].top),
    right: Math.max(cell.right, figures[i].right),
    bottom: Math.max(cell.bottom, figures[i].bottom),
  }));
  const tileWidth = Math.max(...expanded.map((c) => c.right - c.left)) + 4;
  const tileHeight = Math.max(...expanded.map((c) => c.bottom - c.top)) + 4;
  const packed = document.createElement('canvas');
  packed.width = tileWidth * cols;
  packed.height = tileHeight * rows;
  const out = packed.getContext('2d')!,
    cleaned = out.createImageData(packed.width, packed.height);
  const frames = new Map<string, CharacterFrame>();
  const definitions: { name: string; cell: MotionCell; x: number; y: number }[] = [];
  for (const [index, cell] of expanded.entries()) {
    const bounds = figures[index],
      row = Math.floor(index / cols),
      col = index % cols;
    const packX = col * tileWidth + 2,
      packY = row * tileHeight + 2;
    copyFigurePixels(
      pixels,
      cleaned.data,
      canvas.width,
      packed.width,
      cell,
      packX,
      packY,
      bounds.members,
    );
    const name = `${row}-${col}`;
    frames.set(name, {
      ...cell,
      bodyUnit:
        anatomicalUnit(source.image, canvas.width, canvas.height, `${row}-${col}`) ??
        silhouetteUnit(pixels, canvas.width, bounds),
      scaleCorrection: 1,
      width: cell.right - cell.left,
      height: cell.bottom - cell.top,
      footY: (bounds.bottom - cell.top) / (cell.bottom - cell.top),
      nominalX: (col * canvas.width) / cols,
      nominalY: (row * canvas.height) / rows,
      nominalWidth: canvas.width / cols,
      nominalHeight: canvas.height / rows,
    });
    definitions.push({ name, cell, x: packX, y: packY });
  }
  for (const [name, frame] of frames) {
    const direction = name.split('-')[1];
    const idle = frames.get(`0-${direction}`)!;
    frame.scaleCorrection = frame.bodyUnit > 0 ? idle.bodyUnit / frame.bodyUnit : 1;
  }
  out.putImageData(cleaned, 0, 0);
  const isolatedKey = `${texture.key}-isolated`,
    output = texture.manager.addCanvas(isolatedKey, packed)!;
  for (const { name, cell, x, y } of definitions)
    output.add(name, 0, x, y, cell.right - cell.left, cell.bottom - cell.top);
  return { key: isolatedKey, frames };
}
