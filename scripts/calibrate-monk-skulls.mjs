import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { motionLayout, figureExtractor } from '../src/game/motion-layout.ts';
import { groundAnchor } from '../src/game/pose-calibration.ts';
const sharp = createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH ?? 'sharp');
const old = JSON.parse(await readFile('src/platform/anatomical-landmarks.json', 'utf8'));
const standingCalibration = JSON.parse(
  await readFile('src/platform/monk-skull-landmarks.json', 'utf8'),
);
const measurements = [],
  plates = {};
// Bald monks: locate the exposed scalp so standing height excludes a raised
// staff or halo. Do not apply this detector to hair, hats or masks.
function skull(pixels, width, bounds, prone, roi) {
  const w = bounds.right - bounds.left,
    h = bounds.bottom - bounds.top;
  const limit = prone ? h : Math.ceil(h * 0.46),
    seen = new Set();
  const skin = (x, y) => {
    if (roi && (x < w * roi[0] || x > w * roi[2] || y < h * roi[1] || y > h * roi[3])) return false;
    const at = ((bounds.top + y) * width + bounds.left + x) * 4;
    const [r, g, b, a] = pixels.subarray(at, at + 4);
    return a > 180 && r > 150 && g > 100 && b > 70 && r - g > 8 && g - b > 8 && r - b < 140;
  };
  const components = [];
  for (let y = 0; y < limit; y++)
    for (let x = 0; x < w; x++) {
      const key = y * w + x;
      if (seen.has(key) || !skin(x, y)) continue;
      const queue = [[x, y]],
        rows = new Map();
      seen.add(key);
      for (let i = 0; i < queue.length; i++) {
        const [px, py] = queue[i];
        const xs = rows.get(py) ?? [];
        xs.push(px);
        rows.set(py, xs);
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const nx = px + dx,
            ny = py + dy,
            n = ny * w + nx;
          if (nx < 0 || nx >= w || ny < 0 || ny >= limit || seen.has(n) || !skin(nx, ny)) continue;
          seen.add(n);
          queue.push([nx, ny]);
        }
      }
      if (queue.length > 30) {
        const top = Math.min(...rows.keys());
        const spans = [...rows.entries()]
          .filter(([y]) => prone || y < top + h * 0.12)
          .map(([, xs]) => xs)
          .map((xs) => Math.max(...xs) - Math.min(...xs) + 1)
          .sort((a, b) => a - b);
        components.push({
          area: queue.length,
          span: spans[Math.floor((spans.length - 1) * 0.9)],
          top,
          left: Math.min(...queue.map((p) => p[0])),
          right: Math.max(...queue.map((p) => p[0])),
        });
      }
    }
  const plausible = components.filter((c) => c.span >= 15 && c.area >= 60);
  plausible.sort((a, b) => (prone ? b.area - a.area : a.top - b.top || b.area - a.area));
  if (!plausible.length) throw Error('No skull found');
  return plausible[0];
}
for (const [path, rows, cols, selected] of [
  ['/art/hostile-consistency-v3/region-4-directions.webp', 7, 5, [0, 1, 2, 3, 4, 5, 6]],
  ['/art/animation-rebuild-v2/region-4.webp', 7, 6, [0, 1, 2, 3, 4, 5, 6]],
  ['/art/hostile-consistency-v3/region-4-rear.webp', 7, 4, [0, 1, 2, 3, 4, 5, 6]],
  ['/art/hostile-consistency-v3/identity-directions.webp', 3, 5, [1, 2]],
  ['/art/animation-rebuild-v2/identity.webp', 3, 6, [1, 2]],
  ['/art/hostile-consistency-v3/identity-rear.webp', 3, 4, [1, 2]],
]) {
  const { data, info } = await sharp('public' + path)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const cells = motionLayout(data, info.width, info.height, rows, cols),
    extract = figureExtractor(data, info.width, info.height);
  const plate = {
    ...old[path],
    units: { ...(standingCalibration[path]?.units ?? old[path].units) },
    skulls: {},
  };
  for (const row of selected)
    for (let col = 0; col < cols; col++) {
      const frame = `${row}-${col}`,
        bounds = extract(cells[row * cols + col]);
      let head;
      const rois = {
        '/art/hostile-consistency-v3/region-4-directions.webp': {
          '4-3': [0.25, 0, 0.7, 0.18],
          '4-4': [0.2, 0, 0.65, 0.19],
        },
        '/art/animation-rebuild-v2/region-4.webp': {
          '4-0': [0.53, 0, 0.8, 0.14],
          '4-1': [0.53, 0, 0.8, 0.14],
          '4-4': [0.53, 0, 0.78, 0.16],
        },
        '/art/hostile-consistency-v3/region-4-rear.webp': { '2-1': [0.15, 0.08, 0.75, 0.42] },
        '/art/hostile-consistency-v3/identity-rear.webp': {
          '1-1': [0.2, 0.08, 0.7, 0.4],
          '1-3': [0.2, 0.08, 0.7, 0.4],
        },
      };
      try {
        head = skull(data, info.width, bounds, cols === 6 && col === 5, rois[path]?.[frame]);
      } catch (error) {
        throw new Error(`${path}/${frame}: ${error.message}`);
      }
      // Pale scalp shadows overlap the exposed shoulder palette in this row.
      // Reviewed scalp contours in head-detail.png, measured in source pixels.
      if (path === '/art/animation-rebuild-v2/region-4.webp') {
        const contours = { '4-0': [120, 170], '4-1': [123, 173], '4-4': [119, 167] };
        const contour = contours[frame];
        if (contour)
          head = {
            ...head,
            left: contour[0],
            right: contour[1],
            span: contour[1] - contour[0] + 1,
            reviewedContour: true,
          };
      }
      const anchor = groundAnchor(data, info.width, bounds);
      const standingHeight = (bounds.bottom - bounds.top) * anchor.y - head.top;
      // Stature is reported independently from the physical scalp span.
      const standing = cols === 5 || (cols === 6 && col < 2);
      // Stature units and physical skull spans are different references.
      // Preserve the walking correction; attach a separate combat reference.
      plate.skulls[frame] = head.span;
      measurements.push({
        path,
        frame,
        height: bounds.bottom - bounds.top,
        oldUnit: old[path].units[frame],
        unit: plate.units[frame],
        standingHeight,
        standing,
        skull: head,
        bounds: { left: bounds.left, top: bounds.top, right: bounds.right, bottom: bounds.bottom },
      });
    }
  plates[path] = plate;
}
await mkdir('docs/verification/monk-scale-v2', { recursive: true });
await writeFile('src/platform/monk-skull-landmarks.json', JSON.stringify(plates, null, 2) + '\n');
await writeFile(
  'docs/verification/monk-scale-v2/source-measurements.json',
  JSON.stringify(measurements, null, 2) + '\n',
);
console.log(
  JSON.stringify(
    measurements.filter(
      (m) => m.frame.startsWith('0-') || (m.path.includes('identity') && m.frame.startsWith('1-')),
    ),
    null,
    2,
  ),
);
