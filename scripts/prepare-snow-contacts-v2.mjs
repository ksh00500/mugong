import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
const sharp=createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH??'sharp');
const root='docs/source/snow-special-complete-v2';
const base=JSON.parse(await readFile('src/game/snow-family-frames.json'));
const jobs=[
 {id:'mokjin-sweep',character:'mokjin',description:'One continuous brown spear shaft with exactly ONE metal spearhead and one blunt butt. Two anatomically connected hands grasp DIFFERENT positions on the same straight shaft. Waist/chest level HORIZONTAL sweeping strike across the body, torso and hips rotate together, both feet grounded. Never overhead, never separate sticks or two handles.'},
 {id:'baixue-left',character:'baixue',description:'Second strike of a two-palm combo. Anatomical LEFT empty palm extends forward, RIGHT empty hand retracts to right ribs. Front: LEFT is screen RIGHT. Back: LEFT is screen LEFT. White-haired elderly martial artist, bare wrapped feet, white fur cloak, prayer beads. No gauntlet, weapon, projectile, or effect. Pelvis and shoulders rotate together; visible coherent elbow.'},
 {id:'baixue-stomp',character:'baixue',description:'Ground impact of a RIGHT FOOT stomp. Right foot planted firmly slightly forward, right knee bent, left foot supports behind. Lower hips slightly with upright spine, both EMPTY hands in compact chest guard. This is a LEG stomp, not a kneel, ground punch, floating leap, or standing ready pose. Elderly white-haired martial artist with fur cloak and beads, wrapped bare feet.'},
];
for(const j of jobs){
 const a=base.characters.find(a=>a.id===j.character),parts=[];
 for(let n=0;n<6;n++){
  const f=a.frames.find(f=>f.view===(n===5?0:n)&&f.kind==='locomotion'&&f.pose===0),b=f.bounds;
  const crop=await sharp('public/art/snow-family-v1/'+f.texture.replace('snow-family-','')+'.webp').extract({left:f.x+b.left,top:f.y+b.top,width:b.right-b.left,height:b.bottom-b.top}).png().toBuffer();
  parts.push({input:crop,left:n%2*640+Math.round((640-b.right+b.left)/2),top:Math.floor(n/2)*640+Math.round((640-b.bottom+b.top)/2)});
 }
 j.reference=`${root}/references/${j.id}-guide.png`;j.source=`generated/${j.id}.png`;j.prompt=`${j.id}.prompt.txt`;
 await sharp({create:{width:1280,height:1920,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(parts).png().toFile(j.reference);
 const p=`Create a production sprite sheet on TRANSPARENT background using the reference's SAME character identity, proportions, costume and five camera views. Exactly TWO columns and THREE rows, SIX separate full-body figures, reading order: 0 FRONT facing down, 1 FRONT RIGHT facing lower right, 2 RIGHT SIDE, 3 REAR RIGHT facing upper right, 4 BACK facing up, 5 unchanged FRONT READY from reference as scale calibration. First FIVE figures perform: ${j.description}\nLast sixth figure is exact relaxed front READY. Every figure has SAME head/body/limb dimensions as reference. No shrinking for wide arms or long weapon; leave large padding, body occupies about 55 percent cell height. No neighboring cells touching, nothing clipped. Retain aspect, no stretched anatomy, no detached hands, duplicate limbs, extra weapons. No glow, shadows, floor, strokes, text, cell outlines. Detailed chibi hand-painted wuxia game art matching reference. Whole-body biomechanical pose, no pasted rotated limb.`;
 await writeFile(`${root}/${j.prompt}`,p+'\n');
}
await writeFile(root+'/contact-jobs.json',JSON.stringify(jobs,null,2)+'\n');
console.log('Three five-view contact guides and exact prompts prepared');
