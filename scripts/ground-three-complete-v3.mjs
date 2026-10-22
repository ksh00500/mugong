import {readFile,writeFile} from 'node:fs/promises';
const root='docs/source/three-complete-v3',selection=JSON.parse(await readFile(root+'/selection.json')),review=JSON.parse(await readFile(root+'/export-review.json'));
// Manual ground picks on the 1407x1760 display of the 1760x2200 boards.
// Offsets move the proposed lowest-pixel root to the two-boot centre. They do
// not resize or rotate any drawing. Never run against an already adjusted export.
if(selection.manualGroundReviewed)throw Error('Ground picks already persisted. Export directly.');
const picks={
 'asar-reverse':[[50,0],[48,0],[34,0],[-31,0],[5,0]],
 'asar-thrust':[[38,0],[28,0],[35,0],[-29,0],[37,0]],
 'naya-charge':[[20,0],[-40,0],[-44,0],[40,0],[0,0]],
 'balta-double':[[-48,0],[0,0],[0,0],[0,0],[0,0]],
 'balta-left':[[46,0],[10,0],[45,0],[0,0],[0,0]],
 'arkan-down':[[-45,-15],[-42,-4],[37,0],[2,0],[0,0]],
 'arkan-reverse':[[50,0],[43,0],[47,0],[43,0],[0,0]],
 'jeogu-reverse':[[34,0],[34,0],[31,0],[-34,0],[-31,0]],
 'yeonsal-cast':[[-28,0],[28,0],[0,0],[0,0],[26,0]],
 'yeonsal-left':[[39,0],[-43,0],[39,0],[37,0],[0,0]],
 'yeonsal-right':[[38,0],[-40,0],[39,0],[0,0],[-35,0]],
 'sohong-reverse':[[0,0],[-5,0],[6,0],[-5,0],[0,0]],
 'jeokcheon-finish':[[37,0],[27,0],[27,0],[1,0],[0,0]],
 'jeokcheon-reverse':[[39,0],[37,0],[39,0],[-30,0],[0,0]],
 'jeokcheon-thrust':[[31,0],[32,0],[36,0],[-30,0],[0,0]],
 'yanggi-reverse':[[-43,0],[40,0],[42,0],[-30,0],[-20,0]],
 'yanggi-thrust':[[22,0],[-31,0],[38,0],[-30,0],[28,0]],
 'mukyeon-push':[[18,0],[-34,0],[38,0],[32,0],[-30,0]],
 'jingwal-drive':[[23,0],[-34,0],[37,0],[-32,0],[31,0]],
 'jingwal-finish':[[34,-5],[-40,0],[43,0],[37,0],[-29,0]],
 'jingwal-sweep':[[-35,0],[39,0],[43,0],[0,0],[32,0]],
 'zhugehyeon-reverse':[[43,0],[44,0],[38,0],[-22,0],[31,0]],
};
for(const r of review.report){
 const s=selection.sources[r.id]??={};s.boots={};
 for(const f of r.selected){const [dx,dy]=picks[r.id][f.view];s.boots[f.n]=[Math.round(f.sourceBoot[0]+dx/(.4*r.factor)),Math.round(f.sourceBoot[1]+dy/(.4*r.factor))];}
 s.groundReview='Manual two-boot centre on grounded READY/contact comparison board; weapon tip excluded.';
}
selection.manualGroundReviewed=true;selection.groundBoardDisplayScale=.4;
await writeFile(root+'/selection.json',JSON.stringify(selection,null,2)+'\n');
console.log('110 manual ground picks persisted; re-export uses saved metadata.');
