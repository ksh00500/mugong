import {readFile,writeFile} from 'node:fs/promises';
const root='docs/source/tomb-bamboo-special-v2',art=JSON.parse(await readFile('src/game/tomb-bamboo-special-frames.json')),selection=JSON.parse(await readFile(root+'/selection.json'));
// Manual boot-centre picks on the 0.40 comparison boards; offset from red proposal.
// This is authoring metadata only. No runtime scanning, stretching or body fitting.
if(Object.values(selection).some(s=>s.manualGroundPicks))throw Error('Manual ground picks already applied; export uses saved selection.json.');
const corrections={
 'jeokho:slam':[
 [[43,0],[-30,-10],[-30,-7],[39,0]],
 [[40,0],[-56,-23],[-76,-16],[32,0]],
 [[-40,0],[-82,-12],[-104,-12],[-32,-4]],
 [[-37,0],[-51,-5],[-47,-7],[27,-4]],
 [[-27,0],[-32,-1],[-30,0],[-27,0]],
 ],
 'wolryeong:dash':[
 [[-32,-10],[-72,-10],[-98,-10],[-35,-4]],
 [[-35,-8],[-68,-10],[35,-4],[32,-5]],
 [[-24,-4],[-21,-4],[-50,-4],[-37,-4]],
 [[-23,-4],[28,-5],[-75,-7],[-28,-5]],
 [[-10,-4],[-78,-8],[-80,-8],[0,-4]],
 ],
 'nogae:slam':[
 [[-55,-5],[20,-8],[95,-8],[60,-5]],
 [[-55,-4],[-70,-25],[-70,-24],[-55,-4]],
 [[55,-4],[54,-4],[53,-4],[53,-4]],
 [[45,-4],[48,-4],[50,-4],[48,-4]],
 [[-40,-4],[-38,-4],[-40,-4],[-40,-4]],
 ],
};
for(const [key,views]of Object.entries(corrections)){
 const [id,move]=key.split(':'),a=art.characters.find(a=>a.id===id);
 for(let view=0;view<5;view++)for(let pose=1;pose<=4;pose++){
  const f=a.frames.find(f=>f.move===move&&f.view===view&&f.pose===pose),[dx,dy]=views[view][pose-1],job=id+'-'+['front','front-right','right','rear-right','back'][view];
  const ratio=.4*f.normalizationFactor*(f.sourceCalibration??1),s=selection[job]??={};
  (s.boots??={})[f.sourcePose]=[Math.round(f.sourceBoot[0]+dx/ratio),Math.round(f.sourceBoot[1]+dy/ratio)];
 }
}
for(const key of Object.keys(corrections)){const id=key.split(':')[0];for(const [job,s]of Object.entries(selection))if(job.startsWith(id+'-'))s.manualGroundPicks=true;}
await writeFile(root+'/selection.json',JSON.stringify(selection,null,2)+'\n');console.log('Manual ground picks persisted; run only against initial proposal boards.');
