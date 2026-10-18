import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const sharp = createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH ?? 'sharp');
const root = 'docs/source/desert-special-v1';
if (
  await access(root + '/generation-planned-jobs.json').then(
    () => true,
    () => false,
  )
)
  throw Error('Existing source plan preserved');
await mkdir(root + '/references', { recursive: true });
const base = JSON.parse(await readFile('src/game/desert-family-frames.json'));
const identities = JSON.parse(await readFile('docs/source/desert-family-v1/identities.json'));
const patterns = {"asar":{"bossId":"7-1","kit":"src/domain/boss-wave4.ts","moves":["dash","stance"],"stories":["Forward pursuit DOWNWARD dao cut. 0 original RIGHT single curved dao and LEFT empty guard. 1 load rear foot and raise RIGHT hilt HIGH outside rear shoulder, blade UP-BACK; shoulders and hips coil together. 2 decisive forward planted stride and DOWN-FORWARD diagonal slash across target, wrist on same hilt and elbow connected, lead knee flexes and rear foot pushes. 3 blade finishes LOW past target with connected neck/spine. 4 retract OUTSIDE body and settle feet. 5 ready. One dao, left hand stays empty; no low-to-high scoop, uppercut, blade through skull or shrinking contact body.","Sand-footwork activation, NOT a held guard and NOT mounted cavalry. 0 RIGHT dao low safely outside hip, LEFT empty guard. 1 load rear knee while lifting lead boot modestly, chest/pelvis aligned, weapon stable away from limbs. 2 lead boot STAMPS ground in front as rear foot stays planted; left empty hand extends DOWN-FORWARD for balance, right dao stays low. 3 weight settles over stamped foot, connected knees/hips/neck. 4 withdraw empty hand and recover stance. 5 original ready. Game supplies dust; no horse, hooves, smoke bomb or extra weapon drawn."]},"naya":{"bossId":"7-2","kit":"src/domain/boss-wave5.ts","moves":["ring","combo"],"stories":["Single straight returning ring release. 0 anatomical RIGHT holds ONE gold metal ringblade near chest; LEFT retains ONE reserve ring at waist, other spare rings stay on belt. 1 draw RIGHT ring beside rear shoulder, naturally bent elbow, hips/shoulders load together. 2 extend RIGHT arm FORWARD toward target and OPEN EMPTY RIGHT HAND after release; LEFT retains its ring, feet planted. 3 same EMPTY right hand follows forward, no detached ring in sheet. 4 reach belt for reset. 5 ready with original right ring. No swapping hands, no right ring still attached at release, no bow, no glow. Game supplies outgoing and returning ring.","Alternating close-range TWO held ringblade strikes, neither ring is thrown. 0 one ring per hand. 1 draw RIGHT ring beside rear shoulder, LEFT ring guarded beside waist, rear foot loads. 2 RIGHT ring drives DOWN-FORWARD ACROSS target at chest height, same grip, elbow and wrist connected; left ring stays guarded and planted lead foot takes weight. 3 finish right ring low outside opposite flank while LEFT ring prepares a return cut outside shoulder, pelvis/torso turn together. 4 both rings withdraw safely outside torso. 5 original ready. The game contact clock replays contact phases for two hits; preserve both held ringblades in all six exposures, no detached projectile or weapon-through-neck. Gown follows hips but body/skull remain same size."]},"balta":{"bossId":"7-3","kit":"src/domain/boss-melee.ts","moves":["dash","slam"],"stories":["Bare-hand shoulder charge, NOT an uppercut. 0 original empty guarded palms. 1 rear knee loads and torso tilts modestly FORWARD as ONE lead shoulder aligns to target, same-side elbow folded close to ribs, opposite palm guards chest. 2 push from rear foot into planted leading stride, LEAD SHOULDER makes target contact with neck/pelvis connected and forearm safely folded. 3 grounded short follow-through, no rolling, full backspin or broken spine. 4 palms return to guard as torso straightens. 5 ready. Bare hands only, no gauntlet, weapon or conjured orb.","Heavy planted ground STOMP. 0 original empty palms. 1 modest lead-knee lift, rear foot firmly grounded, open palms spread slightly beside ribs to balance, spine erect and torso same size. 2 lead foot STAMPS DOWN onto ground just ahead, knees and hips compress naturally; BOTH hands remain empty guarded palms, no hand strikes ground. 3 hold lowest grounded weight-transfer pose with skull same size and coherent pelvis/neck. 4 straighten through knees and recover arms. 5 original ready. Game supplies sand impact; no ground circle, dust, shockwave, glow or jumping flip."]},"arkan":{"bossId":"7-4","kit":"src/domain/boss-wave4.ts","moves":["sweep","stance"],"stories":["Heavy broad circular RIGHT dao sweep, with stable target-facing torso rather than a full backward spin. 0 ONE massive gold-inlaid curved steel dao in RIGHT hand, LEFT empty balance. 1 draw hilt HIGH and behind rear shoulder, blade UP-BACK, rear knee loads and hips/shoulders coil together. 2 decisive DOWN-FORWARD broad cut crossing target at waist/chest level, planted lead foot and connected right shoulder/elbow/wrist; left palm counterbalances away from blade. 3 long LOW horizontal follow-through past target to outside flank, torso/pelvis turning coherently, crown/skull/blade remain same size. 4 retract rigid blade OUTSIDE legs and torso. 5 ready. No upward shovel/uppercut, no giant axe/second hilt, no shrink-to-fit body; game draws circular slash zone separately.","Oasis retreat-blocking command, NOT held guard. 0 RIGHT original heavy dao safely low outside hip, LEFT empty palm beside chest. 1 raise EMPTY LEFT palm beside shoulder and load rear knee, right wrist securely on same dao hilt. 2 extend LEFT empty palm DOWN-FORWARD toward target ground, connected slight hip hinge and planted feet; right blade stable low away from commanding arm. 3 deliberate grounded command, body/head/crown retain original dimensions. 4 left palm withdraws to chest and weight settles. 5 ready. No conjured staff, orb, gate, water, wall or glow; game supplies terrain/effects. Never throw the heavy dao."]}};
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
      'public/art/desert-family-v1/' + f.texture.replace('desert-family-', '') + '.webp',
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
  '# 서역사막 보스 특별 모션 제작 입력\n\n내장 imagegen 제작 예정. 아직 생성·게임 적용은 하지 않았다. 단일 READY 기준20장, 4보스×2패턴×5시점의40프롬프트.\n\n' +
    promptRecords
      .map(
        (r) =>
          `- ${r.id}: [프롬프트](${r.prompt.split('/').at(-1)}) · [기준](references/${r.id.replace(/-(ring|stance|sweep|slam|dash|fan|combo)$/, '')}.png)`,
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
