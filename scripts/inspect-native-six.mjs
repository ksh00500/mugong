import { createRequire } from 'node:module';
import { figureExtractor } from '../src/game/motion-layout.ts';
const sharp=createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH??'sharp');
for(const file of process.argv.slice(2)){
  const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const extract=figureExtractor(data,info.width,info.height),poses=[];
  for(let index=0;index<6;index++){
    const col=index%3,row=Math.floor(index/3),x=Math.floor(col*info.width/3),y=Math.floor(row*info.height/3);
    const f=extract({left:x,top:y,right:Math.floor((col+1)*info.width/3),bottom:Math.floor((row+1)*info.height/3)});
    poses.push({index,id:f.id,rect:[f.left-x,f.top-y,f.right-x,f.bottom-y],area:f.area,clipped:f.left<=0||f.top<=0||f.right>=info.width||f.bottom>=info.height});
  }
  console.log(JSON.stringify({file,width:info.width,height:info.height,poses}));
}
