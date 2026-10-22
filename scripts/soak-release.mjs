import { chromium } from '@playwright/test';
import { build } from 'esbuild';
import { spawn } from 'node:child_process';
import { mkdir, writeFile, cp } from 'node:fs/promises';
const proof='docs/verification/unification-v2';
await mkdir(proof,{recursive:true});await mkdir('.cache',{recursive:true});
await cp('dist','.cache/soak-release',{recursive:true});
await build({entryPoints:['src/domain/game.ts'],bundle:true,platform:'node',format:'esm',outfile:'.cache/soak-domain.mjs'});
const {emptyGame,startRun}=await import('../.cache/soak-domain.mjs');
const state=emptyGame();startRun(state,'독립 내구성 검객',42);
const r=state.run;r.offers=[];r.spent=20;r.fighter.level=20;r.fighter.spent=20;
r.fighter.arts=['huashan','wudang','tianmo','samja'].map(id=>({id,level:5,combo:0,defenseCd:0,gauge:100}));
r.fighter.bindings=Object.fromEntries(r.fighter.arts.map(a=>[a.id,r.fighter.items[0].id]));r.fighter.invulnerable=100000;
const template=r.enemies[0];
r.enemies=Array.from({length:28},(_,i)=>({...template,id:i+1,kind:i%5===0?'captain':i%3===0?'archer':'sword',
  x:500+(i%7)*120,y:380+Math.floor(i/7)*90,hp:1000000,maxHp:1000000,timer:.5+i*.03,elite:i%8===0}));
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','5183','--strictPort','--outDir','.cache/soak-release'],{windowsHide:true,stdio:'ignore'});
const base='http://127.0.0.1:5183';let browser;
const report={started:new Date().toISOString(),productionSnapshot:true,isolated:true,samples:[],errors:[]};
try {
  for(let n=0;n<100;n++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1093,height:614},locale:'ko-KR'});
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  await page.addInitScript(()=>{
    const Native=window.AudioContext;window.soakSources=0;window.soakMaxSources=0;
    window.AudioContext=class extends Native {
      constructor(...args){super(...args);window.soakAudio=this;}
      createBufferSource(){const s=super.createBufferSource(),start=s.start.bind(s);s.start=(...args)=>{
        window.soakSources++;window.soakMaxSources=Math.max(window.soakMaxSources,window.soakSources);s.addEventListener('ended',()=>window.soakSources--,{once:true});start(...args);};return s;}
    };
  });
  await page.goto(base);await page.locator('.home-scene').waitFor();
  await page.evaluate(async state=>{
    const request=indexedDB.open('mugong-local-v1',1),db=await new Promise(resolve=>{request.onsuccess=()=>resolve(request.result);});
    await new Promise(resolve=>{const tx=db.transaction('saves','readwrite');tx.objectStore('saves').put(state,'current');tx.oncomplete=resolve;});db.close();
  },state);await page.reload();await page.locator('.game-canvas[data-ready="true"]').waitFor();
  await page.mouse.move(610,280);await page.mouse.down();await page.keyboard.press('e');
  await page.evaluate(()=>{
    window.soakFrames=[];window.soakLast=performance.now();
    const frame=now=>{if(now-window.soakLast<500)window.soakFrames.push(now-window.soakLast);window.soakLast=now;
      if(window.soakFrames.length>10000)window.soakFrames.shift();requestAnimationFrame(frame);};requestAnimationFrame(frame);
  });
  const begun=Date.now(),duration=Number(process.env.MUGONG_SOAK_MS??1800000);
  while(Date.now()-begun<duration){
    await new Promise(resolve=>setTimeout(resolve,30000));await page.keyboard.press('e');
    const sample=await page.evaluate(async()=>{
      const request=indexedDB.open('mugong-local-v1',1),db=await new Promise(resolve=>{request.onsuccess=()=>resolve(request.result);});
      const state=await new Promise(resolve=>{const get=db.transaction('saves').objectStore('saves').get('current');get.onsuccess=()=>resolve(get.result);});db.close();
      const r=state.run,times=window.soakFrames.splice(0).sort((a,b)=>a-b);
      return {time:performance.now(),phase:r?.phase,elapsed:r?.elapsed,paused:!!document.querySelector('.pause-menu'),
        error:document.querySelector('.save-error')?.textContent??'',enemies:r?.enemies.length,projectiles:r?.projectiles.length,effects:r?.effects.length,
        renderer:document.querySelector('.game-canvas')?.dataset.renderer,heap:performance.memory?.usedJSHeapSize,
        p95:times[Math.floor(times.length*.95)],frames:times.length,canvas:document.querySelectorAll('canvas').length,
        audio:{context:window.soakAudio?.state,activeSources:window.soakSources,maxSources:window.soakMaxSources}};
    });
    report.samples.push(sample);await writeFile(`${proof}/soak-progress.json`,JSON.stringify(report,null,2));
    if(sample.error||sample.paused||sample.phase!=='combat'||report.errors.length)throw new Error('Soak interrupted; see samples.');
  }
  await page.mouse.up();await page.screenshot({path:`${proof}/soak-combat.png`});report.elapsedMs=Date.now()-begun;report.complete=true;
}catch(error){report.failure=String(error);process.exitCode=1;}
finally{report.finished=new Date().toISOString();await writeFile(`${proof}/soak-result.json`,JSON.stringify(report,null,2));await browser?.close();server.kill();}
console.log(JSON.stringify({complete:report.complete,elapsedMs:report.elapsedMs,samples:report.samples.length,errors:report.errors,failure:report.failure}));
