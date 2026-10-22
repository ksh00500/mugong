import {readFile,writeFile,copyFile} from 'node:fs/promises';
const root='docs/source/hyeolma-family-v1';
const jobs=JSON.parse(await readFile(`${root}/generation-jobs.json`));
const identities=JSON.parse(await readFile(`${root}/identities.json`));
const cameras=[['front',0,'SOUTH: straight front, face/chest looking toward screen BOTTOM, both shoulders equally visible. EVERY pose including all six attack poses aims BOTTOM.'],['right',2,'EAST: full RIGHT SIDE profile, nose toward RIGHT edge, near and far shoulders stacked. EVERY pose and attack aims RIGHT.'],['rear-right',3,'NORTHEAST: rear-right three-quarter, BACK of head/coat toward viewer, body facing screen TOP-RIGHT. Face mostly hidden, right cheek sliver only. EVERY pose and attack aims TOP-RIGHT.'],['back',4,'NORTH: straight BACK, BACK of head and shoulders fully towards viewer, NO face/eyes visible. EVERY pose and attack aims screen TOP.']];
for(const j of jobs.slice()){
 await copyFile(`${root}/${j.source}`,`${root}/${j.character}-front-right-original.png`);
 const fix=`Use case: precise-object-edit. Correct this transparent 3x4 twelve-pose sprite sheet. Keep EXACT identity, camera, grid, head/torso/limb/weapon size, colors, shading, ALL12 pose meanings. Do NOT rescale figures. ONLY add generous empty alpha margins by translating edge-near drawings toward their cell center; every hair/weapon/hand/foot needs at least24 native pixels inside outer canvas and clear from neighboring figure. Repair missing held weapons in walking and tiny-hit poses: ${identities[j.slot][3]}. ${j.character==='bloodhexer'?'Left hand must keep crimson tablet in contact pose8 too; right hand extends casting palm.':''} ${j.character==='bloodassassin'?'Pose7 draw dagger hand back next to flank instead of awkward overhead; pose8 forward stab aligned with forearm.':''} ${j.character==='sohong'?'Fan grip always at folding fan base in SAME RIGHT HAND. Idle fan hand screenRIGHT is her left: swap it to her actual right hand SCREEN LEFT so it matches windup6/7. Keep left hand open counterbalance, no mirrored identity.':''} Pose5 prone needs full same-size head/body, translate left to keep edge clearance. No glowing outlines, no VFX, no grid/text/background; genuine transparent alpha.`;
 await writeFile(`${root}/${j.character}-front-right.repair.prompt.txt`,fix);
 for(const [view,v,description]of cameras){
  const id=`${j.character}-${view}`,prompt=`${id}.prompt.txt`;
  const text=`Use case: identity-preserve. REDRAW ALL12 drawings in this sheet from a DIFFERENT CAMERA. Camera is ${description} Preserve this character's exact costume, physical head/body/limb/weapon dimensions, hand ownership, colors and neutral brightness. Transparent 3columns x4rows twelve poses same grid/order: idle,left-walk,passing-walk,right-walk,TINY-hit,prone-death,early-load,max-load,CONTACT,followthrough,withdrawal,ready. NO shrinking attack/contact/death to fit. Spacious padding: body centered and all hair/weapon/hand/boots at least24px inside canvas, never connected to neighbors. Keep original mild top-down game elevation. ${identities[j.slot][4]} ${j.character==='bloodhexer'?'Left hand ritual tablet ALWAYS retained including contact, right palm cast.':''} No VFX, halos, glow, shadow, blur, trail, detached magic, text or grid. Genuine transparent alpha0.`;
  await writeFile(`${root}/${prompt}`,text);
  jobs.push({...j,id,view:v,source:`${id}.png`,prompt});
 }
}
// Iterate only seven initial jobs, not the appended array.
await writeFile(`${root}/generation-jobs.json`,JSON.stringify(jobs,null,2));
