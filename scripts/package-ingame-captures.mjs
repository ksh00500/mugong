import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const sharp=createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH??'sharp');
const root='docs/verification/ingame-capture-20261018';
const serve='dist-validation-hosting/captures';
await mkdir(serve,{recursive:true});
const regions=[],tiles=[],files=[];
for(let n=0;n<10;n++){
 const id=String(n).padStart(2,'0');
 const region=JSON.parse(await readFile(`${root}/${id}.json`,'utf8'));regions.push(region);
 for(const [i,name] of region.images.entries()){
  const data=await readFile(`${root}/${name}`),meta=await sharp(data).metadata();
  if(meta.width!==1920||meta.height!==1080)throw new Error(`Unexpected dimensions: ${name}`);
  files.push({file:name,region:region.name,width:meta.width,height:meta.height,sha256:createHash('sha256').update(data).digest('hex')});
  await copyFile(`${root}/${name}`,`${serve}/${name}`);
  tiles.push({input:await sharp(data).resize(640,360).toBuffer(),left:i*640,top:n*360});
 }
}
await sharp({create:{width:1280,height:3600,channels:3,background:'#17221e'}}).composite(tiles).png().toFile(`${root}/contact-sheet.png`);
const html=`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>무공 · 인게임 캡처</title><style>body{margin:0;background:#13251f;color:#f6edcf;font:16px system-ui}main{max-width:1600px;margin:auto;padding:28px}h1{font-size:30px}p{color:#c8c5ae}section{margin:36px 0}h2{font-size:22px}.shots{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}figure{margin:0}img{display:block;width:100%;border-radius:8px}figcaption{padding:10px 0;color:#dedac5}a{color:inherit}@media(max-width:800px){.shots{grid-template-columns:1fr}}</style><main><h1>무공 · 인게임 캡처</h1><p>2026-10-18 · 10개 지역 / 20장 · 원본 PNG 1920×1080</p><p>로컬 게임의 실제 렌더 화면입니다. 독립 촬영용 저장을 사용했으며 실제 사용자 저장은 변경하지 않았습니다. 이미지를 누르면 원본을 엽니다.</p>${regions.map(r=>`<section><h2>${r.region+1}. ${r.name}</h2><div class="shots">${r.images.map((name,i)=>`<figure><a href="${name}" target="_blank" rel="noopener"><img src="${name}" loading="lazy" alt="${r.name} ${i?'궁극기':'전투'} 화면"></a><figcaption>${i?'궁극기·강화 발동':'전투'} · <a href="${name}" download>PNG 저장</a></figcaption></figure>`).join('')}</div></section>`).join('')}</main></html>`;
await writeFile(`${root}/index.html`,html);await writeFile(`${serve}/index.html`,html);
await writeFile(`${root}/manifest.json`,JSON.stringify({capturedAt:'2026-10-18',kind:'actual local compiled game screenshots; isolated photography fixtures',originalImagesUnmodified:true,files},null,2)+'\n');
console.log(`Packaged ${files.length} original screenshots and gallery: ${root}`);
