import { readFile, writeFile } from 'node:fs/promises';
const root = 'docs/source/tomb-family-v1';
const findings = JSON.parse(await readFile(`${root}/second-visual-findings.json`, 'utf8'));
const names = [
  'idle guard',
  'left step',
  'passing step',
  'right step',
  'tiny hurt without falling',
  'prone death',
  'early anticipation',
  'maximum anticipation',
  'attack CONTACT',
  'held followthrough',
  'withdrawal',
  'ready',
];
const requests = [];
for (let q = 0; q < findings.length; q++) {
  const item = findings[q];
  const groups = q === 9 ? [[3], [7, 8, 9, 10]] : [item.poses];
  for (const poses of groups) {
    const six = poses.length >= 5;
    const columns = six ? (q === 4 || q === 5 ? 3 : 2) : poses.length === 4 ? 2 : poses.length;
    const rows = six ? 6 / columns : poses.length === 4 ? 2 : 1;
    const id = item.jobId + '-repair-v3-' + poses[0];
    const refs =
      q === 2 || q === 3
        ? ['reference-tombguard-front.png', 'reference-tombguard-right.png']
        : [`reference-${item.jobId}.png`];
    const camera =
      q === 2 || q === 3
        ? 'SOUTHEAST three-quarter FRONT-RIGHT, face mask visible, both shoulders and hips aim bottom-right. Input1 gives physical body size and identity, Input2 continuous spear construction ONLY. Do NOT copy front or side camera.'
        : `Keep exactly the CAMERA of the supplied ONE-POSE reference for every drawing. Its native body scale and clothing are fixed.`;
    const extra =
      q === 0
        ? 'IMPORTANT: The near visible LOWER-LEFT arm must now hold the ROUND BLACK TRAP close to chest, never a pickaxe. The far UPPER-RIGHT arm carries the single pickaxe DOWN beside far hip.'
        : q === 4
          ? 'Spear is foreshortened AWAY INTO DEPTH. SILVER SPEAR TIP AT TOP CENTER ABOVE THE HAT; rear shaft descends toward shoulders, never points horizontally.'
          : q === 5
            ? 'NORTH aiming assembly projects straight UP. The crossbow crossbar is HORIZONTAL ABOVE HEAD, with rail VERTICAL through its center; muzzle is ABOVE THE HEAD, not beside body.'
            : q === 9 && poses.length === 1
              ? 'ONLY one walking RIGHT-STEP pose. Right screen-right wrench low, left screen-left launcher fixed; no attack.'
              : '';
    const prompt = `Generate ${columns * rows} complete independent MUGONG native sprites on a LANDSCAPE transparent canvas about1536x1024, EXACT ${columns} columns by ${rows} rows in row-major order. Use the supplied isolated native sprite as identity, palette, proportions and physical head-size reference. ${camera}\nCRITICAL OCCUPANCY: physical standing body approximately300-330px from head to boots, head90-110px. ${rows === 3 ? 'Each body takes only90% of its row height; wide768px cells leave room for full weapon.' : rows === 2 ? 'Body occupies only65% of each512px-high row, leaving extra transparent room for raised weapons.' : 'Body occupies ONLY ONE THIRD of the1024px canvas height, centered vertically with huge transparent space above/below. Do not enlarge it to fill canvas.'} All figures have identical physical head/limb thickness, including bent pose. Never shrink the character to fit its tool. At least32px clear transparent alpha around all bodies AND complete tools. No ground shadow, background, aura, glow, VFX, trail, projectile, text or labels.\nDraw ONLY these poses in order:\n${poses.map((p, i) => `${i + 1}. Logical${p}: ${names[p]}.`).join('\n')}\n${item.reason}\n${extra}\nTools belong to their specified hands permanently. Exactly two anatomically connected shoulder-elbow-wrist chains. One continuous shaft with separated grips; one tool head. Keep spine, hips, grounded legs coherent. Combat follows anticipation -> quick forward/downward contact -> held low follow -> slower withdrawal; never an uppercut. For back-view contact, arms and tool go AWAY from viewer toward screenTOP, partially occluded by back/head, NEVER toward feet or screenBOTTOM. Give every pose a distinct drawing, even held followthrough has a tiny real shift.\n`;
    await writeFile(`${root}/${id}.prompt.txt`, prompt);
    requests.push({
      id,
      jobId: item.jobId,
      source: id + '.png',
      prompt: id + '.prompt.txt',
      references: refs,
      targets: poses.map((pose, index) => ({ pose, cell: { columns, rows, index } })),
    });
  }
}
await writeFile(`${root}/second-repair-requests.json`, JSON.stringify(requests, null, 2) + '\n');
console.log(JSON.stringify(requests));
