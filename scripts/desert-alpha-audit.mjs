import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
const sharp=createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH??'sharp');
const records=[];
for(const file of process.argv.slice(2)){
 const {data,info}=await sharp(`docs/source/desert-family-v1/${file}`).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let clear=0,solid=0,neon=0;for(let i=0;i<data.length;i+=4){if(data[i+3]===0)clear++;if(data[i+3]>=128){solid++;if((data[i]>240&&data[i+1]<30&&data[i+2]<30)||(data[i+1]>240&&data[i]<30&&data[i+2]<30))neon++;}}
 records.push({file,width:info.width,height:info.height,topLeftRGBA:[...data.subarray(0,4)],clearFraction:clear/(info.width*info.height),solid,neon});
}
await writeFile('docs/source/desert-family-v1/alpha-audit.json',JSON.stringify(records,null,2)+'\n');console.log(JSON.stringify(records));
