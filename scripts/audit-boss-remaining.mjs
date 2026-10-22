import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
await build({entryPoints:['src/domain/boss-melee.ts'],bundle:true,platform:'node',format:'cjs',outfile:'.local-preview/boss-remaining-audit.cjs'});
try{
 const {BOSS_KITS:BOSS_MELEE}=createRequire(import.meta.url)('../.local-preview/boss-remaining-audit.cjs');
 const records=[];
 for(const family of ['shaolin','tianjian','dokmu','qingha']){
  const art=JSON.parse(await readFile('src/game/'+family+'-special-frames.json'));
  for(const c of art.characters)for(const [move,spec] of Object.entries(BOSS_MELEE[c.bossId].moves))
   records.push({family,character:c.id,bossId:c.bossId,move,spec,installed:c.moves.includes(move)});
 }
 await mkdir('docs/source/boss-remaining-v1',{recursive:true});
 await writeFile('docs/source/boss-remaining-v1/action-audit.json',JSON.stringify(records,null,2)+'\n');
 console.log(JSON.stringify(records.filter(r=>!r.installed).map(({family,character,move,spec})=>({family,character,move,...spec})),null,2));
}finally{}

