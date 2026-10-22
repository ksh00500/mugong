import { mkdir, writeFile, access } from 'node:fs/promises';
const root = 'docs/source/bamboo-family-v1';
await mkdir(root, { recursive: true });
const identities = [
  [
    'bambooassassin',
    '죽림 단도 암살자',
    0,
    false,
    'Catalogue TOP LEFT: young male, teal cloth head-wrap and mouth scarf, black loose hair, teal sleeveless ragged coat, dark trousers, brown rope belt, black bracers and boots. ONE short straight silver dagger in anatomical RIGHT hand, LEFT hand empty.',
    'RIGHT dagger high-to-low forward dash-cut. Draw right wrist outside rear shoulder, bend rear elbow, brace feet; contact rotates shoulders and hips together, extends right elbow and cuts DOWN-FORWARD across target. Followthrough low beyond target, retract outside torso and return low guard. Never scoop UP like an uppercut.',
  ],
  [
    'bambooneedle',
    '죽림 암기수',
    1,
    false,
    'Catalogue TOP THIRD: young male black topknot tied with green ribbon, green mouth mask, sleeveless forest-green tunic, charcoal trousers, brown belt, black wristguards and boots. ONE small bundle of three short silver leaf-shaped throwing needles in RIGHT hand, LEFT hand empty for balance.',
    'RIGHT-hand needle throw: right elbow bends behind shoulder with the short needle bundle held near ear, left open hand counterbalances forward; contact unfolds right elbow and wrist toward target, RIGHT fingers open EMPTY after release (game draws needles). Followthrough open hand forward, right hand returns to belt pouch to replenish and ready with the same three small needles. Never a sword, no detached objects or airborne projectiles in sheet.',
  ],
  [
    'bambootrapper',
    '죽림 함정꾼',
    2,
    false,
    'Supporting roles reference SECOND ROW: young male black high ponytail, black mouth mask, ragged charcoal cloak and grey tunic, dark trousers and boots; brown belt with small steel tools and rope loop. LEFT hand holds ONE small round black iron trap device with tiny studs, no glow or fuse. RIGHT hand empty for deploying mechanism. Simpler clothing than boss Qingbi, no green leaves or silk ribbons.',
    'Trap deployment: LEFT hand supports SAME iron device beside waist in every pose; RIGHT hand reaches inward to activate switch then extends empty fingers DOWN-FORWARD toward target to command placement. Coherent shoulder-elbow-wrist chain with planted feet; slight forward lean at contact, no device-hand swaps. Withdraw right hand and reset. No trap drawn on ground; game draws it separately.',
  ],
  [
    'qingbi',
    '죽엽살수 청비',
    3,
    false,
    'Catalogue TOP FOURTH: male assassin leader long black topknot/ponytail with green ribbon, forest-green mouth mask and leafy black/green layered sleeveless robes, gold clasp, dark trousers, boots and bracers. RIGHT hand holds THREE short silver leaf-shaped needles, LEFT hand holds ONE reserve short silver dagger near waist throughout.',
    'RIGHT-hand leaf-needle throwing action: bend right elbow back above rear shoulder to load, LEFT reserve dagger stays waist-height as guard; contact extends right arm toward target and opens fingers EMPTY after release. Followthrough, then reach right hand to belt needle pouch and ready. No swapping weapon ownership, no giant leaf or detached weapon in air. Base representative cycle also supports his melee patterns; do not contort torso.',
  ],
  [
    'nogae',
    '취봉객 노개',
    4,
    true,
    'Catalogue BOTTOM FIRST identity: middle-aged scruffy man with black messy topknot, stubble, worn olive and off-white patched tunic, brown rope belt with two SMALL brown wine gourds tied at LEFT hip (not held), dark ragged trousers and sandals. BOTH hands hold ONE long straight plain bamboo STAFF with visible bamboo nodes, equal smooth unbladed ends, no metal point.',
    'Two-handed bamboo staff strike: early lift rear end outside right shoulder, maximum load staff above rear shoulder with separated grips; rotate chest and hips together; contact swings DOWN-FORWARD with connected arms, staff tip toward target at waist height, front foot planted and rear foot braced. Followthrough low beyond target then retract naturally into two-handed guard. Slight swaying drunk stance with stable spine, no impossible twisting, no gourd held while both hands hold staff. No spear tip, no second handle.',
  ],
  [
    'yanqing',
    '청죽검객 연청',
    5,
    false,
    'Catalogue BOTTOM SECOND: young male long black ponytail tied with blue ribbon, blue and white flowing swordsman robe with black belt and dark trousers, black wristguards and boots. ONE slender straight silver jian sword with small gold guard in RIGHT hand. LEFT hand empty sword-fingers for balance.',
    'Clean jian high-to-low diagonal slash: RIGHT grip lifted outside rear shoulder, straight blade points UP-BACK during anticipation; contact cut DOWN-FORWARD through target via torso and hip rotation, elbow extends, front knee bends, blade ends low in front; followthrough extends beyond target; withdraw outside body and return ready. No uppercut or rising scoop. Body head same size at contact, no blade pasted under unrelated hand.',
  ],
  [
    'songwol',
    '죽림은사 송월',
    6,
    false,
    'Catalogue BOTTOM THIRD: elderly male long white hair in topknot tied with green bamboo ribbon, white eyebrows and long white beard, muted sage-green scholar outer robe over off-white long inner robe, dark shoes. ONE ivory folding FAN with green bamboo-leaf motif in anatomical RIGHT hand at root/rivet; LEFT hand empty for balancing.',
    'RIGHT fan forward downward sweep-cast: early fan above outside rear shoulder, maximum gentle torso coil, contact sweeps DOWN-FORWARD across target with right fingers firmly on fan root, left hand counterbalances, planted shoes; followthrough fan low across chest, withdraw outward then ready. Preserve fan dimensions/ribs/motif and natural shoulders-elbows-wrists. No glow, blades, second fan, detached hand.',
  ],
];
const cameras = [
  ['front', 0, 'SOUTH straight FRONT face and chest toward screen BOTTOM; attacks BOTTOM'],
  ['front-right', 1, 'SOUTHEAST front-right three-quarter; attacks BOTTOM-RIGHT'],
  ['right', 2, 'EAST full RIGHT side profile, nose RIGHT; attacks RIGHT'],
  [
    'rear-right',
    3,
    'NORTHEAST rear-right three-quarter, mostly back of head/coat, only narrow cheek; attacks TOP-RIGHT',
  ],
  ['back', 4, 'NORTH straight BACK, NO face/eyes/nose; attacks TOP'],
];
const poses = [
  'idle guard',
  'left foot walking step',
  'passing walking step',
  'right foot walking step',
  'TINY hit response with very small movement',
  'prone defeated with unchanged head/body dimensions',
  'early attack load',
  'maximum anticipation',
  'CONTACT / RELEASE',
  'followthrough',
  'withdrawal',
  'return ready',
];
const common =
  'Use case: stylized-concept. Native transparent MUGONG sprite sheet. Crisp illustrated chibi wuxia style, mild top-down camera, neutral even lighting and same palette front/back. One identity only. At approximately1088px sheet width: physical head diameter90-100px, standing head-to-feet300-330px; these SAME physical dimensions in EVERY frame and camera. Bend knees/hips for lower poses, NEVER shrink whole person to fit weapon. Exactly two connected arms/hands, stable spine, coherent shoulder/pelvis rotation, planted shoes. Keep32px or more clear alpha padding around hair/fingers/weapons/shoes; weapon may occupy empty outer space but NEVER neighboring character. NO background, shadows, grid, labels, text, floor, aura, glow, emissions, blur, particles, trails or VFX. Genuine alpha0 background.\n';
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
      const text = `${common}PORTRAIT ${wide ? '2 COLUMNS x3 ROWS, SIX' : '3 COLUMNS x4 ROWS, TWELVE'} complete independent full-body drawings, row-major order. ${wide ? 'Spacious cells for ENTIRE straight staff, two hands separate on same shaft. Preserve body size, more empty space around wide staff.' : 'Comfortably roomy cells: keep compact weapon and hand close enough to body to avoid touching other drawings. Contact frame must retain head size, do not miniaturize.'}\nCAMERA remains fixed: ${camera}. In front/back contact foreshorten weapon toward screen bottom/top; torso still faces the specified camera, not sideways.\nORDER: ${poses
        .slice(first, first + count)
        .map((p, i) => `${i + 1}. ${p}`)
        .join(
          '; ',
        )}.\nIDENTITY: ${identity}\nATTACK: ${attack}\nREFERENCES: Input1 region catalogue for specified identity only; Input2 approved bloodblade for clean chibi art style and physical head size, never red costume; Input3 old roles plate ONLY for trapper second-row identity.\n`;
      try {
        await access(`${root}/${prompt}`);
      } catch (e) {
        if (e.code !== 'ENOENT') throw e;
        await writeFile(`${root}/${prompt}`, text);
      }
      requests.push({
        id: sid,
        jobId: id,
        character,
        view,
        kind,
        source: `${sid}.png`,
        prompt,
        references: [
          'public/art/regions-v1/5-actors.png',
          'docs/source/hyeolma-family-v1/bloodblade-front-right.png',
          ...(character === 'bambootrapper' ? ['public/art/animation-rebuild-v2/roles.webp'] : []),
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
