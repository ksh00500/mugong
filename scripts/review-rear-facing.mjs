import{createRequire}from'node:module';
import{motionLayout,figureExtractor}from'../src/game/motion-layout.ts';
const sharp=createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH),layers=[];
for(let r=0;r<10;r++){
 const path=`public/art/hostile-consistency-v3/region-${r}-directions.webp`,{data,info}=await sharp(path).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const cells=motionLayout(data,info.width,info.height,7,5),extract=figureExtractor(data,info.width,info.height);
 for(let row=0;row<7;row++){const f=extract(cells[row*5+3]);const png=await sharp(path).extract({left:f.left,top:f.top,width:f.right-f.left,height:f.bottom-f.top}).resize(130,150,{fit:'inside'}).png().toBuffer(),m=await sharp(png).metadata();layers.push({input:png,left:r*140+Math.round((140-m.width)/2),top:row*175+20});layers.push({input:Buffer.from(`<svg width="140" height="18"><text x="4" y="14" fill="white" font-size="13">R${r} / ${row}</text></svg>`),left:r*140,top:row*175});}
}
await sharp({create:{width:1400,height:1225,channels:4,background:'#637267'}}).composite(layers).png().toFile('docs/verification/hostile-consistency-v3/rear-facing.png');
