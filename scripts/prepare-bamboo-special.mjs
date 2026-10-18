import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const sharp = createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH ?? 'sharp');
const root = 'docs/source/bamboo-special-v1';
if (
  await access(root + '/generation-planned-jobs.json').then(
    () => true,
    () => false,
  )
)
  throw Error('Existing source plan preserved');
await mkdir(root + '/references', { recursive: true });
const base = JSON.parse(await readFile('src/game/bamboo-family-frames.json'));
const identities = JSON.parse(await readFile('docs/source/bamboo-family-v1/identities.json'));
const patterns = {
  qingbi: {
    bossId: '5-1',
    kit: 'src/domain/boss-wave5.ts',
    moves: ['ring', 'stance'],
    stories: [
      'Returning dagger release from anatomical LEFT hand. 0 LEFT holds reserve short silver dagger beside waist, RIGHT holds three short leaf needles. 1 LEFT elbow draws dagger beside rear shoulder and loads rear foot; RIGHT needles remain low and safe. 2 LEFT arm extends FORWARD and fingers open EMPTY, releasing dagger; coherent chest/pelvis turn and grounded feet. 3 EMPTY left hand follows forward, right needles stay attached to right fingers. 4 left hand returns toward belt for reset. 5 original ready with left dagger and right needles. Game supplies flying/returning blade; do not draw detached projectile or second dagger. Never swap ownership or throw with right hand.',
      'Concealment activation command, NOT held guard. 0 original LEFT reserve dagger and RIGHT three needles. 1 right wrist draws near ribs with needles safely tucked, left dagger held low outside hip; small rear knee load. 2 RIGHT forearm extends DOWN-FORWARD, keeping all three needles in same fingers; body sinks through knees, spine/neck connected. 3 grounded deliberate command, left blade remains safely outside body. 4 withdraw right wrist to ribs, rise slightly. 5 original ready. No smoke bomb materializes; game supplies mist. No extra palm/limb, no floating pose or drawn cloud.',
    ],
  },
  nogae: {
    bossId: '5-2',
    kit: 'src/domain/boss-melee.ts',
    moves: ['sweep', 'slam'],
    stories: [
      'Two-handed horizontal bamboo staff sweep. 0 ONE straight plain bamboo STAFF, two separated hand grips. 1 draw rear grip beside ribs, staff horizontal outside rear flank; shoulders and hips coil together with knees loaded. 2 sweep shaft FORWARD ACROSS target at waist/chest height, lead foot planted, rear knee pushes, hands stay on two distinct places of SAME shaft. 3 controlled low follow-through past target; torso turns coherently without reversing spine or facing. 4 retract staff outside hips. 5 ready. Slight drunk sway through weight shift, not full backspin. Two small wine gourds remain tied at left hip, never held. Both smooth ends unbladed, no spear head or second handle.',
      'Bamboo staff ground-end strike. 0 one staff with separated two-hand grip. 1 lift leading end ABOVE and AHEAD of lead shoulder, rear end trails behind hands, knees load; coherent torso. 2 drive SAME plain bamboo end DOWN to ground just AHEAD of lead sandal, two wrists aligned along shaft, sink from knees/hips. 3 planted ground contact follow-through, no spinal kink. 4 lift leading end and settle staff outside torso. 5 original ready. No point/blade/hammer added, same visible bamboo nodes and shaft length; gourds stay attached to belt. Game supplies ground impact, no drawn dust/ring.',
    ],
  },
  yanqing: {
    bossId: '5-3',
    kit: 'src/domain/boss-wave4.ts',
    moves: ['dash', 'stance'],
    stories: [
      'Pursuit high-to-low RIGHT jian cut. 0 ONE straight jian low in RIGHT hand, LEFT empty sword-fingers. 1 load rear foot and bring RIGHT hilt HIGH outside rear shoulder, rigid blade UP-BACK, hips/shoulders coil together. 2 decisive forward planted step and DOWN-FORWARD diagonal cut across target, right wrist at gold hilt and connected elbow; lead knee flexes, rear foot pushes. 3 blade finishes LOW past target with controlled weight transfer. 4 retract outside body. 5 low ready. No low-to-high scoop or uppercut, no weapon floating below unrelated hand; same blade length and skull size.',
      'Falling-bamboo lure command, NOT defense. 0 jian in RIGHT hand low beside hip, LEFT empty near ribs. 1 open LEFT sword-fingers beside chest, rear knee loads, sword stable and safely outside legs. 2 extend LEFT hand DOWN-FORWARD toward target ground, slight connected forward lean, right sword held low away from commanding wrist. 3 planted deliberate cue, stable neck/shoulders/pelvis. 4 left hand withdraws to ribs. 5 ready. Game supplies falling bamboo; no poles materialize in hands, no painted bamboo/runes/ground circle, no sword throw.',
    ],
  },
  songwol: {
    bossId: '5-4',
    kit: 'src/domain/boss-wave5.ts',
    moves: ['fan', 'stance'],
    stories: [
      'RIGHT open-fan needle volley. 0 ONE ivory folding fan with green bamboo motif in RIGHT hand at root/rivet, LEFT free. 1 draw fan HIGH beside rear shoulder with bent elbow, gentle coherent hip/torso load. 2 sweep fan DOWN-FORWARD across target at chest height, fingers firmly at root, lead foot planted and left empty palm counterbalances. 3 fan follows horizontally beyond target plane; shoulder/elbow/wrist connected. 4 bring fan back outside ribs. 5 ready. Fan never leaves hand, no detached needles, extra blades or uppercut; game emits the volley. Preserve fan ribs/motif/dimensions, white beard and robe.',
      'Reflective bamboo-wall activation, NOT an indefinitely held guard. 0 RIGHT holds original fan beside waist, LEFT empty near ribs. 1 bring right fan across upper chest and raise empty LEFT palm beside shoulder, knees gently flex. 2 extend LEFT empty palm DOWN-FORWARD toward target ground, fan stable in right fingers at root, torso leans coherently from hips. 3 planted command with same crownless head/beard/robe size; neck and pelvis aligned. 4 withdraw left palm and lower fan. 5 ready. Game supplies wall and reflection; no wall/pole/shield/projectile/aura in sheet. One fan, two arms, no materialized staff.',
    ],
  },
};
const views = ['front', 'front-right', 'right', 'rear-right', 'back'];
const facing = [
  'SOUTH screen bottom, foreshortened FRONT',
  'SOUTHEAST bottom-right, front-right three-quarter',
  'EAST screen right, true side',
  'NORTHEAST top-right, rear-right three-quarter, face turned away',
  'NORTH screen top, pure BACK, no frontal face',
];
const defaults = (await readFile('src/domain/boss-kit.ts', 'utf8'))
  .split('export const attack =')[1]
  .split('...overrides')[0];
