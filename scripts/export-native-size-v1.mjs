// Deterministic asset export: preserve artwork/content/aspect; calibrate whole
// authored source groups once, then package in generously padded cells.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const sharp=createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH??'sharp');
const root='docs/source/native-size-v1',out='public/art/native-size-v1';
const read=async p=>JSON.parse(await readFile(p,'utf8')),save=async(p,v)=>writeFile(p,JSON.stringify(v,null,2)+'\n');
await mkdir(out,{recursive:true});
// Stable input snapshots make reruns idempotent. Never calibrate already corrected pixels.
const names=['snow-family','zhuge-family','three-special','three-complete'];
const banks={};
for(const name of names){const p=`${root}/${name}-before.json`;let b;try{b=await read(p)}catch(e){if(e.code!=='ENOENT')throw e;b=await read(`src/game/${name}-frames.json`);await save(p,b)}banks[name]=b;}
const manifest=await read('src/platform/region-art-manifests.json');
const inputTextures=Object.assign({},...manifest.regions.map(r=>r.all));
const originalTexturePath=`${root}/textures-before.json`;
let textures;try{textures=await read(originalTexturePath)}catch(e){if(e.code!=='ENOENT')throw e;textures=inputTextures;await save(originalTexturePath,textures)}
const spec=await read(`${root}/calibration.json`),mapping=new Map(),newTextures={},reports=[];
const key=f=>[f.texture,f.x,f.y,f.width,f.height].join('/');
async function pack(label,frames,factorFor,cell){
 const items=[];
 for(const f of frames){const factor=factorFor(f),b=f.bounds,w=b.right-b.left,h=b.bottom-b.top;
  const nw=Math.round(w*factor),nh=Math.round(h*factor),file='public'+textures[f.texture],bytes=await readFile(file);
  const input=await sharp(bytes).extract({left:f.x+b.left,top:f.y+b.top,width:w,height:h}).resize(nw,nh).png().toBuffer();
  items.push({f,factor,input,w:nw,h:nh,oldKey:key(f),sourceAtlasSha256:createHash('sha256').update(bytes).digest('hex')});
 }
 const cols=4,cw=cell?.width??Math.ceil((Math.max(...items.map(i=>i.w))+64)/32)*32,ch=cell?.height??Math.ceil((Math.max(...items.map(i=>i.h))+64)/32)*32;
 if(items.some(i=>i.w+64>cw||i.h+64>ch))throw Error(`${label}: source needs a larger shared canvas; never shrink to fit`);
 const width=cols*cw,height=Math.ceil(items.length/cols)*ch;
 if(Math.max(width,height)>4096)throw Error(`${label}: exceeds 4096 texture bound`);
 const texture=`native-size-${label}`,url=`/art/native-size-v1/${label}.webp`;
 await sharp({create:{width,height,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(items.map((i,n)=>({input:i.input,left:n%cols*cw+32,top:Math.floor(n/cols)*ch+32}))).webp({lossless:true}).toFile('public'+url);
 newTextures[texture]=url;
 for(const[i,item]of items.entries()){
  const {f,factor,w,h,oldKey,sourceAtlasSha256}=item;
  const replacement={texture,x:i%cols*cw,y:Math.floor(i/cols)*ch,width:cw,height:ch,footX:32+Math.round((f.footX-f.bounds.left)*factor),footY:32+Math.round((f.footY-f.bounds.top)*factor),bounds:{left:32,top:32,right:32+w,bottom:32+h},sizeCalibration:{version:1,group:label,factor,sourceTexture:f.texture,sourceRect:[f.x,f.y,f.width,f.height],sourceAtlasSha256}};
  if(mapping.has(oldKey))throw Error('Duplicate physical input '+oldKey);
  mapping.set(oldKey,replacement);
 }
 reports.push({label,texture,url,frames:items.length,cell:[cw,ch],factors:[...new Set(items.map(i=>i.factor))],sha256:createHash('sha256').update(await readFile('public'+url)).digest('hex')});
}
for(const group of spec.basic){
 const art=banks[`${group.family}-family`].characters.find(a=>a.id===group.id),frames=art.frames.filter(f=>f.view===group.view);
 const factorFor=f=>spec.sourceOverrides.find(s=>s.family===group.family&&s.id===group.id&&s.source===f.source)?.factor??group.factor;
 if(frames.every(f=>factorFor(f)===1))continue;
 await pack(`${group.family}-${group.id}-${group.view}`,frames,factorFor,art.cell);
}
// Pack only motion stages; identical basic READY at both ends remains a shared reference.
for(const group of spec.special){const art=banks['three-special'].characters.find(a=>a.id===group.id);await pack(`zhuge-${group.id}-${group.view}-${group.move}`,art.frames.filter(f=>f.view===group.view&&f.move===group.move&&f.pose>0&&f.pose<5),()=>group.factor);}
// Earlier atlases physically duplicated READY. Repoint those copies too, so
// changing a basic source cannot leave small READY flashes inside a special.
for(const art of banks['three-special'].characters){
 const base=banks[`${art.family}-family`]?.characters.find(a=>a.id===art.id);
 if(!base)continue;
 for(const f of art.frames.filter(f=>f.pose===0||f.pose===5)){
  const ready=base.frames.find(r=>r.view===f.view&&r.kind==='locomotion'&&r.pose===0),replacement=ready&&mapping.get(key(ready));
  if(replacement)mapping.set(key(f),replacement);
 }
}
let logicalFrames=0;
for(const [name,bank]of Object.entries(banks)){
 for(const a of bank.characters){
  a.frames=a.frames.map(f=>{const r=mapping.get(key(f));if(!r)return f;logicalFrames++;return {...f,...r}});
  // Existing basic family has one common cell; new atlas cells remain explicit
  // per frame and registration never assumes that legacy common-cell value.
  a.healthClearance=Math.max(a.healthClearance,...a.frames.filter(f=>!(f.kind==='locomotion'&&f.pose===5)).map(f=>(f.footY-f.bounds.top)*a.pixelScale+16));
 }
 // The completion bank owns its 12 newly drawn atlases. Shared calibrated
 // basic/special references are resolved by the primary bank + region index.
 if(name==='three-special'){for(const a of bank.characters)for(const f of a.frames)if(newTextures[f.texture])bank.textures[f.texture]=newTextures[f.texture];}
 await save(`src/game/${name}-frames.json`,bank);
}
await save(`${out}/textures.json`,newTextures);
await save('src/game/native-size-textures.json',newTextures);
await save(`${root}/export-review.json`,{version:1,physicalFrames:reports.reduce((n,r)=>n+r.frames,0),mappedPhysicalReferences:mapping.size,logicalFrames,sourcePixelContentUnchanged:true,aspectPreserved:true,minimumPadding:32,runtimeScale:.225,reports,notes:'Source-group authoring transforms; original atlases preserved. sourcePixelContentUnchanged means unchanged subject/content, NOT RGBA 1:1 after resampling.'});
console.log(JSON.stringify({atlases:reports.length,physicalFrames:reports.reduce((n,r)=>n+r.frames,0),mappedPhysicalReferences:mapping.size,logicalFrames}));
