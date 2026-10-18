import { readFile, writeFile, access } from 'node:fs/promises';
const root = 'docs/source/snow-family-v1',
  jobs = JSON.parse(await readFile(`${root}/generation-jobs.json`));
const path = process.argv[2];
const requests = JSON.parse(await readFile(`${root}/${path}`));
for (const f of Array.isArray(requests) ? requests : [requests]) {
  await access(`${root}/${f.output}`);
  const j = jobs.find((j) => j.id === f.id);
  for (const [i, p] of f.poses.entries()) {
    (j.poseSources ??= {})[p] = f.output;
    (j.poseSourceCells ??= {})[p] = {
      ...f.cell,
      index: f.cell?.rectangle ? undefined : f.key.includes('spacious-combat') ? i : p,
    };
  }
}
await writeFile(`${root}/generation-jobs.json`, JSON.stringify(jobs, null, 2) + '\n');
