import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root='docs/source/hyeolma-special-v1', out='public/art/hyeolma-special-v1', evidence='docs/verification/hyeolma-special-v1';
const hash=b=>createHash('sha256').update(b).digest('hex');
const preflight=JSON.parse(await readFile(`${root}/preflight.json`));
let checked=0;
for(const r of preflight.promptRecords) for(const [path,expected] of [[r.prompt,r.promptSha256],[r.reference,r.referenceSha256],[r.guide,r.guideSha256]]) {
 const bytes=await readFile(path.startsWith('docs/')?path:`${root}/${path}`);
 if(hash(bytes)!==expected)throw Error('Input changed '+r.id+' '+path);
 checked++;
}
const sources=[];
for(const file of (await readdir(root)).filter(f=>f.endsWith('.png')).sort())sources.push({file,sha256:hash(await readFile(`${root}/${file}`))});
const output=[];
for(const file of (await readdir(out)).sort()) {
 const sha256=hash(await readFile(`${out}/${file}`));
 if(hash(await readFile(`dist/art/hyeolma-special-v1/${file}`))!==sha256)throw Error('Local preview mismatch '+file);
 output.push({file,sha256});
}
const reports=JSON.parse(await readFile(`${root}/export-review-draft.json`)), art=JSON.parse(await readFile(`${out}/frames-draft.json`));
if(reports.length!==20||reports.some(r=>!r.solidPixelsPreserved||r.frames.some(f=>Math.min(...f.padding)<32)))throw Error('Native pixel/padding failure');
if(art.characters.length!==4||art.characters.some(c=>c.frames.length!==60||c.pixelScale!==.225))throw Error('Frame inventory/scale failure');
const report={date:'2026-10-07',inputHashesChecked:checked,pngSources:sources.length,localPreviewFiles:output.length,frames:240,minimumPadding:32,pixelScale:.225,solidPixelsPreserved:true,sources,output,publicDeployment:false,gameRegistration:false,automaticFootAnchorsApproved:false};
await writeFile(`${evidence}/file-integrity.json`,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({inputHashesChecked:checked,pngSources:sources.length,localPreviewFiles:output.length,frames:240}));
