import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {figureExtractor,copyFigurePixels} from '../src/game/motion-layout.ts';
import {nativeSourceCell} from './native-source-cell.mjs';
const sharp=createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH??'sharp');
const root='docs/source/three-complete-v3',out='public/art/three-complete-v3';
await mkdir(out,{recursive:true});
const json=async p=>JSON.parse(await readFile(p,'utf8')),save=async(p,v)=>writeFile(p,JSON.stringify(v,null,2)+'\n');
const jobs=await json(root+'/preflight.json'),fixes=await json(root+'/contact-jobs.json'),selection=await json(root+'/selection.json');
const old=await json('src/game/three-special-frames.json'),bases={};
for(const family of ['desert','hyeolma','zhuge'])bases[family]=await json(`src/game/${family}-family-frames.json`);
const bank=new Map(),textures={},report=[],byCharacter=new Map();
for(const id of jobs.map(j=>j.id))byCharacter.set(id,[]);
const median=a=>{const s=[...a].sort((a,b)=>a-b);return s[Math.floor(s.length/2)]};
async function extract(j,indices,calibration){
 const selected=selection.sources[j.id]??{},file=selected.source??root+'/'+j.source,bytes=await readFile(file),{data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 if(data[3]>2)throw Error(file+': background is not transparent');
 const get=figureExtractor(data,info.width,info.height),all=new Map();
 for(const n of new Set([...indices,...calibration])){
  const f=get(nativeSourceCell({columns:j.columns,rows:j.rows,index:n},info.width,info.height));
  if(f.id<0||f.left<=0||f.top<=0||f.right>=info.width||f.bottom>=info.height)throw Error(file+'/'+n+': ambiguous or clipped silhouette');
  all.set(n,f);
 }
 if(new Set([...all.values()].map(f=>f.id)).size!==all.size)throw Error(file+': connected neighboring figures');
 const main=jobs.find(a=>a.id===(j.character??j.id)),a=bases[main.family].characters.find(a=>a.id===main.id),baseHeights=(calibration.length===5?[0,1,2,3,4]:[0]).map(view=>{const f=a.frames.find(f=>f.view===view&&f.kind==='locomotion'&&f.pose===0);return f.bounds.bottom-f.bounds.top});
 const calibrationHeights=calibration.map(n=>{const f=all.get(n);return selected.calibrationHeight??f.bottom-f.top});
 const factor=median(baseHeights)/median(calibrationHeights),poses=[];
 for(const n of indices){
  const f=all.get(n),nw=f.right-f.left,nh=f.bottom-f.top,pixels=new Uint8ClampedArray(nw*nh*4);
  copyFigurePixels(data,pixels,info.width,nw,f,0,0,f.members);
  const low=[...f.members].filter(p=>Math.floor(p/info.width)>=f.bottom-10).map(p=>p%info.width).sort((a,b)=>a-b),point=selected.boots?.[n]??[median(low),f.bottom-2];
  const width=Math.round(nw*factor),height=Math.round(nh*factor);
  const pose={width,height,footX:Math.round((point[0]-f.left)*factor),footY:Math.round((point[1]-f.top)*factor),source:file,sourceCell:{columns:j.columns,rows:j.rows,index:n},sourceBounds:{left:f.left,top:f.top,right:f.right,bottom:f.bottom},sourceBoot:point,sourceSha256:createHash('sha256').update(bytes).digest('hex'),normalizationFactor:factor,image:await sharp(Buffer.from(pixels.buffer),{raw:{width:nw,height:nh,channels:4}}).resize(width,height).png().toBuffer()};
  const view=j.rows===3?n:Math.floor(n/j.columns),column=j.action??n%j.columns;
  poses.push({view,column,n,pose});byCharacter.get(main.id).push({view,column,n,pose});
 }
 report.push({id:j.id,file,sha256:createHash('sha256').update(bytes).digest('hex'),factor,calibration,calibrationHeights,selected:poses.map(({view,column,n,pose:{image,...p}})=>({view,column,n,...p}))});
}
for(const j of fixes)await extract(j,[0,1,2,3,4],[5]);
for(const [id,items]of byCharacter){
 const columns=3,cw=Math.ceil((Math.max(...items.map(f=>f.pose.width))+64)/32)*32,ch=Math.ceil((Math.max(...items.map(f=>f.pose.height))+64)/32)*32,key='three-complete-'+id;
 const width=cw*columns,height=ch*Math.ceil(items.length/columns);if(Math.max(width,height)>4096)throw Error(id+': atlas exceeds 4096');
 await sharp({create:{width,height,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(items.map(({pose:f},n)=>({input:f.image,left:n%columns*cw+32,top:Math.floor(n/columns)*ch+32}))).webp({lossless:true}).toFile(out+'/'+key+'.webp');
 textures[key]=`/art/three-complete-v3/${key}.webp`;
 items.forEach(({view,column,pose:{image,...f}},n)=>{const k=`${id}/${view}/${column}`;if(bank.has(k))throw Error('Duplicate contact '+k);bank.set(k,{...f,texture:key,x:n%columns*cw,y:Math.floor(n/columns)*ch,width:cw,height:ch,footX:f.footX+32,footY:f.footY+32,bounds:{left:32,top:32,right:32+f.width,bottom:32+f.height}})});
}
const S=m=>['l0',`s:${m}:1`,`s:${m}:2`,`s:${m}:3`,`s:${m}:4`,'l0'];
const C=(column,load='b0',back='b0')=>['l0',load,'k:'+column,'k:'+column,back,'l0'];
const B=['l0','b1','b2','b3','b0','l0'];
const plan={
 asar:{combo:[S('dash'),C('reverse','s:dash:3','s:dash:4')],sweep:[C('reverse','s:dash:4')],thrust:[C('thrust')]},
 naya:{fan:[S('ring')],dash:[C('charge','s:combo:1')]},
 balta:{thrust:[C('double')],combo:[B,C('left','b3'),C('double','b1')]},
 arkan:{dash:[C('down','s:sweep:1','s:sweep:4')],slash:[C('down','s:sweep:1','s:sweep:4')],combo:[C('down','s:sweep:1'),C('reverse','k:down')]},
 jeogu:{slash:[S('dash')],combo:[S('dash'),C('reverse','s:dash:3')],sweep:[C('reverse','s:dash:1')]},
 yeonsal:{stance:[C('cast')],combo:[B,C('left','b3'),C('right','b1')],thrust:[C('right')]},
 sohong:{hazard:[S('stance')],sweep:[C('reverse','s:fan:1','s:fan:4')]},
 jeokcheon:{combo:[S('dash'),C('reverse','s:dash:3'),C('finish','s:dash:1')],thrust:[C('thrust')],fan:[S('dash')]},
 yanggi:{thrust:[C('thrust')],combo:[S('sweep'),C('reverse','s:sweep:3')]},
 mukyeon:{combo:[S('fan'),['l0','s:fan:4','s:fan:2','s:fan:3','s:fan:4','l0'],S('fan')],thrust:[C('push')]},
 jingwal:{thrust:[C('drive')],combo:[S('dash'),C('drive','s:dash:4'),C('finish','s:dash:1')],sweep:[C('sweep','s:dash:4')]},
 zhugehyeon:{hazard:[S('stance')],combo:[S('fan'),C('reverse','s:fan:3')],sweep:[C('reverse','s:fan:1')]},
};
const characters=[];
for(const [id,moves]of Object.entries(plan)){
 const j=jobs.find(j=>j.id===id),a=bases[j.family].characters.find(a=>a.id===id),prior=old.characters.find(a=>a.id===id),frames=[];
 for(const [move,cycles]of Object.entries(moves))for(let view=0;view<5;view++)for(const [cycle,stages]of cycles.entries())for(const [pose,source]of stages.entries()){
  let f;if(source.startsWith('k:'))f=bank.get(`${id}/${view}/${source.slice(2)}`);
  else if(source.startsWith('s:')){const[,m,p]=source.split(':');f=prior.frames.find(f=>f.move===m&&f.view===view&&f.pose===+p)}
  else f=a.frames.find(f=>f.view===view&&f.kind===(source[0]==='b'?'combat':'locomotion')&&f.pose===+source.slice(1));
  if(!f)throw Error(`${id}/${move}/${view}/${cycle}/${pose}: missing ${source}`);
  frames.push({...f,name:`${view}-${move}-cycle-${cycle}-${pose}`,view,kind:'special',move,pose,cycle,sourceFrame:f.name??`${id}/${view}/${source}`,choreographySource:source});
 }
 characters.push({id,bossId:j.bossId,slot:a.slot,family:j.family,pixelScale:.225,moves:Object.keys(moves),cycles:Object.fromEntries(Object.entries(moves).map(([m,c])=>[m,c.length])),cell:{padding:32},healthClearance:Math.max(a.healthClearance,prior.healthClearance,...frames.map(f=>(f.footY-f.bounds.top)*.225+16)),frames});
}
const art={version:3,sourceWideNormalization:true,textures,characters};await save('src/game/three-complete-frames.json',art);await save(out+'/frames.json',art);await save(root+'/export-review.json',{date:'2026-10-18',report,plan,newActions:31,newLogicalFrames:characters.reduce((n,c)=>n+c.frames.length,0),packedPoses:[...byCharacter.values()].reduce((n,c)=>n+c.length,0),note:'One aspect-preserving source-wide calibration; READY/basic/previous-special reuse is explicit. Contact and held-contact reuse the same drawing. Boot proposals require a grounded plate review.'});console.log(JSON.stringify({bosses:12,actions:31,frames:characters.reduce((n,c)=>n+c.frames.length,0),packed:[...byCharacter.values()].reduce((n,c)=>n+c.length,0)}));
