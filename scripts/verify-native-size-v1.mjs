import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const sharp=createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH??'sharp');
const json=async p=>JSON.parse(await readFile(p,'utf8'));
const report=await json('docs/source/native-size-v1/export-review.json');
const names=['snow-family','zhuge-family','three-special','three-complete'];
const frames=(await Promise.all(names.map(n=>json(`src/game/${n}-frames.json`)))).flatMap(b=>b.characters.flatMap(a=>a.frames));
const records=[];
for(const r of report.reports){
 const bytes=await readFile('public'+r.url),{data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const sha256=createHash('sha256').update(bytes).digest('hex');
 if(sha256!==r.sha256)throw Error('Atlas changed after export '+r.texture);
 const cells=[...new Map(frames.filter(f=>f.texture===r.texture).map(f=>[[f.x,f.y].join('/'),f])).values()];
 if(cells.length!==r.frames)throw Error('Missing/extra packed cells '+r.texture);
 for(const f of cells){
  if(f.x+f.width>info.width||f.y+f.height>info.height)throw Error('Cut outside texture');
  if(Math.min(f.bounds.left,f.bounds.top,f.width-f.bounds.right,f.height-f.bounds.bottom)<32)throw Error('Padding too small');
  if(f.footX<f.bounds.left||f.footX>f.bounds.right||f.footY<f.bounds.top||f.footY>f.bounds.bottom)throw Error('Anchor outside figure');
  let pixels=0;
  for(let y=0;y<f.height;y++)for(let x=0;x<f.width;x++){
   const alpha=data[((f.y+y)*info.width+f.x+x)*4+3];
   if(!alpha)continue;
   if(x<f.bounds.left||x>=f.bounds.right||y<f.bounds.top||y>=f.bounds.bottom)throw Error('Adjacent pixels/alpha spill '+r.texture+'/'+f.name);
   pixels++;
  }
  if(pixels<1000)throw Error('Empty source cell');
 }
 records.push({texture:r.texture,physicalCells:cells.length,width:info.width,height:info.height,sha256,transparentPadding:true});
}
const summary={date:'2026-10-19',atlases:records.length,physicalFrames:records.reduce((n,r)=>n+r.physicalCells,0),logicalReferences:report.logicalFrames,minimumPadding:32,failures:[],records};
await writeFile('docs/verification/native-size-review-v1/atlas-audit.json',JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({...summary,records:undefined}));
