import { build } from 'esbuild';
await build({
  entryPoints: ['src/pvp/server/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22.16',
  outfile: 'dist-server/pvp.mjs',
  packages: 'external',
  sourcemap: true,
});
