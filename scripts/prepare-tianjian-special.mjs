import { mkdir, readFile, writeFile } from 'node:fs/promises';
const root = 'docs/source/tianjian-special-v1';
await mkdir(root, { recursive: true });
const views = ['front', 'front-right', 'right', 'rear-right', 'back'];
const facing = [
  'SOUTH, face/chest toward screen bottom',
  'SOUTHEAST, front-right three-quarter toward bottom-right',
  'EAST, true right profile',
  'NORTHEAST, back and right shoulder toward top-right, no frontal face',
  'NORTH, pure back facing top, no visible frontal face',
];
const patterns = {
  ujin: {
    bossId: '2-1',
    moves: ['stance', 'dash'],
    stories: [
      'Counter guard: 0 lift single sword from ready; 1 blade diagonal in front of chest, free hand balancing beside ribs; 2 settle low braced guard, sword and forearm protect torso, no arm crossing neck; 3 hold stable guard; 4 ease knees and lower blade slightly; 5 ready guard.',
      'Pursuit thrust: 6 sword hilt drawn beside rear ribs, point aimed at target; 7 load rear foot, rear elbow folded and front knee soft; 8 drive front foot and sword straight FORWARD, blade points to target, rear leg pushes, free hand balances behind; 9 arrest lunge on front foot without fully locking elbow; 10 retract hilt to ribs; 11 ready guard. NO lift from below, no overhead slash.',
    ],
  },
  baekhong: {
    bossId: '2-2',
    moves: ['dash', 'sweep'],
    stories: [
      'Twin-sword pursuit cut: 0 distinct sword arms guarding; 1 coil hips/shoulders, one sword loaded beside upper rear shoulder and the other ahead beside waist; 2 stepping forward cut DOWN and ACROSS target, two hands visibly holding separate hilts, sword edges cross in front but wrists NEVER fuse; 3 brake forward motion on front leg, blades separate; 4 retract both arms independently; 5 ready two-sword guard.',
      'Twin-sword circular sweep: 6 both sword arms held laterally, knees soft; 7 modest whole-body coil away from target, swords horizontal at different heights; 8 wide waist-height outward sweeping cut using hip turn, both hands and blades separate, support foot grounded; 9 follow-through crosses the target plane and torso rotates together with pelvis, no pretzel spine; 10 unwind arms and settle feet; 11 ready guard. NO backflip, no floating body, no upward uppercut.',
    ],
  },
  mumyeong: {
    bossId: '2-3',
    moves: ['dash', 'stance'],
    stories: [
      'Shadow pursuit slash: 0 low ready with sword near rear shoulder; 1 compact forward lean from ankles and hips, rear leg loaded, sword prepared HIGH beside shoulder; 2 decisive forward step and DOWN-CROSS slash, blade crosses target in front of chest then knee, free hand balances behind; 3 grounded low follow-through with rear foot trailing, no airborne dive; 4 retract sword and rise a little; 5 low ready. Never scoop sword UP from below.',
      'Sword counter guard: 6 draw single blade diagonally across upper chest; 7 bend knees and brace elbow naturally, free hand beside ribs; 8 stable compact sword parry in front of chest; 9 hold same guard; 10 relax elbow slightly; 11 ready. Keep black hood, mask and red cloak, no duplicated sword or detached hand.',
    ],
  },
  baekun: {
    bossId: '2-4',
    moves: ['fan', 'sweep'],
    stories: [
      'Straight sword-energy release: 0 sword drawn beside upper rear shoulder, free hand two-finger sword seal toward target; 1 full high-side anticipation, rear foot loaded; 2 planted front foot and hips/chest turn together as sword cuts DOWN and ACROSS toward target, weapon hand at lower chest in front, blade extends forward/down; 3 controlled low forward follow-through; 4 bring hilt back beside ribs and relax sword seal; 5 ready guard. DO NOT draw energy wave: game supplies it at contact. NO upward lift.',
      'Master circular sweep: 6 single blade extends across waist in front, free hand near chest; 7 body coils at hips while blade loads beside rear ribs horizontally; 8 strong horizontal waist-height sweep through target, one foot grounded and other pivots; 9 torso and pelvis follow together, blade finishes beyond lead side, free hand balances; 10 retract blade and unwind stance; 11 ready. Sword blade rigid/straight, same length, no magical fan or floating swords.',
    ],
  },
};
const jobs = [];
for (const [character, p] of Object.entries(patterns))
  for (let view = 0; view < 5; view++) {
    const id = `${character}-${views[view]}`;
    const reference = `docs/source/tianjian-family-v1/${id}.png`;
    const identity = (
      await readFile(`docs/source/tianjian-family-v1/${character}-front-right.prompt.txt`, 'utf8')
    )
      .split('\n')
      .find((l) => l.startsWith('IDENTITY:'))
      .replace(/use Image1 row \d only\./, '');
    const prompt = `Use case: identity-preserve. Asset type: MUGONG boss special-motion production sprite sheet.\nInput image is identity, scale, color, style and requested view reference ONLY. Replace its ordinary action sequence with these special moves; no locomotion, death or hurt poses.\n${identity}\nExactly TWELVE full-body figures, THREE columns by FOUR rows, portrait 1536x2048 transparent RGBA canvas. Row-major indices 0..11. One figure centered in each spacious cell. No grid, text, shadow or background.\nCamera in ALL figures: same slightly elevated game camera as reference; ${facing[view]}. Body and attack face that direction throughout except small coherent whole-body turn for sweep; never switch to opposite/front camera in rear views.\nAt actual 1086x1448 output each virtual cell is362x362. Match reference standing anatomical dimensions IN PIXELS: standing hair-to-boot height about300-325px, physical skull width about90px, same shoulder/limb mass. Crouching lowers head but NEVER shrinks head/limbs/weapon. If weapon is wide provide air or compact sensible swing, never shrink actor. Minimum24px transparent margin to outer edges; no neighboring silhouettes touching. Full weapons/boots/hair must fit. One foot supports body; pelvis/spine/neck connected, elbows and wrists follow arm chain.\nCells0-5 first move: ${p.stories[0]}\nCells6-11 second move: ${p.stories[1]}\nClean outlined detailed chibi wuxia illustration, same palette and neutral diffuse brightness as reference, no added rim light or colored outline. Preserve exact face/hood/hair/beard/robes. Straight swords rigid and same length, hilt remains visibly in correct hand in EACH cell. Exactly two hands, two feet, original weapon count. NO fused forearms, extra grips, blade through skull or chest, bent steel, crescent-shaped swords.\nTransparent alpha ZERO outside silhouettes. No glow/halos/haze/gradients around actor, no motion blur/smears/slash trails/sparks/projectiles/dust/ground shadows. Every figure fully separated and entirely visible. Priorities: anatomy and weapon connection, clear anticipation/contact/followthrough, same physical size and correct view.`;
    const sources = [];
    for (let moveIndex = 0; moveIndex < 2; moveIndex++) {
      const sourceId = `${id}-${p.moves[moveIndex]}`;
      const text = prompt
        .replace(
          'Exactly TWELVE full-body figures, THREE columns by FOUR rows, portrait 1536x2048',
          'Exactly SIX full-body figures, TWO columns by THREE rows, landscape 2048x1536',
        )
        .replace('Row-major indices 0..11.', 'Row-major indices 0..5.')
        .replace(
          'At actual 1086x1448 output each virtual cell is362x362.',
          'At actual 1448x1086 output each virtual cell is724x362. Wide transparent space is essential; each standing body is the SAME pixel height as a figure in the reference, NOT enlarged to fill this wider cell.',
        )
        .replace(
          `Cells0-5 first move: ${p.stories[0]}\nCells6-11 second move: ${p.stories[1]}`,
          `Six sequential frames for ${p.moves[moveIndex]}: ${p.stories[moveIndex].replace(/\b(6|7|8|9|10|11)\b/g, (n) => String(Number(n) - 6))}`,
        )
        .replace('Minimum24px transparent margin', 'Minimum48px transparent margin');
      await writeFile(`${root}/${sourceId}.prompt.txt`, text);
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
      poseSources: Array.from({ length: 12 }, (_, index) => sources[Math.floor(index / 6)].source),
      poseSourceCells: Array.from({ length: 12 }, (_, index) => ({
        columns: 2,
        rows: 3,
        index: index % 6,
      })),
    });
  }
await writeFile(`${root}/generation-jobs.json`, JSON.stringify(jobs, null, 2) + '\n');
console.log(
  JSON.stringify({
    jobs: jobs.length,
    patterns: Object.values(patterns).map((p) => ({ bossId: p.bossId, moves: p.moves })),
  }),
);
