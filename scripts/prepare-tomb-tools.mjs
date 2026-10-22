import { readFile, writeFile, mkdir } from 'node:fs/promises';
const swap = (s) =>
  s.replaceAll('BAMBOO', 'TOMB').replaceAll('Bamboo', 'Tomb').replaceAll('bamboo', 'tomb');
for (const f of [
  'audit-bamboo-art',
  'bamboo-contact-review',
  'preview-bamboo-sources',
  'bamboo-progress',
  'finish-bamboo',
]) {
  const out = swap(f);
  let s = swap(await readFile(`scripts/${f}.mjs`, 'utf8'));
  if (f === 'finish-bamboo')
    s = s
      .replace('r.contacts.length === 200', 'r.contacts.length === 160')
      .replace('totalBossContacts: 800', 'totalBossContacts: 640');
  await writeFile(`scripts/${out}.mjs`, s);
}
const moves = [
  ['slash', 'thrust', 'slam', 'stance', 'dash'],
  ['stance', 'dash', 'slam', 'sweep', 'hazard'],
  ['stance', 'fan', 'slash', 'slam'],
  ['combo', 'dash', 'thrust', 'stance', 'fan'],
];
const idSwap = (s) =>
  swap(s)
    .replaceAll('tombassassin', 'tombtrapper')
    .replaceAll('tombneedle', 'tombguard')
    .replaceAll('tombtrapper\u0000', 'unused')
    .replaceAll('qingbi', 'jeokho')
    .replaceAll('nogae', 'seokmun')
    .replaceAll('yanqing', 'gwakgi')
    .replaceAll('songwol', 'wolryeong');
// Protect old trapper identity before replacing assassin -> new trapper.
const textSwap = (s) =>
  swap(s.replaceAll('bambootrapper', 'TOMB_CROSSBOW'))
    .replaceAll('TOMB_CROSSBOW', 'tombcrossbow')
    .replaceAll('tombassassin', 'tombtrapper')
    .replaceAll('tombneedle', 'tombguard')
    .replaceAll('qingbi', 'jeokho')
    .replaceAll('nogae', 'seokmun')
    .replaceAll('yanqing', 'gwakgi')
    .replaceAll('songwol', 'wolryeong')
    .replaceAll("'assassin'", "'ROLE_TRAPPER'")
    .replaceAll("'needle'", "'guard'")
    .replaceAll("'trapper'", "'crossbow'")
    .replaceAll("'ROLE_TRAPPER'", "'trapper'")
    .replaceAll("bossId: '5-", "bossId: '6-")
    .replaceAll('bossId: `5-', 'bossId: `6-')
    .replaceAll('authoredEnemyArt(e, 5)', 'authoredEnemyArt(e, 6)')
    .replaceAll('authoredEnemyArt(enemy, 5)', 'authoredEnemyArt(enemy, 6)')
    .replaceAll('regionArtManifest(5)', 'regionArtManifest(6)')
    .replaceAll('seedRegion(page, 5,', 'seedRegion(page, 6,')
    .replaceAll("{ kind: 'sword', role: 'trapper' }", "{ kind: 'spear', role: 'trapper' }")
    .replaceAll("{ kind: 'archer', role: 'guard' }", "{ kind: 'spear', role: 'guard' }")
    .replaceAll("{ kind: 'spear', role: 'crossbow' }", "{ kind: 'archer', role: 'crossbow' }")
    .replaceAll('region-actors-5', 'region-actors-6')
    .replaceAll('region-direction-5', 'region-direction-6')
    .replaceAll('region-motion-5', 'region-motion-6')
    .replaceAll('region-rear-5', 'region-rear-6');
for (const [src, dst] of [
  ['tests/authored-bamboo.test.ts', 'tests/authored-tomb.test.ts'],
  ['tests/e2e/authored-bamboo.spec.ts', 'tests/e2e/authored-tomb.spec.ts'],
  ['tests/e2e/bamboo-release.spec.ts', 'tests/e2e/tomb-release.spec.ts'],
  ['tests/e2e/local-preview-bamboo.spec.ts', 'tests/e2e/local-preview-tomb.spec.ts'],
]) {
  let s = textSwap(await readFile(src, 'utf8'));
  if (dst.includes('authored-'))
    s = s.replace(/const moves = \[[\s\S]*?\n\s*\];/, `const moves = ${JSON.stringify(moves)};`);
  if (dst.includes('.test.'))
    s = s.replace(
      'for (const e of cases) expect(authoredEnemyArt(e, 6)).toBeUndefined();',
      'for (const e of cases) expect(authoredEnemyArt(e, 5)?.id).not.toBe(authoredEnemyArt(e, 6)?.id);',
    );
  if (dst.includes('release')) {
    s = s.replace(
      'Tomb dagger dash, needle fan and trap release',
      'Tomb trap release, spear thrust and crossbow fan',
    );
    s = s.replace(
      "kind: role === 'trapper' ? 'sword' : role === 'guard' ? 'archer' : 'spear'",
      "kind: role === 'crossbow' ? 'archer' : 'spear'",
    );
    s = s.replace("if (role === 'trapper')", "if (role === 'guard')");
    s = s
      .replace("if (r.role !== 'trapper')", "if (r.role !== 'guard')")
      .replace("r.role === 'guard' ? 3 : 1", "r.role === 'crossbow' ? 3 : 1")
      .replace(
        "if (r.role === 'crossbow') expect(r.landing).toBe('trap');",
        "if (r.role === 'trapper') expect(r.landing).toBe('trap');",
      );
    s = s.replace(
      "{ assassin: 'tombtrapper', needle: 'tombguard', trapper: 'tombcrossbow' }",
      "{ trapper: 'tombtrapper', guard: 'tombguard', crossbow: 'tombcrossbow' }",
    );
  }
  await writeFile(dst, s);
}
let config = await readFile('playwright.production.config.ts', 'utf8');
if (!config.includes('local-preview-tomb.spec.ts'))
  config = config.replace(
    "    'local-preview-bamboo.spec.ts',",
    "    'local-preview-bamboo.spec.ts',\n    'local-preview-tomb.spec.ts',",
  );
await writeFile('playwright.production.config.ts', config);
// All regions now own authored art; test separation by identity, not lack of art.
for (const family of [
  'bamboo',
  'snow',
  'qingha',
  'desert',
  'hyeolma',
  'dokmu',
  'tianjian',
  'zhuge',
]) {
  const p = `tests/authored-${family}.test.ts`;
  let s = await readFile(p, 'utf8');
  s = s.replace(
    /for \(const e of cases\) expect\(authoredEnemyArt\(e, 6\)\)\.toBeUndefined\(\);/g,
    `for (const e of cases) expect(authoredEnemyArt(e, 6)?.id).not.toBe(authoredEnemyArt(e, ${{ bamboo: 5, snow: 3, qingha: 0, desert: 7, hyeolma: 8, dokmu: 1, tianjian: 2, zhuge: 9 }[family]})?.id);`,
  );
  await writeFile(p, s);
}
await mkdir('docs/verification/tomb-family-v1', { recursive: true });
console.log('Tomb audit, contacts, review and verification tools prepared.');
