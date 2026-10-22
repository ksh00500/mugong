import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root='docs/source/desert-special-v1';
const hash=b=>createHash('sha256').update(b).digest('hex');
const preflight=JSON.parse(await readFile(`${root}/preflight.json`));
const records=preflight.promptRecords;
let checked=0;
for(const r of records){
 const p=await readFile(r.prompt.startsWith('docs/')?r.prompt:`${root}/${r.prompt}`);
 const ref=await readFile(r.reference);
 if(hash(p)!==r.promptSha256||hash(ref)!==r.referenceSha256)throw Error('Input changed '+r.id);
 checked+=2;
}
const sources=[];
for(const file of (await readdir(root)).filter(f=>f.endsWith('.png')).sort())sources.push({file,sha256:hash(await readFile(`${root}/${file}`))});
const output=[];
for(const file of (await readdir('public/art/desert-special-v1')).sort()){
 const sha256=hash(await readFile(`public/art/desert-special-v1/${file}`));
 if(hash(await readFile(`dist/art/desert-special-v1/${file}`))!==sha256)throw Error('Local preview mismatch '+file);
 output.push({file,sha256});
}
const report={inputHashesChecked:checked,pngSources:sources.length,localPreviewFiles:output.length,sources,output,publicDeployment:false,gameRegistration:false};
await writeFile('docs/verification/desert-special-v1/file-integrity.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({inputHashesChecked:checked,pngSources:sources.length,localPreviewFiles:output.length}));
