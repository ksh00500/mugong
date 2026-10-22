import { readFile, writeFile } from 'node:fs/promises';
await readFile('src/game/bamboo-family-frames.json');
for (const path of ['src/game/authored-enemy.ts', 'src/platform/region-art.ts']) {
  let s = await readFile(path, 'utf8');
  if (s.includes('import bamboo from')) continue;
  const relative = path.includes('platform') ? '../game' : '.';
  s = s.replace(
    /(import snow[^\n]*\n)/,
    `$1import bamboo from '${relative}/bamboo-family-frames.json' with { type: 'json' };\n`,
  );
  if (path.includes('authored-enemy')) {
    s = s
      .replace(
        'export const SNOW_FAMILY_ART = snow;',
        'export const SNOW_FAMILY_ART = snow;\nexport const BAMBOO_FAMILY_ART = bamboo;',
      )
      .replaceAll('...snow.characters,', '...snow.characters,\n    ...bamboo.characters,');
    s = s.replace(
      '  if (region === 3) {',
      `  if (region === 5) {
    // Explicit roles own the held tool; boss identity precedes inherited roles.
    const slot = enemy.bossId ? enemyArtSlot(enemy, region)
      : enemy.role === 'assassin' ? 0
      : enemy.role === 'needle' ? 1
      : enemy.role === 'trapper' ? 2
      : enemy.kind === 'archer' ? 1 : enemy.kind === 'spear' ? 2 : 0;
    return bamboo.characters.find((art) => art.slot === slot);
  }
  if (region === 3) {`,
    );
  } else {
    s = s.replace('[0, 1, 2, 3, 4, 7, 8, 9]', '[0, 1, 2, 3, 4, 5, 7, 8, 9]');
    s = s.replace(
      '        ...(index === 3',
      `        ...(index === 5
          ? Object.fromEntries(
              [...new Set(bamboo.characters.flatMap((art) => art.frames.map((f) => f.texture)))].map(
                (key) => [key, \`/art/bamboo-family-v1/\${key.replace('bamboo-family-', '')}.webp\`],
              ),
            )
          : {}),
        ...(index === 3`,
    );
  }
  await writeFile(path, s);
}
const path = 'src/game/CombatScene.ts';
let s = await readFile(path, 'utf8');
if (!s.includes("key.startsWith('bamboo-family-')"))
  s = s.replaceAll(
    "key.startsWith('snow-family-')",
    "key.startsWith('snow-family-') || key.startsWith('bamboo-family-')",
  );
await writeFile(path, s);
console.log('Bamboo native runtime enabled for region5.');
