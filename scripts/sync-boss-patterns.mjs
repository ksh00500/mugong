import { readFile, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';

// Import the TypeScript definitions without emitting a build artifact.
const bundle = await build({
  entryPoints: ['src/domain/boss-melee.ts'],
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
});
const { BOSS_KITS } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`
);
const path = 'src/domain/catalogue.json';
const catalogue = JSON.parse(await readFile(path, 'utf8'));
const rows = catalogue.bosses.map((boss) => {
  const id = `${catalogue.regions.findIndex((region) => region.name === boss.region)}-${boss.phase}`;
  const kit = BOSS_KITS[id];
  if (!kit) throw new Error(`Missing boss kit: ${id}`);
  return { id, boss, kit, patterns: kit.sequence.map((move) => kit.moves[move].name).join(' / ') };
});
const mismatches = rows.filter((row) => row.boss.patterns !== row.patterns);
if (process.argv.includes('--write')) {
  for (const row of rows) row.boss.patterns = row.patterns;
  await writeFile(path, `${JSON.stringify(catalogue, null, 2)}\n`);
} else if (mismatches.length) {
  throw new Error(
    `Stale boss descriptions: ${mismatches.map((row) => row.id).join(', ')}. Run with --write.`,
  );
}
const count = rows.reduce((total, row) => total + row.kit.sequence.length, 0);
console.log(
  `${rows.length} boss kits / ${count} moves; ${mismatches.length} description updates${process.argv.includes('--write') ? ' written' : ' needed'}.`,
);
