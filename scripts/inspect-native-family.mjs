import {createRequire} from 'node:module';
import {figureExtractor} from '../src/game/motion-layout.ts';
const sharp=createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH??'sharp');
const portrait=process.argv.includes('--portrait'),columns=portrait?3:4,rows=portrait?4:3;
for(const file of process.argv.slice(2).filter(x=>x!=='--portrait')){
 const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const extract=figureExtractor(data,info.width,info.height),poses=[];
 for(let pose=0;pose<12;pose++){
  const x=Math.floor(pose%columns*info.width/columns),y=Math.floor(Math.floor(pose/columns)*info.height/rows);
  const f=extract({left:x,top:y,right:Math.floor((pose%columns+1)*info.width/columns),bottom:Math.floor((Math.floor(pose/columns)+1)*info.height/rows)});
  poses.push({pose,id:f.id,rect:[f.left-x,f.top-y,f.right-x,f.bottom-y],area:f.area,clipped:f.left<=0||f.top<=0||f.right>=info.width||f.bottom>=info.height});
 }
 console.log(JSON.stringify({file,width:info.width,height:info.height,poses,shared:poses.filter((p,i)=>poses.slice(0,i).some(q=>p.id===q.id)).map(p=>p.pose)}));
}
