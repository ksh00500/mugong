import { readFile, writeFile, access } from 'node:fs/promises';
const root = 'docs/source/tomb-family-v1';
const jobs = JSON.parse(await readFile(`${root}/generation-jobs.json`, 'utf8'));
const requests = JSON.parse(await readFile(`${root}/second-repair-requests.json`, 'utf8'));
let count = 0;
for (const r of requests) {
  try {
    await access(`${root}/${r.source}`);
  } catch (e) {
    if (process.argv.includes('--existing') && e.code === 'ENOENT') continue;
    throw e;
  }
  const j = jobs.find((j) => j.id === r.jobId);
  for (const t of r.targets) {
    (j.poseSources ??= {})[t.pose] = r.source;
    j.poseSourceCells[t.pose] = t.cell;
    count++;
  }
}
await writeFile(`${root}/generation-jobs.json`, JSON.stringify(jobs, null, 2) + '\n');
console.log(`Selected ${count} v3 poses.`);
