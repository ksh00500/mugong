import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { figureExtractor, copyFigurePixels } from '../src/game/motion-layout.ts';
import { nativeSourceCell } from './native-source-cell.mjs';

const sharp = createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH ?? 'sharp');
const root = 'docs/source/three-special-install-v2';
const out = 'public/art/three-special-v2';
await mkdir(out, { recursive: true });
const json = async p => JSON.parse(await readFile(p, 'utf8'));
const save = async (p, v) => writeFile(p, JSON.stringify(v, null, 2) + '\n');
const audit = await json(root + '/scale-audit.json');
const ground = await json(root + '/ground-corrections.json');
const textures = {}, reports = [], bases = new Map(), sourceCache = new Map();
const sourceHash = async p => createHash('sha256').update(await readFile(p)).digest('hex');
async function sourceFigure(path, layout) {
  let s = sourceCache.get(path);
  if (!s) {
    const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    s = { data, info, extract: figureExtractor(data, info.width, info.height) };
    sourceCache.set(path, s);
  }
  const f = s.extract(nativeSourceCell(layout, s.info.width, s.info.height));
  if (f.id < 0 || f.left <= 0 || f.top <= 0 || f.right >= s.info.width || f.bottom >= s.info.height)
    throw Error(path + ': ambiguous or canvas-clipped source');
  const w = f.right - f.left, h = f.bottom - f.top, pixels = new Uint8ClampedArray(w*h*4);
  copyFigurePixels(s.data, pixels, s.info.width, w, f, 0, 0, f.members);
  return { image: await sharp(Buffer.from(pixels.buffer), {raw:{width:w,height:h,channels:4}}).png().toBuffer(),
    width:w, height:h, source:path, sourceCell:layout,
    sourceBounds:{left:f.left,top:f.top,right:f.right,bottom:f.bottom}, component:f.id };
}
async function scaled(f, factor) {
  const width = Math.round(f.width * factor), height = Math.round(f.height * factor);
  return {...f, width, height, footX:Math.round(f.footX*factor), footY:Math.round(f.footY*factor),
    image:factor===1 ? f.image : await sharp(f.image).resize(width,height,{fit:'fill',kernel:'lanczos3'}).png().toBuffer(),
    normalizationFactor:factor};
}
async function oldFrame(f, family, special=false) {
  const path = `public/art/${family}-${special?'special':'family'}-v1/${f.texture.replace(family+(special?'-special-':'-family-'),'')}.webp`;
  const b=f.bounds, width=b.right-b.left, height=b.bottom-b.top;
  return {...f, image:await sharp(path).extract({left:f.x+b.left,top:f.y+b.top,width,height}).png().toBuffer(),
    width,height,footX:f.footX-b.left,footY:f.footY-b.top,sourceAtlas:path};
}
async function pack(key, poses, filename) {
  const cw=Math.ceil((Math.max(...poses.map(f=>f.width))+64)/32)*32;
  const ch=Math.ceil((Math.max(...poses.map(f=>f.height))+64)/32)*32;
  const rows=Math.ceil(poses.length/4),frames=[];
  await sharp({create:{width:cw*4,height:ch*rows,channels:4,background:{r:0,g:0,b:0,alpha:0}}})
    .composite(poses.map((f,n)=>({input:f.image,left:n%4*cw+32,top:Math.floor(n/4)*ch+32})))
    .webp({lossless:true}).toFile(filename);
  textures[key]='/'+filename.replace(/^public\//,'');
  for(const [n,f] of poses.entries()) {
    const {image,component,...rest}=f;
    const frame={...rest,texture:key,x:n%4*cw,y:Math.floor(n/4)*ch,width:cw,height:ch,
      footX:f.footX+32,footY:f.footY+32,bounds:{left:32,top:32,right:32+f.width,bottom:32+f.height}};
    if(frame.footX<32||frame.footX>frame.bounds.right||frame.footY<32||frame.footY>frame.bounds.bottom)
      throw Error(key+'/'+f.name+': ground anchor outside actor');
    frames.push(frame);
  }
  return frames;
}

for(const family of ['desert','hyeolma','zhuge']) bases.set(family,await json(`src/game/${family}-family-frames.json`));
for(const [id,views] of Object.entries(ground.basicReady)) {
  const actor=bases.get('desert').characters.find(a=>a.id===id);
  for(const [v,[footX,footY]] of Object.entries(views)) {
    const f=actor.frames.find(f=>f.view===Number(v)&&f.kind==='locomotion'&&f.pose===0);
    Object.assign(f,{footX,footY,groundReview:'three-special-install-v2/ground-corrections.json'});
  }
}
await save('src/game/desert-family-frames.json',bases.get('desert'));
// Use the unmodified v1 metadata as a stable calibration reference on reruns.
const baseline = root+'/zhuge-basic-before.json';
let original;
try {original=await json(baseline);} catch { original=bases.get('zhuge'); await save(baseline,original); }
const basicRepairs=[];
for(const id of ['mukyeon','jingwal','zhugehyeon']) {
  const actor=bases.get('zhuge').characters.find(a=>a.id===id);
  const before=original.characters.find(a=>a.id===id),ready=before.frames.find(f=>f.view===1&&f.kind==='locomotion'&&f.pose===0);
  const file=`${root}/generated/${id}-front-right-v2.png`;
  const raw=[];
  for(let pose=0;pose<12;pose++) raw.push(await sourceFigure(file,{columns:4,rows:3,index:id==='jingwal'&&pose===3?0:pose}));
  // One READY calibration applies to the entire 12-pose sheet, never a fit per pose.
  const factor=(ready.bounds.bottom-ready.bounds.top)/raw[0].height;
  const poses=[];
  for(let n=0;n<12;n++) {
    const f=raw[n],old=before.frames.find(f=>f.view===1&&f.sourcePose===n);
    // Reviewed full-sheet boot line; death's root is the resting silhouette's base.
    const footX=f.width/2,footY=f.height-3;
    poses.push(await scaled({...old,...f,footX,footY,provenance:'corrected-native-direction'},factor));
  }
  if(id==='jingwal') {
    const file=root+'/generated/jingwal-two-poses.png';
    const walk=await sourceFigure(file,{columns:2,rows:1,index:0});
    const load=await sourceFigure(file,{columns:2,rows:1,index:1});
    // Both replacement poses are generated together at one body scale.
    const repairFactor=(ready.bounds.bottom-ready.bounds.top)/walk.height;
    for(const [n,f] of [[3,walk],[7,load]]) poses[n]=await scaled({...before.frames.find(f=>f.view===1&&f.sourcePose===n),...f,
      footX:f.width/2,footY:f.height-3,provenance:'corrected-native-direction'},repairFactor);
  }
  const key=`zhuge-family-${id}-front-right-v2`;
  const frames=await pack(key,poses,`public/art/zhuge-family-v1/${id}-front-right-v2.webp`);
  actor.frames=actor.frames.map(f=>f.view===1?frames.find(g=>g.name===f.name):f);
  actor.healthClearance=Math.max(...actor.frames.filter(f=>!(f.kind==='locomotion'&&f.pose===5)).map(f=>(f.footY-f.bounds.top)*actor.pixelScale))+16;
  basicRepairs.push({id,factor,source:file,sha256:await sourceHash(file),frames:frames.length,
    note:id==='jingwal'?'Walking tip and horizontal thrust load use a separate two-pose repair sheet with one shared calibration.':'All twelve southeast poses replaced together.'});
}
await save('src/game/zhuge-family-frames.json',bases.get('zhuge'));

// Naya's actual second contact: LEFT ring, RIGHT ring retracted. One reference
// calibration from the sixth READY drawing applies to all five new contacts.
const nayaFile=root+'/generated/naya-second-contact-v2.png';
const nayaRaw=[];
for(let view=0;view<6;view++) nayaRaw.push(await sourceFigure(nayaFile,{columns:2,rows:3,index:view}));
if(new Set(nayaRaw.map(f=>f.component)).size!==6)throw Error('Naya contacts share connected pixels');
const nayaBase=bases.get('desert').characters.find(a=>a.id==='naya');
const nayaReady=nayaBase.frames.find(f=>f.view===0&&f.kind==='locomotion'&&f.pose===0);
const nayaFactor=(nayaReady.bounds.bottom-nayaReady.bounds.top)/nayaRaw[5].height;
const nayaPoses=[];
for(let view=0;view<5;view++) {
  const f=nayaRaw[view];
  const [bx,by]=ground.newNayaSourceBoots[view];
  nayaPoses.push(await scaled({...f,name:`${view}-combo-second-contact`,view,kind:'special',move:'combo',pose:2,sourcePose:view,
    footX:bx-f.sourceBounds.left,footY:by-f.sourceBounds.top,provenance:'new-left-ring-contact'},nayaFactor));
}
const nayaContacts=await pack('three-special-desert-naya-left',nayaPoses,out+'/desert-naya-left.webp');
const characters=[];
for(const family of ['desert','hyeolma','zhuge']) {
  const draft=await json(`public/art/${family}-special-v1/frames-draft.json`);
  for(const actor of draft.characters) {
    const base=bases.get(family).characters.find(a=>a.id===actor.id);
    const metric=audit.find(a=>a.family===family&&a.id===actor.id);
    const factor=family==='hyeolma'?1:metric.proposedWholeActorFactor;
    const frames=[];
    for(let view=0;view<5;view++) {
      const poses=[];
      for(const f of actor.frames.filter(f=>f.view===view)) {
        if(f.pose===0||f.pose===5) {
          const ready=base.frames.find(g=>g.view===view&&g.kind==='locomotion'&&g.pose===0);
          // Identical READY source on both ends prevents switching-sheet scale pops.
          poses.push({...await oldFrame(ready,family),name:f.name,kind:'special',move:f.move,pose:f.pose,
            sourceFrame:ready.name,provenance:'basic-ready-reuse',normalizationFactor:1});
        } else poses.push(await scaled({...await oldFrame(f,family,true),provenance:'reviewed-draft-pose'},factor));
      }
      frames.push(...await pack(`three-special-${family}-${actor.id}-${view}`,poses,`${out}/${family}-${actor.id}-${view}.webp`));
    }
    for(const f of frames) {
      const corrected=ground.special[actor.id]?.[f.name];
      if(corrected)Object.assign(f,{footX:corrected[0],footY:corrected[1],groundReview:'three-special-install-v2/ground-corrections.json'});
    }
    if(family==='desert'&&actor.id==='naya') {
      for(let view=0;view<5;view++)for(let pose=0;pose<6;pose++) {
        const source=pose===2||pose===3?nayaContacts[view]:frames.find(f=>f.view===view&&f.move==='combo'&&f.pose===(pose===1?4:pose));
        frames.push({...source,name:`${view}-combo-cycle-1-${pose}`,move:'combo',pose,cycle:1,
          sourceFrame:source.name,provenance:pose===2||pose===3?'new-left-ring-contact':pose===1?'guard-reload-before-left-contact':'existing-cycle-stage'});
      }
    }
    characters.push({...actor,family,frames,cell:{padding:32},pixelScale:0.225,normalizationFactor:factor,
      healthClearance:Math.max(base.healthClearance,...frames.map(f=>(f.footY-f.bounds.top)*0.225+16))});
    reports.push({family,id:actor.id,bossId:actor.bossId,factor,logicalFrames:frames.length,
      anchors:frames.map(f=>({name:f.name,foot:[f.footX,f.footY],source:f.source,sourceBounds:f.sourceBounds})),
      review:'Source-wide aspect-preserving calibration; basic READY reused for prepare/ready; draft ground points retained for motion stages and reviewed on foot-marked plates. Runtime never scans/fits a pose.'});
  }
}
const result={version:2,textures,characters};
await save('src/game/three-special-frames.json',result);
await save(out+'/frames.json',result);
await save(root+'/export-review.json',{date:'2026-10-18',basicRepairs,nayaSecondContact:{source:nayaFile,sha256:await sourceHash(nayaFile),factor:nayaFactor,newDrawings:5,logicalFrames:30},reports,
  logicalFrames:characters.reduce((n,c)=>n+c.frames.length,0),newActions:24,
  limitations:'Twenty-four selected actions installed. Other kit actions keep the pre-existing basic pose bank. Generation is not a guarantee of anatomical correctness; actual rendered contact plates must also be inspected.'});
console.log(JSON.stringify({bosses:characters.length,actions:24,frames:characters.reduce((n,c)=>n+c.frames.length,0),textures:Object.keys(textures).length,basicRepairs:basicRepairs.map(r=>({id:r.id,factor:r.factor}))}));
