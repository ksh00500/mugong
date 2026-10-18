import {createReadStream} from 'node:fs';
import {readFile,writeFile,readdir,lstat,mkdir,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {resolve,basename} from 'node:path';
import {pathToFileURL} from 'node:url';

const media=/\.(png|webp|jpe?g|gif|avif|wav|mp3|ogg|webm|mp4|woff2?|ttf|otf)$/i;
const roots=['public','assets','docs/source','docs/references'];
const catalogue='asset-manifest.json';
export async function hashFile(path){
 const hash=createHash('sha256');for await(const chunk of createReadStream(path))hash.update(chunk);return hash.digest('hex');
}
export function assetSetId(files){
 return createHash('sha256').update(JSON.stringify(files.map(({path,bytes,sha256})=>({path,bytes,sha256})))).digest('hex').slice(0,16);
}
export async function loadAssets(){
 const data=JSON.parse(await readFile(catalogue,'utf8'));
 if(data.version!==1||!Array.isArray(data.files)||!data.files.length)throw Error('Invalid asset manifest');
 const seen=new Set();
 for(const f of data.files){
  if(typeof f.path!=='string'||!roots.some(r=>f.path.startsWith(r+'/'))||!/^[a-zA-Z0-9_./-]+$/.test(f.path)||f.path.split('/').some(p=>!p||p==='.'||p==='..')||!media.test(f.path)||seen.has(f.path)||!Number.isSafeInteger(f.bytes)||f.bytes<=0||!/^[0-9a-f]{64}$/.test(f.sha256))throw Error('Invalid asset entry');
  seen.add(f.path);
 }
 if(data.id!==assetSetId(data.files))throw Error('Asset manifest identity mismatch');
 return data;
}
export function selectAssets(data,scope){
 if(!['runtime','authoring','all'].includes(scope))throw Error('Scope must be runtime, authoring or all');
 return data.files.filter(f=>scope==='all'||(scope==='runtime')===f.path.startsWith('public/'));
}
export async function verifyAssets(scope='runtime'){
 const data=await loadAssets(),files=selectAssets(data,scope),failures=[];
 for(const f of files){
  try{
   let cursor=resolve('.');for(const part of f.path.split('/')){cursor=resolve(cursor,part);if((await lstat(cursor)).isSymbolicLink())throw Error('symlink');}
   const s=await lstat(f.path);if(!s.isFile()||s.size!==f.bytes)throw Error('size');
   if(await hashFile(f.path)!==f.sha256)throw Error('SHA256');
  }catch(e){failures.push(`${f.path}: ${e.code==='ENOENT'?'missing':e.message}`);}
 }
 if(failures.length)throw Error(`${failures.length} asset files failed validation. Restore the matching private asset bundle (docs/external-assets.md).\n${failures.slice(0,12).join('\n')}`);
 return {scope,files:files.length,bytes:files.reduce((n,f)=>n+f.bytes,0),id:assetSetId(files)};
}
async function refresh(){
 const paths=[];
 async function walk(dir){for(const item of await readdir(dir,{withFileTypes:true})){const p=`${dir}/${item.name}`;if(item.isSymbolicLink())throw Error('Asset symlinks are not supported');if(item.isDirectory())await walk(p);else if(item.isFile()&&media.test(p))paths.push(p);}}
 for(const root of roots)await walk(root);
 paths.sort();const files=[];
 for(const path of paths)files.push({path,bytes:(await stat(path)).size,sha256:await hashFile(path)});
 await writeFile(catalogue,JSON.stringify({version:1,id:assetSetId(files),files},null,2)+'\n');
 console.log(JSON.stringify({manifest:catalogue,files:files.length,id:assetSetId(files)}));
}
async function pack(scope){
 await verifyAssets(scope);const data=await loadAssets(),files=selectAssets(data,scope),id=assetSetId(files);
 await mkdir('.asset-bundles',{recursive:true});
 const archive=resolve(`.asset-bundles/mugong-${scope}-${id}.tar.gz`),list=resolve(`.asset-bundles/${scope}-files.txt`);
 // Entries are validated relative paths, no leading options or whitespace ambiguity.
 await writeFile(list,files.map(f=>f.path).join('\n')+'\n');
 await new Promise((ok,bad)=>{const child=spawn('tar',['-czf',archive,'-T',list],{stdio:'inherit'});child.on('error',bad);child.on('exit',code=>code===0?ok():bad(Error(`tar exited ${code}`)));});
 const sha256=await hashFile(archive);
 await writeFile(archive+'.sha256',`${sha256}  ${basename(archive)}\n`);
 const summary={scope,id,file:basename(archive),files:files.length,bytes:(await stat(archive)).size,sha256};
 await writeFile(archive+'.json',JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary));
}
async function main(){
 const [action='verify',scope='runtime']=process.argv.slice(2);
 if(action==='refresh')return refresh();
 if(action==='catalog'){const data=await loadAssets();return console.log(JSON.stringify({id:data.id,files:data.files.length,runtime:selectAssets(data,'runtime').length}));}
 if(action==='verify')return console.log(JSON.stringify(await verifyAssets(scope)));
 if(action==='pack')return pack(scope);
 throw Error('Usage: node scripts/asset-bundles.mjs refresh | catalog | verify [runtime|authoring|all] | pack [runtime|authoring]');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().catch(e=>{console.error(e.message);process.exitCode=1;});
