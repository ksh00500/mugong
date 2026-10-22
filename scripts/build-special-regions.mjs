import {readFile,writeFile,mkdir} from 'node:fs/promises';
const names=['shaolin-special','tianjian-special','dokmu-special','qingha-special','snow-special','three-special','tomb-bamboo-special','snow-special-complete','boss-remaining','tomb-bamboo-complete','three-complete'];
const data={};for(const name of names)data[name]=JSON.parse(await readFile(`src/game/${name}-frames.json`,'utf8'));
const originals=names.slice(0,7).flatMap(name=>data[name].characters);
const characters=[...originals,...data['snow-special-complete'].characters.filter(a=>!originals.some(b=>b.bossId===a.bossId))].map(art=>{
 const extra=data['boss-remaining'].characters.find(a=>a.bossId===art.bossId) ?? (originals.some(a=>a.bossId===art.bossId)?data['snow-special-complete'].characters.find(a=>a.bossId===art.bossId):undefined) ?? data['tomb-bamboo-complete'].characters.find(a=>a.bossId===art.bossId) ?? data['three-complete'].characters.find(a=>a.bossId===art.bossId);
 return {...art,moves:[...art.moves,...(extra?.moves??[])],frames:[...art.frames,...(extra?.frames??[])],healthClearance:Math.max(art.healthClearance,extra?.healthClearance??0)};
});
await mkdir('src/game/boss-special-regions',{recursive:true});
for(let region=0;region<10;region++){
 const payload={region,characters:characters.filter(a=>Number(a.bossId.split('-')[0])===region),remaining:data['boss-remaining'].characters.filter(a=>Number(a.bossId.split('-')[0])===region).map(a=>({bossId:a.bossId,moves:a.moves}))};
 if(payload.characters.length!==4)throw Error(`Expected four reviewed bosses in ${region}`);
 await writeFile(`src/game/boss-special-regions/region-${region}.json`,JSON.stringify(payload)+'\n');
}
console.log('10 region metadata modules generated from reviewed frames; source rectangles unchanged');
