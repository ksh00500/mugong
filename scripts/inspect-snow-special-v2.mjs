import {createRequire} from 'node:module';
import {figureExtractor} from '../src/game/motion-layout.ts';
import {nativeSourceCell} from './native-source-cell.mjs';
const sharp=createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH??'sharp');
for(const file of process.argv.slice(2)){
 const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const extract=figureExtractor(data,info.width,info.height),poses=[];
 for(let n=0;n<12;n++){
  const cell=nativeSourceCell({columns:3,rows:4,index:n},info.width,info.height),f=extract(cell);
  poses.push({n,id:f.id,box:[f.left,f.top,f.right,f.bottom],area:f.area,clipped:f.left<=0||f.top<=0||f.right>=info.width||f.bottom>=info.height});
 }
 console.log(JSON.stringify({file,width:info.width,height:info.height,poses,distinct:new Set(poses.map(f=>f.id)).size}));
}
