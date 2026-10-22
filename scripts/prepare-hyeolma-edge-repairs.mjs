import{readFile,writeFile}from'node:fs/promises';
const root='docs/source/hyeolma-family-v1';
const version=process.argv[2]??'v4';
const{records}=JSON.parse(await readFile(`${root}/source-scan.json`));
const groups=new Map();
for(const r of records.filter(r=>r.clipped||r.component<0||r.shared)){
 const g=groups.get(r.id)??{id:r.id,reference:r.source,poses:[]};g.poses.push(r.pose);groups.set(r.id,g);
}
const jobs=[...groups.values()].map(g=>({...g,source:`${g.id}-edge-${version}.png`,prompt:`${g.id}.edge-${version}.prompt.txt`}));
for(const j of jobs){
 const text=`Use case: precise-object-edit. Keep this 3columns x4rows twelve-pose transparent sprite sheet, exact camera, costume, weapon, physical head/body/limb/weapon SIZE. Repair poses ${j.poses.join(',')} (zero-based row-major): complete any cutoff hair/weapon/hand and TRANSLATE entire drawing LEFT by70 native pixels if in rightmost column, otherwise inward from canvas edge; keep all weapon tips/hair/boots at least24px inside the outer canvas. DO NOT scale or shrink. DO NOT change pose/anatomy. Maintain 12 separate drawings, no touching neighbors. No glow/shadow/background/text; alpha0.`;
 await writeFile(`${root}/${j.prompt}`,text);
}
await writeFile(`${root}/edge-jobs.json`,JSON.stringify(jobs,null,2));
console.log(JSON.stringify(jobs));
