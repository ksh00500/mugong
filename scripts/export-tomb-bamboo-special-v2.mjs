import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {figureExtractor,copyFigurePixels} from '../src/game/motion-layout.ts';
import {nativeSourceCell} from './native-source-cell.mjs';
const sharp=createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH??'sharp');
const root='docs/source/tomb-bamboo-special-v2',out='public/art/tomb-bamboo-special-v2';
await mkdir(out,{recursive:true});
const json=async p=>JSON.parse(await readFile(p,'utf8')),save=async(p,v)=>writeFile(p,JSON.stringify(v,null,2)+'\n');
const jobs=await json(root+'/generation-jobs.json'),bases={};
for(const family of ['tomb','bamboo'])bases[family]=await json(`src/game/${family}-family-frames.json`);
let review={};try{review=await json(root+'/selection.json')}catch{}
const textures={},characters=[],reports=[];
for(const id of [...new Set(jobs.map(j=>j.character))]){
 const group=jobs.filter(j=>j.character===id),j0=group[0],base=bases[j0.family].characters.find(a=>a.id===id),frames=[];
 for(const job of group){
  const sel=review[job.id]??{},file=sel.source??root+'/'+job.source,grid=sel.grid??[3,4];
  try{await access(file)}catch{if(process.argv.includes('--partial'))continue;throw Error('Missing '+file)}
  const bytes=await readFile(file),{data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const extract=figureExtractor(data,info.width,info.height),raw=[];
  for(let n=0;n<12;n++){
   const f=extract(nativeSourceCell({columns:grid[0],rows:grid[1],index:n},info.width,info.height));
   if(f.id<0||f.left<=0||f.top<=0||f.right>=info.width||f.bottom>=info.height)throw Error(job.id+'/'+n+': connected/clipped figure');
   const width=f.right-f.left,height=f.bottom-f.top,pixels=new Uint8ClampedArray(width*height*4);
   copyFigurePixels(data,pixels,info.width,width,f,0,0,f.members);
   const low=Array.from(f.members).filter(p=>Math.floor(p/info.width)>=f.bottom-10).map(p=>p%info.width).sort((a,b)=>a-b);
   const foot=sel.boots?.[n]??[low[Math.floor(low.length/2)]??(f.left+f.right)/2,f.bottom-2];
   raw.push({image:await sharp(Buffer.from(pixels.buffer),{raw:{width,height,channels:4}}).png().toBuffer(),width,height,footX:foot[0]-f.left,footY:foot[1]-f.top,sourceBoot:foot,source:file,sourceCell:{columns:grid[0],rows:grid[1],index:n},sourceBounds:{left:f.left,top:f.top,right:f.right,bottom:f.bottom},component:f.id});
  }
  if(new Set(raw.map(f=>f.component)).size!==12)throw Error(job.id+': neighboring figures overlap');
  const originalReadyHeights=[0,5,6,11].map(n=>raw[n].height).sort((a,b)=>a-b),originalReadyHeight=(originalReadyHeights[1]+originalReadyHeights[2])/2;
  for(const [index,replacement]of Object.entries(sel.replacements??{})){
   const n=Number(index),rb=await readFile(replacement.source),decoded=await sharp(rb).ensureAlpha().raw().toBuffer({resolveWithObject:true}),ri=decoded.info,rd=decoded.data,rg=replacement.grid??[3,4],rx=figureExtractor(rd,ri.width,ri.height),f=rx(nativeSourceCell({columns:rg[0],rows:rg[1],index:replacement.index},ri.width,ri.height));
   if(f.id<0||f.left<=0||f.top<=0||f.right>=ri.width||f.bottom>=ri.height)throw Error(job.id+'/'+n+': clipped replacement');
   const nativeWidth=f.right-f.left,nativeHeight=f.bottom-f.top,pixels=new Uint8ClampedArray(nativeWidth*nativeHeight*4);copyFigurePixels(rd,pixels,ri.width,nativeWidth,f,0,0,f.members);
   const reference=rx(nativeSourceCell({columns:rg[0],rows:rg[1],index:replacement.calibrationPose??0},ri.width,ri.height)),calibration=replacement.calibrateToReady?originalReadyHeight/(reference.bottom-reference.top):1;
   const low=Array.from(f.members).filter(p=>Math.floor(p/ri.width)>=f.bottom-10).map(p=>p%ri.width).sort((a,b)=>a-b),foot=sel.boots?.[n]??[low[Math.floor(low.length/2)],f.bottom-2];
   const width=Math.round(nativeWidth*calibration),height=Math.round(nativeHeight*calibration);
   raw[n]={image:await sharp(Buffer.from(pixels.buffer),{raw:{width:nativeWidth,height:nativeHeight,channels:4}}).resize(width,height).png().toBuffer(),width,height,footX:(foot[0]-f.left)*calibration,footY:(foot[1]-f.top)*calibration,sourceBoot:foot,source:replacement.source,sourceSha256:createHash('sha256').update(rb).digest('hex'),sourceCalibration:calibration,sourceCell:{columns:rg[0],rows:rg[1],index:replacement.index},sourceBounds:{left:f.left,top:f.top,right:f.right,bottom:f.bottom},component:f.id};
  }
  const ready=base.frames.find(f=>f.view===job.view&&f.kind==='locomotion'&&f.pose===0),heights=[0,5,6,11].map(n=>raw[n].height).sort((a,b)=>a-b);
  const factor=(ready.bounds.bottom-ready.bounds.top)/((heights[1]+heights[2])/2),poses=[];
  for(const f of raw){const width=Math.round(f.width*factor),height=Math.round(f.height*factor);poses.push({...f,width,height,footX:Math.round(f.footX*factor),footY:Math.round(f.footY*factor),image:await sharp(f.image).resize(width,height,{kernel:'lanczos3'}).png().toBuffer()})}
  const cw=Math.ceil((Math.max(...poses.map(f=>f.width))+64)/32)*32,ch=Math.ceil((Math.max(...poses.map(f=>f.height))+64)/32)*32,key='tomb-bamboo-'+job.id;
  await sharp({create:{width:cw*3,height:ch*4,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(poses.map((f,n)=>({input:f.image,left:n%3*cw+32,top:Math.floor(n/3)*ch+32}))).webp({lossless:true}).toFile(out+'/'+key+'.webp');
  textures[key]=`/art/tomb-bamboo-special-v2/${key}.webp`;
  for(const [m,move]of job.moves.entries())for(let pose=0;pose<6;pose++){
   const index=sel.stages?.[move]?.[pose]??m*6+pose,f=poses[index];
   const name=`${job.view}-${move}-cycle-0-${pose}`;
   if(pose===0||pose===5){frames.push({...ready,name,kind:'special',move,pose,cycle:0,sourceFrame:ready.name,provenance:'basic-ready-reuse'});continue}
   const {image,component,...p}=f;
   frames.push({...p,name,view:job.view,kind:'special',move,pose,cycle:0,sourcePose:index,texture:key,x:index%3*cw,y:Math.floor(index/3)*ch,width:cw,height:ch,footX:f.footX+32,footY:f.footY+32,bounds:{left:32,top:32,right:32+f.width,bottom:32+f.height},normalizationFactor:factor,provenance:'new-special-motion'});
  }
  reports.push({id:job.id,source:file,sha256:createHash('sha256').update(bytes).digest('hex'),grid,factor,referenceReady:ready.name,referenceHeight:ready.bounds.bottom-ready.bounds.top,boots:raw.map(f=>f.sourceBoot),bounds:raw.map(f=>f.sourceBounds),replacements:sel.replacements??null,stages:sel.stages??null});
 }
 if(frames.length)characters.push({id,bossId:j0.bossId,family:j0.family,slot:base.slot,moves:j0.moves,pixelScale:.225,cell:{padding:32},healthClearance:Math.max(base.healthClearance,...frames.map(f=>(f.footY-f.bounds.top)*.225+16)),frames});
}
const result={version:2,sourceWideNormalization:true,textures,characters};
await save('src/game/tomb-bamboo-special-frames.json',result);await save(out+'/frames.json',result);await save(root+'/export-review.json',{date:'2026-10-18',reports,bosses:characters.length,actions:characters.reduce((n,c)=>n+c.moves.length,0),logicalFrames:characters.reduce((n,c)=>n+c.frames.length,0),note:'Two selected special actions per boss. Other kit moves keep basic artwork. READY reused; one aspect-preserving calibration per source sheet, fixed runtime .225. Boot proposals require visual review, selection.json persists corrections.'});
console.log(JSON.stringify({bosses:characters.length,logicalFrames:characters.reduce((n,c)=>n+c.frames.length,0),textures:Object.keys(textures).length}));
