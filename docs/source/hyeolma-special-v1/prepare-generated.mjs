import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const sharp = createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH ?? 'sharp');
const root = 'docs/source/hyeolma-special-v1';
if (
  await access(root + '/generation-planned-jobs.json').then(
    () => true,
    () => false,
  )
)
  console.log('Refreshing existing preparation plan; generated PNGs preserved');
await mkdir(root + '/references', { recursive: true });
const base = JSON.parse(await readFile('src/game/hyeolma-family-frames.json'));
const identities = JSON.parse(await readFile('docs/source/hyeolma-family-v1/identities.json'));
const patterns = {"jeogu":{"bossId":"8-1","kit":"src/domain/boss-wave4.ts","moves":["dash","stance"],"stories":["Forward pursuit HIGH-TO-LOW RIGHT saber cut. 0 original ready. 1 RIGHT hilt above rear shoulder, blade points up-back, LEFT original gauntlet protects chest; rear knee loads. 2 planted forward stride and DOWN-FORWARD diagonal slash, right shoulder/elbow/wrist connected to SAME hilt; hips and shoulders turn together. 3 long LOW follow-through outside opposite flank, no reverse spine. 4 withdraw blade outside body to low guard. 5 original ready. ONE right curved saber, ONE left gauntlet, never swap hands. No uppercut/scooping upward.","Blood-ground activation command, NOT held defense. 0 original ready. 1 draw LEFT gauntlet beside ribs, RIGHT saber low outside hip; knees load modestly. 2 LEFT gauntleted hand extends DOWN-FORWARD toward target ground, small coherent hip hinge, RIGHT saber remains safely outside limbs. 3 hold brief grounded command. 4 retract left arm to guard and settle knees. 5 original ready. Do not draw blood pool or aura; game supplies effect. One right saber and one left gauntlet throughout."]},"yeonsal":{"bossId":"8-2","kit":"src/domain/boss-wave4.ts","moves":["dash","slam"],"stories":["Gauntleted SHOULDER charge, NOT an uppercut or fist thrust. 0 original two gauntlets guarded. 1 rear knee loads, leading shoulder aims at target, leading elbow folded beside ribs and opposite fist guards chest. 2 rear foot drives forward into planted lead stride, SHOULDER makes contact while both wrists remain folded safely. 3 short forward grounded follow-through with continuous neck/spine/pelvis. 4 straighten knees and return fists to guard. 5 ready. No weapon, roll or full backspin; same skull, gauntlets and torso dimensions.","Heavy grounded FOOT STOMP, not a downward punch. 0 original ready. 1 lift lead knee modestly while rear boot remains planted; both fists guard chest. 2 lead boot STAMPS DOWN just ahead, hips/knees compress naturally with spine intact, both gauntlets stay clear of knees. 3 brief grounded compression, same skull scale. 4 straighten through knees and recover balanced guard. 5 ready. No jumping flip or drawn shockwave; game supplies ground impact."]},"sohong":{"bossId":"8-3","kit":"src/domain/boss-wave5.ts","moves":["fan","stance"],"stories":["RIGHT held open fan blood-orb volley. 0 original RIGHT fan, LEFT empty. 1 draw fan beside rear shoulder, elbow naturally bent, rear knee loads and torso coils slightly. 2 sweep fan DOWN-FORWARD across target at chest height, RIGHT fingers visibly grip ONE fan root, LEFT empty palm counterbalances away from ribs. 3 fan follows beyond target horizontally, shoulders/hips turn together. 4 retract fan outside torso and return elbow. 5 ready. Fan never leaves right hand; no emitted orb/needle/glow painted in sprite. Maintain fan ribs and width, gown/face size.","Healing-blocking binding spell command, NOT held guard. 0 original RIGHT fan beside waist, LEFT empty palm near chest. 1 bring empty LEFT palm beside shoulder while right fan stays low outside hip, knees gently flex. 2 extend LEFT palm FORWARD-DOWN toward target with naturally connected shoulder/elbow/wrist, chest/pelvis aligned; right fan stable in same root grip. 3 deliberate planted command. 4 withdraw left hand and settle shoulders. 5 original ready. No rope, blood pool, rune, particles or extra object; game supplies binding."]},"jeokcheon":{"bossId":"8-4","kit":"src/domain/boss-wave5.ts","moves":["dash","stance"],"stories":["Dominant fast pursuit HIGH-TO-LOW RIGHT broad saber cut. 0 original low right saber and free left palm. 1 load rear knee and bring RIGHT hilt HIGH outside rear shoulder, rigid blade up-back; crown/neck/hips connected. 2 planted forward stride with decisive DOWN-FORWARD diagonal cut, right elbow/wrist connected to same hilt, LEFT empty palm counterbalances. 3 low controlled follow-through outside opposite flank with torso/pelvis turning together. 4 retract saber outside legs to low guard. 5 original ready. No upward scoop, extra handle, floating weapon, full backward spin or shrink-to-fit body.","Life-exchange seal command, NOT sustained defense. 0 right saber low safely outside hip, LEFT empty near ribs. 1 LEFT empty palm rises beside chest, knees gently load, RIGHT wrist on original hilt. 2 LEFT palm extends DOWN-FORWARD toward target ground with coherent modest hip hinge; crown/skull stay same size, saber safely outside commanding arm. 3 brief deliberate grounded command. 4 withdraw left palm and settle knees. 5 ready. Game supplies seal and life-exchange effect; no orb, weapon throw, symbol or drawn glow."]}};
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
    identity = identities.find((i) => i[0] === character)[3];
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
      'public/art/hyeolma-family-v1/' + f.texture.replace('hyeolma-family-', '') + '.webp',
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
  '# 혈마전 보스 특별 모션 제작 입력\n\n내장 imagegen 제작 예정. 아직 생성·게임 적용은 하지 않았다. 단일 READY 기준20장, 4보스×2패턴×5시점의40프롬프트.\n\n' +
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
