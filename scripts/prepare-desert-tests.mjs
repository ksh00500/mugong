import {readFile,writeFile} from 'node:fs/promises';
const moves=`[\n      ['dash','combo','sweep','stance','thrust'],\n      ['fan','ring','combo','dash'],\n      ['thrust','dash','combo','slam'],\n      ['dash','slash','combo','sweep','stance'],\n    ]`;
const convert=s=>s.replaceAll('HYEOLMA','DESERT').replaceAll('Hyeolma','Desert').replaceAll('hyeolma','desert')
 .replaceAll("kind: 'sword', role: 'bloodblade'","kind: 'spear', role: 'rider'")
 .replaceAll("kind: 'archer', role: 'hexer'","kind: 'archer', role: 'ringblade'")
 .replaceAll("'bloodblade'","'rider'").replaceAll("'bloodassassin'","'assassin'").replaceAll("'bloodhexer'","'ringblade'").replaceAll("'hexer'","'ringblade'")
 .replaceAll("'jeogu'","'asar'").replaceAll("'yeonsal'","'naya'").replaceAll("'sohong'","'balta'").replaceAll("'jeokcheon'","'arkan'")
 .replaceAll('`8-','`7-').replaceAll("'8-","'7-")
 .replaceAll('seedRegion(page, 8','seedRegion(page, 7').replaceAll('enemy, 8','enemy, 7').replaceAll('e, 8','e, 7')
 .replaceAll("role: 'rider' }, 8","role: 'rider' }, 7")
 .replaceAll('regionArtManifest(8)','regionArtManifest(7)').replaceAll('region-actors-8','region-actors-7').replaceAll('region-direction-8','region-direction-7').replaceAll('region-motion-8','region-motion-7').replaceAll('region-rear-8','region-rear-7')
 .replace(/const moves = \[[\s\S]*?\n\s{4,8}\];/,`const moves = ${moves};`);
for(const path of ['tests/authored-hyeolma.test.ts','tests/e2e/authored-hyeolma.spec.ts','tests/e2e/local-preview-hyeolma.spec.ts'])
 await writeFile(path.replaceAll('hyeolma','desert'),convert(await readFile(path,'utf8')));
let release=convert(await readFile('tests/e2e/hyeolma-release.spec.ts','utf8'))
 .replace('slash, assassin dash and blood ritual','mounted slash, assassin dash and ring throw')
 .replace("kind: role === 'ringblade' ? 'archer' : 'sword'", "kind: role === 'ringblade' ? 'archer' : role === 'rider' ? 'spear' : 'sword'")
 .replace("`desert-family-${r.role === 'assassin' ? 'assassin' : r.role === 'ringblade' ? 'ringblade' : r.role}-`", "`desert-family-${r.role}-`")
 .replace('expect(r.projectiles).toBe(1);', 'expect(r.projectiles).toBe(3);')
 .replace("expect(r.landing).toBe('blood');", 'expect(r.landing).toBeUndefined();');
await writeFile('tests/e2e/desert-release.spec.ts',release);
const configPath='playwright.production.config.ts';
let config=await readFile(configPath,'utf8');
if(!config.includes('local-preview-desert.spec.ts'))config=config.replace("'local-preview-hyeolma.spec.ts',","'local-preview-hyeolma.spec.ts',\n    'local-preview-desert.spec.ts',");
await writeFile(configPath,config);
console.log('Prepared desert contact, direction, bounds and isolated local preview checks.');
