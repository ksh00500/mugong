import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = 'docs/source/dokmu-special-v1';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const records = [];
for (const file of (await readdir(root)).filter((f) => f.endsWith('.record.json')).sort()) {
  const r = JSON.parse(await readFile(`${root}/${file}`, 'utf8'));
  const [original, source, reference] = await Promise.all([
    readFile(r.original),
    readFile(r.source),
    readFile(r.reference),
  ]);
  if (hash(original) !== hash(source)) throw Error(`Selected original differs: ${r.id}`);
  await readFile(r.promptFile, 'utf8');
  records.push({
    ...r,
    sourceSha256: hash(source),
    referenceSha256: hash(reference),
    originalPreserved: true,
  });
}
if (records.length !== 40) throw Error(`Expected 40 selected originals, got ${records.length}`);
await writeFile(`${root}/generation-records.json`, JSON.stringify(records, null, 2) + '\n');
await writeFile(
  `${root}/promptset.md`,
  '# 독무곡 특별 모션 제작 프롬프트\n\n선택한 원화 40개와 실제 사용한 프롬프트. 재제작 원본은 revision으로 구분한다. 모든 원본 파일을 보존하고 SHA-256으로 복사본을 확인했다.\n\n' +
    records
      .map(
        (r) =>
          `- ${r.id}: [프롬프트](${r.promptFile.split('/').at(-1)}) · [선택 원화](${r.source.split('/').at(-1)})`,
      )
      .join('\n') +
    '\n',
);
console.log(
  JSON.stringify({
    originals: records.length,
    revised: records.filter((r) => r.revision).length,
    originalCopiesIdentical: true,
  }),
);
