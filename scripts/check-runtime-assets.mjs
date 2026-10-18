import { readdir, open, readFile, stat } from 'node:fs/promises';
import { resolve, relative, extname, sep } from 'node:path';
import {verifyAssets} from './asset-bundles.mjs';

await verifyAssets('runtime');

const root=resolve('.'),publicRoot=resolve('public'),files=[];
async function walk(dir,list){
 for(const entry of await readdir(dir,{withFileTypes:true})){
  const path=resolve(dir,entry.name);
  if(entry.isSymbolicLink())throw Error('Runtime/build input must not be a symlink: '+relative(root,path));
  if(entry.isDirectory())await walk(path,list);else if(entry.isFile())list.push(path);
 }
}
await walk(publicRoot,files);
if(files.length===0)throw Error('public/ is empty; restore the private runtime asset bundle before building.');
const paths=new Set(files.map(p=>'/'+relative(publicRoot,p).split(sep).join('/'))),failures=[];
for(const path of files){
 const handle=await open(path,'r');
 try{const b=Buffer.alloc(128);const {bytesRead}=await handle.read(b,0,b.length,0);
  if(b.subarray(0,bytesRead).toString().startsWith('version https://git-lfs.github.com/spec/v1'))failures.push(relative(root,path)+': Git LFS pointer; restore the matching private asset bundle');
  if((await handle.stat()).size===0)failures.push(relative(root,path)+': empty asset');
 }finally{await handle.close();}
}
const sources=[];await walk(resolve('src'),sources);
sources.push(resolve('index.html'));
const referenced=new Set();
for(const file of sources.filter(p=>['.ts','.tsx','.css','.json','.html'].includes(extname(p)))){
 const text=await readFile(file,'utf8');
 for(const match of text.matchAll(/["'`(](\/(?:art|audio|fonts)\/[^"'`()\s?#]+)(?:[?#][^"'`()\s]*)?["'`)]/g)){
  const path=match[1];if(path.includes('$')||path.includes('{')||path.endsWith('/'))continue;
  referenced.add(path);
  if(!paths.has(path))failures.push(relative(root,file)+': missing asset '+path);
 }
}
if(failures.length){console.error(failures.join('\n'));process.exitCode=1;}
else console.log(JSON.stringify({runtimeFiles:files.length,literalReferences:referenced.size,gitLfsPointers:0,missingFiles:0}));
