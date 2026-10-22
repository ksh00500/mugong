import{readFile,writeFile}from'node:fs/promises';
const root='docs/source/hyeolma-family-v1';
const jobs=JSON.parse(await readFile(`${root}/generation-jobs.json`));
const choices=JSON.parse(await readFile(`${root}/target-jobs.json`));
// Only visually accepted frames are selected. Rejected arm ownership edits stay as sources.
for(const c of choices.filter(c=>c.id==='bloodblade-front-right')){
 const j=jobs.find(j=>j.id===c.id);j.poseSources??={};
 for(const p of c.poses)j.poseSources[p]=c.source;
}
await writeFile(`${root}/generation-jobs.json`,JSON.stringify(jobs,null,2));
await writeFile(`${root}/selected-corrections.json`,JSON.stringify(choices.filter(c=>c.id==='bloodblade-front-right'),null,2));
