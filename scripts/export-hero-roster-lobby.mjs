import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
import { motionLayout, figureExtractor } from '../src/game/motion-layout.ts';

// Isolate existing cutouts for delivery; never redraw or overwrite originals.
const sharp=createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH??'sharp');
const {data,info}=await sharp('docs/source/hero-roster-v1/lobby.png').ensureAlpha().raw().toBuffer({resolveWithObject:true});
const figures=motionLayout(data,info.width,info.height,2,5).map(figureExtractor(data,info.width,info.height));
if(new Set(figures.map(f=>f.id)).size!==10)throw new Error('Lobby figures overlap');
const report=[];
for(let id=0;id<10;id++) {
  const f=figures[id],width=f.right-f.left,height=f.bottom-f.top;
  const pixels=Buffer.alloc(width*height*4);
  for(const at of f.members) {
    const x=at%info.width,y=Math.floor(at/info.width);
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++) {
      const sx=x+dx,sy=y+dy;
      if(sx<f.left||sx>=f.right||sy<f.top||sy>=f.bottom)continue;
      data.copy(pixels,((sy-f.top)*width+sx-f.left)*4,(sy*info.width+sx)*4,(sy*info.width+sx)*4+4);
    }
  }
  await sharp(pixels,{raw:{width,height,channels:4}}).webp({quality:94,alphaQuality:100}).toFile(`public/art/hero-roster-v1/lobby-${id}.webp`);
  report.push({id,width,height,bounds:[f.left,f.top,f.right,f.bottom],area:f.area});
}
await writeFile('docs/source/hero-roster-v1/lobby-export-report.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
