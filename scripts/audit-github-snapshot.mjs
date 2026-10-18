import {execFileSync} from 'node:child_process';
import {readFile,stat,mkdir,writeFile} from 'node:fs/promises';
import {extname} from 'node:path';
const names=[...new Set(execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{maxBuffer:8*1024*1024}).toString().split('\0').filter(Boolean))];
const attrs=execFileSync('git',['check-attr','-z','filter','--stdin'],{input:names.join('\0')+'\0',maxBuffer:8*1024*1024}).toString().split('\0');
const lfs=new Set();for(let i=0;i<attrs.length-2;i+=3)if(attrs[i+2]==='lfs')lfs.add(attrs[i]);
const textTypes=new Set(['.ts','.tsx','.css','.json','.md','.txt','.toml','.yaml','.yml','.sh','.ps1','.py','.mjs','.html']);
const leaks=/(?:ssh [A-Za-z0-9_-]+@ssh\.app\.daytona\.io|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-proj-[A-Za-z0-9_-]{20,}|AKIA[A-Z0-9]{16}|-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----)/;
const files=[],failures=[];let binaryBytes=0,normalBytes=0;
for(const path of names){
 const s=await stat(path).catch(()=>null);if(!s?.isFile())continue;
 if(lfs.has(path)||/\.(png|webp|jpe?g|gif|avif|wav|mp3|ogg|webm|mp4|woff2?|ttf|otf)$/i.test(path))failures.push(path+': media/LFS must remain outside the source repository');
 if(!lfs.has(path)&&s.size>50*1024*1024)failures.push(path+': large non-LFS file');
 if(!lfs.has(path)&&textTypes.has(extname(path))&&s.size<16*1024*1024&&leaks.test(await readFile(path,'utf8')))failures.push(path+': possible credential; content omitted');
 if(lfs.has(path))binaryBytes+=s.size;else normalBytes+=s.size;
 files.push({path,bytes:s.size,lfs:lfs.has(path)});
}
await mkdir('.validation',{recursive:true});await writeFile('.validation/github-inventory.json',JSON.stringify({files,failures,binaryBytes,normalBytes},null,2)+'\n');
console.log(JSON.stringify({files:files.length,lfsFiles:files.filter(f=>f.lfs).length,lfsMiB:Math.round(binaryBytes/1048576),normalGitMiB:Math.round(normalBytes/1048576),failures}));
if(failures.length)process.exitCode=1;
