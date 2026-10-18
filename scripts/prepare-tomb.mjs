import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
const root = 'docs/source/tomb-family-v1';
await mkdir(root, { recursive: true });
const identities = [
  [
    'tombtrapper',
    '고묘 도굴 함정꾼',
    0,
    false,
    'Catalogue TOP LEFT: adult scruffy man black hair, ochre-yellow head wrap/scarf, worn charcoal short-sleeve tunic, brown rope belt and small tool pouch, dark trousers, brown boots, straw basket on back. LEFT hand holds ONE short wooden pickaxe beside left hip, one continuous shaft and ONE curved iron mining head. RIGHT hand holds a SMALL round black iron trap device from belt, no glow. Keep hands and tool ownership fixed.',
    'Trap deployment: LEFT pickaxe stays low beside hip, one-handed secure grip below its head; RIGHT hand lifts small iron device beside right shoulder, extends downward-forward toward target, opens EMPTY fingers on CONTACT release (game draws device projectile), then returns to belt to replenish. Exactly two attached arms, stable spine and counterbalanced feet. Never a pickaxe swing for the ranged trap release.',
  ],
  [
    'tombguard',
    '고묘 창 수문장',
    1,
    true,
    'Catalogue TOP SECOND: male crypt guard with straw conical hat, pale bone mask with dark eyeholes, long black hair, ragged charcoal/grey robe and armor, brown belt with bronze clasp, dark boots. BOTH hands grip separated places of ONE continuous long straight brown spear shaft; ONE narrow silver leaf point and small red tassel, plain blunt opposite end. No glow or second handle.',
    'Two-handed spear thrust: rear grip draws beside flank while front guide hand stays on shaft; maximum load spear remains level, CONTACT drives straight forward with shoulders and hips moving together, rear elbow unfolds, planted front foot. Followthrough extended, withdraw shaft with both grips and return guard. No spinning torso, no swing above head, no shrinking to fit spear.',
  ],
  [
    'tombcrossbow',
    '고묘 쇠뇌병',
    2,
    false,
    'Catalogue TOP THIRD: young man black high ponytail, brass round goggles with dark green glass pushed on forehead, pale rolled sleeves under worn olive/grey short tunic, brown utility belt, dark trousers and boots, compact tool basket attached LEFT hip. ONE wooden CROSSBOW with rigid transverse limbs and taut string: RIGHT hand on trigger grip, LEFT supports fore-end.',
    'Crossbow shooting: raise crossbow from low guard, both elbows connected and fore-end supported; aim level toward target, CONTACT right trigger pull with empty rail (game draws bolts), tiny recoil follows, lower and draw right hand to reload rail, return supported ready. Crossbow stays same size, no hand swaps, not curved bow. No floating bolt or projectile drawn.',
  ],
  [
    'jeokho',
    '도굴두목 적호',
    3,
    false,
    'Catalogue TOP FOURTH: broad muscular bearded man, red head wrap and ragged red scarf/cape, sleeveless dark leather vest, bronze chest clasp and belt, dark trousers and brown boots, black wrist wraps. BOTH hands grip ONE continuous wooden mining PICKAXE shaft with ONE curved iron pick head with two opposite pointed ends. No extra handles or second pick.',
    'Heavy pickaxe downward strike: bend both elbows to lift pick above rear shoulder, separated grips along single rigid shaft, full anticipation with stable spine; rotate torso and hips together and drive DOWN-FORWARD toward ground ahead with planted feet, CONTACT iron pick ends low ahead, low followthrough, withdraw outside torso and return two-handed guard. No uppercut, disconnected grip or impossible wrist twist. Representative cycle for his five skills.',
  ],
  [
    'seokmun',
    '묘지기 석문',
    4,
    false,
    'Catalogue BOTTOM FIRST: broad adult man short black beard, grey stone helmet with small crest, heavy segmented grey stone armor with brown belt, dark trousers and boots. LEFT arm straps ONE rectangular stone shield with carved face, LEFT hand stays behind shield handle. RIGHT hand holds ONE short stone hammer with continuous brown handle and one squared stone head.',
    'Shielded hammer downward strike: LEFT shield braced forward at chest throughout, right elbow draws hammer above outside right shoulder, maximum load stable torso; CONTACT right hammer cuts DOWN-FORWARD with planted wide feet, shield does not detach or swap hands; followthrough low ahead, withdraw right arm outward and return guard. Preserve hammer dimensions and shield size. No giant fist or second shield. Representative cycle for shield press and hammer skills.',
  ],
  [
    'gwakgi',
    '기관장인 곽기',
    5,
    false,
    'Catalogue BOTTOM SECOND: young male artisan black messy topknot, round brass goggles with green glass over eyes, off-white rolled sleeves, olive leather apron/tunic, brown belt with compact gold tool fittings, dark trousers and boots. Small brass gear backpack, no vapor or glow. RIGHT hand grips ONE plain iron open-ended WRENCH by handle, LEFT hand empty for mechanism control; gear launcher attached LEFT forearm, compact and consistent.',
    'Wrench downward sweep: right hand draws wrench above outside rear shoulder, left empty fingers balance/control forearm launcher; CONTACT sweeps RIGHT wrench DOWN-FORWARD across target, hips/shoulders align, planted boots, followthrough low, withdraw and reset. Keep one wrench head and one handle. No reversing wrench hand, no extra elbows. Representative cycle for repairs/launcher/wrench skills; projectiles generated by game separately.',
  ],
  [
    'wolryeong',
    '고묘후인 월령',
    6,
    false,
    'Catalogue BOTTOM THIRD: young female long dark violet-black hair, ornate small gold floral hair crown with violet flowers/ribbons, elegant off-white flowing robe with purple embroidered panels, gold waist clasp and cuffs, black shoes. RIGHT hand holds ONE slender straight silver JIAN with small gold guard and purple tassel at pommel, LEFT empty sword-fingers for balance.',
    'Clean high-to-low diagonal jian slash: raise RIGHT grip above outside rear shoulder with blade upward-back, maximum coil with natural elbow; CONTACT rotate shoulders and hips together, cut DOWN-FORWARD through target, front knee bent and foot planted, blade ends low ahead; low followthrough beyond target, withdraw outside torso and return ready. No rising scoop, uppercut, disconnected weapon or blade under unrelated hand. Representative cycle for her multi-contact attacks.',
  ],
];
const cameras = [
  ['front', 0, 'SOUTH straight FRONT face/chest toward screen BOTTOM; attacks BOTTOM'],
  ['front-right', 1, 'SOUTHEAST front-right three-quarter; attacks BOTTOM-RIGHT'],
  ['right', 2, 'EAST full RIGHT side profile, nose RIGHT; attacks RIGHT'],
  [
    'rear-right',
    3,
    'NORTHEAST rear-right three-quarter, mostly back of head/robe, only narrow right cheek; attacks TOP-RIGHT',
  ],
  ['back', 4, 'NORTH straight BACK, NO face, eyes or nose; attacks TOP'],
];
const poses = [
  'idle guard',
  'left foot walking step',
  'passing walking step',
  'right foot walking step',
  'TINY hit response with very small movement',
  'prone defeated with unchanged physical head/body dimensions',
  'early attack load',
  'maximum anticipation',
  'CONTACT / RELEASE',
  'followthrough',
  'withdrawal',
  'return ready',
];
const common =
  'Use case: identity-preserve. Native transparent MUGONG sprite sheet. Crisp illustrated chibi wuxia style, mild top-down camera, NEUTRAL even lighting and same palette front/back. One identity only. Canvas approximately1088px wide: physical head diameter90-100px, standing head-to-feet300-330px. These SAME physical dimensions in EVERY frame and camera, even if only two columns; add empty space rather than enlarging the person. Bend knees/hips for lower poses, NEVER shrink whole person to fit weapon. Exactly TWO connected arms/hands with natural joints, stable spine, coherent shoulder/pelvis rotation and planted footwear. At least32px clear alpha around hair/fingers/weapons/shoes; weapon may occupy outer padding but NEVER touch neighboring figure or canvas edge. NO background, shadows, floor, grid, text, labels, aura, glow, particles, trails, VFX, blur or airborne objects. Genuine alpha0 background.\n';
