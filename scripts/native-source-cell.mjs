/** Offline selection only: a reviewed wide drawing may straddle a nominal grid cell. */
export function nativeSourceCell(layout, width, height) {
  let rectangle = layout.rectangle;
  if (!rectangle) {
    const { columns, rows, index } = layout;
    if (
      ![columns, rows, index].every(Number.isInteger) ||
      columns < 1 ||
      rows < 1 ||
      index < 0 ||
      index >= columns * rows
    )
      throw Error('Invalid native source grid');
    const c = index % columns,
      r = Math.floor(index / columns);
    rectangle = [
      Math.floor((c * width) / columns),
      Math.floor((r * height) / rows),
      Math.floor(((c + 1) * width) / columns),
      Math.floor(((r + 1) * height) / rows),
    ];
  }
  if (!Array.isArray(rectangle) || rectangle.length !== 4 || !rectangle.every(Number.isInteger))
    throw Error('Invalid native source rectangle');
  const [left, top, right, bottom] = rectangle;
  if (left < 0 || top < 0 || right > width || bottom > height || right <= left || bottom <= top)
    throw Error('Native source rectangle outside image');
  return { left, top, right, bottom };
}
