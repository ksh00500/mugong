import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {figureExtractor,copyFigurePixels} from '../src/game/motion-layout.ts';
const sharp=createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH??'sharp');
const root='docs/source/hyeolma-family-v1';
const jobs=JSON.parse(await readFile(`${root}/generation-jobs.json`));
const reports=[];
for(const id of ['sohong-front','sohong-rear-right','sohong-back','sohong-right','jeokcheon-right','yeonsal-back']){
 const j=jobs.find(j=>j.id===id), g=j.poseSourceCells[0];
 const source=j.poseSources?.[0]??j.source;
 const {data,info}=await sharp(`${root}/${source}`).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const extract=figureExtractor(data,info.width,info.height);
 const f=extract({left:0,top:0,right:Math.floor(info.width/g.columns),bottom:Math.floor(info.height/g.rows)});
 const size=512, out=new Uint8ClampedArray(size*size*4);
 if(f.right-f.left>size-64||f.bottom-f.top>size-64)throw Error('Reference exceeds unchanged native pixel canvas');
 copyFigurePixels(data,out,info.width,size,f,Math.floor((size-f.right+f.left)/2),Math.floor((size-f.bottom+f.top)/2),f.members);
 const file=`${id}-idle-reference.png`;
 await sharp(out,{raw:{width:size,height:size,channels:4}}).png().toFile(`${root}/${file}`);
 reports.push({id,file,source,pose:0,nativePixelsUnscaled:true,bounds:[f.left,f.top,f.right,f.bottom]});
}
await writeFile(`${root}/final-reference-extraction.json`,JSON.stringify(reports,null,2)+'\n');
console.log(JSON.stringify(reports));
