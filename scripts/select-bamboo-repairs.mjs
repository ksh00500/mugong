import { readFile, writeFile, access } from 'node:fs/promises';
const root = 'docs/source/bamboo-family-v1';
const jobs = JSON.parse(await readFile(`${root}/generation-jobs.json`, 'utf8'));
const requests = JSON.parse(await readFile(`${root}/repair-requests.json`, 'utf8'));
try {
  requests.push(...JSON.parse(await readFile(`${root}/second-repair-requests.json`, 'utf8')));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
try {
  requests.push(...JSON.parse(await readFile(`${root}/third-repair-requests.json`, 'utf8')));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
let selected = 0;
for (const r of requests) {
  try {
    await access(`${root}/${r.source}`);
  } catch (error) {
    if (process.argv.includes('--available') && error.code === 'ENOENT') continue;
    throw error;
  }
  const job = jobs.find((j) => j.id === r.jobId);
  for (const target of r.targets) {
    (job.poseSources ??= {})[target.pose] = r.source;
    job.poseSourceCells[target.pose] = target.cell;
    selected++;
  }
}
await writeFile(`${root}/generation-jobs.json`, JSON.stringify(jobs, null, 2) + '\n');
console.log(`Selected ${selected} repaired poses; other poses preserved.`);
