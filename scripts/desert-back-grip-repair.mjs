import {readFile,writeFile,copyFile} from 'node:fs/promises';
const root='docs/source/desert-family-v1';
const requests=JSON.parse(await readFile(`${root}/generation-requests.json`));
const output=[];
for(const character of process.argv.slice(2)){
 const id=`${character}-back`,j=requests.find(j=>j.id===id);
 await copyFile(`${root}/${j.source}`,`${root}/${id}-original.png`);
 const prompt=`Use case: precise-object-edit. Correct weapon-hand ownership ONLY in this transparent 3x4 twelve-pose NORTH BACK-view sprite sheet. Preserve exact identity, camera, head/torso/weapon pixel size, grid and all12 pose meanings. In a straight BACK view the character's anatomical RIGHT shoulder and RIGHT hand are on SCREEN RIGHT; anatomical LEFT is on SCREEN LEFT. Idle carries weapon in RIGHT hand SCREEN RIGHT, but row3 columns1/2 (logicalposes6/7 early/max load) incorrectly put it in LEFT hand. REDRAW ONLY these two load poses so RIGHT shoulder SCREEN RIGHT leads to natural bent RIGHT elbow and RIGHT wrist on SCREEN RIGHT, weapon held just beside RIGHT shoulder/RIGHT flank on SCREEN RIGHT. Left arm stays SCREEN LEFT ${character==='ringblade'||character==='naya'?'holding reserve ring at LEFT hip. Right ring loaded SCREEN RIGHT then empty RIGHT hand extends north after release.':'with empty open balance hand. Right dagger/dao loads beside RIGHT flank/shoulder then extends forward north.'} Do not mirror the entire character, do not swap hands, do not cross weapon behind spine. Keep feet and pelvis turned NORTH, no face. Other10 drawings unchanged, no shrinking, fully transparent alpha0 and roomy padding, no VFX or background.`;
 const file=`${id}.grip-repair.prompt.txt`;await writeFile(`${root}/${file}`,prompt);output.push({...j,prompt:file,text:prompt,references:[`${root}/${j.source}`]});
}
console.log(JSON.stringify(output));
