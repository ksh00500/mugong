import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = 'docs/source/snow-special-v1';
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
  const inputReferences = await Promise.all(
    (r.referencedImages ?? [r.reference]).map(async (file) => ({
      file,
      sha256: hash(await readFile(file)),
    })),
  );
  records.push({
    ...r,
    sourceSha256: hash(source),
    referenceSha256: hash(reference),
    inputReferences,
    originalPreserved: true,
  });
}
if (records.length !== 10)
  throw Error(`Expected 10 selected Mokjin originals, got ${records.length}`);
await writeFile(`${root}/generation-records.json`, JSON.stringify(records, null, 2) + '\n');
await writeFile(
  `${root}/promptset.md`,
  '# 설산 목진 특별 모션 제작 프롬프트\n\n선택한 원화 10개와 실제 사용한 프롬프트. 나머지 세 보스는 생성 사용량 한도로 미완성이다. 원본 파일을 보존하고 SHA-256으로 복사본을 확인했다.\n\n' +
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
