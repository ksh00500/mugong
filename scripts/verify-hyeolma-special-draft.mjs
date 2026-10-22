import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const dir='docs/verification/hyeolma-special-v1';
await mkdir(dir,{recursive:true});
const browser=await chromium.launch({headless:true});
const report={mode:'draft comparison only; game registration/contact/e2e not tested',screens:[],errors:[],samples:0};
try {
 for(const viewport of [{width:1440,height:900},{width:1366,height:768},{width:1093,height:614}]) {
  const context=await browser.newContext({viewport});
  const page=await context.newPage();
  page.on('pageerror',e=>report.errors.push(String(e)));
  page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`)});
  await page.goto('http://127.0.0.1:5173/art/hyeolma-special-v1/review.html');
  await page.waitForFunction(()=>[...document.images].every(i=>i.complete));
  await page.waitForFunction(()=>[...images.values()].every(i=>i.complete&&i.naturalWidth>0));
  await page.locator('#pause').click();
  for(let actor=0;actor<4;actor++) {
   await page.locator('#character').selectOption(String(actor));
   const moves=await page.locator('#move option').evaluateAll(xs=>xs.map(x=>x.value));
   for(const move of moves) {
    await page.locator('#move').selectOption(move);
    for(let pose=0;pose<6;pose++) {
     await page.locator('#pose').selectOption(String(pose));
     await page.waitForFunction(p=>document.querySelector('#phase').textContent.includes((p+1)+'/6'),pose);
     const result=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,canvases:document.querySelectorAll('canvas').length,holdDisabled:document.querySelector('#hold').disabled,controls:[...document.querySelectorAll('nav button,nav select')].every(e=>{const r=e.getBoundingClientRect();return r.x>=0&&r.right<=innerWidth&&r.bottom<=innerHeight})}));
     if(result.overflow||result.canvases!==8||!result.holdDisabled||!result.controls)throw Error(JSON.stringify({viewport,actor,move,pose,result}));
     report.samples++;
    }
    if(viewport.width===1440) {
     await page.locator('#pose').selectOption('2');
     await page.waitForFunction(()=>document.querySelector('#phase').textContent.includes('3/6'));
     const path=`${dir}/actor-${actor}-${move}-1440.png`;
     await page.screenshot({path,fullPage:true}); report.screens.push(path);
    }
   }
  }
  if(viewport.width===1093){const path=`${dir}/review-1093.png`;await page.screenshot({path});report.screens.push(path)}
  await page.locator('#pose').selectOption('0');await page.locator('#next').click();
  if(await page.locator('#pose').inputValue()!=='1')throw Error('Next pose failed');
  await context.close();
 }
 const context=await browser.newContext({viewport:{width:1093,height:614},reducedMotion:'reduce'});
 const page=await context.newPage();await page.goto('http://127.0.0.1:5173/art/hyeolma-special-v1/review.html');
 if(await page.locator('#pause').textContent()!=='재생')throw Error('Reduced motion should start paused');
 await context.close();
 if(report.errors.length)throw Error(JSON.stringify(report.errors));
 report.passed=true;
} catch(e){report.passed=false;report.failure=String(e);process.exitCode=1}
finally{await browser.close();await writeFile(`${dir}/browser-results.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report))}

