import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const sharp=createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH??'sharp');
const art=JSON.parse(await readFile('src/game/snow-special-complete-frames.json')),base=JSON.parse(await readFile('src/game/snow-family-frames.json'));
const folder='docs/verification/snow-special-complete-v2/boards';await mkdir(folder,{recursive:true});
for(const a of art.characters)for(const move of a.moves){
 const parts=[],b=base.characters.find(b=>b.id===a.id),frames=a.frames.filter(f=>f.move===move),cols=1+frames.length/5;
 for(let view=0;view<5;view++){
  const row=[b.frames.find(f=>f.view===view&&f.kind==='locomotion'&&f.pose===0),...frames.filter(f=>f.view===view)];
  for(const [col,f]of row.entries()){
   const path=art.textures[f.texture]??('/art/snow-'+(f.texture.startsWith('snow-special-')?'special':'family')+'-v1/'+f.texture.replace(/^snow-(special|family)-/,'')+'.webp'),scale=.40;
   parts.push({input:await sharp('public'+path).extract({left:f.x,top:f.y,width:f.width,height:f.height}).resize(Math.round(f.width*scale),Math.round(f.height*scale)).png().toBuffer(),left:col*270+135-Math.round(f.footX*scale),top:view*230+185-Math.round(f.footY*scale)});
   parts.push({input:Buffer.from(`<svg width="270" height="230"><path d="M0 185H270" stroke="#b9ad93"/><circle cx="135" cy="185" r="3" fill="red"/><text x="5" y="218" font-size="16" fill="#20382d">${a.id} / ${view} / ${col===0?'READY':move+' / '+f.cycle+' / '+f.pose}</text></svg>`),left:col*270,top:view*230});
  }
 }
 await sharp({create:{width:cols*270+80,height:1200,channels:4,background:'#ede6d5'}}).composite(parts).png().toFile(`${folder}/${a.id}-${move}.png`);
}
console.log('Six-stage foot-marked boards exported for all sixteen added actions');
