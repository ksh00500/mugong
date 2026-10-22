import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
const sharp = createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH ?? 'sharp');
const root = 'docs/source/snow-special-v1';
try {
  await readFile(root + '/generation-jobs.json');
  throw Error('Existing selected jobs preserved; use generation-planned-jobs.json to continue.');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
await mkdir(root + '/references', { recursive: true });
const base = JSON.parse(await readFile('src/game/snow-family-frames.json'));
const identities = JSON.parse(await readFile('docs/source/snow-family-v1/identities.json'));
const views = ['front', 'front-right', 'right', 'rear-right', 'back'];
const cameras = [
  'SOUTH screen bottom, FRONT view',
  'SOUTHEAST screen bottom-right, front-right three-quarter',
  'EAST screen right, true side profile',
  'NORTHEAST screen top-right, rear-right three-quarter; face turned away',
  'NORTH screen top, pure BACK; no frontal face',
];
const patterns = {
  mokjin: {
    bossId: '3-1',
    moves: ['dash', 'slam'],
    stories: [
      'Spear charge. 0 two separated grips on ONE straight long dark shaft with silver leaf blade and WHITE tassel, spear diagonally low in ready. 1 rear hand pulls shaft beside rear flank, front hand guides farther up same shaft; bend knees and load rear foot, chest/pelvis connected. 2 decisive forward planted lunge, rear hand drives spear FORWARD through target at chest height, front hand guides, front knee bent, rear leg pushes. 3 extended controlled followthrough, rigid shaft and leaf point same size; no jumping. 4 retract rear elbow and recover feet. 5 ready. Never bend pole, duplicate handle, reverse blade/butt or shrink charging body.',
      'Spear-tip ice-floor breaker. 0 ONE spear held at two separated grips diagonally across flank. 1 both hands raise SAME straight shaft so silver point is ABOVE and AHEAD, butt trails beside rear shoulder; shoulders and hips load together, knees flex. 2 drive spear point DOWN into ground immediately AHEAD of lead boot, two wrists aligned along same shaft, knees sink naturally and torso leans from hips. 3 hold point touching ground ahead; solid connected torso, no spinal kink. 4 lift point clear and bring spear outside body toward ready, straighten knees a little. 5 ready. Same spear length and single leaf head; no second grip handles, shaft through neck or body. Game supplies shattered ice, none in art.',
    ],
  },
  xuelan: {
    bossId: '3-2',
    moves: ['hazard', 'stance'],
    stories: [
      'Ice-sphere bombardment CAST, not throwing the held focus. 0 LEFT hand supports one small nonluminous ice focus orb beside waist, RIGHT hand empty beside chest. 1 right empty palm gathers behind upper chest, left orb stable and same size. 2 extend empty RIGHT palm FORWARD slightly DOWN at target, lead knee soft and rear foot grounded; right wrist connected, left hand still holds focus. 3 right palm follows forward gently, shoulders and pelvis turn together. 4 withdraw right palm toward ribs. 5 ready. No projectile in sheet, game emits a separate ice sphere. Focus never leaves left hand, no hand swap or second orb.',
      'Ice-silk binding command, not held defense. 0 LEFT hand holds original solid ice focus at waist; RIGHT palm free. 1 lift RIGHT open hand beside cheek with bent elbow, shift weight to rear leg, left orb stays beside flank. 2 extend RIGHT hand FORWARD and slightly DOWN, fingers form a natural loosely pinching gathering gesture, wrists and two arms connected. 3 deliberate stable gathering/pulling cue, right elbow retracts a little while body/pelvis remain coherent. 4 release fingers and withdraw right hand to chest. 5 ready. Game supplies tether; no drawn silk, rope, field, cage, glow or magic circle. Exactly one orb permanently in left hand.',
    ],
  },
  baixue: {
    bossId: '3-3',
    moves: ['stance', 'dash'],
    stories: [
      'Snow-wind breath concealment activation, not held guard. 0 two empty fists near ribs, large dark prayer beads across chest. 1 lower weight with knees and draw both forearms inward below chest, elbows stay naturally beside ribs, shoulders relaxed. 2 open BOTH hands and gently press palms DOWN and OUT at waist level as controlled breath, straight connected neck/spine and grounded feet. 3 steady breath cue with open hands held low, no exaggerated hit recoil. 4 close hands and bring fists back beside ribs. 5 ready. Game supplies concealment mist. No smoke, particles, new weapon or magic symbol in sheet.',
      'Hidden pursuit heavy RIGHT palm. 0 two fists ready. 1 draw RIGHT elbow back beside ribs and left fist guards chest, rear knee loaded and hips/shoulders coil coherently. 2 powerful forward step and RIGHT palm strike FORWARD at chest height, fingers upward, front knee bent and rear foot pushes, chest/neck/pelvis aligned. 3 connected forward followthrough, right elbow softly extended and LEFT hand at chest, at least one wrapped foot anchored. 4 retract right elbow and settle stance. 5 ready. Do not lift hand upward from low position or uppercut, swap arms, reverse spine, fly or shrink body. No ghost duplicates.',
    ],
  },
  hanxue: {
    bossId: '3-4',
    moves: ['fan', 'stance'],
    stories: [
      'Ice-wind fan release. 0 ONE crystalline pale-blue OPEN folding fan in RIGHT hand grasped at single root/rivet, LEFT hand empty near waist. 1 draw right fan hand high beside rear shoulder with folded elbow, coil shoulders/pelvis gently; crown stays upright. 2 step onto lead foot and sweep fan DOWN and FORWARD across target at chest height, wrist connected at root, left palm balances. 3 fan follows horizontally beyond target plane near waist/chest, body turns coherently. 4 return fan outside body beside ribs. 5 ready. No low-to-high uppercut, warped fan ribs, detached fan, second fan or ice shards; game supplies projectiles.',
      'Ice-wall retreat-route blockade command, not held guard. 0 RIGHT hand holds ONE open crystalline fan at waist, LEFT hand empty near ribs. 1 lift fan across upper chest and open LEFT palm beside shoulder, rear foot loaded. 2 extend LEFT empty palm DOWN and FORWARD toward ground ahead, fan stable across right chest, small natural forward lean from hips. 3 deliberate planted ground-directed command, shoulder/elbow/wrist chain coherent, crown/silver hair and robe dimensions unchanged. 4 withdraw left palm and lower fan outside torso. 5 ready. Game supplies barricades; do not paint walls, ground circles, ice pillars, glow or other characters. Fan remains attached to right hand at root.',
    ],
  },
};
const jobs = [];
for (const [character, p] of Object.entries(patterns)) {
  const actor = base.characters.find((c) => c.id === character);
  const identity = identities.find(
    (i) => i[0] === (character === 'mokjin' ? 'mujin' : character),
  )[4];
  for (let view = 0; view < 5; view++) {
    const id = character + '-' + views[view];
    const f = actor.frames.find((f) => f.view === view && f.kind === 'locomotion' && f.pose === 0);
    const reference = root + '/references/' + id + '.png';
    const { data, info } = await sharp(
      'public/art/snow-family-v1/' + f.texture.replace('snow-family-', '') + '.webp',
    )
      .extract({
        left: f.x + f.bounds.left,
        top: f.y + f.bounds.top,
        width: f.bounds.right - f.bounds.left,
        height: f.bounds.bottom - f.bounds.top,
      })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    // Hidden RGB at alpha zero is not visible art. Clear only those bytes in
    // the identity-reference crop; preserve every visible pixel and native size.
    for (let i = 0; i < data.length; i += 4)
      if (data[i + 3] === 0) data[i] = data[i + 1] = data[i + 2] = 0;
    await sharp(data, { raw: info })
      .extend({
        top: 32,
        bottom: 32,
        left: 32,
        right: 32,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toFile(reference);
    const height = f.bounds.bottom - f.bounds.top;
    const sources = [];
    for (let m = 0; m < 2; m++) {
      const sourceId = id + '-' + p.moves[m];
      const prompt = `Use case: identity-preserve. MUGONG production boss special animation sprite sheet. Input is a single READY actor cropped at NATIVE PIXEL SIZE, with transparent padding; identity, palette, anatomical scale, weapon and camera reference ONLY.\nIDENTITY: ${identity}\nExactly SIX full-body independent figures on a SQUARE transparent RGBA canvas, TWO COLUMNS by THREE ROWS, numbered only conceptually 0,1 / 2,3 / 4,5. No actual text/numbers/grid/background/shadow. Large generous blank cells, no neighboring silhouettes touching.\nCAMERA constant: same mildly elevated game camera as reference, ${cameras[view]}. All six heads/feet/chest/action aim this direction, no opposite-facing pose or front face in rear views. Shoulders, pelvis, knees and neck rotate coherently.\nPHYSICAL SCALE: reference ready hair-to-boots ${height}px, keep this native anatomical size; skull, hands, torso, limbs and weapon stay same pixel dimensions across all six poses and close to reference. Canvas approximately1800x1800 to leave at least48px transparent space around each silhouette, large lateral/overhead allowance for extended arms or spear. Do not enlarge figure to fill cell, do not shrink crouched/contact figure to fit weapon. Crouching bends joints, does not miniaturize skull/body. Hair and fur solid neutral material, no luminous edges.\nFRAME ACTIONS in row-major order: ${p.stories[m]}\nReadable anticipation → decisive target-directed contact → planted followthrough → controlled recovery. Exactly TWO arms and TWO feet with connected shoulder/elbow/wrist and hip/knee/ankle. One planted foot at every pose; no extra limbs hidden in cloak. Same crisp outlined detailed chibi wuxia illustration, stable winter costume palette and NEUTRAL diffuse light. No gold/blue emitted glow, rim light, alpha mist or particles. All hair, boot soles, hands and weapon tips fully visible within their OWN generous cell. Transparent alpha ZERO outside clean opaque silhouette, no trails/smears/projectiles/fog/aura/dust. Preserve original weapon hand and count, natural grips and original length.`;
      await writeFile(root + '/' + sourceId + '.prompt.txt', prompt);
      sources.push({ id: sourceId, source: sourceId + '.png', prompt: sourceId + '.prompt.txt' });
    }
    jobs.push({
      id,
      character,
      bossId: p.bossId,
      view,
      moves: p.moves,
      reference,
      source: sources[0].source,
      sources,
      poseSources: Array.from({ length: 12 }, (_, i) => sources[Math.floor(i / 6)].source),
      poseSourceCells: Array.from({ length: 12 }, (_, i) => ({
        columns: 2,
        rows: 3,
        index: i % 6,
      })),
    });
  }
}
await writeFile(root + '/generation-jobs.json', JSON.stringify(jobs, null, 2) + '\n');
console.log(
  JSON.stringify({
    jobs: jobs.length,
    sources: 40,
    patterns: Object.values(patterns).map((p) => ({ bossId: p.bossId, moves: p.moves })),
  }),
);
