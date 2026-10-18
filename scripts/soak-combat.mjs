import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
const root='docs/verification/unification-v2';
await mkdir(root,{recursive:true});
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5183','--strictPort'],{windowsHide:true,stdio:'ignore'});
const base='http://127.0.0.1:5183'; let browser;
const report={started:new Date().toISOString(), isolated:true, samples:[], errors:[]};
try {
  for(let n=0;n<100;n++) { try { if((await fetch(base)).ok)break; }catch{} await new Promise(r=>setTimeout(r,100)); }
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1093,height:614},locale:'ko-KR'});
  const page=await context.newPage(); page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(base); await page.locator('.home-scene').waitFor();
  await page.evaluate(async()=>{
    const {gameStore}=await import('/src/platform/store.ts');
    await gameStore.dispatch({type:'start',name:'독립 내구성 검객',seed:42});
    const r=gameStore.state.run;
    r.offers=[]; r.spent=20; r.fighter.level=20;
    r.fighter.arts=['huashan','wudang','tianmo','samja'].map(id=>({id,level:5,combo:0,defenseCd:0,gauge:100}));
    r.fighter.bindings=Object.fromEntries(r.fighter.arts.map(a=>[a.id,r.fighter.items[0].id]));
    r.fighter.invulnerable=100000;
    const template=r.enemies[0];
    r.enemies=Array.from({length:28},(_,i)=>({...template,id:i+1,kind:i%5===0?'captain':i%3===0?'archer':'bandit',
      x:500+(i%7)*120,y:380+Math.floor(i/7)*90,hp:1000000,maxHp:1000000,timer:.5+i*.03,elite:i%8===0}));
    await gameStore.persist();
  });
  await page.locator('.game-canvas[data-ready="true"]').waitFor();
  await page.mouse.move(610,280); await page.mouse.down(); await page.keyboard.press('e');
  await page.evaluate(()=>{
    window.soakFrames=[]; window.soakLast=performance.now();
    const frame=now=>{ if(now-window.soakLast<500) window.soakFrames.push(now-window.soakLast); window.soakLast=now;
      if(window.soakFrames.length>10000) window.soakFrames.shift(); requestAnimationFrame(frame); };
    requestAnimationFrame(frame);
  });
  const begun=Date.now(), duration=Number(process.env.MUGONG_SOAK_MS??1800000);
  while(Date.now()-begun<duration) {
    await new Promise(resolve=>setTimeout(resolve,30000));
    await page.keyboard.press('e'); await page.keyboard.press('Space');
    const sample=await page.evaluate(async()=>{
      const {gameStore}=await import('/src/platform/store.ts');
      const {audioDiagnostics}=await import('/src/platform/audio.ts');
      const r=gameStore.state.run;
      const times=window.soakFrames.splice(0).sort((a,b)=>a-b);
      return {time:performance.now(),phase:r?.phase,paused:gameStore.paused,busy:gameStore.busy,error:gameStore.error,
        enemies:r?.enemies.length,projectiles:r?.projectiles.length,effects:r?.effects.length,
        renderer:document.querySelector('.game-canvas')?.dataset.renderer,
        heap:performance.memory?.usedJSHeapSize,p95:times[Math.floor(times.length*.95)],frames:times.length,
        canvas:document.querySelectorAll('canvas').length,audio:audioDiagnostics()};
    });
    report.samples.push(sample); await writeFile(`${root}/soak-progress.json`,JSON.stringify(report,null,2));
    if(sample.error || sample.paused || sample.phase!=='combat' || report.errors.length) throw new Error('Soak interrupted; see samples.');
  }
  await page.mouse.up(); await page.screenshot({path:`${root}/soak-combat.png`});
  report.elapsedMs=Date.now()-begun; report.complete=true;
} catch(error) {report.failure=String(error);process.exitCode=1;}
finally { report.finished=new Date().toISOString(); await writeFile(`${root}/soak-result.json`,JSON.stringify(report,null,2));await browser?.close();server.kill(); }
console.log(JSON.stringify({complete:report.complete,elapsedMs:report.elapsedMs,samples:report.samples.length,errors:report.errors,failure:report.failure}));
