import { readFile, writeFile, mkdir } from 'node:fs/promises';
// Reuse the native READY crop / six-exposure format; give each tomb tool its own action.
const template = await readFile('scripts/prepare-bamboo-special.mjs', 'utf8');
const patterns = {
  jeokho: {
    bossId: '6-1',
    kit: 'src/domain/boss-wave5.ts',
    moves: ['slam', 'stance'],
    stories: [
      'Heavy two-hand mining pick DOWNWARD strike. 0 TWO separated grips on ONE continuous wooden shaft with ONE curved two-ended iron mining head. 1 raise pick ABOVE rear shoulder, both elbows bend, rear knee loads, torso/pelvis turn together; the iron head remains same size. 2 bring pick DOWN-FORWARD into ground AHEAD of lead boot, rear arm drives and front hand guides same shaft, hips hinge naturally and knees flex. 3 planted low follow-through, neck/spine coherent and all pick ends visible. 4 retract outside torso and settle feet. 5 original ready. Never uppercut, shaft through neck, double handle, impossible backward wrist or shrink-to-fit contact. Game supplies impact.',
      'Heated floor activation, NOT held guard or another overhead pick strike. 0 ONE original pick secure in both separated hand grips, head held low outside body. 1 draw shaft beside hip and load rear knee, chest/pelvis/neck coherent. 2 deliberately STAMP lead boot onto ground ahead with modest knee lift then planted pressure, original pick remains secure beside flank with TWO hands, no tool swing through head. 3 grounded floor-command stance with heel settled, torso upright, pick held safely to side. 4 bring rear foot alongside normal stance. 5 ready. Game supplies heated floor; no lever, switch, glowing tool, ground marks, extra arm or detached pick appears.',
    ],
  },
  seokmun: {
    bossId: '6-2',
    kit: 'src/domain/boss-wave4.ts',
    moves: ['dash', 'stance'],
    stories: [
      'LEFT stone shield forward charge. 0 LEFT forearm strapped to ONE rectangular carved stone shield, RIGHT holds ONE short stone hammer low. 1 brace shield in front of LEFT chest, bend knees, tuck right hammer safely behind right hip. 2 powerful forward planted step with LEFT shoulder/shield leading, shield handle remains attached to left forearm, right hammer stays low clear of legs. Rear leg pushes, head/neck/chest/pelvis align in natural forward lean. 3 controlled grounded shield-led follow-through, no shield through face or missing elbow. 4 lift chest and retract left elbow slightly. 5 original ready. Do not transform hammer into fist or swap shield side; no flying body or enlarged shield.',
      'TRUE sustained LEFT shield guard. 0 LEFT original shield braced chest height, RIGHT hammer low outside hip. 1 settle weight through bent knees, draw shield toward left shoulder and load rear foot. 2 raise shield slightly FORWARD to intercept at chest/head height, left elbow naturally bent behind original handle and strapped forearm; right hammer safely low. 3 stable planted defended hold, neck/chest/pelvis coherent and both boots visible. 4 release pressure and lower shield a little. 5 ready. Game can hold exposure3 during defensive mechanic. This is not a spell or knockback recoil. No magical shield, new wall, detached left hand, weapon swap or oversized flinch.',
    ],
  },
  gwakgi: {
    bossId: '6-3',
    kit: 'src/domain/boss-wave5.ts',
    moves: ['fan', 'stance'],
    stories: [
      'LEFT forearm launcher saw release; NOT a wrench throw. 0 RIGHT holds ONE plain iron wrench, LEFT empty hand with compact gear launcher strapped to forearm. 1 draw left elbow near ribs and aim forearm launcher toward target, right wrench stays safely low. 2 extend LEFT forearm FORWARD at chest height and press left fingers slightly to command release, coherent shoulder/elbow/wrist, front boot planted. 3 tiny launcher recoil with right wrench still in right hand, same compact device dimensions. 4 retract left elbow beside ribs. 5 ready. Game emits ONE returning saw; no detached saw/projectile or giant cannon drawn. Wrench is NEVER released, no swap between hands or extra elbow.',
      'Mechanism repair and spinning-blade deployment command, NOT held guard. 0 RIGHT wrench beside hip, LEFT forearm launcher attached and fingers empty. 1 bring left forearm safely in front of waist and RIGHT wrench tip toward visible small launcher fitting, natural connected shoulders and bent elbows. 2 brief controlled RIGHT wrench adjustment against fitting on LEFT forearm, hilt remains securely in right fingers and LEFT hand stabilizes its own wrist angle; chest/neck/pelvis coherent. 3 deliberate grounded activation with small right wrist turn and left launcher stable, no detached limb. 4 withdraw right wrench outside body and settle left arm. 5 original ready. Game supplies repair/blades; no loose gear, energy cloud, new tool or replaced backpack.',
    ],
  },
  wolryeong: {
    bossId: '6-4',
    kit: 'src/domain/boss-wave5.ts',
    moves: ['dash', 'stance'],
    stories: [
      'False-path pursuit RIGHT jian descending cut. 0 ONE slender silver jian in RIGHT hand low beside hip, LEFT empty sword-fingers. 1 bring RIGHT hilt HIGH outside rear shoulder, blade points UP-BACK, rear knee loaded, shoulders and pelvis coil together. 2 forward planted step with decisive DOWN-FORWARD diagonal cut across target, wrist connected at gold guard, lead knee flexes and rear leg pushes. 3 blade ends LOW past target, balanced connected torso, same head/robes/body size. 4 retract sword outside body. 5 low ready. No low-to-high uppercut, sword pasted under unrelated hand, backwards spine or new weapon. Game supplies false path; no ghost clone or painted trail.',
      'False chest and stone gate command, NOT held sword guard. 0 original RIGHT jian low outside hip and LEFT sword-fingers near chest. 1 raise EMPTY LEFT hand beside shoulder, open palm, rear foot loads; right jian remains safely lowered. 2 extend LEFT empty palm DOWN-FORWARD toward target ground, slight hip hinge with coherent neck/spine and planted feet. 3 deliberate grounded deceptive command, sword stays in original right hand and unchanged length. 4 left palm withdraws to ribs. 5 ready. Game draws chest/gate; no chest, stone wall, key, poles or magic glow materializes in hands or sheet. Never throw the held jian.',
    ],
  },
};
const start = template.indexOf('const patterns = {');
const end = template.indexOf('const views =');
if (start < 0 || end < start) throw Error('Native source preparation template changed');
const program = (
  template.slice(0, start) +
  'const patterns = ' +
  JSON.stringify(patterns) +
  ';\n' +
  template.slice(end)
).replaceAll('bamboo', 'tomb');
await mkdir('docs/source/tomb-special-v1', { recursive: true });
await writeFile('docs/source/tomb-special-v1/prepare-generated.mjs', program);
await import('../docs/source/tomb-special-v1/prepare-generated.mjs');
