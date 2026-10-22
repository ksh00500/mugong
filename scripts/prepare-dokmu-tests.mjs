import { readFile, writeFile } from 'node:fs/promises';
const moves = `[\n      ['slash', 'thrust', 'dash', 'sweep', 'stance'],\n      ['hazard', 'fan', 'stance', 'slash'],\n      ['fan', 'hazard', 'stance', 'combo'],\n      ['fan', 'hazard', 'stance', 'thrust', 'sweep'],\n    ]`;
const convert = s => s.replaceAll('TIANJIAN','DOKMU').replaceAll('Tianjian','Dokmu').replaceAll('tianjian','dokmu')
  .replaceAll("kind: 'sword', role: 'duelist'", "kind: 'archer', role: 'needle'")
  .replaceAll("'duelist'", "'needle'").replaceAll("'swordcaster'", "'bombardier'")
  .replaceAll("'spearguard'", "'poisonguard'")
  .replaceAll("'ujin'", "'cheongrin'").replaceAll("'baekhong'", "'mukchil'")
  .replaceAll("'mumyeong'", "'yeonhwa'").replaceAll("'baekun'", "'sagongyeom'")
  .replaceAll('`2-','`1-').replaceAll("'2-","'1-")
  .replaceAll('seedRegion(page, 2','seedRegion(page, 1')
  .replaceAll('enemy, 2','enemy, 1').replaceAll('e, 2','e, 1')
  .replaceAll("role: 'needle' }, 2", "role: 'needle' }, 1")
  .replaceAll('regionArtManifest(2)', 'regionArtManifest(1)')
  .replaceAll('region-actors-2','region-actors-1').replaceAll('region-direction-2','region-direction-1')
  .replaceAll('region-motion-2','region-motion-1').replaceAll('region-rear-2','region-rear-1')
  .replace(/const moves = \[[\s\S]*?\n\s{4,8}\];/, `const moves = ${moves};`);
for (const name of ['tests/authored-tianjian.test.ts','tests/e2e/authored-tianjian.spec.ts','tests/e2e/local-preview-tianjian.spec.ts']) {
  let text = convert(await readFile(name,'utf8'));
  if (name.includes('local-preview')) text = text.replace("selectOption('4')", "selectOption('5')");
  await writeFile(name.replaceAll('tianjian','dokmu'), text);
}
let release = convert(await readFile('tests/e2e/tianjian-release.spec.ts','utf8'));
release = release.replace("kind: role === 'guard' ? 'spear' : role === 'needle' ? 'sword' : 'archer'", "kind: role === 'guard' ? 'spear' : 'archer'")
  .replaceAll("role !== 'bombardier'", "role === 'guard'")
  .replaceAll("r.role !== 'bombardier'", "r.role === 'guard'")
  .replace('expect(r.projectiles).toBe(2);', "expect(r.projectiles).toBe(r.role === 'needle' ? 3 : 1);\n      if (r.role === 'bombardier') expect(r.landing).toBe('poison');");
await writeFile('tests/e2e/dokmu-release.spec.ts',release);
console.log('Saved independent Dokmu role, release and boss contact verification.');
