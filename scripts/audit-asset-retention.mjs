import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {build} from 'esbuild';
import {loadAssets,verifyAssets,assetSetId} from './asset-bundles.mjs';

// Read-only classification. Absence of a reference NEVER authorizes deletion.
const catalogue=await loadAssets();
const verified=await verifyAssets('all');
const bundled=await build({stdin:{contents:`
 import {UI_IMAGES, COMBAT_IMAGES, combatBaseImages} from './src/platform/assets';
 import {ITEM_ARTWORK} from './src/platform/item-art';
 import {characterCombatImages,characterPortrait,characterLobbyArt} from './src/platform/character-art';
 import index from './src/platform/region-art-manifests.json';
 const current=new Set([...Object.values(UI_IMAGES),...Object.values(combatBaseImages(true)),...Object.values(ITEM_ARTWORK).map(v=>v.src)]);
 for(const r of index.regions) for(const group of [r.ordinary,...Object.values(r.bosses)]) for(const p of Object.values(group)) current.add(p);
 for(const appearance of [undefined,0,1,2,3,4,5,6,7,8,9]) {
   const f={appearance}; for(const p of Object.values(characterCombatImages(f)))current.add(p);
   current.add(characterPortrait(f));current.add(characterLobbyArt(f));
 }
 for(const portrait of [0,1,2])current.add(characterPortrait({portrait}));
 export const active=[...current];
 export const fallback=Object.values(COMBAT_IMAGES).filter(p=>!current.has(p));
`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false});
const {active,fallback}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const current=new Set(active.map(p=>'public'+p)),compat=new Set(fallback.map(p=>'public'+p));
const textFiles=[];
async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){if(e.isSymbolicLink())throw Error('Symlink in reference roots');const p=dir+'/'+e.name;if(e.isDirectory())await walk(p);else if(/\.(ts|tsx|mjs|py|css|json|md|html|txt|yml|yaml)$/.test(p))textFiles.push(p);}}
for(const dir of ['src','scripts','tests','docs/source','public','next-stage'])await walk(dir);
const texts=await Promise.all(textFiles.map(async p=>[p,await readFile(p,'utf8')]));
const records=[];
for(const f of catalogue.files){
 const url=f.path.startsWith('public/')?f.path.slice(6):f.path;
 const exact=texts.filter(([,s])=>s.includes(url)||s.includes(f.path)).map(([p])=>p);
 const dynamic=f.path.startsWith('public/audio/')||f.path.startsWith('public/fonts/')||f.path.startsWith('public/art/character-info-v1/');
 const category=!f.path.startsWith('public/')?'authoring-preserve':current.has(f.path)||dynamic?'runtime-declared':compat.has(f.path)?'fallback-preserve':exact.some(p=>p.startsWith('src/'))?'source-reference-preserve':exact.length?'review-rebuild-preserve':'unresolved-preserve';
 records.push({...f,category,git:f.path.startsWith('public/'),references:exact,dynamicFamily:dynamic,deleteApproved:false});
}
const missing=[...current,...compat].filter(p=>!records.some(f=>f.path===p));
if(missing.length)throw Error('Runtime path outside catalogue: '+missing.join(', '));
const groups=Object.groupBy(records,r=>r.category);
const duplicates=Object.values(Object.groupBy(records,r=>r.sha256)).filter(g=>g.length>1).map(g=>({sha256:g[0].sha256,bytes:g[0].bytes,paths:g.map(f=>f.path),deleteApproved:false}));
const summary={asOf:'2026-10-20',catalogueId:catalogue.id,verified,categories:Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,{files:v.length,bytes:v.reduce((n,f)=>n+f.bytes,0)}])),gitRuntimeId:assetSetId(records.filter(f=>f.git)),gitRuntimeFiles:records.filter(f=>f.git).length,gitImages:records.filter(f=>f.git&&/\.(png|webp|jpe?g|gif|avif)$/i.test(f.path)).length,missingRuntimePaths:missing,duplicateGroups:duplicates.length,imageDeletionsApproved:0};
await mkdir('docs/asset-management',{recursive:true});
await writeFile('docs/asset-management/inventory.json',JSON.stringify({summary,files:records,duplicates},null,2)+'\n');
await writeFile('docs/asset-management/summary.json',JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary));
