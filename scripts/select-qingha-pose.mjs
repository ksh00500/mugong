import { readFile, writeFile } from 'node:fs/promises';
const [id, source, ...poses] = process.argv.slice(2),
  root = 'docs/source/qingha-family-v1';
await readFile(`${root}/${source}`);
const jobs = JSON.parse(await readFile(`${root}/generation-jobs.json`)),
  j = jobs.find((j) => j.id === id);
if (!j) throw Error('Unknown sheet');
for (const value of poses) {
  const pose = Number(value);
  if (!Number.isInteger(pose) || pose < 0 || pose > 11) throw Error('Invalid pose');
  (j.poseSources ??= {})[pose] = source;
  j.poseSourceCells[pose] = { columns: 3, rows: 4, index: pose };
}
await writeFile(`${root}/generation-jobs.json`, JSON.stringify(jobs, null, 2) + '\n');
console.log(`${id}: ${poses.join(',')}`);
