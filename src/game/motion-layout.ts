export type MotionCell = { left: number; top: number; right: number; bottom: number };

/** Follow the selected body beyond an approximate cell boundary. Cache global
 * components so a raised weapon/boot is recovered once, without flood-filling
 * the whole sheet for every animation frame. Members use global pixel indices. */
export function figureExtractor(
  pixels: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
) {
  const labels = new Uint32Array(width * height),
    queue = new Uint32Array(width * height);
  const figures = new Map<
    number,
    {
      left: number;
      top: number;
      right: number;
      bottom: number;
      area: number;
      members: Uint32Array;
      id: number;
    }
  >();
  return (cell: MotionCell) => {
    const seed = figureBounds(pixels, width, cell);
    const first = seed.members[0];
    const at =
      (cell.top + Math.floor(first / seed.cellWidth)) * width +
      cell.left +
      (first % seed.cellWidth);
    const confined = () => ({
      ...seed,
      id: -at - 1,
      members: Uint32Array.from(
        seed.members,
        (p) =>
          (cell.top + Math.floor(p / seed.cellWidth)) * width + cell.left + (p % seed.cellWidth),
      ),
    });
    if (labels[at]) {
      const cached = figures.get(labels[at])!;
      return cached.area > seed.area * 1.6 ? confined() : cached;
    }
    const id = figures.size + 1;
    labels[at] = id;
    queue[0] = at;
    let read = 0,
      end = 1,
      left = width,
      top = height,
      right = 0,
      bottom = 0;
    while (read < end) {
      const p = queue[read++],
        x = p % width,
        y = Math.floor(p / width);
      left = Math.min(left, x);
      right = Math.max(right, x + 1);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y + 1);
      // Keep traversal order, without allocating a neighbour array per pixel.
      let n = p - 1;
      if (x && !labels[n] && pixels[n * 4 + 3] >= 128) {
        labels[n] = id;
        queue[end++] = n;
      }
      n = p + 1;
      if (x + 1 < width && !labels[n] && pixels[n * 4 + 3] >= 128) {
        labels[n] = id;
        queue[end++] = n;
      }
      n = p - width;
      if (y && !labels[n] && pixels[n * 4 + 3] >= 128) {
        labels[n] = id;
        queue[end++] = n;
      }
      n = p + width;
      if (y + 1 < height && !labels[n] && pixels[n * 4 + 3] >= 128) {
        labels[n] = id;
        queue[end++] = n;
      }
    }
    const result = {
      id,
      left: Math.max(0, left - 1),
      top: Math.max(0, top - 1),
      right: Math.min(width, right + 1),
      bottom: Math.min(height, bottom + 1),
      area: end,
      members: queue.slice(0, end),
    };
    figures.set(id, result);
    return result.area > seed.area * 1.6 ? confined() : result;
  };
}

/** Find the transparent seams of each row rather than assuming generated cells are equal. */
export function motionLayout(
  pixels: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  rows: number,
  columnCount = 6,
) {
  function seam(expected: number, span: number, score: (at: number) => number, limit: number) {
    let best = Math.round(expected),
      cost = Infinity;
    for (
      let at = Math.max(1, Math.round(expected - span));
      at < Math.min(limit - 1, expected + span);
      at++
    ) {
      const value = score(at) + (Math.abs(at - expected) / span) * 0.15;
      if (value < cost) {
        best = at;
        cost = value;
      }
    }
    return best;
  }
  const rowHeight = height / rows,
    colWidth = width / columnCount;
  const rowEdges = [0];
  for (let row = 1; row < rows; row++)
    rowEdges.push(
      seam(
        row * rowHeight,
        rowHeight * 0.3,
        (y) => {
          let count = 0;
          for (let x = 0; x < width; x++) if (pixels[(y * width + x) * 4 + 3] >= 128) count++;
          return count;
        },
        height,
      ),
    );
  rowEdges.push(height);
  const cells: MotionCell[] = [];
  for (let row = 0; row < rows; row++) {
    const top = rowEdges[row],
      bottom = rowEdges[row + 1],
      columns = [0];
    const opacity = new Float64Array(width);
    // Read contiguous scanlines rather than repeatedly striding an entire image.
    for (let y = top; y < bottom; y++)
      for (let x = 1, at = (y * width + 1) * 4 + 3; x < width - 1; x++, at += 4)
        if (pixels[at] >= 128) opacity[x]++;
    // Choose the seams jointly so a narrow figure cannot be skipped for a wider corpse.
    const parents: Int32Array[] = [];
    let previous = new Float64Array(width).fill(Infinity);
    previous[0] = 0;
    const separation = Math.round(colWidth * 0.52);
    for (let col = 1; col < columnCount; col++) {
      const current = new Float64Array(width).fill(Infinity),
        parent = new Int32Array(width).fill(-1);
      let best = Infinity,
        bestAt = -1,
        cursor = 0;
      for (let x = 1; x < width - 1; x++) {
        while (cursor <= x - separation) {
          if (previous[cursor] < best) {
            best = previous[cursor];
            bestAt = cursor;
          }
          cursor++;
        }
        if (Math.abs(x - col * colWidth) > colWidth * 0.65 || bestAt < 0) continue;
        current[x] = best + opacity[x] + (Math.abs(x - col * colWidth) / colWidth) * 0.15;
        parent[x] = bestAt;
      }
      parents.push(parent);
      previous = current;
    }
    let at = previous.indexOf(Math.min(...previous));
    const chosen: number[] = [];
    for (let col = columnCount - 2; col >= 0; col--) {
      chosen.unshift(at);
      at = parents[col][at];
    }
    columns.push(...chosen);
    columns.push(width);
    for (let col = 0; col < columnCount; col++) {
      const left = columns[col],
        right = columns[col + 1];
      const localOpacity = (y: number) => {
        let count = 0;
        for (let x = left; x < right; x++) if (pixels[(y * width + x) * 4 + 3] >= 128) count++;
        return count;
      };
      // One tall boot or raised hand must not force the same row cut on all
      // directions. Calibrate each column's transparent gap independently.
      cells.push({
        left,
        right,
        top: row === 0 ? 0 : seam(top, rowHeight * 0.24, localOpacity, height),
        bottom: row === rows - 1 ? height : seam(bottom, rowHeight * 0.24, localOpacity, height),
      });
    }
  }
  return cells;
}

