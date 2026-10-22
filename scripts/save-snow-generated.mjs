import { readFile, writeFile, copyFile } from 'node:fs/promises';
const root = 'docs/source/snow-special-v1';
const [id, original] = process.argv.slice(2);
const jobs = JSON.parse(await readFile(root + '/generation-jobs.json'));
const job = jobs.find((j) => j.sources.some((s) => s.id === id));
if (!job) throw Error('Unknown source ' + id);
const source = job.sources.find((s) => s.id === id);
await copyFile(original, root + '/' + source.source);
await writeFile(
  root + '/' + id + '.record.json',
  JSON.stringify(
    {
      id,
      original,
      source: root + '/' + source.source,
      reference: job.reference,
      promptFile: root + '/' + source.prompt,
      tool: 'built-in imagegen',
    },
    null,
    2,
  ) + '\n',
);
console.log(id + ' saved');
