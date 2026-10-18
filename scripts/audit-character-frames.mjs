import { createRequire } from 'node:module';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { figureBounds, figureExtractor, motionLayout } from '../src/game/motion-layout.ts';
const sharp = createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH ?? 'sharp');
const sheets = [
  { path: 'public/art/delivery-v1/hero-unarmed-v1.webp', rows: 5, cols: 8 },
  { path: 'public/art/delivery-v1/enemy-atlas-v1.webp', rows: 4, cols: 3 },
  { path: 'public/art/enemy-role-directions-v2.png', rows: 4, cols: 5 },
  { path: 'public/art/enemy-role-actions-v1.png', rows: 4, cols: 6 },
  { path: 'public/art/cavalry-actions-v1.png', rows: 1, cols: 6 },
];
for (let region = 0; region < 10; region++) {
  sheets.push({ path: `public/art/direction-v2/${region}-directions.webp`, rows: 7, cols: 5 });
  sheets.push({ path: `public/art/enemy-motion-v1/${region}-motion${[0, 2, 4, 9].includes(region) ? '-v2' : ''}.webp`, rows: 7, cols: 6 });
  if ([2, 4, 9].includes(region)) sheets.push({ path: `public/art/enemy-motion-v1/${region}-repair.webp`, rows: region === 4 ? 2 : 1, cols: 6 });
}
const results = [];
for (const sheet of sheets) {
  const { data, info } = await sharp(sheet.path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const cells = motionLayout(data, info.width, info.height, sheet.rows, sheet.cols);
  const extract = figureExtractor(data, info.width, info.height);
  const frames = cells.map((cell, index) => {
    const f = figureBounds(data, info.width, cell), complete = extract(cell);
    let opaque = 0;
    for (let y = cell.top; y < cell.bottom; y++) for (let x = cell.left; x < cell.right; x++)
      if (data[(y * info.width + x) * 4 + 3] >= 128) opaque++;
    const edgePixels = Array.from(f.members).filter(at => {
      const x = at % f.cellWidth, y = Math.floor(at / f.cellWidth);
      const px = cell.left+x, py = cell.top+y;
      return [[-1,0],[1,0],[0,-1],[0,1]].some(([dx,dy]) => {
        const nx=px+dx, ny=py+dy;
        return nx>=0 && nx<info.width && ny>=0 && ny<info.height &&
          (nx<cell.left || nx>=cell.right || ny<cell.top || ny>=cell.bottom) && data[(ny*info.width+nx)*4+3]>=128;
      });
    }).length;
    return { row: Math.floor(index / sheet.cols), col: index % sheet.cols,
      recoveredPixels: complete.area-f.area, component: complete.id, completeBounds: [complete.left, complete.top, complete.right, complete.bottom], cell, bounds: [f.left, f.top, f.right, f.bottom], area: f.area,
      outsideMainFigure: opaque - f.area,
      edgePixels, touchesBoundary: edgePixels > 0 };
  });
  results.push({ ...sheet, width: info.width, height: info.height, frames });
}
// Horse crops are authored separately; audit their actual runtime crop bounds.
const horse = JSON.parse(await readFile('src/platform/cavalry-frames.json', 'utf8'));
const { data, info } = await sharp('public/art/regional-identity-v1/cavalry.webp').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
results.push({ path: 'public/art/regional-identity-v1/cavalry.webp', frames: horse.map(([x,y,w,h], col) => {
  const f = figureBounds(data, info.width, { left: x, top: y, right: x+w, bottom: y+h });
  return { col, area: f.area, bounds: [f.left, f.top, f.right, f.bottom] };
}) });
await mkdir('docs/verification/character-frames-v4', { recursive: true });
await writeFile('docs/verification/character-frames-v4/source-audit.json', JSON.stringify(results, null, 2));
console.log(JSON.stringify({ sheets: results.length, frames: results.reduce((n,r)=>n+r.frames.length,0), recovered: results.flatMap(s=>s.frames).filter(f=>f.recoveredPixels>0).length, duplicates: results.flatMap(s=>s.frames.filter((f,i,a)=>f.component && a.findIndex(g=>g.component===f.component)!==i).map(f=>({path:s.path,row:f.row,col:f.col}))) }));

