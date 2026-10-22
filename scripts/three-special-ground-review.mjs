import {readFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
const sharp=createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH??'sharp');
const art=JSON.parse(await readFile('src/game/three-special-frames.json'));
await mkdir('docs/verification/three-special-v2/ground',{recursive:true});
for(const id of ['asar','arkan']){
 const actor=art.characters.find(a=>a.id===id);
 for(let view=0;view<5;view++){
  const pieces=[];
  for(const [n,f] of actor.frames.filter(f=>f.view===view).entries()){
   const x=n%4*520,y=Math.floor(n/4)*540;
   const im=await sharp('public'+art.textures[f.texture]).extract({left:f.x,top:f.y,width:f.width,height:f.height}).png().toBuffer();
   pieces.push({input:im,left:x,top:y});
   pieces.push({input:Buffer.from(`<svg width="520" height="540"><path d="M0 ${f.footY}H520 M${f.footX} 0V500" stroke="red" opacity=".7"/><text x="5" y="520" font-size="22">${f.name} foot=${f.footX},${f.footY}</text>${Array.from({length:9},(_,n)=>`<text x="${50+n*50}" y="25" font-size="12">${50+n*50}</text><text x="4" y="${50+n*50}" font-size="12">${50+n*50}</text>`).join('')}</svg>`),left:x,top:y});
  }
  await sharp({create:{width:2080,height:1620,channels:4,background:'#e5dfcd'}}).composite(pieces).png().toFile(`docs/verification/three-special-v2/ground/${id}-${view}.png`);
 }
}
