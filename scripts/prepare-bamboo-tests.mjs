import { readFile, writeFile, mkdir } from 'node:fs/promises';
const moves = [
  ['fan', 'ring', 'stance', 'combo', 'dash'],
  ['thrust', 'sweep', 'combo', 'slam', 'dash'],
  ['dash', 'thrust', 'combo', 'sweep', 'stance'],
  ['stance', 'fan', 'thrust', 'combo', 'dash'],
];
const identities = [
  'bambooassassin',
  'bambooneedle',
  'bambootrapper',
  'qingbi',
  'nogae',
  'yanqing',
  'songwol',
];
const roles = ['assassin', 'needle', 'trapper'];
const swap = (s) =>
  s
    .replaceAll('SNOW', 'BAMBOO')
    .replaceAll('Snow', 'Bamboo')
    .replaceAll('snow', 'bamboo')
    .replaceAll('icehunter', 'assassin')
    .replaceAll('iceweaver', 'needle')
    .replaceAll('bowman', 'trapper')
    .replaceAll('bamboohunter', 'bambooassassin')
    .replaceAll('bambooweaver', 'bambooneedle')
    .replaceAll('bamboobowman', 'bambootrapper')
    .replaceAll('mokjin', 'qingbi')
    .replaceAll('xuelan', 'nogae')
    .replaceAll('baixue', 'yanqing')
    .replaceAll('hanxue', 'songwol')
    .replaceAll("bossId: '3-", "bossId: '5-")
    .replaceAll('bossId: `3-', 'bossId: `5-')
    .replaceAll('authoredEnemyArt(e, 3)', 'authoredEnemyArt(e, 5)')
    .replaceAll('authoredEnemyArt(enemy, 3)', 'authoredEnemyArt(enemy, 5)')
    .replaceAll('regionArtManifest(3)', 'regionArtManifest(5)')
    .replaceAll('seedRegion(page, 3,', 'seedRegion(page, 5,')
    .replaceAll("{ kind: 'spear', role: 'assassin' }", "{ kind: 'sword', role: 'assassin' }")
    .replaceAll("{ kind: 'archer', role: 'trapper' }", "{ kind: 'spear', role: 'trapper' }");
for (const [src, dst] of [
  ['tests/authored-snow.test.ts', 'tests/authored-bamboo.test.ts'],
  ['tests/e2e/authored-snow.spec.ts', 'tests/e2e/authored-bamboo.spec.ts'],
  ['tests/e2e/snow-release.spec.ts', 'tests/e2e/bamboo-release.spec.ts'],
  ['tests/e2e/local-preview-snow.spec.ts', 'tests/e2e/local-preview-bamboo.spec.ts'],
]) {
  let s = swap(await readFile(src, 'utf8'));
  if (dst.includes('authored-'))
    s = s.replace(/const moves = \[[\s\S]*?\n\s*\];/, `const moves = ${JSON.stringify(moves)};`);
  if (dst.includes('.test.')) {
    s = s.replace(/  it\('keeps the bamboo commander[\s\S]*?\n  \}\);\n/, '');
    s = s.replace("role: 'assassin' }, 3)?.id", "role: 'assassin' }, 5)?.id");
    s = s
      .replaceAll('region-actors-3', 'region-actors-5')
      .replaceAll('region-direction-3', 'region-direction-5')
      .replaceAll('region-motion-3', 'region-motion-5')
      .replaceAll('region-rear-3', 'region-rear-5');
  }
  if (dst.includes('release')) {
    s = s.replace(
      'Bamboo spear dash, cold-field cast and bow release',
      'Bamboo dagger dash, needle fan and trap release',
    );
    s = s.replace(
      "kind: role === 'assassin' ? 'spear' : 'archer'",
      "kind: role === 'assassin' ? 'sword' : role === 'needle' ? 'archer' : 'spear'",
    );
    s = s.replace(
      'expect(r.projectiles).toBe(1);',
      "expect(r.projectiles).toBe(r.role === 'needle' ? 3 : 1);",
    );
    s = s.replace(
      "if (r.role === 'needle') expect(r.landing).toBe('cold');",
      "if (r.role === 'trapper') expect(r.landing).toBe('trap');",
    );
  }
  await writeFile(dst, s);
}
let config = await readFile('playwright.production.config.ts', 'utf8');
if (!config.includes('local-preview-bamboo.spec.ts'))
  config = config.replace(
    "    'local-preview-snow.spec.ts',",
    "    'local-preview-snow.spec.ts',\n    'local-preview-bamboo.spec.ts',",
  );
await writeFile('playwright.production.config.ts', config);
await mkdir('docs/verification/bamboo-family-v1', { recursive: true });
let finish = swap(await readFile('scripts/finish-snow.mjs', 'utf8'));
finish = finish
  .replace('r.contacts.length === 168', 'r.contacts.length === 200')
  .replace('totalBossContacts: 672', 'totalBossContacts: 800');
await writeFile('scripts/finish-bamboo.mjs', finish);
console.log(JSON.stringify({ identities, roles, bossMoves: moves }));
