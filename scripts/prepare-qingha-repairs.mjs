import { readFile, writeFile } from 'node:fs/promises';
const root = 'docs/source/qingha-family-v1';
const specs = [
 ['qingharaider-rear-right',[2,8],[], 'Move both rightmost drawings 50 pixels LEFT, restoring the entire sword tips within the canvas.'],
 ['qingharaider-back',[5,11],[4,10], 'Move the prone and final ready rightmost figures 50 pixels LEFT, restore complete curved sword tips.'],
 ['qinghaguard-right',[5],[4], 'Move prone figure 45 pixels LEFT. Keep the spear complete and gripped by both hands.'],
 ['madabong-right',[5],[4], 'Move prone figure 55 pixels LEFT and restore whole dao blade.'],
 ['madabong-right',[9],[10], 'Move row4 column1 follow-through figure 35 pixels LEFT and 20 pixels UP. Complete dao blade without touching anything.'],
 ['madabong-right',[10],[9], 'Keep row4 column2 withdrawing figure, complete dao blade. Remove the neighboring figure, giving transparent clearance.'],
 ['madabong-rear-right',[8],[7], 'Move contact figure row3 column3 55 pixels LEFT, retaining the whole dao blade and forearm.'],
 ['madabong-back',[5,6],[4], 'Move prone figure 50 pixels LEFT with whole dao. Correct early load row3 column1: dao MUST stay in anatomical RIGHT hand, screen-RIGHT arm raised and sword swept back over right shoulder; left hand empty balancing forward. Match row3 column2 maximum load right-hand ownership.'],
 ['nojin-front-right',[8],[7], 'Move contact row3 column3 55 pixels LEFT, restore complete blue spearhead and tassel. Maintain both hands gripping ONE straight shaft at hip/chest.'],
 ['nojin-right',[7],[8], 'Move maximum-load row3 column2 30 pixels LEFT, completing spear tip and tassel. Keep two hands at chest/hip ready to thrust EAST.'],
 ['nojin-right',[8],[7], 'Move contact row3 column3 50 pixels LEFT, completing spear tip and tassel. Both hands thrust EAST.'],
 ['qinghaguard-back',[6,7,8,9],[], 'Correct NORTH attack direction. The camera sees back of head, blue tabard and shoulders. Body faces straight NORTH. Both hands lower the spear to waist then push away from viewer toward TOP CENTER, not upper-right. Contact spear shaft projects straight UP with foreshortening; spearhead lies above head at top-center. Early/max load shaft also points north/up, rear end behind lower hand. Follow-through stays north. Both hands grip ONE rigid shaft, shoulders/hips rotate together slightly, grounded boots. Preserve native head size and the four different stages.'],
 ['qinghabowman-front',[6,7,8,9],[], 'Correct SOUTH firing direction. Camera sees front face/chest. Aim the crossbow AWAY from chest toward viewer, screen-BOTTOM CENTER, not screen-right. Stock foreshortened toward bottom-center, broad bow limbs horizontal across frame, bolt rail center line projects vertically downward. Right hand trigger grip near body, left hand under fore-end. Early raise, max aim, bolt release, small recoil four distinct stages. Maintain same native head/body sizes; no sideways profile crossbow for a SOUTH facing archer.'],
 ['hanmugeuk-right',[5,8],[4,7], 'Move prone and contact rightmost figures 55 pixels LEFT; restore complete curved dao tips without shortening or changing the body size.'],
 ['hanmugeuk-rear-right',[5],[4], 'Move prone figure 55 pixels LEFT and restore the complete curved dao.'],
 ['hanmugeuk-back',[5,8],[4,7], 'Move prone and contact rightmost figures 55 pixels LEFT and restore complete dao tips.'],
 ['cheolmu-front',[8,9],[], 'Correct SOUTH chain attack. Right hand (screen LEFT anatomical right) sends its short chain and diamond weight FORWARD toward BOTTOM CENTER. Foreshortened chain crosses in front of torso ending below/forward of right fist, NOT horizontally to screen-right. Left hand holds the separate spare short chain at left hip. Follow-through preserves same right-hand ownership and southward path. Preserve two chains, two weights, no third chain.'],
 ['cheolmu-rear-right',[6,7],[], 'Fix attacking hand continuity. Contact row3 column3 uses anatomical RIGHT hand, near arm toward screen RIGHT. Early and maximum load must raise SAME RIGHT arm/chain back over RIGHT shoulder. Other left hand keeps spare chain at left hip and does not become attacking hand. Shoulders and hips turn naturally together, elbows and wrists continuous.'],
 ['cheolmu-back',[7,8,9],[], 'Correct NORTH chain attack and hand continuity. Right arm is screen RIGHT viewed from rear. Maximum load raises same right chain over right shoulder, matching early load; left hand retains its other chain at left hip. Contact extends RIGHT hand FORWARD away from viewer to TOP CENTER with foreshortened short chain, diamond weight above head at top-center, not upper-right. Follow-through remains northward, with right arm lowering slightly. No front face, no swapped weapons or hands.'],
];
const jobs = JSON.parse(await readFile(`${root}/generation-jobs.json`, 'utf8'));
const repairs = [];
for (let i=0;i<specs.length;i++) {
 const [id, poses, blank, instruction] = specs[i];
 const j = jobs.find(j=>j.id===id);
 const key = `${id}-repair-${i+1}`;
 const prompt = `Edit the supplied transparent sprite sheet in place. Same portrait canvas, THREE columns FOUR rows. Preserve camera, character, colors, style, exact native physical head/body/weapon dimensions. No resize, no zoom, no fitting to cell, no glow, no shadow background. Transparent alpha outside artwork. Zero-based row-major pose indices 0..11. ONLY modify pose indices ${poses.join(', ')}. ${blank.length ? `Erase whole drawings at pose indices ${blank.join(', ')} to TRANSPARENT, they are unused neighbors in this repair source; leave those cells empty.` : 'Retain all other drawings.'} ${instruction} Every selected figure must have at least 35 pixels clear transparent space from original sheet outer boundary and be disconnected from its neighboring drawings. Do not shorten weapons. No labels/grid. Anatomically sound wrists, elbows and continuous weapon grips. Keep the rest of the original sheet unchanged.`;
 await writeFile(`${root}/${key}.prompt.txt`, prompt+'\n');
 repairs.push({id, key, poses, blank, source:j.source, prompt:`${key}.prompt.txt`, output:`${key}.png`});
}
await writeFile(`${root}/repair-requests.json`,JSON.stringify(repairs,null,2)+'\n');
console.log(repairs.length);
