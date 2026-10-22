import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { basename, resolve, relative } from 'node:path';
const [family, id, original, source = `${id}.png`, prompt = `${id}.prompt.txt`] =
  process.argv.slice(2);
if (
  !['shaolin', 'zhuge', 'tianjian', 'dokmu', 'hyeolma', 'desert', 'qingha', 'snow', 'bamboo', 'tomb'].includes(family) ||
  basename(source) !== source ||
  basename(prompt) !== prompt
)
  throw Error('Invalid native image output');
const root = resolve(`docs/source/${family}-family-v1`),
  destination = resolve(root, source);
if (relative(root, destination).startsWith('..')) throw Error('Outside family source folder');
await readFile(resolve(root, prompt));
await copyFile(original, destination);
const ledger = resolve(root, 'provenance.json');
let entries = [];
try {
  entries = JSON.parse(await readFile(ledger, 'utf8'));
} catch (e) {
  if (e.code !== 'ENOENT') throw e;
}
entries = entries.filter((e) => e.source !== source);
entries.push({ id, source, tool: 'image_gen.imagegen', original, prompt });
await writeFile(ledger, JSON.stringify(entries, null, 2) + '\n');
console.log(source);
