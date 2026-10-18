import{readFile,writeFile}from'node:fs/promises';
const root='docs/source/hyeolma-family-v1';
const targets=[
 ['bloodblade-front-right', [1,4], 'Add the missing curved saber into his SCREEN-LEFT right fist in pose1 (row1 center) and pose4 (row2 center). Saber points low screen-left, exactly same length as idle pose0. Keep all other drawings unchanged.'],
 ['bloodhexer-front-right',[8,9], 'Repair ONLY pose8 (row3 right) and pose9 (row4 left): RIGHT arm originates SCREEN-LEFT shoulder, reaches ACROSS chest forward to bottom-right with open casting palm. LEFT hand remains near waist at SCREEN-RIGHT holding the same red tablet seen in idle0. Swap the current arms in these two poses to match idle grip. Tablet NEVER vanishes. All other drawings unchanged.'],
 ['sohong-front-right',[0,1,2,3,4,5,8,9,10,11], 'Swap fan to her RIGHT HAND in ALL12 drawings: her RIGHT arm originates SCREEN-LEFT shoulder in this front-right camera. Idle right forearm crosses across chest and holds fan base toward screen-right; left arm rests/counterbalances. Pose6/7 already use correct raised right arm, retain those. Contact8 right forearm crosses over chest and forward holding SAME fan base. No fan in her left hand, no hand swapping.'],
 ];
for(const[id,poses,detail]of targets)await writeFile(`${root}/${id}.target-v3.prompt.txt`,`Use case: precise-object-edit. Edit this transparent 3x4 sprite sheet. ${detail} Keep EXACT SAME12 pose order, grid, identity, head/body physical size, costume, camera and colors. Preserve alpha0. No rescaling/no VFX/no text. Reposition edge-near pose5/8 left within its cell for complete weapon and24px exterior padding; do not shrink.`);
await writeFile(`${root}/target-jobs.json`,JSON.stringify(targets.map(([id,poses])=>({id,poses,source:`${id}-target-v3.png`,prompt:`${id}.target-v3.prompt.txt`,reference:`${id}.png`})),null,2));
console.log('Saved three targeted grip corrections.');
