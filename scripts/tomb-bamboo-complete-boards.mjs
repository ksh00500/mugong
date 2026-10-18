import {readFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
const sharp=createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH??'sharp'),root='docs/source/tomb-bamboo-complete-v3';
const art=JSON.parse(await readFile('src/game/tomb-bamboo-complete-frames.json')),review=JSON.parse(await readFile(root+'/export-review.json'));
await mkdir(root+'/boards',{recursive:true});
for(const a of art.characters){
 const base=JSON.parse(await readFile(`src/game/${a.family}-family-frames.json`)),b=base.characters.find(b=>b.id===a.id),items=review.report.filter(r=>r.id===a.id||r.id.startsWith(a.id+'-')).flatMap(r=>r.selected),cols=a.id==='qingbi'?5:4,cw=440,rh=440,parts=[];let svg='';
 for(let view=0;view<5;view++){
  const ready=b.frames.find(f=>f.view===view&&f.kind==='locomotion'&&f.pose===0),poses=[{label:'READY',f:ready,path:`public/art/${a.family}-family-v1/${ready.texture.replace(a.family+'-family-','')}.webp`},...items.filter(f=>f.view===view).sort((a,b)=>a.column-b.column).map(item=>{const f=a.frames.find(f=>f.source===item.source&&f.sourceCell.index===item.sourceCell.index);return {label:'C'+item.column+' #'+item.sourceCell.index,f,path:'public'+art.textures[f.texture]}})];
  for(const [col,{f,path,label}]of poses.entries()){
   const scale=.5,im=await sharp(path).extract({left:f.x,top:f.y,width:f.width,height:f.height}).resize(Math.round(f.width*scale),Math.round(f.height*scale)).png().toBuffer(),m=await sharp(im).metadata(),x=Math.round(col*cw+cw/2-f.footX*scale),y=Math.round(view*rh+rh-35-f.footY*scale);if(x<0||y<0)throw Error(a.id+' board overflow');
   parts.push({input:im,left:x,top:y});svg+=`<text x="${col*cw+10}" y="${view*rh+24}" font-size="16">${['S','SE','E','NE','N'][view]} ${label}</text><path d="M${col*cw} ${view*rh+rh-35}h${cw}" stroke="#c0a578"/><circle cx="${col*cw+cw/2}" cy="${view*rh+rh-35}" r="4" fill="red"/>`;
  }
 }
 parts.push({input:Buffer.from(`<svg width="${cw*cols}" height="${rh*5}"><g fill="#20382d">${svg}</g></svg>`),left:0,top:0});
 await sharp({create:{width:cw*cols,height:rh*5,channels:4,background:'#ede6d5'}}).composite(parts).png().toFile(root+'/boards/'+a.id+'.png');
}
console.log('8 grounded source/READY contact boards');
