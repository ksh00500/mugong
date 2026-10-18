import {createServer} from 'vite';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const root='docs/source/tomb-bamboo-complete-v3';await mkdir(root+'/generated',{recursive:true});await mkdir(root+'/references',{recursive:true});
const vite=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 // Audit against the preserved sixteen-action baseline, so rerunning after
 // installation cannot erase this production batch with an empty move list.
 const {BOSS_KITS}=await vite.ssrLoadModule('/src/domain/boss-melee.ts'),baseline=JSON.parse(await readFile('src/game/tomb-bamboo-special-frames.json')),jobs=[];
 for(const family of ['tomb','bamboo']){
  const ids=family==='tomb'?['jeokho','seokmun','gwakgi','wolryeong']:['qingbi','nogae','yanqing','songwol'];
  for(const [slot,id]of ids.entries()){
   const bossId=(family==='tomb'?'6':'5')+'-'+(slot+1),installed=baseline.characters.find(a=>a.bossId===bossId),kit=BOSS_KITS[bossId],moves=Object.entries(kit.moves).filter(([m])=>!installed.moves.includes(m)).map(([move,spec])=>({move,...spec}));
   jobs.push({id,bossId,family,moves});
  }
 }
 await writeFile(root+'/preflight.json',JSON.stringify(jobs,null,2)+'\n');console.log(JSON.stringify(jobs.map(j=>({id:j.id,moves:j.moves.map(m=>({move:m.move,name:m.name,shape:m.shape,motion:m.motion,contacts:m.contacts,mechanic:m.mechanic,shot:m.shot,zone:m.zone,windup:m.windup,duration:m.duration,recovery:m.recovery,dash:m.dash}))})),null,2));
}finally{await vite.close()}
