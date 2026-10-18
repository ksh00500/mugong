import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
const sharp=createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH??'sharp');
const root='docs/source/three-special-install-v2';
await mkdir(root+'/references',{recursive:true});await mkdir(root+'/generated',{recursive:true});
const metrics=[];
for(const family of ['desert','hyeolma','zhuge']){
 const base=JSON.parse(await readFile(`src/game/${family}-family-frames.json`));
 const draft=JSON.parse(await readFile(`public/art/${family}-special-v1/frames-draft.json`));
 for(const actor of draft.characters){
  const ordinary=base.characters.find(c=>c.id===actor.id),views=[];
  for(let view=0;view<5;view++){
   const ref=ordinary.frames.find(f=>f.view===view&&f.kind==='locomotion'&&f.pose===0);
   const ready=actor.frames.filter(f=>f.view===view&&f.pose===5);
   views.push({view,baseHeight:ref.bounds.bottom-ref.bounds.top,specialReadyHeights:ready.map(f=>f.bounds.bottom-f.bounds.top),ratios:ready.map(f=>(ref.bounds.bottom-ref.bounds.top)/(f.bounds.bottom-f.bounds.top))});
  }
  const ratios=views.flatMap(v=>v.ratios).sort((a,b)=>a-b);
  metrics.push({family,id:actor.id,bossId:actor.bossId,views,proposedWholeActorFactor:(ratios[4]+ratios[5])/2});
  if(family==='desert'&&actor.id==='naya'){
   const parts=[];
   for(let index=0;index<6;index++){
    const view=index===5?0:index,ref=ordinary.frames.find(f=>f.view===view&&f.kind==='locomotion'&&f.pose===0);
    const file=`public/art/${family}-family-v1/${ref.texture.replace(family+'-family-','')}.webp`;
    const b=ref.bounds,crop=await sharp(file).extract({left:ref.x+b.left,top:ref.y+b.top,width:b.right-b.left,height:b.bottom-b.top}).png().toBuffer();
    parts.push({input:crop,left:index%2*512+Math.round((512-(b.right-b.left))/2),top:Math.floor(index/2)*512+Math.round((512-(b.bottom-b.top))/2)});
   }
   await sharp({create:{width:1024,height:1536,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(parts).png().toFile(root+'/references/naya-five-view-ready.png');
  }
 }
}
await writeFile(root+'/scale-audit.json',JSON.stringify(metrics,null,2)+'\n');
console.log(JSON.stringify(metrics.map(({family,id,proposedWholeActorFactor})=>({family,id,factor:proposedWholeActorFactor}))));
