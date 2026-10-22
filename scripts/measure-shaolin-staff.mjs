import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const sharp = createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH ?? 'sharp');
const atlas = JSON.parse(await readFile('src/game/shaolin-staff-frames.json','utf8'));
const sheets = new Map();
const records = [];
for (const frame of atlas.frames) {
  if (!sheets.has(frame.source)) sheets.set(frame.source, await sharp('docs/source/shaolin-staff-v1/'+frame.source).ensureAlpha().raw().toBuffer({resolveWithObject:true}));
  const {data,info} = sheets.get(frame.source), b=frame.sourceBounds;
  const seen = new Uint8Array(info.width*info.height), queue = new Uint32Array(info.width*info.height);
  const skin = p => { const i=p*4; return data[i+3]>=128 && data[i]>180 && data[i+1]>95 && data[i]>data[i+1]+20 && data[i+1]>data[i+2]+10; };
  let head={area:0,left:0,top:0,right:0,bottom:0};
  for(let y=b.top;y<b.bottom;y++)for(let x=b.left;x<b.right;x++) {
    const p=y*info.width+x;if(seen[p] || !skin(p))continue;
    queue[0]=p;seen[p]=1;let read=0,end=1,l=x,r=x,t=y,bot=y;
    while(read<end) {
      const q=queue[read++],qx=q%info.width,qy=Math.floor(q/info.width);
      l=Math.min(l,qx);r=Math.max(r,qx);t=Math.min(t,qy);bot=Math.max(bot,qy);
      for(const n of [q-1,q+1,q-info.width,q+info.width]) if(n>=0&&n<seen.length&&!seen[n]&&skin(n)) {seen[n]=1;queue[end++]=n;}
    }
    if(end>head.area) head={area:end,left:l,top:t,right:r,bottom:bot};
  }
  records.push({frame:frame.name,texture:frame.texture,source:frame.source,head,headSpan:head.right-head.left+1,sourceScale:atlas.pixelScale});
}
const living=records.filter(r=>!r.frame.endsWith('locomotion-5'));
const report={method:'largest connected warm skin component, source-space inspection only; no scale fitting',records,
  livingHeadSpan:{min:Math.min(...living.map(r=>r.headSpan)),max:Math.max(...living.map(r=>r.headSpan))}};
await writeFile('docs/source/shaolin-staff-v1/anatomy-review.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report.livingHeadSpan));
