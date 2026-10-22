import { readFile, writeFile } from 'node:fs/promises';
await readFile('src/game/snow-family-frames.json');
for (const path of ['src/game/authored-enemy.ts', 'src/platform/region-art.ts']) {
  let s = await readFile(path, 'utf8');
  if (s.includes('import snow from')) continue;
  const importLine = path.includes('platform')
    ? "import snow from '../game/snow-family-frames.json' with { type: 'json' };"
    : "import snow from './snow-family-frames.json' with { type: 'json' };";
  s = s.replace(/(import qingha[^\n]*\n)/, `$1${importLine}\n`);
  if (path.includes('authored-enemy')) {
    s = s
      .replace(
        'export const QINGHA_FAMILY_ART = qingha;',
        'export const QINGHA_FAMILY_ART = qingha;\nexport const SNOW_FAMILY_ART = snow;',
      )
      .replaceAll('...qingha.characters,', '...qingha.characters,\n    ...snow.characters,');
    const branch = `  if (region === 3) {
    // Iceweaver and bowman both use archer kind; the role owns its held tool.
    const slot = enemy.bossId
      ? enemyArtSlot(enemy, region)
      : enemy.role === 'icehunter' ? 0
      : enemy.role === 'iceweaver' ? 1
      : enemy.role === 'bowman' ? 2
      : enemy.kind === 'spear' ? 0 : 2;
    return snow.characters.find((art) => art.slot === slot);
  }
`;
    s = s.replace('  if (region === 0) {', branch + '  if (region === 0) {');
  } else {
    s = s.replace('[0, 1, 2, 4, 7, 8, 9]', '[0, 1, 2, 3, 4, 7, 8, 9]');
    s = s.replace(
      '        ...(index === 0',
      `        ...(index === 3
          ? Object.fromEntries(
              [...new Set(snow.characters.flatMap((art) => art.frames).map((f) => f.texture))].map(
                (key) => [key, \`/art/snow-family-v1/\${key.replace('snow-family-', '')}.webp\`],
              ),
            )
          : {}),
        ...(index === 0`,
    );
  }
  await writeFile(path, s);
}
const path = 'src/game/CombatScene.ts';
let s = await readFile(path, 'utf8');
if (!s.includes("key.startsWith('snow-family-')"))
  s = s.replaceAll(
    "key.startsWith('qingha-family-')",
    "key.startsWith('qingha-family-') || key.startsWith('snow-family-')",
  );
await writeFile(path, s);
for (const name of ['desert', 'dokmu', 'qingha', 'hyeolma', 'family', 'tianjian', 'zhuge']) {
  const path = `tests/authored-${name}.test.ts`;
  let s = await readFile(path, 'utf8');
  s = s.replace(
    'for (const e of cases) expect(authoredEnemyArt(e, 3)).toBeUndefined();',
    'for (const e of cases) expect(authoredEnemyArt(e, 6)).toBeUndefined();',
  );
  await writeFile(path, s);
}
console.log(
  'Snow native runtime enabled; generic unimplemented-region assertions now use tomb region6.',
);
