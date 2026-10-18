import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const sharp=createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH??'sharp');
const art=JSON.parse(await readFile('src/game/tomb-bamboo-complete-frames.json'));

const frames=art.characters.flatMap(a=>a.frames);
const records=[];
for(const [key,url] of Object.entries(art.textures)){
 const bytes=await readFile('public'+url),{data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const unique=[...new Map(frames.filter(f=>f.texture===key).map(f=>[[f.x,f.y,f.width,f.height].join('/'),f])).values()];
 if(!unique.length)throw Error(key+': unused atlas');
 let checked=0;
 for(const f of unique){
  if(f.x<0||f.y<0||f.x+f.width>info.width||f.y+f.height>info.height)throw Error(key+': cut outside atlas');
  if(Math.min(f.bounds.left,f.bounds.top,f.width-f.bounds.right,f.height-f.bounds.bottom)<32)throw Error(key+': padding below 32');
  let ink=0;
  for(let y=0;y<f.height;y++)for(let x=0;x<f.width;x++){
   const alpha=data[((f.y+y)*info.width+f.x+x)*4+3];
   if(!alpha)continue;
   if(x<f.bounds.left||x>=f.bounds.right||y<f.bounds.top||y>=f.bounds.bottom)throw Error(key+'/'+f.name+': neighboring pixels outside declared silhouette');
   ink++;
  }
  if(ink<1000)throw Error(key+': empty or suspiciously small figure');
  checked+=ink;
 }
 records.push({texture:key,url,width:info.width,height:info.height,physicalCells:unique.length,inkPixels:checked,sha256:createHash('sha256').update(bytes).digest('hex'),paddingTransparent:true});
}
const report={date:'2026-10-18',textures:records.length,logicalSpecialFrames:870,physicalCells:records.reduce((n,r)=>n+r.physicalCells,0),minimumTransparentPadding:32,failures:[],records};
await writeFile('docs/verification/tomb-bamboo-complete-v3/atlas-audit.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,records:undefined}));