const jobs = [],
  requests = [];
for (const [character, name, slot, wide, identity, attack] of identities)
  for (const [viewName, view, camera] of cameras) {
    const id = `${character}-${viewName}`,
      job = {
        id,
        character,
        name,
        slot,
        view,
        source: `${id}${wide ? '-locomotion' : ''}.png`,
        prompt: `${id}${wide ? '-locomotion' : ''}.prompt.txt`,
        poseSourceCells: {},
        ...(wide ? { poseSources: {} } : {}),
      };
    for (const kind of wide ? ['locomotion', 'combat'] : ['all']) {
      const first = kind === 'combat' ? 6 : 0,
        count = wide ? 6 : 12,
        sid = `${id}${wide ? `-${kind}` : ''}`,
        prompt = `${sid}.prompt.txt`;
      const text = `${common}PORTRAIT ${wide ? '2 COLUMNS x3 ROWS, SIX' : '3 COLUMNS x4 ROWS, TWELVE'} complete independent full-body drawings, row-major order. ${wide ? 'Spacious cells for full continuous spear and two separated grips. Do NOT fill spacious cell by enlarging body: retain90-100px head and300-330px standing height.' : 'Roomy cells: keep torso large and consistent in contact; tools extend into padding without touching neighbors.'}\nCAMERA FIXED: ${camera}. Front/back contact foreshortens tool toward screen bottom/top while torso still faces this camera, not sideways.\nORDER: ${poses
        .slice(first, first + count)
        .map((p, i) => `${i + 1}. ${p}`)
        .join(
          '; ',
        )}.\nIDENTITY: ${identity}\nATTACK: ${attack}\nREFERENCES: Input1 region catalogue for named identity only; Input2 approved bloodblade for clean chibi style and physical head size ONLY, do not copy red costume or dagger. Additional approved source when supplied locks body proportions, costume and lighting; preserve those exactly in new camera.\n`;
      await writeFile(`${root}/${prompt}`, text);
      requests.push({
        id: sid,
        jobId: id,
        character,
        view,
        kind,
        source: `${sid}.png`,
        prompt,
        references: [
          'public/art/regions-v1/6-actors.png',
          'docs/source/hyeolma-family-v1/bloodblade-front-right.png',
        ],
        status: 'pending',
      });
      for (let i = 0; i < count; i++) {
        job.poseSourceCells[first + i] = { columns: wide ? 2 : 3, rows: wide ? 3 : 4, index: i };
        if (wide) job.poseSources[first + i] = `${sid}.png`;
      }
    }
    jobs.push(job);
  }
try {
  await access(`${root}/provenance.json`);
  throw Error('Sources already recorded; do not reset selections.');
} catch (e) {
  if (e.code !== 'ENOENT') throw e;
}
await writeFile(`${root}/generation-jobs.json`, JSON.stringify(jobs, null, 2) + '\n');
await writeFile(`${root}/generation-requests.json`, JSON.stringify(requests, null, 2) + '\n');
await writeFile(`${root}/identities.json`, JSON.stringify(identities, null, 2) + '\n');
await writeFile(
  `${root}/generation-status.json`,
  JSON.stringify(
    {
      status: 'prepared',
      characters: 7,
      targetFrames: 420,
      sourceSheets: requests.length,
      gameApplied: false,
      remoteDeployed: false,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  JSON.stringify({ logicalSheets: jobs.length, frames: 420, sourceSheets: requests.length }),
);
