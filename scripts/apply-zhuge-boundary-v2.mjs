import fs from 'node:fs';
import {createHash} from 'node:crypto';
const root='docs/source/zhuge-family-v1',proof='docs/verification/zhuge-boundary-v2';
fs.mkdirSync(proof+'/before',{recursive:true});
const backup=['generation-jobs.json','ground-anchors.json','export-review.json'];
for(const file of backup)if(!fs.existsSync(proof+'/before/'+file))fs.copyFileSync(root+'/'+file,proof+'/before/'+file);
if(!fs.existsSync(proof+'/before/frames.json'))fs.copyFileSync('src/game/zhuge-family-frames.json',proof+'/before/frames.json');
const read=f=>JSON.parse(fs.readFileSync(root+'/'+f,'utf8'));
const jobs=read('generation-jobs.json'),anchors=read('ground-anchors.json');
const edits=[
 {id:'engineer-front-right',pose:9,source:'engineer-front-right-boundary-v2.png',cell:{columns:3,rows:3,index:3},anchor:[286,347],generated:'exec-a2ecef60-1052-40bf-b964-56da75a976e6.png',prompt:'engineer-front-right-boundary-v2.prompt.txt'},
 {id:'engineer-front-right',pose:10,source:'engineer-front-right-boundary-v2.png',cell:{columns:3,rows:3,index:5},anchor:[215,347],generated:'exec-a2ecef60-1052-40bf-b964-56da75a976e6.png',prompt:'engineer-front-right-boundary-v2.prompt.txt'},
 {id:'jingwal-right',pose:5,source:'jingwal-right-prone-boundary-v2.png',cell:{columns:1,rows:1,index:0,rectangle:[684,520,1400,805]},anchor:[349,186],generated:'exec-7b1d6d27-b619-43ac-aa2b-a369a311d346.png',prompt:'jingwal-right-prone-boundary-v2.prompt.txt'}
];
for(const edit of edits){
 const job=jobs.find(j=>j.id===edit.id);if(!job)throw Error(edit.id);
 (job.poseSources??={})[edit.pose]=edit.source;
 (job.poseSourceCells??={})[edit.pose]=edit.cell;
 anchors[edit.id][edit.pose]=edit.anchor;
 edit.sha256=createHash('sha256').update(fs.readFileSync(root+'/'+edit.source)).digest('hex');
}
fs.writeFileSync(root+'/generation-jobs.json',JSON.stringify(jobs,null,2)+'\n');
fs.writeFileSync(root+'/ground-anchors.json',JSON.stringify(anchors,null,2)+'\n');
fs.writeFileSync(root+'/boundary-v2-provenance.json',JSON.stringify({date:'2026-10-06',tool:'built-in image_gen',edits,notes:'Generated sources selected without image resizing. Original sources and unaffected poses are retained; reviewed boot/body contact anchors.'},null,2)+'\n');
console.log(JSON.stringify(edits));
