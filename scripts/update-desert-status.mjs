import {readFile,writeFile,access} from 'node:fs/promises';
const root='docs/source/desert-family-v1';
const requests=JSON.parse(await readFile(`${root}/generation-requests.json`));
const sources=[];
for(const r of requests){try{await access(`${root}/${r.source}`);sources.push(r.source);}catch(e){if(e.code!=='ENOENT')throw e;}}
const verified=process.argv.includes('--verified');
if(verified && sources.length!==requests.length)throw Error('Missing generated source');
const state={status:verified?'verified-local':sources.length===requests.length?'sources-generated-awaiting-verification':'generating',tool:'image_gen.imagegen',updatedAtUTC:new Date().toISOString(),requestedSources:requests.length,availableSources:sources.length,sources,gameApplied:verified,previousError:'First account request failed with usage_limit_reached; current account retry succeeded.'};
await writeFile(`${root}/generation-status.json`,JSON.stringify(state,null,2)+'\n');
console.log(JSON.stringify({status:state.status,availableSources:sources.length}));
