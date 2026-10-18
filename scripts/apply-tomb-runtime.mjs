import { readFile, writeFile } from 'node:fs/promises';
await readFile('src/game/tomb-family-frames.json');
for (const path of ['src/game/authored-enemy.ts', 'src/platform/region-art.ts']) {
  let s = await readFile(path, 'utf8');
  if (s.includes('import tomb from')) continue;
  const relative = path.includes('platform') ? '../game' : '.';
  s = s.replace(
    /(import bamboo[^\n]*\n)/,
    `$1import tomb from '${relative}/tomb-family-frames.json' with { type: 'json' };\n`,
  );
  if (path.includes('authored-enemy')) {
    s = s
      .replace(
        'export const BAMBOO_FAMILY_ART = bamboo;',
        'export const BAMBOO_FAMILY_ART = bamboo;\nexport const TOMB_FAMILY_ART = tomb;',
      )
      .replaceAll('...bamboo.characters,', '...bamboo.characters,\n    ...tomb.characters,');
    s = s.replace(
      '  if (region === 5) {',
      `  if (region === 6) {
    // Both trapper and guard use spear kind; explicit role owns the tool.
    const slot = enemy.bossId ? enemyArtSlot(enemy, region)
      : enemy.role === 'trapper' ? 0 : enemy.role === 'guard' ? 1
      : enemy.role === 'crossbow' ? 2 : enemy.kind === 'archer' ? 2
      : enemy.kind === 'spear' ? 1 : 0;
    return tomb.characters.find((art) => art.slot === slot);
  }
  if (region === 5) {`,
    );
  } else {
    s = s.replace('[0, 1, 2, 3, 4, 5, 7, 8, 9]', '[0, 1, 2, 3, 4, 5, 6, 7, 8, 9]');
    s = s.replace(
      '        ...(index === 5',
      `        ...(index === 6
          ? Object.fromEntries(
              [...new Set(tomb.characters.flatMap((art) => art.frames.map((f) => f.texture)))].map(
                (key) => [key, \`/art/tomb-family-v1/\${key.replace('tomb-family-', '')}.webp\`],
              ),
            )
          : {}),
        ...(index === 5`,
    );
  }
  await writeFile(path, s);
}
const path = 'src/game/CombatScene.ts';
let s = await readFile(path, 'utf8');
if (!s.includes("key.startsWith('tomb-family-')"))
  s = s.replaceAll(
    "key.startsWith('bamboo-family-')",
    "key.startsWith('bamboo-family-') || key.startsWith('tomb-family-')",
  );
await writeFile(path, s);
console.log('Tomb native runtime enabled for region6.');