const jobs = [],
  timings = [],
  promptRecords = [];
const hash = (b) => createHash('sha256').update(b).digest('hex');
for (const [character, p] of Object.entries(patterns)) {
  const actor = base.characters.find((a) => a.id === character),
    identity = identities.find((i) => i[0] === character)[4];
  const kit = (await readFile(p.kit, 'utf8')).split(`'${p.bossId}': {`)[1].split(/\n  '\d-\d':/)[0];
  const times = p.moves.map((move) => {
    const block = kit.split(new RegExp(`${move}: (?:a|punch)\\(`))[1].split('}),')[0];
    const number = (key) =>
      Number(
        block.match(new RegExp(key + ': ([\\d.]+)'))?.[1] ??
          defaults.match(new RegExp(key + ': ([\\d.]+)'))?.[1],
      );
    const timing = {
      bossId: p.bossId,
      character,
      move,
      name: block.match(/^'([^']+)'/)[1],
      windup: number('windup'),
      duration: number('duration'),
      recovery: number('recovery'),
      contacts: JSON.parse(
        '[' +
          (block.match(/contacts: \[([^\]]+)\]/)?.[1] ??
            defaults.match(/contacts: \[([^\]]+)\]/)[1]) +
          ']',
      ),
      holdEligible: /mechanic: 'stance'/.test(block),
    };
    if (timing.contacts.some((c) => c < 0 || c > timing.duration)) throw Error('Bad kit contact');
    timings.push(timing);
    return timing;
  });
  for (let view = 0; view < 5; view++) {
    const id = character + '-' + views[view],
      reference = root + '/references/' + id + '.png';
    const f = actor.frames.find((f) => f.view === view && f.kind === 'locomotion' && f.pose === 0);
    const { data, info } = await sharp(
      'public/art/bamboo-family-v1/' + f.texture.replace('bamboo-family-', '') + '.webp',
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
    const sources = [];
    for (let m = 0; m < 2; m++) {
      const sourceId = id + '-' + p.moves[m],
        t = times[m];
      const prompt = `Use case: identity-preserve. Asset type: MUGONG production boss special animation sprite sheet. Input is a SINGLE native-size READY actor, identity/palette/equipment/anatomical scale/camera reference ONLY.\nIDENTITY: ${identity}\nExactly SIX independent full-body figures on PORTRAIT 3:4 transparent RGBA canvas, TWO columns by THREE rows, row-major 0,1 / 2,3 / 4,5. No actual labels/grid/background/shadow. Each figure owns generous empty cell padding, no shared silhouettes or neighboring limbs.\nCAMERA constant: mildly elevated game view matching reference, ${facing[view]}. All heads/chest/pelvis/feet and contact aim this same direction, no opposite-facing contact. Chest-height front contact is foreshortened toward viewer, not sideways.\nNATIVE ANATOMICAL SCALE: ready silhouette is ${info.height}px high; match reference skull/torso/limbs/equipment size IN PIXELS throughout, not a thumbnail to enlarge. Canvas approximately2400x3200 for empty travel space. Minimum48px transparent outside spacing, generous overhead/lateral weapon allowance. Never fill cell by enlarging body or shrink contact body to fit weapon; crouch bends joints while skull stays same size.\nSIX ACTION EXPOSURES: ${p.stories[m]}\nActual production timing ${t.name}: windup ${t.windup}s, strike ${t.duration}s, contacts at ${t.contacts.join('/')}s of strike, recovery ${t.recovery}s. Art stages prepare, load, contact, follow-through, return, ready.\nKeep crisp outlined detailed chibi wuxia illustration, stable original costume colors, NEUTRAL diffuse lighting. No emitted glow, colored rim outline or halo. TWO arms and TWO feet, connected shoulder/elbow/wrist and hip/knee/ankle; at least one foot planted. Pelvis/torso/neck turn coherently, no reversed spine. Same equipment ownership and dimensions, plausible grip, no duplicate handle or hidden extra limbs. Full hair/feet/weapon ends visible in own cell; opaque material, transparent alpha ZERO outside clean silhouette. No motion smear/trail/projectile/mist/smoke/particles/magic circle/effect. Game draws effects separately.\n`;
      await writeFile(root + '/' + sourceId + '.prompt.txt', prompt);
      sources.push({ id: sourceId, source: sourceId + '.png', prompt: sourceId + '.prompt.txt' });
      promptRecords.push({
        id: sourceId,
        reference,
        referenceSha256: hash(await readFile(reference)),
        prompt: root + '/' + sourceId + '.prompt.txt',
        promptSha256: hash(Buffer.from(prompt)),
      });
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
await writeFile(root + '/generation-planned-jobs.json', JSON.stringify(jobs, null, 2) + '\n');
await writeFile(
  root + '/preflight.json',
  JSON.stringify(
    {
      status: 'prepared only; no generated or installed art',
      plannedBosses: 4,
      plannedMoves: 8,
      plannedSources: 40,
      timings,
      promptRecords,
    },
    null,
    2,
  ) + '\n',
);
await writeFile(
  root + '/promptset.md',
  '# 죽림 보스 특별 모션 제작 입력\n\n내장 imagegen 제작 예정. 아직 생성·게임 적용은 하지 않았다. 단일 READY 기준20장, 4보스×2패턴×5시점의40프롬프트.\n\n' +
    promptRecords
      .map(
        (r) =>
          `- ${r.id}: [프롬프트](${r.prompt.split('/').at(-1)}) · [기준](references/${r.id.replace(/-(ring|stance|sweep|slam|dash|fan)$/, '')}.png)`,
      )
      .join('\n') +
    '\n',
);
console.log(
  JSON.stringify({
    preparedBosses: 4,
    preparedMoves: 8,
    preparedReferences: 20,
    preparedSources: 40,
    generated: 0,
    runtimeChanged: false,
  }),
);
