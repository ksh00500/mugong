import { readFile, writeFile } from 'node:fs/promises';
const root = 'docs/source/tomb-family-v1';
const requests = JSON.parse(await readFile(`${root}/generation-requests.json`, 'utf8'));
const notes = [
  'SOUTH ownership: anatomical RIGHT hand is SCREEN-LEFT and LEFT hand is SCREEN-RIGHT. Both chest and face face screen bottom, not right profile.',
  'SOUTHEAST ownership: RIGHT arm is the nearer lower-left side of this front-right view, LEFT arm farther upper-right. Face must clearly aim diagonally BOTTOM-RIGHT, distinct from straight front.',
  'EAST ownership: anatomical RIGHT arm is the NEAR arm visible to viewer at lower edge of torso; LEFT is FAR arm. Preserve tool ownership through walking and attack: never give near arm the left-hand tool in idle then right-hand tool during attack. Nose and chest face RIGHT in every pose.',
  'NORTHEAST ownership: anatomical RIGHT hand/arm on SCREEN-RIGHT nearer edge, LEFT on SCREEN-LEFT farther edge. Mostly back view, visible back of coat and head, only narrow right cheek. Keep camera across attack.',
  'NORTH ownership: anatomical RIGHT hand at SCREEN-RIGHT; LEFT at SCREEN-LEFT. Full back view in ALL poses; no face, eyes or nose. Never flip torso to achieve tool position.',
];
for (const r of requests) {
  if (r.view === 0) continue;
  const p = `${root}/${r.prompt}`;
  let s = await readFile(p, 'utf8');
  if (!s.includes('VIEW HAND OWNERSHIP:')) s += `\nVIEW HAND OWNERSHIP: ${notes[r.view]}\n`;
  await writeFile(p, s);
}
console.log('Explicit anatomical hand positions added for pending directional sources.');
