import type Phaser from 'phaser';
import { registerEnemyMotion } from './enemy-motion';
/** Alpha trims only the display frames. The generated source is kept intact. */
export function registerCavalry(texture: Phaser.Textures.Texture) {
  const frames = new Map<
    number,
    {
      width: number;
      height: number;
      footX: number;
      originY: number;
      referenceHeight: number;
      bodyUnit: number;
    }
  >();
  const directions = registerEnemyMotion(texture, [0], 5);
  for (let view = 0; view < 5; view++) {
    const frame = directions.get(`0-${view}`)!;
    texture.add(String(view), 0, frame.sourceX, frame.sourceY, frame.width, frame.height);
    frames.set(view, { ...frame, footX: view === 2 ? 0.55 : view === 3 ? 0.6 : 0.5, originY: 1 });
  }
  return frames;
}
