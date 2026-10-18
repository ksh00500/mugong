import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
const sharp=createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH??'sharp');
const root='docs/source/boss-remaining-v1';await mkdir(root+'/banks',{recursive:true});
const audit=JSON.parse(await readFile(root+'/action-audit.json'));
for(const family of [...new Set(audit.map(a=>a.family))]){
 const base=JSON.parse(await readFile('src/game/'+family+'-family-frames.json'));
 const special=JSON.parse(await readFile('src/game/'+family+'-special-frames.json'));
 for(const b of special.characters){
 const basic=base.characters.find(c=>c.id===b.id);
 const poses=[...basic.frames.filter(f=>f.view===1&&f.kind==='combat'),...b.frames.filter(f=>f.view===1)];
 const parts=[];
 for(let i=0;i<poses.length;i++){
  const f=poses[i],dir=f.texture.startsWith(family+'-special-')?'special':'family';
  const path='public/art/'+family+'-'+dir+'-v1/'+f.texture.replace(family+'-'+dir+'-','')+'.webp';
  const {left,top,right,bottom}=f.bounds;
  const crop=await sharp(path).extract({left:f.x+left,top:f.y+top,width:right-left,height:bottom-top}).png().toBuffer();
  parts.push({input:crop,left:(i%6)*550+35,top:Math.floor(i/6)*500+40});
 }
 await sharp({create:{width:3300,height:1500,channels:4,background:{r:237,g:230,b:213,alpha:1}}}).composite(parts).png().toFile(root+'/banks/'+family+'-'+b.id+'.png');
 }
}
console.log('16 native pose-bank comparisons: first row BASIC, next two selected SPECIAL.');

