import { mkdir, readFile, writeFile, access } from 'node:fs/promises';

// Preparation only: never replaces selected art, provenance, or game saves.
const root = 'docs/source/desert-family-v1';
await mkdir(root, { recursive: true });
const characters = [
  ['rider', '사막 기마병', 0,
    'Use cavalry reference: male teal turban and scarf, bronze shoulder armor, cream trousers, brown boots, riding the SAME brown horse with teal saddle cloth and gold/brown tack. ONE single-edged curved steel saber in RIGHT hand, LEFT hand holds connected reins. Same mounted rider throughout; never replace with standing infantry.',
    'Mounted forward saber charge: right arm draws saber above and behind shoulder, cuts DOWN and forward across the target, follows through low outside horse neck, withdraws outward back into guard. Rider pelvis remains seated on saddle, knees grip both sides of horse, left reins hand stays connected. Horse gait has four articulated legs and grounded hoof contacts, never human walking feet. Tiny hit only, not a horse rear-up. Defeat is complete horse and rider on ground with same head/body dimensions.'],
  ['assassin', '사막 암살자', 1,
    'Use catalogue top-left brown headwrap and lower-face brown scarf bandit, dark brown vest and wrist wraps, cream trousers, brown boots. ONE SHORT curved steel dagger in RIGHT hand, LEFT hand open guard. Gameplay is a dagger assassin: no spear, no giant scimitar.',
    'Short forward dagger thrust: retract right hand beside flank, extend wrist and elbow in a straight line with blade aligned with forearm, shift pelvis and shoulders together, left hand counterbalances. Same hand and rigid dagger length, no overhead scoop or uppercut.'],
  ['ringblade', '사막 환도병', 2,
    'Adapt catalogue top-row third red headwrap/scarf female bandit with dark hair, cream trousers and gold/bronze wrist bracers. Replace bow and quiver with THREE ordinary steel throwing rings carried at belt. RIGHT hand grips ONE ring for throw, LEFT hand keeps a reserve ring at waist. Distinct from teal-gowned boss Naya.',
    'Right-hand ring throw: draw ring hand behind shoulder at chest height, hips and shoulder rotate together, elbow extends toward target, CONTACT is an OPEN EMPTY RIGHT HAND after release, left hand retains reserve ring. Followthrough same empty hand then reach belt to reload and return ready. No projectile floating in sprite; game draws the released rings separately. Rear-facing release must clearly extend toward TOP or TOP-RIGHT, not return to idle.'],
  ['asar', '황사도적왕 아사르', 3,
    'Catalogue top-row fourth: large bearded male black turban, dark bronze armor, black fur trim, crimson cape, cream/dark trousers and brown boots. ONE ornate curved steel dao in RIGHT hand, LEFT hand free guard. Keep beard, head, torso, cape and dao dimensions identical in all poses.',
    'Weighty downward diagonal dao slash, from raised rear-shoulder guard through target to low front followthrough, coherent hip/shoulder rotation, planted forward foot. Recover outward into guard. Supports dash, two-cut combo, sweep, stance and straight thrust without an upward scooping blade.'],
  ['naya', '쌍환무희 나야', 4,
    'Catalogue bottom-row first: dark-haired woman with teal head veil, gold head jewelry, flowing teal gown, gold bracelets and flat shoes. TWO held gold-edged solid metal ringblades plus spare rings on belt. RIGHT hand throws, LEFT hand retains one ring at waist. No bow or sword.',
    'Controlled ringblade throw: draw right ring back beside shoulder with naturally bent elbow, rotate torso and pelvis, extend arm and OPEN EMPTY RIGHT HAND at contact after release. Left reserve ring remains gripped. Empty hand followthrough, draw spare from belt, return ready. Sprite contains no detached projectiles, returning rings or glow. Close range strikes use the same ring ownership.'],
  ['balta', '흑사마승 발타', 5,
    'Catalogue bottom-row second: bald bearded adult monk, black robe with dark red sash, brown prayer beads, white trousers, brown cloth shoes. BARE HANDS, no gauntlets, weapons or magic objects. Preserve bald head, beard and torso dimensions.',
    'Straight horizontal double-palm strike: retract both palms beside ribs with elbows bent, drive both palms toward target at chest height while shoulders and pelvis move together, planted feet. Followthrough with slight knee bend, withdraw into guarded palms. No uppercut, no folded spine. Also used for shoulder dash, alternating palm combo and ground stomp; boss hit flinch barely moves.'],
  ['arkan', '대막도왕 아르칸', 6,
    'Catalogue bottom-row third: regal male gold crown over white headscarf, gold armor with white fur trim, crimson cape, brown boots. ONE massive gold-inlaid steel curved dao in RIGHT hand, left hand open balance. Do not shrink torso, crown or blade in long attack poses.',
    'Heavy overhead DOWNWARD diagonal dao cut: raised hand behind shoulder, blade extends above back, hips and shoulders turn together, deliver decisive down-forward contact, followthrough low beyond target, withdraw outward to high guard. Never lift blade from floor like an uppercut. Supports chase, downward slash, two-cut combo, circular sweep and stance.'],
];
const cameras = [
  ['front', 0, 'SOUTH, straight FRONT, face and chest toward screen BOTTOM, both shoulders visible, every attack aims BOTTOM'],
  ['front-right', 1, 'SOUTHEAST, FRONT-RIGHT three-quarter, face/chest toward screen BOTTOM-RIGHT, every attack aims BOTTOM-RIGHT'],
  ['right', 2, 'EAST, full RIGHT SIDE profile, nose toward RIGHT edge, shoulders stacked, every attack aims RIGHT'],
  ['rear-right', 3, 'NORTHEAST, rear-right three-quarter, BACK of head/coat toward viewer, only right cheek sliver, every attack aims TOP-RIGHT'],
  ['back', 4, 'NORTH, straight BACK, NO face or eyes visible, back of head and shoulders toward viewer, every attack aims TOP'],
];
const refs = {
  catalogue: 'public/art/regions-v1/7-actors.png',
  cavalry: 'docs/source/hostile-consistency-v3/cavalry-directions.png',
  style: 'docs/source/hyeolma-family-v1/bloodblade-front-right.png',
};
const poseNames = ['idle', 'left walk', 'passing walk', 'right walk', 'TINY hit flinch', 'prone defeated', 'early attack load', 'maximum anticipation', 'CONTACT / RELEASE', 'followthrough', 'withdrawal', 'return ready'];
const common = `Use case: identity-preserve. Native transparent sprite sheet for MUGONG wuxia action game. ONE specified identity ONLY. Mild top-down camera, crisp chibi illustrated wuxia style and stable neutral brightness. Physical head, torso, limbs and held weapon dimensions MUST remain constant across every pose AND camera. Bend joints to show crouching; NEVER shrink the entire character to fit an attack cell. Keep natural connected wrists/elbows/shoulders and coherent pelvis rotation; exactly two arms and hands per human. Genuine alpha0 outside subjects. NO text, grid, background, floor, shadow, glow, halo, VFX, blur, sword trails or floating projectiles. At least32 native pixels of EMPTY space around EVERY weapon, hair, hand, hoof and boot, never touch canvas edge or another cell. Increase working space instead of resizing a figure. Keep weapons rigid and same hand ownership.\n`;
const jobs = [], generation = [];
for (const [character, name, slot, identity, attack] of characters) {
  for (const [viewName, view, camera] of cameras) {
    const id = `${character}-${viewName}`;
    const mounted = character === 'rider';
    const job = { id, character, name, slot, view, source: `${id}${mounted ? '-locomotion' : ''}.png`, prompt: `${id}${mounted ? '-locomotion' : ''}.prompt.txt`, poseSourceCells: {} };
    if (mounted) job.poseSources = {};
    for (const kind of mounted ? ['locomotion', 'combat'] : ['all']) {
      const first = kind === 'combat' ? 6 : 0, count = kind === 'all' ? 12 : 6;
      const sourceId = `${id}${kind === 'all' ? '' : `-${kind}`}`;
      const prompt = `${sourceId}.prompt.txt`;
      const referencePaths = [refs.catalogue, ...(mounted ? [refs.cavalry] : []), refs.style];
      const layout = mounted ? { columns: 2, rows: 3 } : { columns: 3, rows: 4 };
      const size = mounted
        ? 'PORTRAIT 2 COLUMNS x3 ROWS, SIX complete horse-and-rider drawings. Roomy cells for full horse. Rider head about90-100px, mounted hoof-to-head about420-460px; horse length about380-430px. Keep same head size as human infantry; use a taller/wider cell for horse, not a smaller rider.'
        : 'PORTRAIT 3 COLUMNS x4 ROWS, TWELVE complete full-body drawings. Standing head-to-boot about300-330 native pixels, head about90-100px. Same actual head/torso size even in contact or prone pose.';
      const text = `${common}${size}\nCAMERA: ${camera}. This camera stays EXACTLY the same throughout the entire sheet.\nORDER in row-major: ${poseNames.slice(first, first + count).map((p, i) => `${i + 1}. ${p}`).join('; ')}.\nIDENTITY: ${identity}\nATTACK: ${attack}\nREFERENCES: Input1 old catalogue ONLY for the specified identity. ${mounted ? 'Input2 brown horse and teal mounted rider identity from existing cavalry art, preserve tack and horse proportions. Input3' : 'Input2'} is art style reference ONLY, never copy its costume or weapon.\n`;
      generation.push({ id: sourceId, jobId: id, character, view, kind, source: `${sourceId}.png`, prompt, references: referencePaths, status: 'pending' });
      // Preserve a user-reviewed or repaired prompt on repeated preparation.
      try { await access(`${root}/${prompt}`); } catch (e) {
        if (e.code !== 'ENOENT') throw e;
        await writeFile(`${root}/${prompt}`, text);
      }
      for (let i = 0; i < count; i++) {
        job.poseSourceCells[first + i] = { ...layout, index: i };
        if (mounted) job.poseSources[first + i] = `${sourceId}.png`;
      }
    }
    jobs.push(job);
  }
}
for (const source of Object.values(refs)) await access(source);
await writeFile(`${root}/generation-jobs.json`, JSON.stringify(jobs, null, 2) + '\n');
// Source inventory is immutable preparation; actual outcomes belong in generation-status.json.
await writeFile(`${root}/generation-requests.json`, JSON.stringify(generation, null, 2) + '\n');
await writeFile(`${root}/identities.json`, JSON.stringify(characters, null, 2) + '\n');
const catalogue = JSON.parse(await readFile('src/domain/catalogue.json', 'utf8'));
const bosses = catalogue.bosses?.filter((b) => b.region === '서역사막');
await writeFile(`${root}/boss-catalogue.json`, JSON.stringify(bosses ?? [], null, 2) + '\n');
console.log(JSON.stringify({ logicalSheets: jobs.length, logicalFrames: jobs.length * 12, sourceSheets: generation.length, prompts: generation.length }));
