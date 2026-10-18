import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { figureExtractor, copyFigurePixels } from '../src/game/motion-layout.ts';
import { nativeSourceCell } from './native-source-cell.mjs';
const sharp = createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH ?? 'sharp');
const root = 'docs/source/boss-remaining-v1', out = 'public/art/boss-remaining-v1';
await mkdir(out, { recursive: true });
const jobs = JSON.parse(await readFile(root + '/generation-jobs.json'));
const audit = JSON.parse(await readFile(root + '/action-audit.json'));
const families = new Map();
for (const family of [...new Set(audit.map(a => a.family))]) families.set(family, {
  base: JSON.parse(await readFile(`src/game/${family}-family-frames.json`)),
  special: JSON.parse(await readFile(`src/game/${family}-special-frames.json`)),
});
// Reviewed boot coordinates in original generated-sheet pixels. A low weapon
// must not become the root point. They are transformed once during export.
const boots = [
 [[283,413],[817,416],[292,901],[827,909],[285,1371]],
 [[296,450],[810,446],[285,909],[797,917],[277,1376]],
 [[284,416],[798,430],[280,893],[810,891],[292,1344]],
 [[285,430],[815,431],[292,893],[809,895],[284,1378]],
 [[297,439],[809,440],[295,900],[815,903],[293,1382]],
 [[303,470],[828,487],[311,926],[826,925],[294,1370]],
 [[269,485],[791,489],[251,918],[801,947],[267,1380]],
 [[291,458],[797,463],[265,930],[806,931],[287,1399]],
 [[325,426],[867,434],[290,897],[818,902],[311,1368]],
 [[279,445],[811,448],[290,926],[822,925],[280,1380]],
 [[281,447],[822,447],[293,933],[823,918],[282,1395]],
 [[316,440],[876,435],[325,930],[870,928],[320,1375]],
 [[322,458],[829,454],[282,929],[798,934],[270,1380]],
 [[240,441],[812,446],[274,920],[820,923],[270,1386]],
 [[294,425],[813,439],[288,910],[827,909],[282,1380]],
 [[331,451],[840,454],[285,912],[779,926],[278,1370]],
 [[291,432],[794,442],[282,909],[798,939],[307,1378]],
 [[321,438],[833,444],[290,917],[809,922],[315,1390]],
];
const contacts = new Map(), normalization = [], textures = {};
for (const [index, job] of jobs.entries()) {
  const png = await readFile(`${root}/${job.source}`);
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixels = new Uint8ClampedArray(data.buffer, data.byteOffset, data.length);
  const extract = figureExtractor(pixels, info.width, info.height);
  const figures = Array.from({length:6}, (_,v) => extract(nativeSourceCell({columns:2,rows:3,index:v},info.width,info.height)));
  if (figures.some(f=>f.id<0) || new Set(figures.map(f=>f.id)).size !== 6) throw Error(job.id+': overlapping/ambiguous figures');
  if (figures.some(f=>f.left<=0||f.top<=0||f.right>=info.width||f.bottom>=info.height)) throw Error(job.id+': canvas-clipped figure');
  const basic = families.get(job.family).base.characters.find(c=>c.id===job.character);
  const ready = basic.frames.find(f=>f.kind==='locomotion'&&f.pose===0&&f.view===0);
  // ONE source-wide calibration against the stationary READY reference. Every
  // direction/contact keeps the same factor; no individual-pose fitting exists.
  const factor = (ready.bounds.bottom-ready.bounds.top)/(figures[5].bottom-figures[5].top);
  const packed=[];
  for (let view=0;view<5;view++) {
    const f=figures[view],w=f.right-f.left,h=f.bottom-f.top;
    const raw=new Uint8ClampedArray(w*h*4);
    copyFigurePixels(pixels,raw,info.width,w,f,0,0,f.members);
    const width=Math.round(w*factor),height=Math.round(h*factor);
    const image=await sharp(Buffer.from(raw.buffer),{raw:{width:w,height:h,channels:4}}).resize(width,height,{kernel:'lanczos3'}).png().toBuffer();
    const [bx,by]=boots[index][view];
    const footX=Math.round((bx-f.left)*factor),footY=Math.round((by-f.top)*factor);
    if(footX<0||footX>width||footY<0||footY>height)throw Error(`${job.id}/${view}: boot outside silhouette bounds`);
    packed.push({image,width,height,footX,footY,sourceBounds:{left:f.left,top:f.top,right:f.right,bottom:f.bottom}});
  }
  const cw=Math.ceil((Math.max(...packed.map(f=>f.width))+64)/32)*32;
  const ch=Math.ceil((Math.max(...packed.map(f=>f.height))+64)/32)*32;
  const texture='boss-remaining-'+job.id;
  await sharp({create:{width:cw*2,height:ch*3,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(packed.map((f,v)=>({input:f.image,left:v%2*cw+32,top:Math.floor(v/2)*ch+32}))).webp({lossless:true}).toFile(`${out}/${job.id}.webp`);
  textures[texture]=`/art/boss-remaining-v1/${job.id}.webp`;
  for(let view=0;view<5;view++) {
    const f=packed[view];
    contacts.set(job.id+'/'+view,{name:`${view}-${job.kind}`,texture,view,kind:'special',move:'',pose:2,sourcePose:view,x:view%2*cw,y:Math.floor(view/2)*ch,width:cw,height:ch,footX:f.footX+32,footY:f.footY+32,bounds:{left:32,top:32,right:32+f.width,bottom:32+f.height},source:job.source,sourceCell:{columns:2,rows:3,index:view},sourceBounds:f.sourceBounds,normalizationFactor:factor});
  }
  normalization.push({id:job.id,sha256:createHash('sha256').update(png).digest('hex'),factor,referenceReady:ready.name,referenceHeight:ready.bounds.bottom-ready.bounds.top,generatedReadyHeight:figures[5].bottom-figures[5].top,bootPoints:boots[index],review:'All five views use one source-wide READY calibration; padded packing; boots reviewed separately from low weapon.'});
}
const B=['b0','b1','b2','b3','b0','l0'];
const S=move=>Array.from({length:6},(_,p)=>`s:${move}:${p}`);
const K=(id,base=B)=>[base[0],base[1],'k:'+id,'k:'+id,base[4],base[5]];
const change=(cycle,pose,source)=>cycle.map((s,p)=>p===pose?source:s);
// Explicit choreography. Combos own separate six-stage cycles per actual hit.
// b4/b5 (basic HURT/DEATH) are deliberately never used for recovery.
const plan={
 '4-1':{thrust:[B],combo:[B,K('shaolin-gongheo-left-punch')]},
 '4-2':{dash:[K('shaolin-dowon-shoulder',S('stance'))],slam:[K('shaolin-dowon-ground-fist',S('stance'))]},
 '4-3':{combo:[B,K('shaolin-bulmyeong-left-palm'),change(B,2,'b3')],thrust:[change(B,2,'b3')]},
 '4-4':{sweep:[S('combo')],slam:[K('shaolin-mujin-stomp',S('stance'))]},
 '2-1':{thrust:[S('dash')],slash:[B],sweep:[K('tianjian-ujin-horizontal-cut')]},
 '2-2':{combo:[B,S('dash'),S('sweep')],thrust:[K('tianjian-baekhong-dual-thrust',S('dash'))]},
 '2-3':{combo:[B,S('dash'),K('tianjian-mumyeong-straight-thrust')],thrust:[K('tianjian-mumyeong-straight-thrust')],sweep:[K('tianjian-mumyeong-horizontal-cut')]},
 '2-4':{combo:[B,S('sweep'),change(S('sweep'),2,'s:sweep:3')],thrust:[S('sweep')],dash:[S('fan')]},
 '1-1':{slash:[B],thrust:[K('dokmu-cheongrin-straight-thrust')],sweep:[K('dokmu-cheongrin-horizontal-cut')]},
 '1-2':{stance:[S('fan')],slash:[K('dokmu-mukchil-bottle-hit',S('hazard'))]},
 '1-3':{hazard:[S('stance')],combo:[S('fan'),K('dokmu-yeonhwa-reverse-fan',S('fan'))]},
 '1-4':{hazard:[S('stance')],thrust:[S('fan')],sweep:[K('dokmu-sagongyeom-staff-sweep',S('fan'))]},
 '0-1':{slash:[B],sweep:[change(B,2,'b3')],slam:[K('qingha-madabong-stomp',S('dash'))]},
 '0-2':{thrust:[S('combo')],sweep:[B],slam:[K('qingha-nojin-stomp',S('stance'))],dash:[S('combo')]},
 '0-3':{combo:[B,S('thrust')],slam:[K('qingha-cheolmu-ground-chain',S('thrust'))]},
 '0-4':{combo:[S('slash'),S('sweep')],dash:[S('slash')],slam:[K('qingha-hanmugeuk-ground-cut',S('slash'))]},
};
const characters=[];
for(const [family,{base,special}] of families)for(const actor of special.characters){
 const ordinary=base.characters.find(c=>c.id===actor.id),moves=plan[actor.bossId],frames=[];
 for(const [move,cycles] of Object.entries(moves)) {
  const actual=audit.find(a=>a.bossId===actor.bossId&&a.move===move&&!a.installed);
  if(!actual)throw Error(actor.bossId+'/'+move+': not in remaining kit');
  if(cycles.length!==Math.max(1,actual.spec.contacts.length))throw Error('Cycle/contact mismatch');
  for(let view=0;view<5;view++)for(const [cycle,stages] of cycles.entries())for(const [pose,source] of stages.entries()){
   let f;
   if(source.startsWith('k:'))f=contacts.get(source.slice(2)+'/'+view);
   else if(source.startsWith('s:')) {const [,m,p]=source.split(':');f=actor.frames.find(f=>f.view===view&&f.move===m&&f.pose===Number(p));}
   else f=ordinary.frames.find(f=>f.view===view&&f.kind===(source[0]==='b'?'combat':'locomotion')&&f.pose===Number(source.slice(1)));
   if(!f)throw Error(`${actor.bossId}/${move}/${view}/${pose}: ${source} missing`);
   frames.push({...f,name:`${view}-remaining-${move}-${cycle}-${pose}`,kind:'special',move,pose,cycle,sourceFrame:f.name,provenance:source.startsWith('k:')?'new-contact':'existing-pose-bank',choreographySource:source});
  }
 }
 characters.push({id:actor.id,bossId:actor.bossId,slot:actor.slot,pixelScale:0.225,moves:Object.keys(moves),cycles:Object.fromEntries(Object.entries(moves).map(([m,c])=>[m,c.length])),cell:{padding:32},healthClearance:Math.max(...frames.map(f=>(f.footY-f.bounds.top)*0.225))+16,frames});
}
if(characters.reduce((n,c)=>n+c.moves.length,0)!==41)throw Error('Expected 41 remaining actions');
const result={version:1,sourceWideNormalization:true,textures,characters};
await writeFile('src/game/boss-remaining-frames.json',JSON.stringify(result,null,2)+'\n');
await writeFile(out+'/frames.json',JSON.stringify(result,null,2)+'\n');
await writeFile(root+'/export-review.json',JSON.stringify({normalization,actions:audit.filter(a=>!a.installed),plan,newContactDrawings:jobs.length*5,logicalFrames:characters.reduce((n,c)=>n+c.frames.length,0),newArtStages:'Contact and held follow-through; preparation/recovery deliberately reuse suitable installed source poses.'},null,2)+'\n');
console.log(JSON.stringify({bosses:characters.length,actions:41,newContactDrawings:jobs.length*5,logicalFrames:characters.reduce((n,c)=>n+c.frames.length,0)}));
