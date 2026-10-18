import { readFile, writeFile } from 'node:fs/promises';
const root = 'docs/source/tomb-family-v1';
const raw = (await readFile(`${root}/second-repair-requests.json`, 'utf8')).replace(/\\n$/, '\n');
const qs = JSON.parse(raw);
for (const q of qs) {
  let p = await readFile(`${root}/${q.prompt}`, 'utf8');
  p = p.replaceAll('\\n', '\n');
  await writeFile(`${root}/${q.prompt}`, p);
}
const q = qs[1];
q.id = q.id.replace('-v3-', '-v4-');
q.source = q.id + '.png';
const p = await readFile(`${root}/${q.prompt}`, 'utf8');
q.prompt = q.id + '.prompt.txt';
await writeFile(`${root}/${q.prompt}`, p);
await writeFile(`${root}/second-repair-requests.json`, JSON.stringify(qs, null, 2) + '\n');
console.log(JSON.stringify(qs.map((q) => ({ ...q, text: '' }))));
