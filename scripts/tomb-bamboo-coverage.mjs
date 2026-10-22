import {createServer} from 'vite';
import {writeFile} from 'node:fs/promises';
const vite=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const {BOSS_KITS}=await vite.ssrLoadModule('/src/domain/boss-melee.ts'),{bossSpecialArt,TOMB_BAMBOO_SPECIAL_ART}=await vite.ssrLoadModule('/src/game/boss-special.ts');
 const bosses=Object.entries(BOSS_KITS).map(([id,kit])=>{const art=bossSpecialArt({bossId:id},Number(id.split('-')[0]));return{bossId:id,kitMoves:Object.keys(kit.moves),specialMoves:art?.moves??[],logicalFrames:art?.frames.length??0,remaining:Object.keys(kit.moves).filter(m=>!art?.moves.includes(m))}});
 const art=TOMB_BAMBOO_SPECIAL_ART,frames=art.characters.flatMap(a=>a.frames),uniqueSources=new Set(frames.filter(f=>f.provenance==='new-special-motion').map(f=>f.source+'/'+f.sourceCell.index)),failures=[];
 for(const a of art.characters)for(const f of a.frames)for(const flip of [false,true]){
  const left=750+(flip?f.footX-f.bounds.right:f.bounds.left-f.footX)*.5,right=750+(flip?f.footX-f.bounds.left:f.bounds.right-f.footX)*.5,top=430+(f.bounds.top-f.footY)*.5,bottom=430+(f.bounds.bottom-f.footY)*.5,barTop=430-a.healthClearance/a.pixelScale*.5;
  if(left<500||right>1000||top<0||bottom>520||barTop<0)failures.push({id:a.id,frame:f.name,flip,left,right,top,bottom,barTop});
 }
 const result={date:'2026-10-18',global:{bosses:bosses.filter(b=>b.specialMoves.length).length,kitActions:bosses.reduce((n,b)=>n+b.kitMoves.length,0),specialActions:bosses.reduce((n,b)=>n+b.specialMoves.length,0),logicalFrames:bosses.reduce((n,b)=>n+b.logicalFrames,0),remaining:bosses.reduce((n,b)=>n+b.remaining.length,0)},selected:{bosses:8,actions:16,logicalFrames:frames.length,uniqueSourceCells:uniqueSources.size,readyReuse:frames.filter(f=>f.provenance==='basic-ready-reuse').length},reviewCanvas:{width:1000,height:520,ground:430,scale:.5,failures},bosses};
 await writeFile('docs/verification/tomb-bamboo-special-v2/coverage.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({...result,bosses:undefined}));if(failures.length)process.exitCode=1;
}finally{await vite.close()}
