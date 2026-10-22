import { readFile, writeFile } from 'node:fs/promises';
const root = 'docs/source/tomb-family-v1';
const qs = JSON.parse(await readFile(`${root}/second-repair-requests.json`, 'utf8'));
const q = qs[0];
q.id = 'tombtrapper-right-repair-v5';
q.source = q.id + '.png';
q.prompt = q.id + '.prompt.txt';
q.references = ['reference-tombtrapper-rear-right.png', 'reference-tombtrapper-right.png'];
// Actual source cell5 has the right hand returning to the belt for reload.
qs[5].targets.find((t) => t.pose === 10).cell.index = 5;
await writeFile(`${root}/second-repair-requests.json`, JSON.stringify(qs, null, 2) + '\n');
