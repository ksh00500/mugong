import {readFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
const sharp=createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH??'sharp');
const jobs=JSON.parse(await readFile('docs/source/snow-special-complete-v2/generation-jobs.json'));
await mkdir('docs/source/snow-special-complete-v2/references',{recursive:true});
for(const job of jobs){
 const im=await sharp(job.reference).trim().png().toBuffer(),s=await sharp(im).metadata();
 const pieces=Array.from({length:12},(_,n)=>({input:im,left:n%3*640+Math.floor((640-s.width)/2),top:Math.floor(n/3)*640+Math.floor((640-s.height)/2)}));
 await sharp({create:{width:1920,height:2560,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(pieces).png().toFile(`docs/source/snow-special-complete-v2/references/${job.id}-layout.png`);
}
console.log('15 native-size, generous-padding 3x4 layout guides');
