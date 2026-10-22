import { readFile, writeFile } from 'node:fs/promises';
const moves="[\n      ['stance', 'thrust', 'slash', 'dash', 'sweep'],\n      ['combo', 'dash', 'sweep', 'thrust'],\n      ['dash', 'stance', 'combo', 'thrust', 'sweep'],\n      ['combo', 'thrust', 'dash', 'fan', 'sweep'],\n    ]";
const root='docs/source/tianjian-family-v1';
const jobs=JSON.parse(await readFile(`${root}/generation-jobs.json`,'utf8'));
for(const j of jobs.filter(j=>j.slot>=3)){
 j.poseSourceCells=Object.fromEntries(Array.from({length:12},(_,index)=>[index,{columns:3,rows:4,index}]));
 if(j.view===1)j.prompt=j.id+'.portrait.prompt.txt';
}
await writeFile(`${root}/generation-jobs.json`,JSON.stringify(jobs,null,2)+'\n');
const convert=s=>s.replaceAll('ZHUGE','TIANJIAN').replaceAll('Zhuge','Tianjian').replaceAll('zhuge','tianjian').replaceAll('MUGONG_TIANJIAN_PROOF','MUGONG_TIANJIAN_PROOF')
 .replaceAll("kind: 'archer', role: 'engineer'","kind: 'sword', role: 'duelist'")
 .replaceAll("role: 'gatekeeper'","role: 'guard'").replaceAll("role: 'crossbow'","role: 'swordcaster'")
 .replaceAll("['engineer', 'gatekeeper', 'crossbow']","['duelist', 'guard', 'swordcaster']")
 .replaceAll("'engineer'","'duelist'").replaceAll("'gatekeeper'","'spearguard'").replaceAll("'crossbow'","'swordcaster'")
 .replaceAll("'yanggi'","'ujin'").replaceAll("'mukyeon'","'baekhong'").replaceAll("'jingwal'","'mumyeong'").replaceAll("'tianjianhyeon'","'baekun'")
 .replaceAll('`9-','`2-').replaceAll("'9-","'2-").replaceAll('seedRegion(page, 9','seedRegion(page, 2')
 .replaceAll('enemy, 9','enemy, 2').replaceAll('e, 9','e, 2').replaceAll('regionArtManifest(9)','regionArtManifest(2)')
 .replaceAll('region-actors-9','region-actors-2').replaceAll('region-direction-9','region-direction-2').replaceAll('region-motion-9','region-motion-2').replaceAll('region-rear-9','region-rear-2')
 .replace(/const moves = \[[\s\S]*?\n\s{4,8}\];/,`const moves = ${moves};`);
let unit=convert(await readFile('tests/authored-zhuge.test.ts','utf8'));
unit=unit.replaceAll('authoredEnemyArt(e, 9)','authoredEnemyArt(e, 2)').replace("role: 'duelist' }, 9","role: 'duelist' }, 2");
await writeFile('tests/authored-tianjian.test.ts',unit);
await writeFile('tests/e2e/authored-tianjian.spec.ts',convert(await readFile('tests/e2e/authored-zhuge.spec.ts','utf8')));
let production=convert(await readFile('tests/e2e/local-preview-zhuge.spec.ts','utf8'));
production=production.replaceAll('jingwal-pose-','tianjian-pose-').replace("selectOption('5')","selectOption('4')");
await writeFile('tests/e2e/local-preview-tianjian.spec.ts',production);
let release=convert(await readFile('tests/e2e/zhuge-release.spec.ts','utf8'));
release=release.replace("kind: role === 'spearguard' ? 'spear' : 'archer'", "kind: role === 'guard' ? 'spear' : role === 'duelist' ? 'sword' : 'archer'")
 .replaceAll("role === 'spearguard'", "role !== 'swordcaster'")
 .replace('`tianjian-family-${r.role}-`', "`tianjian-family-${r.role === 'guard' ? 'spearguard' : r.role}-`")
 .replace("r.role === 'spearguard'", "r.role !== 'swordcaster'")
 .replace("expect(r.projectiles).toBe(r.role === 'duelist' ? 1 : 3)", "expect(r.projectiles).toBe(2)")
 .replace("    if (r.role === 'duelist') expect(r.landing).toBe('gate');\n", '');
await writeFile('tests/e2e/tianjian-release.spec.ts',release);
console.log('Saved source-grid metadata and Tianjian family verification scenarios.');
