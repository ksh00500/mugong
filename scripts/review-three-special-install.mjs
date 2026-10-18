import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
const sharp=createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH??'sharp');
const root='docs/source/three-special-install-v1';await mkdir(root+'/boards',{recursive:true});
const inventory=[];
for(const family of ['desert','hyeolma','zhuge']){
 const art=JSON.parse(await readFile(`public/art/${family}-special-v1/frames-draft.json`));
 const base=JSON.parse(await readFile(`src/game/${family}-family-frames.json`));
 const status=JSON.parse(await readFile(`docs/source/${family}-special-v1/generation-status.json`));
 const jobs=JSON.parse(await readFile(`docs/source/${family}-special-v1/generation-draft-jobs.json`));
 inventory.push({family,actors:art.characters.map(a=>({id:a.id,bossId:a.bossId,moves:a.moves,frames:a.frames.length})),pending:status.pending??[],jobs:jobs.map(j=>({id:j.id,source:j.source,poseSources:j.poseSources,poseSourceCells:j.poseSourceCells}))});
 for(const a of art.characters){
  const b=base.characters.find(c=>c.id===a.id),parts=[];
  for(let v=0;v<5;v++){
   const ref=b.frames.find(f=>f.view===v&&f.kind==='locomotion'&&f.pose===0);
   const row=[ref,...a.frames.filter(f=>f.view===v)];
   for(const [col,f] of row.entries()){
    const texturePath=col===0?`public/art/${family}-family-v1/${f.texture.replace(family+'-family-','')}.webp`:`public/art/${family}-special-v1/${f.texture.replace(family+'-special-','')}.webp`;
    const width=Math.round(f.width*.4),height=Math.round(f.height*.4);
    const sprite=await sharp(texturePath).extract({left:f.x,top:f.y,width:f.width,height:f.height}).resize(width,height).png().toBuffer();
    const x=col*240+120-Math.round(f.footX*.4),y=v*210+174-Math.round(f.footY*.4);
    parts.push({input:sprite,left:Math.max(0,x),top:Math.max(0,y)});
    const label=`${v}/${col===0?'READY':f.move+'/'+f.pose}`;
    parts.push({input:Buffer.from(`<svg width="230" height="200"><text x="3" y="193" font-size="15" fill="#21352a">${label}</text><circle cx="120" cy="174" r="3" fill="#ff452b"/></svg>`),left:col*240,top:v*210});
   }
  }
  await sharp({create:{width:13*240+240,height:5*210+200,channels:4,background:'#e4dfce'}}).composite(parts).png().toFile(root+'/boards/'+family+'-'+a.id+'.png');
 }
}
await writeFile(root+'/inventory.json',JSON.stringify(inventory,null,2)+'\n');
console.log(JSON.stringify(inventory.map(({family,actors,pending})=>({family,actors,pending}))));
