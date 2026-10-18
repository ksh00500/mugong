import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const sharp=createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH??'sharp');
const root='docs/source/boss-remaining-v1',jobs=JSON.parse(await readFile(root+'/generation-jobs.json'));
const base=JSON.parse(await readFile('src/game/tianjian-family-frames.json'));
const actor=base.characters.find(c=>c.id==='mumyeong');
for(const [kind,story] of [
 ['straight-thrust','ONE hooded swordsman performs a coherent grounded lunge with ONE right-hand straight silver sword thrust towards the target. Exactly ONE body in EACH cell, absolutely no afterimage or duplicate person. Weapon aiming vectors MUST follow camera: SOUTH front tip screen DOWN foreshortened towards viewer; SOUTHEAST tip screen DOWN-RIGHT; EAST tip screen RIGHT; NORTHEAST tip UP-RIGHT; NORTH pure-back tip UP foreshortened above right shoulder. The original right gold hilt stays connected to original right wrist; left hand counterbalances. Sword along forearm axis, not a lateral sweep or raised overhead chop.'],
 ['horizontal-cut','ONE hooded swordsman performs ONE right-hand horizontal sweep after sword passes target. Exactly ONE body per cell, no afterimage. Torso and pelvis pivot together, one foot grounded, empty left hand balances. Blade tangent across the target plane: SOUTH front lateral blade towards viewer-left; EAST right profile blade finishes forward/downward across camera plane; NORTH back lateral blade left/right across target plane. Sword at waist/chest, not straight thrust or upward scoop. Preserve original right-hand ownership, single silver straight blade and gold guard.'],
]){
 const id='tianjian-mumyeong-'+kind;if(jobs.some(j=>j.id===id))continue;
 const parts=[];
 for(let v=0;v<6;v++){const f=actor.frames.find(f=>f.view===v%5&&f.kind==='locomotion'&&f.pose===0),b=f.bounds;
 const crop=await sharp('public/art/tianjian-family-v1/'+f.texture.replace('tianjian-family-','')+'.webp').extract({left:f.x+b.left,top:f.y+b.top,width:b.right-b.left,height:b.bottom-b.top}).png().toBuffer();
 parts.push({input:crop,left:v%2*543+Math.round((543-(b.right-b.left))/2),top:Math.floor(v/2)*482+Math.round((482-(b.bottom-b.top))/2)});}
 const guide='guides/'+id+'.png';await sharp({create:{width:1086,height:1448,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(parts).png().toFile(root+'/'+guide);
 const prompt=jobs[5].prompt.replace(jobs[5].story,story)+' Exactly6 separate full bodies at2columns3rows. Preserve the input figure pixel size in every cell. Dark hood/red scarf unchanged, no glow/trail. Slot5 originalREADY.';
 jobs.push({id,family:'tianjian',character:'mumyeong',bossId:'2-3',kind,guide,source:'generated/'+id+'.png',promptFile:'generated/'+id+'.prompt.txt',prompt,story,status:'pending'});
 await writeFile(root+'/generated/'+id+'.prompt.txt',prompt+'\n');
}
await writeFile(root+'/generation-jobs.json',JSON.stringify(jobs,null,2)+'\n');
