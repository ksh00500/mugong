import {readFile,writeFile,mkdir} from 'node:fs/promises';
const root='docs/source/snow-special-complete-v2';await mkdir(root+'/generated',{recursive:true});
const actors={
 xuelan:{bossId:'3-2',moves:['hazard','stance'],identity:'Young black-haired woman with ornate blue crystal hairpiece, white fur winter mantle, blue embroidered layered robes and dark boots. Exactly ONE small solid nonluminous ice orb held permanently in anatomical LEFT hand; anatomical RIGHT hand is always empty. No fan or weapon.',
 actions:[
 'Ice-sphere bombardment cast: 0 ready with left orb at waist and empty right palm at chest; 1 draw right open palm toward shoulder loading rear knee; 2 extend empty RIGHT palm FORWARD and slightly DOWN toward the target; 3 grounded forward follow-through, left orb stable; 4 right palm returns to ribs; 5 ready. Orb is a focus, NEVER thrown. Game emits projectiles separately.',
 'Ice-silk binding command: 0 same ready; 1 lift empty RIGHT hand beside cheek, rear leg loaded; 2 RIGHT hand reaches forward at chest height, fingers loosely PINCH together, left orb stays at flank; 3 right elbow draws back slightly with gathering/pulling gesture; 4 open and withdraw right hand; 5 ready. No drawn rope/silk/cage or effects.'
 ]},
 baixue:{bossId:'3-3',moves:['stance','dash'],identity:'Muscular elderly white-haired man, wild white hair and full white beard/eyebrows, heavy dark wooden prayer beads, white fur mantle over brown/charcoal winter tunic, dark trousers, wrapped bare feet. Both hands EMPTY, no gauntlet armor, orb, fan or weapon.',
 actions:[
 'Snow breathing/collecting strength: 0 both fists ready at ribs; 1 both open palms draw inward at abdomen while knees bend slightly; 2 both empty palms settle parallel at abdomen, shoulders lowered and ribs expanded; 3 measured exhale with palms lowering gently, feet planted; 4 hands return to ready fist guard; 5 ready. Controlled breathing, NOT hurt/recoil or a new defensive hold.',
 'Heavy RIGHT palm pursuit strike: 0 both fists ready; 1 load RIGHT elbow behind ribs and LEFT fist guards chest, bend rear knee; 2 forward step with RIGHT open palm striking FORWARD chest height, fingers UP, body/pelvis/neck aligned and rear foot pushes off; 3 palm follows past target with coherent torso turn, one foot planted; 4 retract right elbow and regain guard; 5 ready. NOT uppercut, NOT fall or horizontal floating body.'
 ]},
 hanxue:{bossId:'3-4',moves:['fan','stance'],identity:'Regal silver-haired young woman, blue ice crystal crown and ornaments, silver/ice-blue layered robes, white fur mantle, dark shoes. Exactly ONE OPEN pale-blue crystalline folding FAN in anatomical RIGHT hand, wrist visibly grips fan root/rivet. Anatomical LEFT hand always empty. No orb, sword, staff or second fan.',
 actions:[
 'Ice-wind fan release: 0 right OPEN fan at torso and empty left hand at waist; 1 right fan hand draws up beside rear shoulder, elbow bent, pelvis and shoulders coil coherently; 2 right fan sweeps DOWN and FORWARD at target chest height; 3 right fan follows HORIZONTALLY across target plane near waist/chest, left palm balances; 4 retract right fan to ribs; 5 ready. Decisive slash, NOT low-to-high uppercut. Fan stays attached to right wrist at root, no projectiles in artwork.',
 'Ice escape-route sealing command: 0 fan in RIGHT hand at torso; 1 hold right fan steady and load empty LEFT palm beside cheek; 2 LEFT empty palm pushes forward and slightly down to command target ground, right fan remains beside flank; 3 LEFT hand settles with fingers splayed naturally, body stays grounded; 4 left hand withdraws to waist; 5 ready. No drawn ice field/gate/circle, game supplies it. This is activation, NOT indefinite guard.'
 ]}
};
const views=['front','front-right','right','rear-right','back'];
const cameras=[
 'SOUTH, front view toward viewer/screen-bottom. Chest and face visible symmetrically. Forward attacks are foreshortened toward screen-bottom; not sideways. Anatomical LEFT is screen-RIGHT and anatomical RIGHT is screen-LEFT.',
 'SOUTHEAST, front three-quarter toward screen-bottom-right. BOTH chest and right-facing profile visible. All faces and feet and attacks aim diagonally bottom-right; never face left. Not a pure side view.',
 'EAST, right side profile toward screen-right. Nose, chest, feet and every attack point RIGHT.',
 'NORTHEAST, rear three-quarter toward screen-top-right. Back of head and back garment visible, nose points right and away. All attacks aim top-right, never left or toward viewer.',
 'NORTH, full back view toward screen-top. Only back of head/back garment, NO front face. Attacks aim away/up-screen. Anatomical LEFT is screen-LEFT and anatomical RIGHT is screen-RIGHT.'
];
const jobs=[];
for(const [actor,a] of Object.entries(actors))for(const [view,direction] of views.entries()){
 const id=actor+'-'+direction;
 const prompt=`Production MUGONG wuxia boss animation sprite sheet, identity reference is the attached READY character.\nIDENTITY: ${a.identity}\nExactly TWELVE independent full-body figures on transparent RGBA canvas, THREE columns by FOUR rows, equal generous cells. Row-major reading order 0..11. First SIX figures (rows1-2) are motion A; last SIX (rows3-4) motion B. No words/numbers/grid/background/shadows.\nCAMERA for EVERY figure: ${cameras[view]} Use same mildly elevated top-down camera as reference.\nMOTION A, cells0..5: ${a.actions[0]}\nMOTION B, cells6..11: ${a.actions[1]}\nMatch the same skull, torso, limb dimensions and costume palette in ALL TWELVE poses, including contact. Do not enlarge to fill cell or miniaturize for wide arms. Crouching bends joints without shrinking head. Keep enough empty transparent padding around every silhouette for extended hands/hair/feet. No neighboring figures touch or cross cells. Entire head, boots, fingers, fan/orb fully visible; enlarge EMPTY canvas instead of shrinking anatomy. Keep body size close to reference; clear crisp outlined chibi wuxia painted style, neutral diffuse light.\nExactly two anatomically connected arms/legs. Shoulder/elbow/wrist and pelvis/knee/ankle coherent; head turn supported by spine. At least one foot grounded. Keep equipment in the specified ANATOMICAL hand through ALL views and phases. No hand swaps, extra limbs, detached grips. Motion preparation -> strong contact -> follow-through -> recovery. NO glowing edges, light emissions, cyan halos, particles, mist, trails, slash VFX or floor shadow. Material is opaque with clean transparent alpha ZERO outside. No weapon/figure clipped at image boundary. Both READY poses must match character body scale of the motion frames.`;
 const reference=`docs/source/snow-special-v1/references/${id}.png`;
 await writeFile(`${root}/generated/${id}.prompt.txt`,prompt+'\n');
 jobs.push({id,character:actor,bossId:a.bossId,view,moves:a.moves,source:`generated/${id}.png`,reference,prompt:`generated/${id}.prompt.txt`,columns:3,rows:4});
}
await writeFile(root+'/generation-jobs.json',JSON.stringify(jobs,null,2)+'\n');
console.log(JSON.stringify(jobs.map(j=>({id:j.id,moves:j.moves,reference:j.reference}))));
