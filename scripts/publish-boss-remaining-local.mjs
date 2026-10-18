import {readFile,writeFile,readdir,mkdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const build='dist-validation-boss-remaining', proof='docs/verification/boss-remaining-v1';
const before=(await readdir('dist/art',{withFileTypes:true})).filter(x=>x.isDirectory()).map(x=>x.name);
await mkdir('dist/art/boss-remaining-v1',{recursive:true});
await mkdir('dist/assets',{recursive:true});
for(const name of await readdir(build+'/assets'))await copyFile(build+'/assets/'+name,'dist/assets/'+name);
await copyFile(build+'/index.html','dist/index.html');
await copyFile(build+'/next-stage/index.html','dist/next-stage/index.html');
const files=await readdir('public/art/boss-remaining-v1');
const hashes=[];
for(const name of files){
 const source='public/art/boss-remaining-v1/'+name,dest='dist/art/boss-remaining-v1/'+name;
 await copyFile(source,dest);
 const a=createHash('sha256').update(await readFile(source)).digest('hex'),b=createHash('sha256').update(await readFile(dest)).digest('hex');
 if(a!==b)throw Error('Local copy mismatch: '+name);
 hashes.push({name,sha256:a});
}
const after=(await readdir('dist/art',{withFileTypes:true})).filter(x=>x.isDirectory()).map(x=>x.name);
if(before.some(x=>!after.includes(x)))throw Error('Existing draft art directory lost');
await mkdir(proof,{recursive:true});
await writeFile(proof+'/local-publication.json',JSON.stringify({date:'2026-10-08',scope:'local only',preview:'http://127.0.0.1:5173/art/boss-remaining-v1/review.html',files:hashes,preservedArtDirectories:before,compiledIndex:true},null,2)+'\n');
console.log(JSON.stringify({files:hashes.length,preservedDraftDirectories:before.length,publicDeployment:false}));
