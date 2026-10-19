import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
const sharp = createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH ?? 'sharp');
const json = async p => JSON.parse(await readFile(p, 'utf8'));
const a = await json('src/game/three-special-frames.json'), b = await json('src/game/zhuge-family-frames.json'), d = await json('public/art/zhuge-special-v1/frames-draft.json');
const index = await json('src/platform/region-art-manifests.json');
const texturePaths = Object.assign({},...index.regions.map(r=>r.all));
const out = 'docs/verification/native-size-review-v1' + (process.argv.includes('--after') ? '/after' : '');
await mkdir(out, { recursive:true });
for(const id of ['yanggi','mukyeon','jingwal','zhugehyeon']) {
 const parts=[],art=a.characters.find(x=>x.id===id),base=b.characters.find(x=>x.id===id),draft=d.characters.find(x=>x.id===id);
 for(let v=0;v<5;v++) {
  const ready=base.frames.find(f=>f.view===v&&f.kind==='locomotion'&&f.pose===0);
  const items=[{f:ready,url:'public'+texturePaths[ready.texture],label:'B READY'},...art.moves.flatMap(m=>{
   const raw=draft.frames.find(f=>f.view===v&&f.move===m&&f.pose===0);
   return [{f:raw,url:'public/art/zhuge-special-v1/'+raw.texture.replace('zhuge-special-','')+'.webp',label:'RAW '+m+' READY'},...art.frames.filter(f=>f.view===v&&f.move===m&&[1,2,4].includes(f.pose)).map(f=>({f,url:'public'+a.textures[f.texture],label:m+' #'+f.pose}))];
  })];
  for(const[c,{f,url,label}]of items.entries()) {
   const s=.55,x=150+c*330+180-Math.round(f.footX*s),y=100+v*310+260-Math.round(f.footY*s);
   parts.push({input:await sharp(url).extract({left:f.x,top:f.y,width:f.width,height:f.height}).resize(Math.round(f.width*s),Math.round(f.height*s)).png().toBuffer(),left:x,top:y});
   parts.push({input:Buffer.from(`<svg width="330" height="310"><text x="4" y="295" font-size="16">V${v} ${label}</text><path d="M0 260H330" stroke="#baa"/></svg>`),left:150+c*330,top:100+v*310});
  }
 }
 await sharp({create:{width:3350,height:1850,channels:4,background:'#e5dfcd'}}).composite(parts).png().toFile(`${out}/${id}-calibration.png`);
 for(const v of [1,4]) {
  const ready=base.frames.find(f=>f.view===v&&f.kind==='locomotion'&&f.pose===0);
  const items=[{f:ready,url:'public'+texturePaths[ready.texture],label:'B READY'},...art.moves.map(m=>{const f=draft.frames.find(f=>f.view===v&&f.move===m&&f.pose===0);return {f,url:'public/art/zhuge-special-v1/'+f.texture.replace('zhuge-special-','')+'.webp',label:'RAW '+m+' READY'};})];
  const parts=[];
  for(const[c,{f,url,label}]of items.entries()) {
   const crop=await sharp(url).extract({left:f.x,top:f.y,width:f.width,height:f.height}).png().toBuffer();
   parts.push({input:crop,left:c*650,top:0});
   let lines='';for(let n=0;n<650;n+=25)lines+=`<path d="M${n} 0V650M0 ${n}H650" stroke="#c03939" opacity=".25"/><text x="${n}" y="14" font-size="11">${n}</text><text x="0" y="${n}" font-size="11">${n}</text>`;
   parts.push({input:Buffer.from(`<svg width="650" height="700">${lines}<text x="10" y="680" font-size="22">${label}</text></svg>`),left:c*650,top:0});
  }
  await sharp({create:{width:1950,height:750,channels:4,background:'#e5dfcd'}}).composite(parts).png().toFile(`${out}/${id}-V${v}-ruler.png`);
 }
 console.log(id);
}
