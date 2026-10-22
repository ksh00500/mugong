import {readFile,writeFile}from 'node:fs/promises';
const moves=`[\n      ['slash','dash','combo','sweep','stance'],\n      ['stance','dash','combo','slam','thrust'],\n      ['fan','stance','hazard','sweep'],\n      ['combo','dash','thrust','stance','fan'],\n    ]`;
const convert=s=>s.replaceAll('DOKMU','HYEOLMA').replaceAll('Dokmu','Hyeolma').replaceAll('dokmu','hyeolma')
 .replaceAll("kind: 'archer', role: 'needle'","kind: 'sword', role: 'bloodblade'")
 .replaceAll("kind: 'spear', role: 'guard'","kind: 'sword', role: 'assassin'")
 .replaceAll("kind: 'archer', role: 'bombardier'","kind: 'archer', role: 'hexer'")
 .replaceAll("'needle'","'bloodblade'").replaceAll("'guard'","'assassin'").replaceAll("'bombardier'","'hexer'")
 .replaceAll("'poisonguard'","'bloodassassin'").replaceAll("'cheongrin'","'jeogu'").replaceAll("'mukchil'","'yeonsal'").replaceAll("'yeonhwa'","'sohong'").replaceAll("'sagongyeom'","'jeokcheon'")
 .replaceAll('`1-','`8-').replaceAll("'1-","'8-")
 .replaceAll('seedRegion(page, 1','seedRegion(page, 8').replaceAll('enemy, 1','enemy, 8').replaceAll('e, 1','e, 8')
 .replaceAll("role: 'bloodblade' }, 1","role: 'bloodblade' }, 8")
 .replaceAll('regionArtManifest(1)','regionArtManifest(8)').replaceAll('region-actors-1','region-actors-8').replaceAll('region-direction-1','region-direction-8').replaceAll('region-motion-1','region-motion-8').replaceAll('region-rear-1','region-rear-8')
 .replace(/const moves = \[[\s\S]*?\n\s{4,8}\];/,`const moves = ${moves};`);
for(const path of ['tests/authored-dokmu.test.ts','tests/e2e/authored-dokmu.spec.ts','tests/e2e/local-preview-dokmu.spec.ts']){
 let s=convert(await readFile(path,'utf8')).replace("'bloodblade',\n      'bloodassassin',\n      'hexer'","'bloodblade',\n      'bloodassassin',\n      'bloodhexer'");
 await writeFile(path.replaceAll('dokmu','hyeolma'),s);
}
let s=await readFile('scripts/family-review.mjs','utf8');
s=s.replace("const names =\n", "const names =\n  familyName === 'hyeolma'\n    ? ['혈도병','혈영 암살자','혈지 술사','혈도객 적우','혈마제자 연살','홍의마녀 소홍','혈마교주 적천']\n    : ");
s=s.replace("familyName === 'dokmu' ? '독무곡'", "familyName === 'hyeolma' ? '혈마전' : familyName === 'dokmu' ? '독무곡'");
await writeFile('scripts/family-review.mjs',s);
let config=await readFile('playwright.production.config.ts','utf8');config=config.replace("'local-preview-dokmu.spec.ts',","'local-preview-dokmu.spec.ts',\n    'local-preview-hyeolma.spec.ts',");await writeFile('playwright.production.config.ts',config);
console.log('Prepared Hyeolma matrix/contact/production tests.');
