import { readFile, writeFile } from 'node:fs/promises';
const root = 'docs/source/tianjian-family-v1';
const jobs = JSON.parse(await readFile(`${root}/generation-jobs.json`, 'utf8'));
const selected = [
  ['swordcaster-front-right', 'swordcaster-front-right-spacing-v2.png', [9, 10]],
  ['spearguard-rear-right', 'spearguard-rear-right-aim-v2.png', [6, 7, 8, 9]],
  ['spearguard-back', 'spearguard-back-aim-v2.png', [6, 7, 8, 9]],
  ['duelist-rear-right', 'duelist-rear-right-aim-v2.png', [6, 7, 8, 9]],
];
for (const [id, source, poses] of selected.slice(0, 1)) {
  await readFile(`${root}/${source}`);
  const job = jobs.find((j) => j.id === id);
  job.poseSources ??= {};
  for (const pose of poses) job.poseSources[pose] = source;
}
for (const [id, view, version] of [
  ['duelist', 'right', 3],
  ['duelist', 'rear-right', 4],
  ['spearguard', 'right', 4],
  ['spearguard', 'rear-right', 3],
  ['spearguard', 'back', 3],
]) {
  const source = `${id}-${view}-attack-v${version}.png`;
  await readFile(`${root}/${source}`);
  const job = jobs.find((j) => j.id === `${id}-${view}`);
  job.poseSources = {};
  job.poseSourceCells = {};
  for (let pose = 6; pose <= 10; pose++) {
    job.poseSources[pose] = source;
    job.poseSourceCells[pose] = { columns: 3, rows: 3, index: pose - 6 };
  }
}
const caster = jobs.find((j) => j.id === 'swordcaster-rear-right');
caster.poseSources = {
  9: 'swordcaster-rear-right-spacing-v5.png',
  10: 'swordcaster-rear-right-spacing-v5.png',
};
await readFile(`${root}/swordcaster-rear-right-spacing-v5.png`);
const elder = jobs.find((j) => j.id === 'baekun-right');
elder.poseSources = { 5: 'baekun-right-death-v2.png' };
await readFile(`${root}/${elder.poseSources[5]}`);
await writeFile(`${root}/generation-jobs.json`, JSON.stringify(jobs, null, 2) + '\n');
console.log('Selected reviewed corrections only; other source poses are preserved.');
