import{readFile,writeFile}from'node:fs/promises';
const root='docs/source/hyeolma-family-v1';
const jobs=JSON.parse(await readFile(`${root}/generation-jobs.json`));
const fixes=JSON.parse(await readFile(`${root}/edge-jobs.json`));
for(const c of fixes){const j=jobs.find(j=>j.id===c.id);j.poseSources??={};for(const p of c.poses)j.poseSources[p]=c.source;}
await writeFile(`${root}/generation-jobs.json`,JSON.stringify(jobs,null,2));
await writeFile(`${root}/selected-edge-corrections.json`,JSON.stringify(fixes,null,2));
