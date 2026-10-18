import type Phaser from 'phaser';
import { groundAnchor, silhouetteUnit } from './pose-calibration';
import type { Enemy } from '../domain/model';
import { copyFigurePixels, figureExtractor, motionLayout } from './motion-layout';
import { anatomicalUnit, anatomicalSkullUnit } from './anatomical-calibration';

export type EnemyPose = 0 | 1 | 2 | 3 | 4 | 5;

/** Poses follow simulation state; they never own the damage or recovery clocks. */
export function enemyPose(
  state: Enemy['state'],
  time: number,
  id: number,
  hitAge: number,
  dead: boolean,
  reducedMotion: boolean,
): EnemyPose | null {
  if (dead) return 5;
  if (hitAge >= 0 && hitAge < 0.12) return 4;
  if (state === 'windup') return 2;
  if (state === 'strike') return 3;
  if (state === 'approach') return reducedMotion ? 0 : ((Math.floor(time * 8 + id) % 2) as 0 | 1);
  return null;
}

export type MotionFrame = {
  texture: string;
  width: number;
  height: number;
  footX: number;
  originY: number;
  referenceHeight: number;
  bodyUnit: number;
  skullUnit?: number;
  /** Original sheet coordinates, before tight isolation/packing. */
  sourceX: number;
  sourceY: number;
};

/** Read alpha bounds without editing the sheet; use one pixel scale per character. */
export function registerEnemyMotion(
  texture: Phaser.Textures.Texture,
  slots = [0, 1, 2, 3, 4, 5, 6],
  columns = 6,
  actionSheet = columns === 6,
) {
  const source = texture.source[0];
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const context = canvas.getContext('2d', { willReadFrequently: true })!;
  context.drawImage(source.image as HTMLImageElement, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const cells = motionLayout(pixels, source.width, source.height, slots.length, columns);
  // Runtime atlas packing keeps neighbouring fragments out of the render frame.
  // Original images stay unchanged; preserve the figure's antialiased border.
  const extract = figureExtractor(pixels, source.width, source.height);
  const figures = cells.map(extract);
  const tileWidth = Math.max(...figures.map((f) => f.right - f.left)) + 4;
  const tileHeight = Math.max(...figures.map((f) => f.bottom - f.top)) + 4;
  const packed = document.createElement('canvas');
  packed.width = tileWidth * columns;
  packed.height = tileHeight * slots.length;
  const outputContext = packed.getContext('2d')!;
  const isolated = outputContext.createImageData(packed.width, packed.height);
  const frameDefinitions: { name: string; x: number; y: number; width: number; height: number }[] =
    [];
  const isolatedKey = `${texture.key}-isolated`;
  const frames = new Map<string, MotionFrame>();
  for (const [rowIndex, slot] of slots.entries()) {
    const row: MotionFrame[] = [];
    for (let pose = 0; pose < columns; pose++) {
      const cell = cells[rowIndex * columns + pose];
      const bounds = figures[rowIndex * columns + pose];
      const packX = pose * tileWidth + 2,
        packY = rowIndex * tileHeight + 2;
      copyFigurePixels(
        pixels,
        isolated.data,
        source.width,
        packed.width,
        bounds,
        packX,
        packY,
        bounds.members,
      );
      const x1 = bounds.left,
        y1 = bounds.top,
        x2 = bounds.right - 1,
        y2 = bounds.bottom - 1;
      const anchor = groundAnchor(pixels, source.width, bounds);
      const frame = {
        texture: isolatedKey,
        width: x2 - x1 + 1,
        height: y2 - y1 + 1,
        footX: actionSheet && pose === 5 ? 0.5 : anchor.x,
        originY: actionSheet && pose === 5 ? 0.7 : anchor.y,
        referenceHeight: 0,
        bodyUnit:
          anatomicalUnit(source.image, source.width, source.height, `${slot}-${pose}`) ??
          silhouetteUnit(pixels, source.width, bounds),
        skullUnit: anatomicalSkullUnit(
          source.image,
          source.width,
          source.height,
          `${slot}-${pose}`,
        ),
        sourceX: x1,
        sourceY: y1,
      };
      frameDefinitions.push({
        name: `${slot}-${pose}`,
        x: packX,
        y: packY,
        width: frame.width,
        height: frame.height,
      });
      frames.set(`${slot}-${pose}`, frame);
      row.push(frame);
    }
    // A raised weapon or a horizontal body must not resize the character itself.
    const referenceHeight = actionSheet ? (row[0].height + row[1].height) / 2 : row[0].height;
    const baseUnit = row[0].bodyUnit || 1;
    for (const frame of row)
      frame.referenceHeight = referenceHeight * (frame.bodyUnit / baseUnit || 1);
  }
  outputContext.putImageData(isolated, 0, 0);
  const output = texture.manager.addCanvas(isolatedKey, packed)!;
  for (const frame of frameDefinitions)
    output.add(frame.name, 0, frame.x, frame.y, frame.width, frame.height);
  return frames;
}
