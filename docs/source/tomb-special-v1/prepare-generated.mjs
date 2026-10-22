import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const sharp = createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH ?? 'sharp');
const root = 'docs/source/tomb-special-v1';
if (
  await access(root + '/generation-planned-jobs.json').then(
    () => true,
    () => false,
  )
)
  throw Error('Existing source plan preserved');
await mkdir(root + '/references', { recursive: true });
const base = JSON.parse(await readFile('src/game/tomb-family-frames.json'));
const identities = JSON.parse(await readFile('docs/source/tomb-family-v1/identities.json'));
const patterns = {"jeokho":{"bossId":"6-1","kit":"src/domain/boss-wave5.ts","moves":["slam","stance"],"stories":["Heavy two-hand mining pick DOWNWARD strike. 0 TWO separated grips on ONE continuous wooden shaft with ONE curved two-ended iron mining head. 1 raise pick ABOVE rear shoulder, both elbows bend, rear knee loads, torso/pelvis turn together; the iron head remains same size. 2 bring pick DOWN-FORWARD into ground AHEAD of lead boot, rear arm drives and front hand guides same shaft, hips hinge naturally and knees flex. 3 planted low follow-through, neck/spine coherent and all pick ends visible. 4 retract outside torso and settle feet. 5 original ready. Never uppercut, shaft through neck, double handle, impossible backward wrist or shrink-to-fit contact. Game supplies impact.","Heated floor activation, NOT held guard or another overhead pick strike. 0 ONE original pick secure in both separated hand grips, head held low outside body. 1 draw shaft beside hip and load rear knee, chest/pelvis/neck coherent. 2 deliberately STAMP lead boot onto ground ahead with modest knee lift then planted pressure, original pick remains secure beside flank with TWO hands, no tool swing through head. 3 grounded floor-command stance with heel settled, torso upright, pick held safely to side. 4 bring rear foot alongside normal stance. 5 ready. Game supplies heated floor; no lever, switch, glowing tool, ground marks, extra arm or detached pick appears."]},"seokmun":{"bossId":"6-2","kit":"src/domain/boss-wave4.ts","moves":["dash","stance"],"stories":["LEFT stone shield forward charge. 0 LEFT forearm strapped to ONE rectangular carved stone shield, RIGHT holds ONE short stone hammer low. 1 brace shield in front of LEFT chest, bend knees, tuck right hammer safely behind right hip. 2 powerful forward planted step with LEFT shoulder/shield leading, shield handle remains attached to left forearm, right hammer stays low clear of legs. Rear leg pushes, head/neck/chest/pelvis align in natural forward lean. 3 controlled grounded shield-led follow-through, no shield through face or missing elbow. 4 lift chest and retract left elbow slightly. 5 original ready. Do not transform hammer into fist or swap shield side; no flying body or enlarged shield.","TRUE sustained LEFT shield guard. 0 LEFT original shield braced chest height, RIGHT hammer low outside hip. 1 settle weight through bent knees, draw shield toward left shoulder and load rear foot. 2 raise shield slightly FORWARD to intercept at chest/head height, left elbow naturally bent behind original handle and strapped forearm; right hammer safely low. 3 stable planted defended hold, neck/chest/pelvis coherent and both boots visible. 4 release pressure and lower shield a little. 5 ready. Game can hold exposure3 during defensive mechanic. This is not a spell or knockback recoil. No magical shield, new wall, detached left hand, weapon swap or oversized flinch."]},"gwakgi":{"bossId":"6-3","kit":"src/domain/boss-wave5.ts","moves":["fan","stance"],"stories":["LEFT forearm launcher saw release; NOT a wrench throw. 0 RIGHT holds ONE plain iron wrench, LEFT empty hand with compact gear launcher strapped to forearm. 1 draw left elbow near ribs and aim forearm launcher toward target, right wrench stays safely low. 2 extend LEFT forearm FORWARD at chest height and press left fingers slightly to command release, coherent shoulder/elbow/wrist, front boot planted. 3 tiny launcher recoil with right wrench still in right hand, same compact device dimensions. 4 retract left elbow beside ribs. 5 ready. Game emits ONE returning saw; no detached saw/projectile or giant cannon drawn. Wrench is NEVER released, no swap between hands or extra elbow.","Mechanism repair and spinning-blade deployment command, NOT held guard. 0 RIGHT wrench beside hip, LEFT forearm launcher attached and fingers empty. 1 bring left forearm safely in front of waist and RIGHT wrench tip toward visible small launcher fitting, natural connected shoulders and bent elbows. 2 brief controlled RIGHT wrench adjustment against fitting on LEFT forearm, hilt remains securely in right fingers and LEFT hand stabilizes its own wrist angle; chest/neck/pelvis coherent. 3 deliberate grounded activation with small right wrist turn and left launcher stable, no detached limb. 4 withdraw right wrench outside body and settle left arm. 5 original ready. Game supplies repair/blades; no loose gear, energy cloud, new tool or replaced backpack."]},"wolryeong":{"bossId":"6-4","kit":"src/domain/boss-wave5.ts","moves":["dash","stance"],"stories":["False-path pursuit RIGHT jian descending cut. 0 ONE slender silver jian in RIGHT hand low beside hip, LEFT empty sword-fingers. 1 bring RIGHT hilt HIGH outside rear shoulder, blade points UP-BACK, rear knee loaded, shoulders and pelvis coil together. 2 forward planted step with decisive DOWN-FORWARD diagonal cut across target, wrist connected at gold guard, lead knee flexes and rear leg pushes. 3 blade ends LOW past target, balanced connected torso, same head/robes/body size. 4 retract sword outside body. 5 low ready. No low-to-high uppercut, sword pasted under unrelated hand, backwards spine or new weapon. Game supplies false path; no ghost clone or painted trail.","False chest and stone gate command, NOT held sword guard. 0 original RIGHT jian low outside hip and LEFT sword-fingers near chest. 1 raise EMPTY LEFT hand beside shoulder, open palm, rear foot loads; right jian remains safely lowered. 2 extend LEFT empty palm DOWN-FORWARD toward target ground, slight hip hinge with coherent neck/spine and planted feet. 3 deliberate grounded deceptive command, sword stays in original right hand and unchanged length. 4 left palm withdraws to ribs. 5 ready. Game draws chest/gate; no chest, stone wall, key, poles or magic glow materializes in hands or sheet. Never throw the held jian."]}};
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
      'public/art/tomb-family-v1/' + f.texture.replace('tomb-family-', '') + '.webp',
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
