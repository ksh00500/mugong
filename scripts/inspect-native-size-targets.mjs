import { readFile } from 'node:fs/promises';
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
const sharp=createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH??'sharp');
const index=JSON.parse(await readFile('src/platform/region-art-manifests.json','utf8'));
const textures=Object.assign({},...index.regions.map(r=>r.all));
const out='docs/verification/native-size-review-v1'+(process.argv.includes('--after')?'/after':'');
await mkdir(out,{recursive:true});
for(const [family,id]of [['snow','snowhunter'],['zhuge','mukyeon']]) {
 const art=JSON.parse(await readFile(`src/game/${family}-family-frames.json`,'utf8')).characters.find(a=>a.id===id),parts=[];
 for(let v=0;v<5;v++) {
  const fs=art.frames.filter(f=>f.view===v);
  for(const [c,f]of fs.entries()) {
   const scale=.5, left=180+c*330+165-Math.round(f.footX*scale),top=100+v*300+250-Math.round(f.footY*scale);
   parts.push({input:await sharp('public'+textures[f.texture]).extract({left:f.x,top:f.y,width:f.width,height:f.height}).resize(Math.round(f.width*scale),Math.round(f.height*scale)).png().toBuffer(),left,top});
   parts.push({input:Buffer.from(`<svg width="330" height="300"><path d="M0 250H330" stroke="#baa"/><text x="4" y="280" font-size="18">${f.name}</text></svg>`),left:180+c*330,top:100+v*300});
  }
 }
 await sharp({create:{width:4400,height:1800,channels:4,background:'#e5dfcd'}}).composite(parts).png().toFile(`${out}/${id}-basic-all.png`);
 // Native-size ruler on READY + recovered combat, to exclude weapon/ponytail bounds.
 const p=[];
 for(let v=0;v<5;v++) for(const [row,kind,pose]of [[0,'locomotion',0],[1,'combat',5]]) {
  const f=art.frames.find(f=>f.view===v&&f.kind===kind&&f.pose===pose);
  p.push({input:await sharp('public'+textures[f.texture]).extract({left:f.x,top:f.y,width:f.width,height:f.height}).png().toBuffer(),left:100+v*650,top:50+row*700});
  let lines='';for(let n=0;n<650;n+=25)lines+=`<path d="M${n} 0V650M0 ${n}H650" stroke="#c03939" opacity=".25"/><text x="${n}" y="14" font-size="11">${n}</text><text x="0" y="${n}" font-size="11">${n}</text>`;
  p.push({input:Buffer.from(`<svg width="650" height="700">${lines}<text x="8" y="680" font-size="20">${f.name}</text></svg>`),left:100+v*650,top:50+row*700});
 }
 await sharp({create:{width:3500,height:1500,channels:4,background:'#e5dfcd'}}).composite(p).png().toFile(`${out}/${id}-ruler.png`);
 console.log(id);
}
