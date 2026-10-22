import { readFile, writeFile } from 'node:fs/promises';
const root = 'docs/source/tomb-family-v1';
const requests = JSON.parse(await readFile(`${root}/generation-requests.json`, 'utf8'));
const jobs = JSON.parse(await readFile(`${root}/generation-jobs.json`, 'utf8'));
const identities = JSON.parse(await readFile(`${root}/identities.json`, 'utf8'));
const poses = [
  'idle guard',
  'left foot walking step',
  'passing walking step',
  'right foot walking step',
  'TINY hit response with very small movement',
  'prone defeated with unchanged physical head/body dimensions',
  'early attack load',
  'maximum anticipation',
  'CONTACT / RELEASE',
  'followthrough',
  'withdrawal',
  'return ready',
];
const next = [];
for (const r of requests) {
  if (r.character !== 'tombguard') {
    next.push(r);
    continue;
  }
  if (r.kind === 'combat') continue;
  const id = r.jobId,
    source = `${id}${r.view === 0 ? '-v2' : ''}.png`,
    prompt = source.replace('.png', '.prompt.txt');
  const previous = await readFile(`${root}/${r.prompt}`, 'utf8');
  const text = previous
    .replace(
      /PORTRAIT[\s\S]*?\nCAMERA FIXED:/,
      'PORTRAIT 3 COLUMNS x4 ROWS, TWELVE complete independent drawings, row-major. Mild top-down camera. Physical skull diameter90-100px, hat180px, standing head-to-boots300-330px. Keep FULL spear with alpha gaps between drawings; original body size never shrinks for attack.\nCAMERA FIXED:',
    )
    .replace(
      /ORDER:[\s\S]*?\nIDENTITY:/,
      `ORDER: ${poses.map((p, i) => `${i + 1}. ${p}`).join('; ')}.\nIDENTITY:`,
    );
  await writeFile(`${root}/${prompt}`, text);
  next.push({ ...r, id, kind: 'all', source, prompt });
  const j = jobs.find((j) => j.id === id);
  j.source = source;
  j.prompt = prompt;
  delete j.poseSources;
  j.poseSourceCells = {};
  for (let i = 0; i < 12; i++) j.poseSourceCells[i] = { columns: 3, rows: 4, index: i };
}
await writeFile(`${root}/generation-jobs.json`, JSON.stringify(jobs, null, 2) + '\n');
await writeFile(`${root}/generation-requests.json`, JSON.stringify(next, null, 2) + '\n');
identities[1][3] = false;
await writeFile(`${root}/identities.json`, JSON.stringify(identities, null, 2) + '\n');
console.log('Guard now uses same 12-pose camera grid; old six-pose candidate preserved.');
