import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { figureExtractor } from '../src/game/motion-layout.ts';
import { nativeSourceCell } from './native-source-cell.mjs';
const sharp = createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH || 'sharp');
const root = 'docs/source/desert-special-v1';
const results = [];
for (const file of (await readdir(root)).filter(f => /^(asar|naya|balta|arkan)-(front|front-right|right|rear-right|back)-(dash|stance|ring|combo|slam|sweep)\.png$/.test(f)).sort()) {
 const {data,info} = await sharp(await readFile(`${root}/${file}`)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const extract = figureExtractor(data, info.width, info.height);
 const poses = Array.from({length:6}, (_,index) => {
  const cell = nativeSourceCell({columns:2,rows:3,index},info.width,info.height);
  const f = extract(cell);
  const bounds = [f.left,f.top,f.right,f.bottom];
  return {index,bounds,area:f.area,componentId:f.id,outerMargin:Math.min(f.left,f.top,info.width-f.right,info.height-f.bottom),cellMargins:[f.left-cell.left,f.top-cell.top,cell.right-f.right,cell.bottom-f.bottom]};
 });
 results.push({file,width:info.width,height:info.height,poses,flags:poses.filter(p=>p.outerMargin<8 || Math.min(...p.cellMargins)<8).map(p=>p.index)});
}
await writeFile(`${root}/source-audit.json`,JSON.stringify({note:'Geometric alpha audit only; not an anatomy, skull-size or motion approval.',sources:results},null,2)+'\n');
console.log(JSON.stringify({sources:results.length,flagged:results.filter(r=>r.flags.length).map(({file,flags,poses})=>({file,flags,details:poses.filter(p=>flags.includes(p.index))}))},null,2));
