import { readFile, writeFile, access } from 'node:fs/promises';
const root = 'docs/source/dokmu-family-v1';
const jobs = JSON.parse(await readFile(root + '/generation-jobs.json', 'utf8'));
const corrections = JSON.parse(await readFile(root + '/selected-corrections.json', 'utf8'));
for (const j of jobs) {
  try {
    await access(root + '/' + j.id + '.camera-v2.prompt.txt');
    j.prompt = j.id + '.camera-v2.prompt.txt';
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
}
for (const c of corrections) {
  await access(root + '/' + c.source);
  await access(root + '/' + c.prompt);
  const j = jobs.find((j) => j.id === c.id);
  if (!j) throw Error(c.id);
  j.poseSources ??= {};
  for (const pose of c.poses) j.poseSources[pose] = c.source;
}
await writeFile(root + '/generation-jobs.json', JSON.stringify(jobs, null, 2) + '\n');
console.log({ sheets: jobs.length, correctedPoses: corrections.flatMap((c) => c.poses).length });
