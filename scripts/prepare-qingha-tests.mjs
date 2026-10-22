import {readFile,writeFile} from 'node:fs/promises';
const moves=`[\n      ['slash','sweep','summon','slam','dash'],\n      ['thrust','combo','stance','sweep','slam','dash'],\n      ['thrust','combo','sweep','slam'],\n      ['slash','combo','dash','sweep','slam'],\n    ]`;
const convert=s=>s.replaceAll('DESERT','QINGHA').replaceAll('Desert','Qingha').replaceAll('desert','qingha')
 .replaceAll("kind: 'spear', role: 'rider'","kind: 'sword', role: 'raider'")
 .replaceAll("kind: 'sword', role: 'assassin'","kind: 'spear', role: 'guard'")
 .replaceAll("'rider'","'raider'").replaceAll("'assassin'","'guard'").replaceAll("'ringblade'","'bowman'")
 .replaceAll("'asar'","'madabong'").replaceAll("'naya'","'nojin'").replaceAll("'balta'","'cheolmu'").replaceAll("'arkan'","'hanmugeuk'")
 .replaceAll('`7-','`0-').replaceAll("'7-","'0-")
 .replaceAll('seedRegion(page, 7','seedRegion(page, 0').replaceAll('enemy, 7','enemy, 0').replaceAll('e, 7','e, 0')
 .replaceAll("role: 'raider' }, 7","role: 'raider' }, 0")
 .replaceAll('regionArtManifest(7)','regionArtManifest(0)').replaceAll('region-actors-7','region-actors-0').replaceAll('region-direction-7','region-direction-0').replaceAll('region-motion-7','region-motion-0').replaceAll('region-rear-7','region-rear-0')
 .replace(/const moves = \[[\s\S]*?\n\s{4,8}\];/,`const moves = ${moves};`)
 .replace('expect(r.mounted).toBe(r.slot === 0);','expect(r.mounted).toBe(false);');
for(const path of ['tests/authored-desert.test.ts','tests/e2e/authored-desert.spec.ts','tests/e2e/local-preview-desert.spec.ts']){
 let s=convert(await readFile(path,'utf8'));
 if(path==='tests/authored-desert.test.ts')s=s.replace("      'raider',\n      'guard',\n      'bowman',", "      'qingharaider',\n      'qinghaguard',\n      'qinghabowman',");
 await writeFile(path.replaceAll('desert','qingha'),s);
}
let release=convert(await readFile('tests/e2e/desert-release.spec.ts','utf8'))
 .replace('mounted slash, assassin dash and ring throw','dao slash, spear thrust and crossbow bolt')
 .replace("['raider', 'guard', 'bowman', 'naya-fan', 'naya-ring']", "['raider', 'guard', 'bowman']")
 .replace(/kind: role.startsWith\('naya-'\)[\s\S]*?: 'sword',/, "kind: role === 'bowman' ? 'archer' : role === 'guard' ? 'spear' : 'sword',")
 .replace("role: role.startsWith('naya-') ? undefined : role,",'role,')
 .replace("bossId: role.startsWith('naya-') ? '0-2' : undefined,",'bossId: undefined,')
 .replace("move: role.startsWith('naya-') ? role.slice(5) : undefined,",'move: undefined,')
 .replace(/role.startsWith\('naya-'\)\s*\? run.projectiles.some\(\(p: any\) => p.owner === e.id\)\s*: run.fighter.hp < before/, 'run.fighter.hp < before')
 .replace("`qingha-family-${r.role.startsWith('naya-') ? 'nojin' : r.role}-`",'`qingha-family-qingha${r.role}-`')
 .replace("if (r.role === 'bowman' || r.role.startsWith('naya-'))", "if (r.role === 'bowman')")
 .replace("expect(r.projectiles).toBe(r.role === 'naya-ring' ? 1 : 3);",'expect(r.projectiles).toBe(1);')
 .replace("test('Qingha", "const proof = process.env.MUGONG_QINGHA_PROOF ?? 'docs/verification/qingha-family-v1';\ntest('Qingha")
 .replace("await mkdir('docs/verification/qingha-family-v1',",'await mkdir(proof,')
 .replace("'docs/verification/qingha-family-v1/actual-release.json'",'`${proof}/actual-release.json`');
await writeFile('tests/e2e/qingha-release.spec.ts',release);
const configPath='playwright.production.config.ts';let config=await readFile(configPath,'utf8');
if(!config.includes('local-preview-qingha.spec.ts'))config=config.replace("'local-preview-desert.spec.ts',","'local-preview-desert.spec.ts',\n    'local-preview-qingha.spec.ts',");
await writeFile(configPath,config);
console.log('Prepared Qingha unit, four renderer/motion matrices,24 actual ordinary contacts,3 viewport checks.');
