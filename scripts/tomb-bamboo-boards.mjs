import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const sharp=createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH??'sharp');
const art=JSON.parse(await readFile('src/game/tomb-bamboo-special-frames.json')),bases={};for(const f of ['tomb','bamboo'])bases[f]=JSON.parse(await readFile('src/game/'+f+'-family-frames.json'));
const folder='docs/verification/tomb-bamboo-special-v2/boards';await mkdir(folder,{recursive:true});
for(const a of art.characters)for(const move of a.moves){
 const parts=[],b=bases[a.family].characters.find(b=>b.id===a.id),frames=a.frames.filter(f=>f.move===move),cols=1+frames.length/5;
 for(let view=0;view<5;view++){
  const row=[b.frames.find(f=>f.view===view&&f.kind==='locomotion'&&f.pose===0),...frames.filter(f=>f.view===view)];
  for(const [col,f]of row.entries()){
   const path=art.textures[f.texture]??('/art/'+a.family+'-family-v1/'+f.texture.replace(a.family+'-family-','')+'.webp'),scale=.40;
   parts.push({input:await sharp('public'+path).extract({left:f.x,top:f.y,width:f.width,height:f.height}).resize(Math.round(f.width*scale),Math.round(f.height*scale)).png().toBuffer(),left:col*270+135-Math.round(f.footX*scale),top:view*300+250-Math.round(f.footY*scale)});
   parts.push({input:Buffer.from(`<svg width="270" height="300"><path d="M0 250H270" stroke="#b9ad93"/><circle cx="135" cy="250" r="3" fill="red"/><text x="5" y="286" font-size="16" fill="#20382d">${a.id} / ${view} / ${col===0?'READY':move+' / '+f.cycle+' / '+f.pose}</text></svg>`),left:col*270,top:view*300});
  }
 }
 await sharp({create:{width:cols*270+80,height:1540,channels:4,background:'#ede6d5'}}).composite(parts).png().toFile(`${folder}/${a.id}-${move}.png`);
}
console.log('Six-stage boards exported for Tomb and Bamboo selected actions');
