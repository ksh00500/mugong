import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
const sharp=createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH || 'sharp');
const root='docs/source/zhuge-special-v1';
await mkdir(root+'/correction-v2',{recursive:true});
for(const [actor,view] of [['yanggi','right'],['mukyeon','rear-right'],['jingwal','right'],['jingwal','back'],['zhugehyeon','rear-right'],['mukyeon','front-right'],['jingwal','front-right'],['zhugehyeon','front-right']]) {
 const png=await readFile(root+'/references/'+actor+'-'+view+'.png');
 const m=await sharp(png).metadata();
 const composite=Array.from({length:6},(_,i)=>({input:png,left:Math.round((i%2)*543+(543-m.width)/2),top:Math.round(Math.floor(i/2)*482+(482-m.height)/2)}));
 await sharp({create:{width:1086,height:1448,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(composite).png().toFile(root+'/correction-v2/'+actor+'-'+view+'-guide.png');
}
await writeFile(root+'/correction-v2/README.md','# 팔진고성 두 번째 교정\n\n기존 원화 기준을 네이티브 복사한 1086×1448 기준판. 원화 크기 변경·배경 편집 없이 슬롯 구성만 한다. 생성 후 실제 머리/몸 크기와 손 소유를 직접 비교한다.\n');
