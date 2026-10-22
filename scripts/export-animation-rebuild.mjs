import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { motionLayout, figureExtractor } from '../src/game/motion-layout.ts';

// Delivery packing only; generated originals are retained unchanged.
const sharp = createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH ?? 'sharp');
const collection = process.env.MUGONG_ANIMATION_COLLECTION ?? 'animation-rebuild-v2';
if (!/^[a-z0-9-]+$/.test(collection)) throw new Error('Invalid art collection');
const root = `docs/source/${collection}`;
const deliveryRoot = `public/art/${collection}`;
await mkdir(root, { recursive: true });
await mkdir(deliveryRoot, { recursive: true });
const jobs = JSON.parse(await readFile(`${root}/manifest.json`, 'utf8'));
const reports = [];
for (const job of jobs) {
  const original = `${root}/${job.id}.png`;
  if (job.source !== original) await copyFile(job.source, original);
  const { data, info } = await sharp(original).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let clear = 0, partial = 0;
  for (let at = 3; at < data.length; at += 4) {
    if (data[at] < 5) clear++;
    else if (data[at] <= 128) partial++;
  }
  const transparency = {clear:clear/(info.width*info.height),partial:partial/(info.width*info.height)};
  // A broad translucent matte can connect different figures and corrupt cuts.
  // Reject it for a new imagegen correction; do not silently threshold artwork.
  if (transparency.clear < 0.15 || transparency.partial > 0.12)
    throw new Error(`${job.id}: background matte requires visual correction ${JSON.stringify(transparency)}`);
  const cells = motionLayout(data, info.width, info.height, job.rows, job.cols);
  const extract = figureExtractor(data, info.width, info.height);
  const figures = cells.map(extract);
  if (figures.some(f => f.area < 50)) throw new Error(`${job.id}: empty pose`);
  if (new Set(figures.map(f => f.id)).size !== figures.length) throw new Error(`${job.id}: shared figure across cells`);
  const pixels = figures.map(f => {
    const width = f.right-f.left, height=f.bottom-f.top;
    const isolated = Buffer.alloc(width*height*4);
    for (const at of f.members) {
      const x=at%info.width, y=Math.floor(at/info.width);
      for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++) {
        const sx=x+dx,sy=y+dy;
        if(sx<f.left||sx>=f.right||sy<f.top||sy>=f.bottom) continue;
        data.copy(isolated, ((sy-f.top)*width+sx-f.left)*4, (sy*info.width+sx)*4, (sy*info.width+sx)*4+4);
      }
    }
    return {pixels:isolated,width,height};
  });
  const tile=256, layers=[];
  for(let i=0;i<pixels.length;i++) {
    const p=pixels[i], scale=Math.min(220/p.width,220/p.height);
    const width=Math.max(1,Math.round(p.width*scale)),height=Math.max(1,Math.round(p.height*scale));
    const input=await sharp(p.pixels,{raw:{width:p.width,height:p.height,channels:4}}).resize(width,height).png().toBuffer();
    layers.push({input,left:(i%job.cols)*tile+Math.floor((tile-width)/2),top:Math.floor(i/job.cols)*tile+Math.floor((tile-height)/2)});
  }
  const delivery=`${deliveryRoot}/${job.id}.webp`;
  // Hero hand anchors are authored in the source cells; retain those coordinates.
  const output=job.id === 'hero'
    ? await sharp(original).webp({quality:90,alphaQuality:100}).toFile(delivery)
    : await sharp({create:{width:job.cols*tile,height:job.rows*tile,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(layers).webp({quality:90,alphaQuality:100}).toFile(delivery);
  const hash = async path => createHash('sha256').update(await readFile(path)).digest('hex');
  reports.push({id:job.id,original,delivery,rows:job.rows,cols:job.cols,frames:figures.length,bytes:output.size,review:job.review??'pending',transparency,sourceHash:await hash(original),deliveryHash:await hash(delivery),sourceBounds:figures.map(f=>[f.left,f.top,f.right,f.bottom])});
}
await writeFile(`${root}/export-report.json`,JSON.stringify(reports,null,2)+'\n');
console.log(JSON.stringify(reports.map(({id,frames,bytes,review})=>({id,frames,bytes,review}))));
