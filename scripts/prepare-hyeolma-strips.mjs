import {readFile,writeFile} from 'node:fs/promises';
const root='docs/source/hyeolma-family-v1';
const requests=JSON.parse(await readFile(`${root}/final-v8-requests.json`));
for(const id of ['sohong-front','sohong-rear-right','sohong-back']){
 const r=requests.find(r=>r.id===id);
 const view=id==='sohong-front'?'strict FRONT SOUTH, face visible':id==='sohong-back'?'strict BACK NORTH, face never visible':'rear-three-quarter NORTHEAST, back hair visible, gaze upper-right';
 const side=id==='sohong-front'?'SCREEN RIGHT':id==='sohong-back'?'SCREEN LEFT':'far LEFT arm, on upper-right side of torso';
 const size=id==='sohong-front'?340:id==='sohong-back'?310:330;
 r.source=`${id}-combat-v9.png`;r.prompt=`${id}.combat-v9.prompt.txt`;r.poses=[6,7,8,9,10,11];r.grid={columns:3,rows:2,offset:6};
 r.references=[`${root}/${id}-idle-reference.png`];
 r.text=`Use case: identity-preserve. The input is ONE unchanged native-size idle character reference, 512x512 transparent canvas. Create SIX new transparent attack keyframes of this exact red-gold fan witch. Output1536x1024, uniform3columns x2rows, each512px cell. Each character stays the SAME native head/torso/limb size as input: crown-to-foot approx${size}px, roomy clear padding at least48px in cell. Do NOT enlarge to fill cell, do NOT shrink contact. Preserve costume, skin, brightness and black hair. Same ${view} camera throughout. Exactly one red-black-gold FAN in ANATOMICAL LEFT hand, ${side}, every frame. Anatomical right arm is EMPTY and open balance hand, separate visibly. Never transfer weapon hands, never cross the right arm across chest to grip fan, no second fan. Keep fan-side shoulder-elbow-wrist-handle visibly continuous. Six stages row-major: 0 pull LEFT elbow toward left ribs and fan beside LEFT chest; 1 further cock same LEFT fan wrist at shoulder, small waist coil, supporting foot planted; 2 LEFT arm sweeps fan forward toward facing target, below shoulder height, correct left shoulder connected through left elbow to left hand, empty right palm still visible; 3 continue same left-arm sweep slightly lower with following sleeve/hair, no wrist switch; 4 retract same left fan to chest; 5 settle idle same left-hand fan. Chest-height forward fan sweep with weight shift, not overhead or uppercut, no contorted spine. For front contact keep fan/wrist in SCREENRIGHT half of torso; for back keep fan on SCREENLEFT. Six complete distinct connected sprites, no touching neighbors, no clipping. Genuinely transparent alpha0, no shadow/glow/trail/background/text/grid.`;
 await writeFile(`${root}/${r.prompt}`,r.text);
}
await writeFile(`${root}/final-v8-requests.json`,JSON.stringify(requests,null,2)+'\n');
console.log(JSON.stringify(requests));
