import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
const sharp=createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH??'sharp');
const root='docs/source/tomb-bamboo-special-v2';
await mkdir(root+'/generated',{recursive:true});await mkdir(root+'/references',{recursive:true});
const views=['front','front-right','right','rear-right','back'],jobs=[];
for(const family of ['tomb','bamboo']){
 const old=JSON.parse(await readFile(`docs/source/${family}-special-v1/preflight.json`));
 for(const character of [...new Set(old.timings.map(t=>t.character))])for(let view=0;view<5;view++){
  const actions=old.timings.filter(t=>t.character===character),id=character+'-'+views[view];
  const prompts=await Promise.all(actions.map(a=>readFile(`docs/source/${family}-special-v1/${id}-${a.move}.prompt.txt`,'utf8')));
  const line=(p,s)=>p.split('\n').find(l=>l.startsWith(s));
  const reference=`docs/source/${family}-special-v1/references/${id}.png`;
  const crop=await sharp(reference).trim().png().toBuffer(),meta=await sharp(crop).metadata();
  const guide=`${root}/references/${id}-layout.png`;
  await sharp({create:{width:1920,height:2560,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(Array.from({length:12},(_,n)=>({input:crop,left:n%3*640+Math.floor((640-meta.width)/2),top:Math.floor(n/3)*640+Math.floor((640-meta.height)/2)}))).png().toFile(guide);
  const prompt=`Use case: identity-preserve. Production MUGONG boss special-animation sprite sheet, transparent RGBA. Image1 is the SINGLE original READY identity/equipment/camera reference. Image2 is a SPACING GUIDE only; replace repeated idle figures with described poses.\n${line(prompts[0],'IDENTITY:').replace('LEFT hand holds ONE reserve short silver dagger near waist throughout.','LEFT hand holds ONE reserve short silver dagger near waist except during LEFT release/contact/follow-through, when LEFT is EMPTY. RIGHT retains three needles.')}\nTWELVE separate FULL BODY figures, exactly THREE COLUMNS FOUR ROWS on portrait canvas. Reading order0..11. First SIX figures0..5 perform MOTION A, last SIX6..11 perform MOTION B. No captions, grid, shadows, backdrop. Body height about55-60% of cell; keep large transparent margins.\n${line(prompts[0],'CAMERA constant:')}\nMOTION A local poses0..5: ${line(prompts[0],'SIX ACTION EXPOSURES:').replace('SIX ACTION EXPOSURES: ','')}\nMOTION B local poses0..5 (global6..11): ${line(prompts[1],'SIX ACTION EXPOSURES:').replace('SIX ACTION EXPOSURES: ','')}\nAll12skulls, torso, limb lengths, costume and equipment dimensions SAME. Never shrink attacking figure to fit extended weapon; leave more empty air. Shoulder/elbow/wrist and pelvis/knee/ankle connected. Head and torso turn coherently, no reversed spine. In REAR views, hands in front of abdomen/chest are OCCLUDED by torso, NEVER paint fingers on back. Honor anatomical hand ownership through all poses. One continuous straight staff/pick handle, two spaced grips; fan root attached to owning hand. No duplicate prop, disconnected grip, extra fingers/arms/legs.\nAll silhouettes independent and wholly inside own cells, no contact between neighboring figures or canvas border. Preserve clear detailed outlined chibi wuxia painted style and neutral diffuse light from original. Transparent alpha ZERO outside; no glowing border, colored fringe, VFX, particles, floor, smoke, flying weapon, trails or effects. Game supplies attacks/effects separately. Preparation -> load -> contact -> follow-through -> return -> identical READY. No low-to-high uppercut for sword/fan. DO NOT enlarge face at contact or shrink crouching head. Exactly3columns4rows.`;
  const promptPath=`generated/${id}.prompt.txt`;await writeFile(root+'/'+promptPath,prompt+'\n');
  jobs.push({id,character,family,bossId:actions[0].bossId,view,moves:actions.map(a=>a.move),timings:actions,reference,guide,prompt:promptPath,source:`generated/${id}.png`,columns:3,rows:4});
 }
}
await writeFile(root+'/generation-jobs.json',JSON.stringify(jobs,null,2)+'\n');
console.log(JSON.stringify({jobs:jobs.length,bosses:8,actions:16}));
