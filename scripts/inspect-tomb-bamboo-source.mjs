import {readFile,writeFile,access} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {figureExtractor} from '../src/game/motion-layout.ts';
import {nativeSourceCell} from './native-source-cell.mjs';
const sharp=createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH??'sharp'),root='docs/source/tomb-bamboo-special-v2';
const jobs=JSON.parse(await readFile(root+'/generation-jobs.json'));let selection={};try{selection=JSON.parse(await readFile(root+'/selection.json'))}catch{}
const reports=[];
for(const j of jobs){const s=selection[j.id]??{},file=s.source??root+'/'+j.source;try{await access(file)}catch{continue}
 const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true}),extract=figureExtractor(data,info.width,info.height),grid=s.grid??[3,4];
 const cells=Array.from({length:12},(_,n)=>{const f=extract(nativeSourceCell({columns:grid[0],rows:grid[1],index:n},info.width,info.height));return{n,id:f.id,bounds:[f.left,f.top,f.right,f.bottom],clipped:f.left<=0||f.top<=0||f.right>=info.width||f.bottom>=info.height}});
 const r={id:j.id,file,size:[info.width,info.height],distinct:new Set(cells.map(f=>f.id)).size,cells};reports.push(r);
}
await writeFile(root+'/source-audit.json',JSON.stringify(reports,null,2)+'\n');
const supplementSources=new Map();for(const s of Object.values(selection))for(const r of Object.values(s.replacements??{})){const entry=supplementSources.get(r.source)??{grid:r.grid??[3,4],used:[]};entry.used.push(r.index);supplementSources.set(r.source,entry);}
const supplements=[];for(const [file,{grid,used}]of supplementSources){
 const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true}),extract=figureExtractor(data,info.width,info.height),count=grid[0]*grid[1];
 const cells=Array.from({length:count},(_,index)=>{const f=extract(nativeSourceCell({columns:grid[0],rows:grid[1],index},info.width,info.height));return{index,id:f.id,bounds:[f.left,f.top,f.right,f.bottom],clipped:f.left<=0||f.top<=0||f.right>=info.width||f.bottom>=info.height}});
 supplements.push({file,grid,selectedIndices:[...new Set(used)],distinct:new Set(cells.map(f=>f.id)).size,cells});
}
const failures=[...reports.filter(r=>r.distinct!==12||r.cells.some(f=>f.clipped||f.id<0)),...supplements.filter(r=>r.distinct!==r.grid[0]*r.grid[1]||r.cells.some(f=>r.selectedIndices.includes(f.index)&&(f.clipped||f.id<0)))];
await writeFile(root+'/source-audit.json',JSON.stringify({mainSheets:reports.length,supplementSheets:supplements.length,failures,reports,supplements},null,2)+'\n');
console.log(JSON.stringify({mainSheets:reports.length,supplementSheets:supplements.length,failures}));if(failures.length)process.exitCode=1;
