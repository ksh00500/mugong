import { build } from 'esbuild';
import { writeFile } from 'node:fs/promises';
// Build in memory: no generated temporary module beside user sources.
const result = await build({
  entryPoints: ['src/platform/region-art-source.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
});
const { buildRegionArtIndex } = await import(
  'data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64')
);
const content = JSON.stringify(buildRegionArtIndex(), null, 2) + '\n';
await writeFile('src/platform/region-art-manifests.json', content);
console.log(`Wrote region art index: ${Buffer.byteLength(content)} bytes`);
