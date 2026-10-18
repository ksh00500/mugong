import {readFile,writeFile} from 'node:fs/promises';
const path='docs/source/snow-family-v1/generation-jobs.json',jobs=JSON.parse(await readFile(path));
// Shaolin's abbot already uses the runtime key 'mujin'.
// Snow's commander is Mokjin (목진). Keep historical source filenames intact.
for(const j of jobs)if(j.character==='mujin')j.character='mokjin';
await writeFile(path,JSON.stringify(jobs,null,2)+'\n');
console.log('Snow commander uses unique runtime identity mokjin.');