/** Ignore isolated neighbouring weapon tips and speckles; select the connected figure. */
export function figureBounds(
  pixels: Uint8ClampedArray | Uint8Array,
  width: number,
  cell: MotionCell,
) {
  const { left, top, right, bottom } = cell;
  const w = right - left,
    h = bottom - top;
  const seen = new Uint8Array(w * h),
    queue = new Int32Array(w * h);
  let largest = {
    left: right,
    top: bottom,
    right: left,
    bottom: top,
    area: 0,
    members: new Int32Array(),
  };
  for (let start = 0; start < seen.length; start++) {
    const px = left + (start % w),
      py = top + Math.floor(start / w);
    if (seen[start] || pixels[(py * width + px) * 4 + 3] < 128) continue;
    queue[0] = start;
    seen[start] = 1;
    let read = 0,
      end = 1,
      x1 = right,
      y1 = bottom,
      x2 = left,
      y2 = top;
    while (read < end) {
      const at = queue[read++],
        x = at % w,
        y = Math.floor(at / w);
      x1 = Math.min(x1, left + x);
      x2 = Math.max(x2, left + x);
      y1 = Math.min(y1, top + y);
      y2 = Math.max(y2, top + y);
      const pixel = (top + y) * width + left + x;
      let n = at - 1;
      if (x > 0 && !seen[n] && pixels[(pixel - 1) * 4 + 3] >= 128) {
        seen[n] = 1;
        queue[end++] = n;
      }
      n = at + 1;
      if (x + 1 < w && !seen[n] && pixels[(pixel + 1) * 4 + 3] >= 128) {
        seen[n] = 1;
        queue[end++] = n;
      }
      n = at - w;
      if (y > 0 && !seen[n] && pixels[(pixel - width) * 4 + 3] >= 128) {
        seen[n] = 1;
        queue[end++] = n;
      }
      n = at + w;
      if (y + 1 < h && !seen[n] && pixels[(pixel + width) * 4 + 3] >= 128) {
        seen[n] = 1;
        queue[end++] = n;
      }
    }
    if (end > largest.area)
      largest = {
        left: Math.max(left, x1 - 1),
        top: Math.max(top, y1 - 1),
        right: Math.min(right, x2 + 2),
        bottom: Math.min(bottom, y2 + 2),
        area: end,
        members: queue.slice(0, end),
      };
  }
  if (largest.area < 64) throw new Error('Enemy motion sheet is missing a figure');
  return { ...largest, cellWidth: w };
}

/** Copy exactly the connected figure plus its one-pixel antialias border.
 * ImageData buffers are aligned RGBA bytes: copying a 32-bit pixel preserves
 * every channel, including hidden RGB, without four writes per neighbour. */
export function copyFigurePixels(
  pixels: Uint8ClampedArray,
  output: Uint8ClampedArray,
  sourceWidth: number,
  outputWidth: number,
  cell: MotionCell,
  packX: number,
  packY: number,
  members: Uint32Array,
) {
  const source = new Uint32Array(pixels.buffer, pixels.byteOffset, pixels.length / 4);
  const target = new Uint32Array(output.buffer, output.byteOffset, output.length / 4);
  for (const member of members) {
    const px = member % sourceWidth,
      py = Math.floor(member / sourceWidth);
    const left = Math.max(cell.left, px - 1),
      right = Math.min(cell.right, px + 2);
    const top = Math.max(cell.top, py - 1),
      bottom = Math.min(cell.bottom, py + 2);
    for (let y = top; y < bottom; y++) {
      let src = y * sourceWidth + left;
      let dest = (packY + y - cell.top) * outputWidth + packX + left - cell.left;
      for (let x = left; x < right; x++) target[dest++] = source[src++];
    }
  }
}
