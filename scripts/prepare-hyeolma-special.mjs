import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const sharp = createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH ?? 'sharp');
const root = 'docs/source/hyeolma-special-v1';
const patterns = {
  jeogu: { bossId: '8-1', kit: 'src/domain/boss-wave4.ts', moves: ['dash','stance'], stories: [
    'Forward pursuit HIGH-TO-LOW RIGHT saber cut. 0 original ready. 1 RIGHT hilt above rear shoulder, blade points up-back, LEFT original gauntlet protects chest; rear knee loads. 2 planted forward stride and DOWN-FORWARD diagonal slash, right shoulder/elbow/wrist connected to SAME hilt; hips and shoulders turn together. 3 long LOW follow-through outside opposite flank, no reverse spine. 4 withdraw blade outside body to low guard. 5 original ready. ONE right curved saber, ONE left gauntlet, never swap hands. No uppercut/scooping upward.',
    'Blood-ground activation command, NOT held defense. 0 original ready. 1 draw LEFT gauntlet beside ribs, RIGHT saber low outside hip; knees load modestly. 2 LEFT gauntleted hand extends DOWN-FORWARD toward target ground, small coherent hip hinge, RIGHT saber remains safely outside limbs. 3 hold brief grounded command. 4 retract left arm to guard and settle knees. 5 original ready. Do not draw blood pool or aura; game supplies effect. One right saber and one left gauntlet throughout.'
  ] },
  yeonsal: { bossId: '8-2', kit: 'src/domain/boss-wave4.ts', moves: ['dash','slam'], stories: [
    'Gauntleted SHOULDER charge, NOT an uppercut or fist thrust. 0 original two gauntlets guarded. 1 rear knee loads, leading shoulder aims at target, leading elbow folded beside ribs and opposite fist guards chest. 2 rear foot drives forward into planted lead stride, SHOULDER makes contact while both wrists remain folded safely. 3 short forward grounded follow-through with continuous neck/spine/pelvis. 4 straighten knees and return fists to guard. 5 ready. No weapon, roll or full backspin; same skull, gauntlets and torso dimensions.',
    'Heavy grounded FOOT STOMP, not a downward punch. 0 original ready. 1 lift lead knee modestly while rear boot remains planted; both fists guard chest. 2 lead boot STAMPS DOWN just ahead, hips/knees compress naturally with spine intact, both gauntlets stay clear of knees. 3 brief grounded compression, same skull scale. 4 straighten through knees and recover balanced guard. 5 ready. No jumping flip or drawn shockwave; game supplies ground impact.'
  ] },
  sohong: { bossId: '8-3', kit: 'src/domain/boss-wave5.ts', moves: ['fan','stance'], stories: [
    'RIGHT held open fan blood-orb volley. 0 original RIGHT fan, LEFT empty. 1 draw fan beside rear shoulder, elbow naturally bent, rear knee loads and torso coils slightly. 2 sweep fan DOWN-FORWARD across target at chest height, RIGHT fingers visibly grip ONE fan root, LEFT empty palm counterbalances away from ribs. 3 fan follows beyond target horizontally, shoulders/hips turn together. 4 retract fan outside torso and return elbow. 5 ready. Fan never leaves right hand; no emitted orb/needle/glow painted in sprite. Maintain fan ribs and width, gown/face size.',
    'Healing-blocking binding spell command, NOT held guard. 0 original RIGHT fan beside waist, LEFT empty palm near chest. 1 bring empty LEFT palm beside shoulder while right fan stays low outside hip, knees gently flex. 2 extend LEFT palm FORWARD-DOWN toward target with naturally connected shoulder/elbow/wrist, chest/pelvis aligned; right fan stable in same root grip. 3 deliberate planted command. 4 withdraw left hand and settle shoulders. 5 original ready. No rope, blood pool, rune, particles or extra object; game supplies binding.'
  ] },
  jeokcheon: { bossId: '8-4', kit: 'src/domain/boss-wave5.ts', moves: ['dash','stance'], stories: [
    'Dominant fast pursuit HIGH-TO-LOW RIGHT broad saber cut. 0 original low right saber and free left palm. 1 load rear knee and bring RIGHT hilt HIGH outside rear shoulder, rigid blade up-back; crown/neck/hips connected. 2 planted forward stride with decisive DOWN-FORWARD diagonal cut, right elbow/wrist connected to same hilt, LEFT empty palm counterbalances. 3 low controlled follow-through outside opposite flank with torso/pelvis turning together. 4 retract saber outside legs to low guard. 5 original ready. No upward scoop, extra handle, floating weapon, full backward spin or shrink-to-fit body.',
    'Life-exchange seal command, NOT sustained defense. 0 right saber low safely outside hip, LEFT empty near ribs. 1 LEFT empty palm rises beside chest, knees gently load, RIGHT wrist on original hilt. 2 LEFT palm extends DOWN-FORWARD toward target ground with coherent modest hip hinge; crown/skull stay same size, saber safely outside commanding arm. 3 brief deliberate grounded command. 4 withdraw left palm and settle knees. 5 ready. Game supplies seal and life-exchange effect; no orb, weapon throw, symbol or drawn glow.'
  ] }
};
const template = await readFile('scripts/prepare-bamboo-special.mjs','utf8');
const start=template.indexOf('const patterns = {'),end=template.indexOf('const views =');
let program=(template.slice(0,start)+'const patterns = '+JSON.stringify(patterns)+';\n'+template.slice(end))
  .replaceAll('bamboo','hyeolma').replaceAll('죽림','혈마전')
  .replace("identities.find((i) => i[0] === character)[4]", "identities.find((i) => i[0] === character)[3]")
  .replace("throw Error('Existing source plan preserved');", "console.log('Refreshing existing preparation plan; generated PNGs preserved');");
