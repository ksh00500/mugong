import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const sharp = createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH ?? 'sharp');
const root = 'docs/source/tomb-family-v1';
const { characters } = JSON.parse(await readFile('src/game/tomb-family-frames.json', 'utf8'));
const provenance = JSON.parse(await readFile(`${root}/provenance.json`, 'utf8'));
const sources = [...new Set(characters.flatMap((c) => c.frames.map((f) => f.source)))].sort();
for (const source of sources) {
  const entry = provenance.find((p) => p.source === source);
  if (!entry || entry.tool !== 'image_gen.imagegen')
    throw Error(`Missing native provenance: ${source}`);
  const [saved, original] = await Promise.all([
    readFile(`${root}/${source}`),
    readFile(entry.original),
  ]);
  if (!saved.equals(original)) throw Error(`Original source changed: ${source}`);
  await readFile(`${root}/${entry.prompt}`);
}
const hashes = new Map();
const records = [];
for (const c of characters)
  for (const f of c.frames) {
    const b = f.bounds;
    const rgba = await sharp(
      `public/art/tomb-family-v1/${f.texture.replace('tomb-family-', '')}.webp`,
    )
      .extract({
        left: f.x + b.left,
        top: f.y + b.top,
        width: b.right - b.left,
        height: b.bottom - b.top,
      })
      .ensureAlpha()
      .raw()
      .toBuffer();
    const hash = createHash('sha256').update(rgba).digest('hex');
    const id = `${c.id}/${f.view}/${f.sourcePose}`;
    if (hashes.has(hash)) throw Error(`Duplicate source drawing: ${id}, ${hashes.get(hash)}`);
    hashes.set(hash, id);
    records.push({ id, source: f.source, sha256: hash });
  }
const result = {
  sources,
  nativeProvenanceVerified: true,
  selectedFrames: records.length,
  uniqueFrameHashes: hashes.size,
  records,
};
await writeFile(`${root}/selected-art-audit.json`, JSON.stringify(result, null, 2) + '\n');
console.log(
  JSON.stringify({
    selectedSources: sources.length,
    selectedFrames: records.length,
    uniqueFrameHashes: hashes.size,
    nativeProvenanceVerified: true,
  }),
);
