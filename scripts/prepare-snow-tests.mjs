import { readFile, writeFile } from 'node:fs/promises';
const moves = `[
      ['thrust', 'dash', 'sweep', 'slam', 'combo'],
      ['fan', 'hazard', 'stance', 'thrust'],
      ['stance', 'dash', 'combo', 'slam'],
      ['fan', 'stance', 'hazard', 'sweep', 'combo'],
    ]`;
const convert = (s) =>
  s
    .replaceAll('QINGHA', 'SNOW')
    .replaceAll('Qingha', 'Snow')
    .replaceAll('qingha', 'snow')
    .replaceAll("kind: 'sword', role: 'raider'", "kind: 'spear', role: 'icehunter'")
    .replaceAll("kind: 'spear', role: 'guard'", "kind: 'archer', role: 'iceweaver'")
    .replaceAll("'raider'", "'icehunter'")
    .replaceAll("'guard'", "'iceweaver'")
    .replaceAll("'snowraider'", "'snowhunter'")
    .replaceAll("'snowguard'", "'snowweaver'")
    .replaceAll('madabong', 'mokjin')
    .replaceAll('nojin', 'xuelan')
    .replaceAll('cheolmu', 'baixue')
    .replaceAll('hanmugeuk', 'hanxue')
    .replaceAll('`0-', '`3-')
    .replaceAll("'0-", "'3-")
    .replaceAll('seedRegion(page, 0', 'seedRegion(page, 3')
    .replaceAll('enemy, 0', 'enemy, 3')
    .replaceAll('e, 0', 'e, 3')
    .replaceAll("role: 'icehunter' }, 0", "role: 'icehunter' }, 3")
    .replaceAll('regionArtManifest(0)', 'regionArtManifest(3)')
    .replaceAll('region-actors-0', 'region-actors-3')
    .replaceAll('region-direction-0', 'region-direction-3')
    .replaceAll('region-motion-0', 'region-motion-3')
    .replaceAll('region-rear-0', 'region-rear-3')
    .replace(/const moves = \[[\s\S]*?\n\s{4,8}\];/, `const moves = ${moves};`);
for (const path of [
  'tests/authored-qingha.test.ts',
  'tests/e2e/authored-qingha.spec.ts',
  'tests/e2e/local-preview-qingha.spec.ts',
]) {
  let s = convert(await readFile(path, 'utf8'));
  if (path === 'tests/authored-qingha.test.ts') {
    s = s.replace(
      'for (const e of cases) expect(authoredEnemyArt(e, 3)).toBeUndefined();',
      'for (const e of cases) expect(authoredEnemyArt(e, 6)).toBeUndefined();',
    );
    s = s.replace(
      "describe('whole Snow authored family', () => {",
      `describe('whole Snow authored family', () => {
  it('keeps the snow commander separate from the Shaolin abbot frame map', () => {
    const abbot = authoredEnemyArt({kind: 'chief', bossId: '4-4'}, 4)!;
    const commander = authoredEnemyArt({kind: 'chief', bossId: '3-1'}, 3)!;
    expect(abbot.id).toBe('mujin');
    expect(commander.id).toBe('mokjin');
    for(let d=0;d<8;d++) {
      expect(authoredEnemyFrame(abbot,d,'strike',0.35,0).frame.texture).toContain('shaolin-family-mujin-');
      expect(authoredEnemyFrame(commander,d,'strike',0.35,0).frame.texture).toContain('snow-family-mujin-');
    }
  });`,
    );
  }
  if (path.includes('local-preview')) s = s.replace("selectOption('5')", "selectOption('6')");
  await writeFile(path.replaceAll('qingha', 'snow'), s);
}
let s = convert(await readFile('tests/e2e/qingha-release.spec.ts', 'utf8'))
  .replace(
    'dao slash, spear thrust and crossbow bolt',
    'spear dash, cold-field cast and bow release',
  )
  .replace(
    "kind: role === 'bowman' ? 'archer' : role === 'iceweaver' ? 'spear' : 'sword',",
    "kind: role === 'icehunter' ? 'spear' : 'archer',",
  )
  .replace("if (role !== 'bowman')", "if (role === 'icehunter')")
  .replace(
    '`snow-family-snow${r.role}-`',
    "`snow-family-${({ icehunter: 'snowhunter', iceweaver: 'snowweaver', bowman: 'snowbowman' } as Record<string, string>)[r.role]}-`",
  )
  .replace("if (r.role === 'bowman')", "if (r.role !== 'icehunter')")
  .replace(
    'expect(r.landing).toBeUndefined();',
    "if (r.role === 'iceweaver') expect(r.landing).toBe('cold');\n      else expect(r.landing).toBeUndefined();",
  );
await writeFile('tests/e2e/snow-release.spec.ts', s);
const path = 'playwright.production.config.ts';
let config = await readFile(path, 'utf8');
if (!config.includes('local-preview-snow.spec.ts'))
  config = config.replace(
    "'local-preview-qingha.spec.ts',",
    "'local-preview-qingha.spec.ts',\n    'local-preview-snow.spec.ts',",
  );
await writeFile(path, config);
console.log(
  'Snow tests prepared: 7 identities, 4 renderer/motion matrices, 24 actual releases and 3 local production viewports.',
);
