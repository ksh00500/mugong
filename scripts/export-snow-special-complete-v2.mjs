import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {figureExtractor,copyFigurePixels} from '../src/game/motion-layout.ts';
import {nativeSourceCell} from './native-source-cell.mjs';
const sharp=createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH??'sharp');
const root='docs/source/snow-special-complete-v2',out='public/art/snow-special-complete-v2';
await mkdir(out,{recursive:true});
const json=async p=>JSON.parse(await readFile(p,'utf8'));
const save=async(p,v)=>writeFile(p,JSON.stringify(v,null,2)+'\n');
const base=await json('src/game/snow-family-frames.json'),old=await json('src/game/snow-special-frames.json');
const jobs=await json(root+'/generation-jobs.json'),contacts=await json(root+'/contact-jobs.json');
let overrides={};try{overrides=await json(root+'/ground-corrections.json')}catch{}
const textures={},bank=new Map(),report=[];
function boot(f,data,w){
 // Export-time proposal only. Persist/review these points on grounded plates.
 const xs=[];for(const p of f.members){const y=Math.floor(p/w);if(y>=f.bottom-10)xs.push(p%w)}
 xs.sort((a,b)=>a-b);return [xs[Math.floor(xs.length/2)]??(f.left+f.right)/2,f.bottom-2];
}
async function figures(file,columns,rows){
 const bytes=await readFile(file),{data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const extract=figureExtractor(data,info.width,info.height),result=[];
 for(let n=0;n<columns*rows;n++){
  const f=extract(nativeSourceCell({columns,rows,index:n},info.width,info.height));
  if(f.id<0||f.left<=0||f.top<=0||f.right>=info.width||f.bottom>=info.height)throw Error(file+'/'+n+': ambiguous or canvas-clipped');
  const width=f.right-f.left,height=f.bottom-f.top,pixels=new Uint8ClampedArray(width*height*4);
  copyFigurePixels(data,pixels,info.width,width,f,0,0,f.members);
  const point=overrides[file]?.[n]??boot(f,data,info.width);
  result.push({image:await sharp(Buffer.from(pixels.buffer),{raw:{width,height,channels:4}}).png().toBuffer(),width,height,footX:point[0]-f.left,footY:point[1]-f.top,source:file,sourceCell:{columns,rows,index:n},sourceBounds:{left:f.left,top:f.top,right:f.right,bottom:f.bottom},component:f.id,sourceBoot:point});
 }
 if(new Set(result.map(f=>f.component)).size!==columns*rows)throw Error(file+': connected neighboring figures');
 return {result,sha256:createHash('sha256').update(bytes).digest('hex')};
}
async function pack(key,raw,factor){
 const poses=[];
 for(const f of raw){const width=Math.round(f.width*factor),height=Math.round(f.height*factor);poses.push({...f,width,height,footX:Math.round(f.footX*factor),footY:Math.round(f.footY*factor),image:await sharp(f.image).resize(width,height,{kernel:'lanczos3'}).png().toBuffer()})}
 const cw=Math.ceil((Math.max(...poses.map(f=>f.width))+64)/32)*32,ch=Math.ceil((Math.max(...poses.map(f=>f.height))+64)/32)*32;
 await sharp({create:{width:cw*3,height:ch*Math.ceil(poses.length/3),channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(poses.map((f,n)=>({input:f.image,left:n%3*cw+32,top:Math.floor(n/3)*ch+32}))).webp({lossless:true}).toFile(`${out}/${key}.webp`);
 textures[key]=`/art/snow-special-complete-v2/${key}.webp`;
 return poses.map(({image,component,...f},n)=>({...f,texture:key,x:n%3*cw,y:Math.floor(n/3)*ch,width:cw,height:ch,footX:f.footX+32,footY:f.footY+32,bounds:{left:32,top:32,right:32+f.width,bottom:32+f.height},normalizationFactor:factor}));
}
for(const j of jobs){
 const a=base.characters.find(a=>a.id===j.character),ready=a.frames.find(f=>f.kind==='locomotion'&&f.pose===0&&f.view===j.view);
 const grid=j.id==='hanxue-front'?[4,3]:[3,4];
 const {result,sha256}=await figures(`${root}/${j.source}`,...grid);
 const heights=[0,5,6,11].map(n=>result[n].height).sort((a,b)=>a-b),factor=(ready.bounds.bottom-ready.bounds.top)/((heights[1]+heights[2])/2);
 const frames=await pack('snow-complete-'+j.id,result,factor);
 for(let n=0;n<12;n++)bank.set(`${j.character}/${j.view}/${j.moves[Math.floor(n/6)]}/${n%6}`,frames[n]);
 report.push({id:j.id,sha256,grid,factor,referenceHeight:ready.bounds.bottom-ready.bounds.top,sourceBoots:result.map(f=>f.sourceBoot),bounds:result.map(f=>f.sourceBounds)});
}
for(const j of contacts){
 const a=base.characters.find(a=>a.id===j.character),ready=a.frames.find(f=>f.kind==='locomotion'&&f.pose===0&&f.view===0);
 const {result,sha256}=await figures(`${root}/${j.source}`,2,3),factor=(ready.bounds.bottom-ready.bounds.top)/result[5].height;
 const frames=await pack('snow-complete-'+j.id,result.slice(0,5),factor);
 frames.forEach((f,v)=>bank.set(`${j.id}/${v}`,f));
 report.push({id:j.id,sha256,factor,sourceBoots:result.map(f=>f.sourceBoot),bounds:result.map(f=>f.sourceBounds)});
}
const B=['b0','b1','b2','b3','b0','l0'];
const S=m=>['l0',`s:${m}:1`,`s:${m}:2`,`s:${m}:3`,`s:${m}:4`,'l0'];
const K=(id,stages=B)=>[stages[0],stages[1],'k:'+id,'k:'+id,stages[4],stages[5]];
const change=(c,p,s)=>c.map((v,n)=>n===p?s:v);
const plan={
 mokjin:{thrust:[B],sweep:[K('mokjin-sweep')],combo:[B,S('dash')]},
 xuelan:{hazard:[S('hazard')],stance:[change(S('stance'),4,'l0')],fan:[S('hazard')],thrust:[S('hazard')]},
 baixue:{stance:[S('stance')],dash:[S('dash')],combo:[S('dash'),K('baixue-left',['l0','l0','l0','l0','l0','l0'])],slam:[K('baixue-stomp',['l0','l1','l0','l0','l0','l0'])]},
 hanxue:{fan:[S('fan')],stance:[S('stance')],hazard:[S('stance')],sweep:[change(S('fan'),2,'s:fan:3')],combo:[S('fan'),['l0','s:fan:4','s:fan:3','s:fan:2','s:fan:4','l0']]},
};
const characters=[];
for(const [id,moves]of Object.entries(plan)){
 const a=base.characters.find(a=>a.id===id),prior=old.characters.find(a=>a.id===id),frames=[];
 for(const [move,cycles]of Object.entries(moves))for(let view=0;view<5;view++)for(const [cycle,stages]of cycles.entries())for(const [pose,source]of stages.entries()){
  let f;
  if(source.startsWith('k:'))f=bank.get(`${source.slice(2)}/${view}`);
  else if(source.startsWith('s:')){const[,m,p]=source.split(':');f=bank.get(`${id}/${view}/${m}/${p}`)??prior?.frames.find(f=>f.view===view&&f.move===m&&f.pose===+p)}
  else f=a.frames.find(f=>f.view===view&&f.kind===(source[0]==='b'?'combat':'locomotion')&&f.pose===+source.slice(1));
  if(!f)throw Error(`${id}/${move}/${view}/${cycle}/${pose}: missing ${source}`);
  frames.push({...f,name:`${view}-${move}-cycle-${cycle}-${pose}`,view,kind:'special',move,pose,cycle,sourceFrame:f.name??`${id}/${view}/${source}`,choreographySource:source});
 }
 characters.push({id,bossId:`3-${Object.keys(plan).indexOf(id)+1}`,slot:a.slot,family:'snow',pixelScale:.225,moves:Object.keys(moves),cycles:Object.fromEntries(Object.entries(moves).map(([m,c])=>[m,c.length])),cell:{padding:32},healthClearance:Math.max(a.healthClearance,...frames.map(f=>(f.footY-f.bounds.top)*.225+16)),frames});
}
const art={version:2,sourceWideNormalization:true,textures,characters};
await save('src/game/snow-special-complete-frames.json',art);await save(out+'/frames.json',art);
await save(root+'/export-review.json',{date:'2026-10-18',report,plan,newActions:16,newLogicalFrames:characters.reduce((n,c)=>n+c.frames.length,0),notes:'READY is reused from basic frames; source-wide aspect preserving calibration, never per-pose fitting. Core source banks and distinct contacts share explicit six-stage cycles. Existing Mokjin dash/slam remain installed separately.'});
console.log(JSON.stringify({bosses:4,newActions:16,newLogicalFrames:characters.reduce((n,c)=>n+c.frames.length,0),textures:Object.keys(textures).length}));
