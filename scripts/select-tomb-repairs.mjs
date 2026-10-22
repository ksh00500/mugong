import { readFile, writeFile, access } from 'node:fs/promises';
import { createRequire } from 'node:module';
const sharp = createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH ?? 'sharp');
const root = 'docs/source/tomb-family-v1';
const jobs = JSON.parse(await readFile(`${root}/generation-jobs.json`, 'utf8'));
const requests = JSON.parse(await readFile(`${root}/repair-requests.json`, 'utf8'));
let selected = 0;
for (const r of requests) {
  await access(`${root}/${r.source}`);
  const job = jobs.find((j) => j.id === r.jobId);
  const [before, after] = await Promise.all([
    sharp(`${root}/${r.reference}`).metadata(),
    sharp(`${root}/${r.source}`).metadata(),
  ]);
  for (const target of r.targets) {
    (job.poseSources ??= {})[target.pose] = r.source;
    const cell = { ...target.cell };
    if (cell.rectangle)
      cell.rectangle = cell.rectangle.map((v, i) =>
        Math.round(v * (i % 2 ? after.height / before.height : after.width / before.width)),
      );
    job.poseSourceCells[target.pose] = cell;
    selected++;
  }
}
await writeFile(`${root}/generation-jobs.json`, JSON.stringify(jobs, null, 2) + '\n');
console.log(`Selected ${selected} repaired poses; other original poses retained.`);
