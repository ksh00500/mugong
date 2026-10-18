import { readFile,mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
const sharp=createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH??'sharp');
const art=JSON.parse(await readFile('src/game/three-special-frames.json'));
const folder='docs/verification/three-special-v2/boards';await mkdir(folder,{recursive:true});
for(const a of art.characters){
 const basic=JSON.parse(await readFile(`src/game/${a.family}-family-frames.json`)).characters.find(b=>a.id===b.id);
 const parts=[],cols=a.id==='naya'?19:13;
 for(let view=0;view<5;view++){
  const frames=[basic.frames.find(f=>f.view===view&&f.kind==='locomotion'&&f.pose===0),...a.frames.filter(f=>f.view===view)];
  for(const [col,f] of frames.entries()){
   const path=col===0?`/art/${a.family}-family-v1/${f.texture.replace(a.family+'-family-','')}.webp`:art.textures[f.texture];
   const scale=.45,x=col*260+130-Math.round(f.footX*scale),y=view*245+200-Math.round(f.footY*scale);
   parts.push({input:await sharp('public'+path).extract({left:f.x,top:f.y,width:f.width,height:f.height}).resize(Math.round(f.width*scale),Math.round(f.height*scale)).png().toBuffer(),left:Math.max(0,x),top:Math.max(0,y)});
   parts.push({input:Buffer.from(`<svg width="260" height="245"><path d="M0 200H260" stroke="#bbb19b"/><circle cx="130" cy="200" r="3" fill="red"/><text x="4" y="232" font-size="15" fill="#20382d">${view}/${col===0?'READY':f.move+'/'+(f.cycle??0)+'/'+f.pose}</text></svg>`),left:col*260,top:view*245});
  }
 }
 await sharp({create:{width:cols*260+100,height:1325,channels:4,background:'#e5dfcd'}}).composite(parts).png().toFile(`${folder}/${a.family}-${a.id}.png`);
}
console.log('12 padded, foot-marked review plates exported');