await mkdir(root,{recursive:true});
await writeFile(root+'/prepare-generated.mjs',program);
await import('../'+root+'/prepare-generated.mjs');
const preflight=JSON.parse(await readFile(root+'/preflight.json'));
for(const r of preflight.promptRecords){
  const meta=await sharp(r.reference).metadata();
  const bodyHeight=meta.height-64;
  const guide=r.reference.replace('/references/','/guides/');
  await mkdir(root+'/guides',{recursive:true});
  const raw=await sharp(r.reference).toBuffer();
  const placements=Array.from({length:6},(_,i)=>({input:raw,left:(i%2)*512+Math.floor((512-meta.width)/2),top:Math.floor(i/2)*512+512-meta.height-48}));
  if(meta.width>480||meta.height>440)throw Error('Reference exceeds guide slot: '+r.id);
  await sharp({create:{width:1024,height:1536,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(placements).png().toFile(guide);
  let p=await readFile(r.prompt,'utf8');
  p=p.replace('Input is a SINGLE native-size READY actor, identity/palette/equipment/anatomical scale/camera reference ONLY.', 'Input1 is the native READY actor. Input2 is a 1024x1536 composition guide with six IDENTICAL native-size READY figures in six slots. EDIT guide slots into the requested action. Preserve slots0 and5 exactly and maintain their skull/torso/limb/equipment pixel size in slots1-4.');
  p=p.replace('Canvas approximately2400x3200 for empty travel space. Minimum48px transparent outside spacing, generous overhead/lateral weapon allowance.', `Output 1024x1536 matching the guide. Six512x512 slots. Body height around ${bodyHeight}px matching guide, not512px. Huge transparent margin intentionally leaves motion travel space. Minimum40px empty inset from EVERY slot edge, no neighboring overlap. Do not fill slots by enlarging figures. Use guide at native1:1, no resizing. Do not put all six figures across three columns or crop tips.`);
  await writeFile(r.prompt,p);r.promptSha256=createHash('sha256').update(p).digest('hex');r.guide=guide;r.guideSha256=createHash('sha256').update(await readFile(guide)).digest('hex');r.referenceHeight=bodyHeight;
}
await writeFile(root+'/preflight.json',JSON.stringify(preflight,null,2)+'\n');
console.log(JSON.stringify({references:20,guides:40,prompts:40,scale:'native1:1 guide, no pose fitting'}));
