import { mkdir, readFile, writeFile } from 'node:fs/promises';
const root = 'docs/source/dokmu-special-v1';
await mkdir(root, { recursive: true });
const base = JSON.parse(await readFile('src/game/dokmu-family-frames.json'));
const views = ['front', 'front-right', 'right', 'rear-right', 'back'];
const facing = [
  'SOUTH facing screen bottom, front view',
  'SOUTHEAST facing bottom-right, front-right three-quarter',
  'EAST facing right, true side profile',
  'NORTHEAST facing top-right, back-right three-quarter, face turned away',
  'NORTH facing screen top, pure back, NO frontal face',
];
const patterns = {
  cheongrin: {
    bossId: '1-1',
    moves: ['dash', 'stance'],
    stories: [
      'Pursuit downward sword cut. 0 low ready with sword hand beside rear ribs. 1 weight on rear leg, sword lifted beside upper rear shoulder; pelvis and shoulders coil together. 2 decisive grounded forward step and DOWN-ACROSS cut through target plane; front knee bent, rear leg pushing, blade ends forward and below chest. 3 planted follow-through beyond target plane, elbow soft, free hand balances. 4 retract blade while settling rear foot. 5 low ready. Do NOT scoop upward from below. Sword decorative serpentine edge remains rigid and same length; no new weapon.',
      'Poison-vein ritual deployment, NOT a guard/parry. 0 lower sword diagonally beside the body, free palm close to chest. 1 open free palm and load a small coherent hip turn, sword held safely away from legs. 2 extend free palm FORWARD and slightly DOWN as poison-vein deployment cue; grounded feet and sword hand stable beside hip. 3 hold deliberate open-palm command, no magical drawing. 4 withdraw free palm to ribs. 5 original sword ready. Maintain sword in original hand throughout; no additional flask/fan/staff.',
    ],
  },
  mukchil: {
    bossId: '1-2',
    moves: ['hazard', 'fan'],
    stories: [
      'Poison flask throw. 0 one green flask in RIGHT hand beside ribs. 1 draw right hand BACK beside shoulder, elbow folded, rear foot loaded, left hand aims/balances. 2 right forearm snaps FORWARD and releases flask toward target: RIGHT hand is EMPTY and fingers open at release. 3 empty right hand follows forward/down; left hand balances. 4 empty right hand reaches toward belt/backpack for refill. 5 a single new flask back in right hand at ready. No detached projectile in this sheet, game supplies it. Bottle cannot stick to hand after release; no bottle on left hand.',
      'Three poison needles scatter from RIGHT hand. 0 keep green flask tucked at belt, right fingertips pinch THREE tiny dark green metal needles near ribs. 1 pull right elbow back, wrist aligned with forearm, left palm balances. 2 extend right hand forward with short horizontal wrist fan and OPEN fingers, needles released so hand EMPTY. 3 empty hand follows sideways only a little, torso turns with pelvis. 4 retract hand beside belt to refill. 5 flask in original right hand at ready. No airborne needles/colored trails; no sword or fan materializes; do not remove herb backpack.',
    ],
  },
  yeonhwa: {
    bossId: '1-3',
    moves: ['fan', 'stance'],
    stories: [
      'Poison needle fan release. 0 ONE open rigid purple/gold folding fan held at pivot in RIGHT hand near ribs. 1 draw fan high beside rear shoulder with elbow folded; left palm aims at target. 2 step onto lead foot and flick fan DOWN and ACROSS target at chest height using connected shoulder/elbow/wrist; free palm balances. 3 fan follows past target plane while torso and pelvis turn together. 4 bring fan back toward chest. 5 fan ready. Fan never leaves hand, no bent ribs/fused wrists. Game supplies needles, do not draw projectiles.',
      'Purple poison-mist ritual. 0 open fan near right hip, LEFT hand close to chest. 1 lift fan across upper chest, turn hips/torso slightly as left palm opens. 2 sweep fan horizontally OUTWARD and extend left palm forward/down, grounded open stance; fan always grasped at pivot by right hand. 3 hold open deliberate command pose; no actual fog. 4 lower left palm and draw fan beside ribs. 5 original fan ready. This is ritual, not injury or oversized flinch; no missing feet, no contorted neck or reversed spine.',
    ],
  },
  sagongyeom: {
    bossId: '1-4',
    moves: ['fan', 'stance'],
    stories: [
      'Triple poison-bead staff cast. 0 staff upright in original hand, free palm near ribs. 1 incline staff head toward target, rear elbow loaded and free palm gathers at chest. 2 drive staff head forward at chest height and extend free palm, lead knee bends and rear foot planted; whole wooden shaft stays straight and same length. 3 controlled forward follow-through with soft elbow; no projectile drawing. 4 retract staff and free palm to repeat loading for next shot. 5 original staff ready. Repeated contact timings are supplied by game. Staff is never thrown, no detached gem, no second pole.',
      'Antidote-herb trial ritual. 0 staff upright planted beside supporting foot, free palm over waist. 1 bend knees a little and raise free palm beside chest while staff hand anchors rigid shaft. 2 command free palm toward GROUND AHEAD, deliberate grounded forward lean through hips, staff head stays above hand and staff butt beside foot. 3 hold ground-directed command, connected neck/chest/pelvis; no bowing spine kink. 4 straighten knees slightly and retract palm. 5 upright original staff ready. Game generates herbs; no plants/ground circles/mist drawn into sheet.',
    ],
  },
};
const jobs = [];
for (const [character, p] of Object.entries(patterns)) {
  const identity = (
    await readFile(`docs/source/dokmu-family-v1/${character}-front-right.prompt.txt`, 'utf8')
  )
    .split('\n')
    .find((l) => l.startsWith('IDENTITY:'))
    .replace(/Preserve Image1 row\d identity\./, '');
  for (let view = 0; view < 5; view++) {
    const id = `${character}-${views[view]}`;
    const reference = `docs/source/dokmu-family-v1/${id}.png`;
    const native = base.characters
      .find((c) => c.id === character)
      .frames.find((f) => f.view === view && f.kind === 'locomotion' && f.pose === 0);
    const bodyHeight = native.bounds.bottom - native.bounds.top;
    const sources = [];
    for (let m = 0; m < 2; m++) {
      const sourceId = `${id}-${p.moves[m]}`;
      const prompt = `Use case: identity-preserve. Asset type: MUGONG production boss special-motion sprite sheet.\nInput image is identity/style/color/anatomical pixel scale and camera reference ONLY; replace sequence with specified special action.\n${identity}\nExactly SIX full-body figures, TWO columns by THREE rows, LANDSCAPE 2048x1536 transparent RGBA canvas. Row-major order 0..5. One actor centered in each generous cell. NO text/grid/shadow/background.\nCamera in ALL six figures: same mildly elevated game camera as reference, ${facing[view]}. Face, feet, chest and attack aim this direction throughout; no opposite-facing pose or front-facing face in back views. Small whole-body rotation only, pelvis/shoulders/neck coherent.\nAt actual1448x1086 output cells724x362. Reference ready actor is ${bodyHeight}px hair-to-boots; match that physical anatomy IN PIXELS, skull about95px wide, consistent skull/torso/limbs/weapon across six poses. Never enlarge to fill cell or shrink a wide/crouching action. Leave minimum48px transparent margin to outside canvas and clear spacing between every figure, generous lateral air for hands/weapons/hair. A low stance lowers head, NEVER scales it.\nSix sequential frames for ${p.moves[m]}: ${p.stories[m]}\nSame crisp outlined detailed chibi wuxia style and costume palette, neutral diffuse light, no new rim light, no gold/green/purple emitted glow. Preserve exact hair/beard/flower/crown/backpack/robes and weapon count. Every hilt/fan pivot/flask/staff remains connected to correct hand with plausible two-armed anatomy. Two hands, two feet, coherent knee/elbow/wrist chains. At least one boot planted.\nOutside silhouettes alpha ZERO; no fog/haze/halo/gradient, no motion blur/smear/effect/trail/spark/projectile/dust/ground shadow. Colored gems and poison liquids are LOCAL MATERIAL COLOR only. Do not fit wide silhouettes by shrinking. Full body/boots/weapon tips entirely visible. Priorities: connected anatomy and weapon grip, correct direction, same physical size, readable load/contact/followthrough.`;
      await writeFile(`${root}/${sourceId}.prompt.txt`, prompt);
      sources.push({ id: sourceId, source: `${sourceId}.png`, prompt: `${sourceId}.prompt.txt` });
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
await writeFile(`${root}/generation-jobs.json`, JSON.stringify(jobs, null, 2) + '\n');
console.log(
  JSON.stringify({
    jobs: jobs.length,
    sources: jobs.length * 2,
    patterns: Object.values(patterns).map((p) => ({ bossId: p.bossId, moves: p.moves })),
  }),
);
