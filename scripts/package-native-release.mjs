import { build } from 'esbuild';
import { readdir, readFile, writeFile, mkdir, copyFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
const version = process.argv[2];
if (!/^20261006-[a-z0-9-]+$/.test(version ?? '')) throw new Error('Expected release version');
const proof = `docs/verification/daytona-${version}`;
const stage = `.cache/daytona-${version}-stage`;
await mkdir(proof, { recursive: true });
await mkdir(stage, { recursive: true });
await build({
  stdin: {
    contents: `export * from './src/platform/assets.ts'; export * from './src/platform/region-art.ts'; export * from './src/platform/character-art.ts'; export { ITEM_ARTWORK } from './src/platform/item-art.ts';`,
    resolveDir: process.cwd(),
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: `.cache/release-manifests-${version}.mjs`,
});
const m = await import(`../.cache/release-manifests-${version}.mjs`);
const files = new Set(['index.html']);
const add = (url) => {
  if (typeof url === 'string' && url.startsWith('/art/')) files.add(url.slice(1));
};
Object.values(m.UI_IMAGES).forEach(add);
Object.values(m.COMBAT_IMAGES).forEach(add);
Object.values(m.ITEM_ARTWORK).forEach((v) => add(v.src));
Object.values(m.characterCombatImages()).forEach(add);
for (let i = 0; i < 10; i++) {
  Object.values(m.regionArtManifest(i)).forEach(add);
  Object.values(m.characterCombatImages({ appearance: i })).forEach(add);
  add(m.characterPortrait({ appearance: i }));
  add(m.characterLobbyArt({ appearance: i }));
}
async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const name = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...(await walk(name)));
    else out.push(name);
  }
  return out;
}
for (const dir of ['assets', 'fonts', 'audio'])
  for (const file of await walk(`dist/${dir}`)) files.add(file.slice(5));
// Include static artwork referenced by UI/CSS outside the image manifests.
for (const file of await walk('src')) {
  if (!/\.(ts|tsx|css|json)$/.test(file)) continue;
  const source = await readFile(file, 'utf8');
  for (const match of source.matchAll(/["'`](\/art\/[^"'`\s$]+\.(?:png|webp))["'`]/g))
    add(match[1]);
}
for (const file of await walk('dist/art'))
  if (file.endsWith('/review.html')) files.add(file.slice(5));
const remote = new Map();
for (const line of (await readFile('.cache/daytona-remote-current.sha256', 'utf8')).split('\n')) {
  const match = line.match(/^([a-f0-9]{64})\s+\.\/(.+)\r?$/);
  if (match) remote.set(match[2].trim(), match[1]);
}
const changedFiles = [],
  manifest = [];
let totalBytes = 0;
for (const file of [...files].sort()) {
  const content = await readFile(`dist/${file}`);
  totalBytes += content.length;
  const sha = createHash('sha256').update(content).digest('hex');
  manifest.push(`${sha}  ./${file}`);
  if (remote.get(file) !== sha) {
    changedFiles.push(file);
    await mkdir(path.dirname(`${stage}/${file}`), { recursive: true });
    await copyFile(`dist/${file}`, `${stage}/${file}`);
  }
}
await writeFile(`${stage}/SHA256SUMS`, manifest.join('\n') + '\n');
const archive = `${proof}/release.tar.gz`;
execFileSync('tar', ['-czf', archive, '-C', stage, '.']);
const summary = {
  version,
  release: `/srv/mugong/releases/${version}`,
  previous: process.argv[3],
  sha256: createHash('sha256')
    .update(await readFile(archive))
    .digest('hex'),
  transferBytes: (await stat(archive)).size,
  manifestFiles: files.size,
  totalBytes,
  changedFiles,
  assets: await readdir('dist/assets'),
  localDir: 'dist',
};
await writeFile(`${proof}/release.json`, JSON.stringify(summary, null, 2) + '\n');
console.log(
  JSON.stringify({
    version,
    transferBytes: summary.transferBytes,
    manifestFiles: files.size,
    changed: changedFiles.length,
    sha256: summary.sha256,
  }),
);
