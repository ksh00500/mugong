import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const sharp = createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH ?? 'sharp');
const root = 'docs/source/zhuge-special-v1';
if (
  await access(root + '/generation-planned-jobs.json').then(
    () => true,
    () => false,
  )
)
  console.log('Refreshing existing preparation plan; generated PNGs preserved');
await mkdir(root + '/references', { recursive: true });
const base = JSON.parse(await readFile('src/game/zhuge-family-frames.json'));
const identities = await Promise.all(['yanggi','mukyeon','jingwal','zhugehyeon'].map(async id => [id,id,0,(await readFile('docs/source/zhuge-family-v1/'+id+'-front-right.prompt.txt','utf8')).match(/^IDENTITY: (.+)$/m)[1]]));
const patterns = {"yanggi":{"bossId":"9-1","kit":"src/domain/boss-wave5.ts","moves":["sweep","stance"],"stories":["Two-hand SINGLE plain wooden staff horizontal sweep. 0 exact READY. 1 draw staff beside rear flank with BOTH spaced grips firm, rear knee loads and shoulder/pelvis coil together. 2 waist-height FORWARD horizontal sweep toward target with BOTH hands on same rigid shaft, lead boot planted, rear heel turns. 3 controlled horizontal follow-through outside far flank, same anatomy, not full backspin. 4 retract staff outside torso to ready. 5 exact original READY. Plain rounded shaft ends, simple gold ferrule only, no spearhead, second handle or shaft. Never shrink body for extended staff.","Stone-gate deployment command. NOT held guard. 0 exact READY two hands on staff. 1 settle SINGLE staff into LEFT hand beside left hip with lower plain end grounded, RIGHT hand releases shaft and draws beside chest. 2 RIGHT empty palm extends toward target at chest height, LEFT hand holds same staff at its central grip, knees modestly flex, torso/pelvis coherent. 3 hold command briefly, ONE staff stable in LEFT hand, RIGHT empty and separate. 4 RIGHT hand returns to its original READY grip. 5 exact READY. Two arms only, no hand remaining on released grip, no stone/gate/glyph painted."]},"mukyeon":{"bossId":"9-2","kit":"src/domain/boss-wave5.ts","moves":["fan","stance"],"stories":["Repeating CROSSBOW THREE-BOLT shot. 0 exact READY one crossbow RIGHT hand at rear trigger stock and LEFT palm supporting underside forward of trigger. 1 raise SINGLE crossbow to aim toward target, stock rests alongside chest/shoulder, elbows connected. 2 FIRE: tiny backward recoil against right shoulder, RIGHT hand remains trigger grip, LEFT support beneath same stock, planted lead boot. 3 small settled aim after recoil. 4 lower/recover aim with both same grips. 5 exact READY. In FRONT view bow arms must foreshorten toward camera naturally; do not point to unrelated side. In BACK view weapon aims away with forearms seen forward. Do not turn crossbow into short sword, gun or two bows; no bolts drawn outside weapon, game emits3 shots simultaneously.","Mechanical crossbow-and-flying-device placement signal, NOT defensive stance. Keep crossbow intact. 0 original READY with two hands. 1 retain crossbow stock/trigger firmly in RIGHT hand outside right hip, release LEFT support hand and lift empty left palm beside chest. 2 LEFT empty hand signals FORWARD-DOWN, right elbow supports SAME intact crossbow at hip, stock and bow assembly remain connected. 3 brief planted command, only two hands, no duplicate support hand under crossbow. 4 LEFT returns beneath same crossbow stock. 5 exact READY. No device materializes in hand; game spawns machines independently."]},"jingwal":{"bossId":"9-3","kit":"src/domain/boss-wave4.ts","moves":["dash","stance"],"stories":["Two-handed pursuit SPEAR drive. 0 exact READY single long gold/silver spearhead on dark wood shaft, blue tassel, plain butt. 1 rear knee loads and two hands draw shaft back beside ribs, point FORWARD toward target, NOT overhead like a sword. 2 rear boot drives planted forward lunge, leading LEFT hand guides shaft toward target and rear RIGHT hand pushes butt, palms spaced on same unbroken straight shaft. Head/chest/pelvis all face target, torso leans only slightly and neck attached. 3 retain extended spear thrust with rear leg following, no third hand, no spear flying away. 4 both hands pull SAME spear to original diagonal guard outside torso. 5 READY. Spear length/head/skull constant, no camera zoom or shrink-to-fit. FRONT/BACK spear thrust foreshortens naturally, rightward for side; no backwards spine.","Rotating-gate deployment command with spear retained. 0 original READY. 1 transfer SPEAR to anatomical LEFT support hand near left hip with plain butt grounded, spearhead remains upper-forward safely outside head; RIGHT hand releases its rear shaft grip and draws to chest. 2 RIGHT EMPTY palm signals FORWARD toward target while LEFT single hand retains spear at central support point and butt grounded. 3 deliberate command with connected shoulders/hips, two hands only. 4 RIGHT returns to original separated rear grip. 5 exact READY. No duplicate grip/hand, no floating spear, blade never held directly, no new pole or second handle. Game supplies rotating walls, do not paint gate or glow."]},"zhugehyeon":{"bossId":"9-4","kit":"src/domain/boss-wave5.ts","moves":["fan","stance"],"stories":["White-feather fan triple wind release. 0 READY ONE fan in anatomical RIGHT hand at original gold hub, LEFT empty. 1 RIGHT fan draws beside rear shoulder/chest, elbow bends and hips load subtly, left open hand counterbalances. 2 crisp outward DOWN-FORWARD fan sweep toward target at chest height, RIGHT fingers visibly hold gold hub, left remains empty, head/torso/hips rotate together only modestly. 3 forward sweep follow-through and open left balance palm. 4 retract same fan outside ribs. 5 original READY. Fan is WHITE FEATHERS with BLACK tips, not red folding paper fan. Same width/hub and skull/beard size. No painted wind waves; game emits three wind blades.","Eight-trigram safe-gate forward cycle command, NOT held defense. 0 original RIGHT fan and empty LEFT hand. 1 right fan held steady beside chest, empty LEFT palm lifts slightly with gently flexed knees. 2 LEFT empty palm extends DOWN-FORWARD toward target ground while RIGHT grips original fan gold hub near chest, robe and pelvis remain coherent. 3 brief planted ritual command, fan stays same right hand and ONLY two arms. 4 withdraw left palm and settle fan. 5 exact original READY. No floating fan, weapon swap, magic circle/gate/runes/glow or drawn projectile; game supplies formation."]}};
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
      'public/art/zhuge-family-v1/' + f.texture.replace('zhuge-family-', '') + '.webp',
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
  '# 팔진고성 보스 특별 모션 제작 입력\n\n내장 imagegen 제작 예정. 아직 생성·게임 적용은 하지 않았다. 단일 READY 기준20장, 4보스×2패턴×5시점의40프롬프트.\n\n' +
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
