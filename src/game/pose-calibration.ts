import type { MotionCell } from './motion-layout';

/** Ignore thin shafts and bright blade tips below the boots when anchoring a
 * standing pose. Bounds still include the whole weapon. */
export function groundAnchor(
  pixels: Uint8Array | Uint8ClampedArray,
  width: number,
  cell: MotionCell,
) {
  const w = cell.right - cell.left,
    h = cell.bottom - cell.top,
    minRun = Math.max(5, Math.round(w * 0.045));
  for (let y = cell.bottom - 1; y > cell.top + h * 0.58; y--) {
    const runs: { left: number; right: number }[] = [];
    let start = -1;
    for (let x = cell.left; x <= cell.right; x++) {
      const at = (y * width + x) * 4;
      const solid =
        x < cell.right &&
        pixels[at + 3] >= 200 &&
        Math.max(pixels[at], pixels[at + 1], pixels[at + 2]) < 165;
      if (solid && start < 0) start = x;
      if (!solid && start >= 0) {
        if (x - start >= minRun) runs.push({ left: start, right: x });
        start = -1;
      }
    }
    if (runs.length) {
      const weight = runs.reduce((n, r) => n + r.right - r.left, 0);
      const x =
        runs.reduce((n, r) => n + ((r.left + r.right) / 2) * (r.right - r.left), 0) / weight;
      return { x: (x - cell.left) / w, y: (y + 1 - cell.top) / h };
    }
  }
  return { x: 0.5, y: 1 };
}

/** Estimate the exposed face, not the weapon/hat bounding box. Only used to
 * normalize drawings of the same character; masked/rear views use fallback. */
export function faceUnit(pixels: Uint8Array | Uint8ClampedArray, width: number, cell: MotionCell) {
  const w = cell.right - cell.left,
    h = cell.bottom - cell.top;
  const visited = new Uint8Array(w * h),
    queue = new Uint32Array(w * h);
  const skin = (x: number, y: number) => {
    const at = ((cell.top + y) * width + cell.left + x) * 4;
    const r = pixels[at],
      g = pixels[at + 1],
      b = pixels[at + 2];
    return pixels[at + 3] > 180 && r > 95 && g > 60 && r > g + 3 && g > b + 3 && r - b < 110;
  };
  let best = 0;
  for (let y = 0; y < h * 0.62; y++)
    for (let x = 0; x < w; x++) {
      const first = y * w + x;
      if (visited[first] || !skin(x, y)) continue;
      let read = 0,
        end = 1;
      queue[0] = first;
      visited[first] = 1;
      while (read < end) {
        const at = queue[read++],
          px = at % w,
          py = Math.floor(at / w);
        for (const [dx, dy] of [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ]) {
          const nx = px + dx,
            ny = py + dy,
            n = ny * w + nx;
          if (nx < 0 || nx >= w || ny < 0 || ny >= h * 0.62 || visited[n] || !skin(nx, ny))
            continue;
          visited[n] = 1;
          queue[end++] = n;
        }
      }
      best = Math.max(best, end);
    }
  return best >= 20 ? Math.sqrt(best) : 0;
}

export function poseReferenceHeight(baseHeight: number, baseFace: number, currentFace: number) {
  if (!baseFace || !currentFace) return baseHeight;
  return baseHeight * Math.max(0.82, Math.min(1.22, currentFace / baseFace));
}

/** Match the authored anatomical unit across independently authored sheets.
 * Character plates use reviewed skull spans; effect/prop plates may use mass. */
export function matchedPoseHeight(
  actionHeight: number,
  actionUnit: number,
  directionHeight: number,
  directionUnit: number,
) {
  return actionUnit > 0 && directionUnit > 0
    ? (directionHeight * actionUnit) / directionUnit
    : actionHeight;
}

/** Opaque silhouette mass is orientation-independent: a fallen body has the
 * same scale as a standing body. Exclude translucent shadows and effects. */
export function silhouetteUnit(
  pixels: Uint8Array | Uint8ClampedArray,
  width: number,
  cell: MotionCell,
) {
  let area = 0;
  for (let y = cell.top; y < cell.bottom; y++)
    for (let x = cell.left; x < cell.right; x++) {
      const alpha = pixels[(y * width + x) * 4 + 3];
      if (alpha >= 200) area += alpha / 255;
    }
  return Math.sqrt(area);
}
