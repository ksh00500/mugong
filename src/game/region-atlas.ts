import type Phaser from 'phaser';

/** Trim transparent gutters at runtime, preserving generated originals and aspect ratio. */
export function registerRegionAtlas(texture: Phaser.Textures.Texture) {
  const source = texture.source[0];
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const context = canvas.getContext('2d', { willReadFrequently: true })!;
  context.drawImage(source.image as HTMLImageElement, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const frames = new Map<number, { footX: number; width: number; height: number }>();
  for (let slot = 0; slot < 7; slot++) {
    const left = Math.round(((slot % 4) * source.width) / 4) + 8;
    const cellRight = Math.round((((slot % 4) + 1) * source.width) / 4);
    const top = Math.round((Math.floor(slot / 4) * source.height) / 2) + 8;
    const bottom = Math.round(((Math.floor(slot / 4) + 1) * source.height) / 2) - 8;
    // Some generated sheets contain a fine separator in the otherwise empty last cell.
    // Keep it outside the displayed frame, while allowing a wide last boss's weapon.
    let border = 0;
    if (slot === 6)
      for (let x = cellRight - 8; x <= cellRight + 8; x++) {
        let opaque = 0;
        for (let y = top; y < bottom; y++)
          if (pixels[(y * source.width + x) * 4 + 3] >= 220) opaque++;
        border = Math.max(border, opaque);
      }
    const right = slot === 6 && border < (bottom - top) * 0.6 ? source.width - 8 : cellRight - 8;
    let x1 = right,
      y1 = bottom,
      x2 = left,
      y2 = top;
    for (let y = top; y < bottom; y++)
      for (let x = left; x < right; x++) {
        if (pixels[(y * source.width + x) * 4 + 3] < 220) continue;
        x1 = Math.min(x1, x);
        y1 = Math.min(y1, y);
        x2 = Math.max(x2, x);
        y2 = Math.max(y2, y);
      }
    if (x2 <= x1 || y2 <= y1) continue;
    x1 = Math.max(left, x1 - 2);
    y1 = Math.max(top, y1 - 2);
    x2 = Math.min(right - 1, x2 + 2);
    y2 = Math.min(bottom - 1, y2 + 2);
    let sum = 0,
      count = 0;
    for (let y = Math.max(y1, y2 - Math.round((y2 - y1) * 0.06)); y <= y2; y++)
      for (let x = x1; x <= x2; x++)
        if (pixels[(y * source.width + x) * 4 + 3] >= 220) {
          sum += x;
          count++;
        }
    texture.add(String(slot), 0, x1, y1, x2 - x1 + 1, y2 - y1 + 1);
    frames.set(slot, {
      footX: count ? (sum / count - x1) / (x2 - x1 + 1) : 0.5,
      width: x2 - x1 + 1,
      height: y2 - y1 + 1,
    });
  }
  return frames;
}
