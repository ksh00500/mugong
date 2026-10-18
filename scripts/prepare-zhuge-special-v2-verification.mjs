import {readFile,writeFile} from 'node:fs/promises';
let browser=await readFile('scripts/verify-zhuge-special-draft.mjs','utf8');
browser=browser.replace("const dir='docs/verification/zhuge-special-v1'","const dir='docs/verification/zhuge-special-v2'");
await writeFile('scripts/verify-zhuge-special-v2-browser.mjs',browser);
let files=await readFile('scripts/verify-zhuge-special-files.mjs','utf8');
files=files.replace("evidence='docs/verification/zhuge-special-v1'","evidence='docs/verification/zhuge-special-v2'");
files=files.replace("const output=[];", "const corrections=JSON.parse(await readFile(root+'/correction-v2/provenance.json'));for(const r of corrections){for(const [file,expected] of [[r.source,r.sourceSha256],[r.prompt,r.promptSha256]])if(hash(await readFile(root+'/'+file))!==expected)throw Error('Correction input changed '+file);sources.push({file:r.source,sha256:r.sourceSha256});}const output=[];");
files=files.replace("date:'2026-10-07'","date:'2026-10-08'");
await writeFile('scripts/verify-zhuge-special-v2-files.mjs',files);

