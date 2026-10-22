import { readFile, writeFile } from 'node:fs/promises';
const root = 'docs/source/tomb-family-v1';
const json = async (p) => JSON.parse(await readFile(`${root}/${p}`, 'utf8'));
const jobs = await json('generation-jobs.json');
const f = await json('directional-visual-findings.json');
for (const g of f.gridOverrides) {
  const job = jobs.find((j) => j.id === g.id);
  if (!g.irregular)
    for (let p = 0; p < 12; p++)
      job.poseSourceCells[p] = { columns: g.columns, rows: g.rows, index: p };
}
const j = jobs.find((j) => j.id === 'jeokho-back');
const rects = [
  [0, 0, 323, 335],
  [323, 0, 646, 335],
  [646, 0, 969, 335],
  [969, 0, 1293, 335],
  [0, 335, 480, 610],
  [540, 330, 1250, 610],
  [0, 610, 500, 925],
  [500, 540, 900, 930],
  [900, 610, 1293, 925],
  [0, 925, 470, 1217],
  [470, 925, 890, 1217],
  [890, 925, 1293, 1217],
];
for (let p = 0; p < 12; p++) j.poseSourceCells[p] = { rectangle: rects[p] };
await writeFile(`${root}/generation-jobs.json`, JSON.stringify(jobs, null, 2) + '\n');
const existing = await json('visual-issues.json');
for (const issue of f.issues) if (!existing.some((r) => r.id === issue.id)) existing.push(issue);
await writeFile(`${root}/visual-issues.json`, JSON.stringify(existing, null, 2) + '\n');
await writeFile(
  `${root}/repair-queue.json`,
  JSON.stringify(
    existing.map(({ issue, ...i }) => ({ ...i, reason: issue })),
    null,
    2,
  ) + '\n',
);
const requests = await json('generation-requests.json');
for (const r of requests)
  if (r.view !== 0) {
    const front = jobs.find((j) => j.character === r.character && j.view === 0);
    if (!r.references.includes(`${root}/${front.source}`))
      r.references.push(`${root}/${front.source}`);
  }
const guard = requests.find((r) => r.id === 'tombguard-front-v2');
if (guard && !guard.references.includes(`${root}/tombtrapper-front.png`))
  guard.references.push(`${root}/tombtrapper-front.png`);
await writeFile(`${root}/generation-requests.json`, JSON.stringify(requests, null, 2) + '\n');
console.log('Recorded directional layouts, visual repairs and actual references.');
