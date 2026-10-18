import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const sharp=createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH??'sharp');
const root='docs/source/snow-family-v1',scan=JSON.parse(await readFile(`${root}/source-scan.json`)),jobs=JSON.parse(await readFile(`${root}/generation-jobs.json`));
const fixes=[];
for(const r of scan.records.filter(r=>r.id!=='snowhunter-front-right' && (r.component<0||r.shared||r.clipped))){
 const j=jobs.find(j=>j.id===r.id),g=j.poseSourceCells[r.pose];
 const {width,height}=await sharp(`${root}/${r.source}`).metadata();
 const row=Math.floor(g.index/g.columns),col=g.index%g.columns;
 const key=`${r.id}-separate-p${r.pose}`,camera=j.view===0?'SOUTH front':j.view===4?'NORTH back':j.view===2?'EAST side':'diagonal matching original';
 const prompt=`EDIT the transparent ${width}x${height} sprite sheet, ${g.columns}columns x${g.rows}rows. SELECTED DRAWING is row${row+1} column${col+1} (logical pose${r.pose}). Keep that ONE full warrior with exact original physical head/body/limb/weapon dimensions, existing ${camera} camera, costume, pose and neutral palette. Remove ALL OTHER warriors in the SAME ROW to alpha0. Preserve every other row unchanged. Move the ENTIRE selected warrior including weapon into the horizontal CENTER of that now-empty whole row so there are at least80px alpha padding at BOTH left and right canvas edges. Also keep16px clear before row top/bottom. Translate only, NEVER shrink or enlarge actor or weapon. Restore any clipped weapon/hair/feet tip completely. Spears have ONE forward silver leaf point/tassel, ONE plain blunt wood rear butt, two separated CLOSED hand grips on SAME straight shaft, no grip duplication or bent weapon. Do not add a spear to characters that have none. Alpha0 everywhere outside sprites, no background, glow or effects. Only the full selected middle-row drawing will be extracted, so empty neighboring cells are intentional.\n`;
 const output=`${key}.png`,promptFile=`${key}.prompt.txt`;
 await writeFile(`${root}/${promptFile}`,prompt);
 fixes.push({id:r.id,key,poses:[r.pose],source:r.source,output,promptFile,prompt,references:[`C:/Users/user/Documents/ChatGPT/MUGONG/${root}/${r.source}`],cell:{rectangle:[0,Math.floor(row*height/g.rows),width,Math.floor((row+1)*height/g.rows)]}});
}
await writeFile(`${root}/separation-repair-requests.json`,JSON.stringify(fixes,null,2)+'\n');
console.log(JSON.stringify(fixes));
