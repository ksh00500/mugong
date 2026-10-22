import {execFileSync} from 'node:child_process';
import {readFile,stat,mkdir,writeFile} from 'node:fs/promises';
import {extname} from 'node:path';
import {hashFile} from './asset-bundles.mjs';
const names=[...new Set(execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{maxBuffer:8*1024*1024}).toString().split('\0').filter(Boolean))];
const attrs=execFileSync('git',['check-attr','-z','filter','--stdin'],{input:names.join('\0')+'\0',maxBuffer:8*1024*1024}).toString().split('\0');
const lfs=new Set();for(let i=0;i<attrs.length-2;i+=3)if(attrs[i+2]==='lfs')lfs.add(attrs[i]);
const textTypes=new Set(['.ts','.tsx','.css','.json','.md','.txt','.toml','.yaml','.yml','.sh','.ps1','.py','.mjs','.html']);
const leaks=/(?:ssh [A-Za-z0-9_-]+@ssh\.app\.daytona\.io|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-proj-[A-Za-z0-9_-]{20,}|AKIA[A-Z0-9]{16}|-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----)/;
const files=[],failures=[];let binaryBytes=0,normalBytes=0;
const catalogue=JSON.parse(await readFile('asset-manifest.json','utf8'));
const approved=new Map(catalogue.files.filter(f=>f.path.startsWith('public/')).map(f=>[f.path,f]));
const presentMedia=new Set();
for(const path of names){
 const s=await stat(path).catch(()=>null);if(!s?.isFile())continue;
 const media=/\.(png|webp|jpe?g|gif|avif|wav|mp3|ogg|webm|mp4|woff2?|ttf|otf)$/i.test(path);
 if(lfs.has(path))failures.push(path+': LFS pointer policy is not supported');
 if(media){presentMedia.add(path);if(!approved.has(path)||approved.get(path).bytes!==s.size||approved.get(path).sha256!==await hashFile(path))failures.push(path+': media must match the public asset catalogue');}
 if(!lfs.has(path)&&s.size>50*1024*1024)failures.push(path+': large non-LFS file');
 if(!lfs.has(path)&&textTypes.has(extname(path))&&s.size<16*1024*1024&&leaks.test(await readFile(path,'utf8')))failures.push(path+': possible credential; content omitted');
 if(media)binaryBytes+=s.size;else normalBytes+=s.size;
 files.push({path,bytes:s.size,lfs:lfs.has(path)});
}
for(const path of approved.keys())if(!presentMedia.has(path))failures.push(path+': runtime media excluded from Git');
await mkdir('.validation',{recursive:true});await writeFile('.validation/github-inventory.json',JSON.stringify({files,failures,binaryBytes,normalBytes},null,2)+'\n');
console.log(JSON.stringify({files:files.length,lfsFiles:files.filter(f=>f.lfs).length,mediaFiles:presentMedia.size,mediaMiB:Math.round(binaryBytes/1048576),sourceMiB:Math.round(normalBytes/1048576),failures}));
if(failures.length)process.exitCode=1;
