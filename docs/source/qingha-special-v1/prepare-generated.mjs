import { mkdir, readFile, writeFile } from 'node:fs/promises';
const root = 'docs/source/qingha-special-v1';
await mkdir(root, { recursive: true });
const base = JSON.parse(await readFile('src/game/qingha-family-frames.json'));
const views = ['front', 'front-right', 'right', 'rear-right', 'back'];
const facing = [
  'SOUTH facing screen bottom, front view',
  'SOUTHEAST facing bottom-right, front-right three-quarter',
  'EAST facing right, true side profile',
  'NORTHEAST facing top-right, back-right three-quarter, face turned away',
  'NORTH facing screen top, pure back, NO frontal face',
];
const patterns = {"madabong":{"bossId":"0-1","moves":["summon","dash"],"stories":["Bandit command shout. 0 curved dao low in RIGHT hand and left fist beside ribs. 1 lift EMPTY LEFT fist beside chest, rear foot loaded. 2 open LEFT palm and thrust it forward as a commanding shout, dao safely beside right hip, grounded broad stance. 3 hold forward command briefly with connected shoulders and pelvis. 4 withdraw left palm to ribs. 5 ready. No minions, new weapons, horn, flag, glow or projectiles in sheet.","Shoulder charge. 0 dao low in RIGHT hand. 1 bend knees, load rear foot, tuck right sword hand beside hip and left forearm across chest. 2 powerful forward step with LEFT shoulder leading toward target, rear leg pushes, head neck chest pelvis form natural coherent forward lean; dao remains low clear of legs. 3 planted follow-through with left shoulder still leading. 4 settle knees and lift chest, withdraw left arm. 5 ready. No airborne floating body, blade thrust, reverse spine or uppercut."]},"nojin":{"bossId":"0-2","moves":["combo","stance"],"stories":["Three long spear thrusts, one coherent thrust cycle repeated by game. 0 ONE straight wooden spear with silver leaf tip and blue tassel, original two hands on distinct grips. 1 draw REAR grip beside flank, front grip guides same continuous shaft, rear knee loads. 2 thrust spear FORWARD at target chest, lead knee bent, rear heel grounded, shoulders and pelvis rotate together, front elbow softly extended. 3 controlled forward followthrough, shaft stays straight. 4 retract rear grip beside ribs for next thrust. 5 ready. Preserve spear length, two hands, ONE shaft, one leaf head, no doubled handles or bent spear.","Escort flag deployment command, NOT a parry or held guard. 0 spear upright in original rear weapon hand with butt beside supporting boot. 1 stabilize spear as front hand releases its grip and lifts near chest. 2 extend EMPTY free palm forward/down, commanding escort formation, spear remains upright securely grasped in original hand. 3 grounded deliberate command. 4 retract free hand toward front spear grip. 5 both hands ready. Game supplies flag; do NOT paint a flag, magic shield, extra pole or changed spear. Neck torso pelvis connected."]},"cheolmu":{"bossId":"0-3","moves":["thrust","sweep"],"stories":["Chain capture cast. TWO separate SHORT iron chains ending in small diamond steel weights, one grip in each hand. 0 right chain gathered beside ribs, left reserve chain safely low. 1 draw RIGHT elbow back beside shoulder while hips coil, left hand balances. 2 cast RIGHT chain FORWARD toward target with right arm extended, continuous visible chain between right hand and its single weight; LEFT reserve chain remains gathered beside left waist. 3 follow through with right chain taut forward, weight is same size as before. 4 right elbow retracts and gathers chain. 5 ready. No chain through neck/torso, detached weights, third weapon or spaghetti coils. Game supplies reach effect beyond this local short chain.","Chain rotation sweep. TWO short chains each held in its own hand with one small diamond weight. 0 chains low outside hips. 1 load hips and shoulders together, right elbow draws back and right weight trails behind. 2 broad RIGHT chain sweeps horizontally across target while torso turns with pelvis and knees; left chain held low and clear. 3 followthrough with right chain stretched out beyond target plane and one planted boot. 4 gather right chain beside ribs. 5 ready. No whole character spinning backwards away from facing, no chain wrapping chest or neck, no detached handle/weight, no drawn circle or VFX."]},"hanmugeuk":{"bossId":"0-4","moves":["slash","sweep"],"stories":["Charged powerful high-to-low dao cut. 0 ONE massive curved silver dao with gold guard in RIGHT hand low beside hip, LEFT fist free. 1 coil shoulders and hips together, raise right hand and blade above REAR shoulder, rear knee loaded. 2 decisive DOWN-and-FORWARD diagonal cut through target, right hand moves from shoulder height DOWN across target plane, front knee bends and rear foot pushes. 3 blade finishes LOW past target, left arm counterbalances, planted grounded stance. 4 withdraw blade outside body and settle feet. 5 low ready. Never lift blade from low to high or uppercut. Rigid same-length dao, connected right wrist at ONE gold hilt.","Great horizontal dao sweep. 0 dao low in RIGHT hand. 1 draw right sword hand behind ribs, blade horizontally outward, coil torso and pelvis together, left fist balances. 2 broad chest-height horizontal cut through target, RIGHT hand leads blade, lead knee bends, at least one boot anchored. 3 sword finishes beyond target plane at waist/chest height and torso follows smoothly. 4 withdraw outside body. 5 ready. Same camera/facing in all poses; no full backspin, upside-down body, uppercut or blade passing through torso. One weapon in original right hand."]}};
const jobs = [];
for (const [character, p] of Object.entries(patterns)) {
  const identity = (
    await readFile(`docs/source/qingha-family-v1/${character}-front-right.prompt.txt`, 'utf8')
  )
    .split('\n')
    .find((l) => l.startsWith('IDENTITY:'))
    .replace(/Preserve Image1 row\d identity\./, '');
  for (let view = 0; view < 5; view++) {
    const id = `${character}-${views[view]}`;
    const reference = `docs/source/qingha-family-v1/${id}.png`;
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
