import { chromium } from '@playwright/test';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const proof='docs/verification/boss-remaining-v1';await mkdir(proof,{recursive:true});
const data=JSON.parse(await readFile('public/art/boss-remaining-v1/review-data.json'));
const browser=await chromium.launch({headless:true});
const results=[];
try{
 for(const viewport of [{width:1440,height:900},{width:1366,height:768},{width:1093,height:614}]){
  const context=await browser.newContext({viewport});const page=await context.newPage();const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5173/art/boss-remaining-v1/review.html');
  await page.locator('#phase').filter({hasText:'0.00초'}).waitFor();
  let samples=0;
  for(const family of ['shaolin','tianjian','dokmu','qingha']){
   await page.locator('#family').selectOption(family);
   for(const actor of data.filter(a=>a.family===family)){
    await page.locator('#boss').selectOption(actor.bossId);
    // Loading uses independent image decodes, then resets the phase.
    await page.waitForFunction(()=>document.querySelector('#phase').textContent.startsWith('0.00초'));
    for(const move of actor.moves){
     await page.locator('#move').selectOption(move);
     for(let direction=0;direction<8;direction++){
      await page.locator('#dir').selectOption(String(direction));
      await page.locator('#next').click();
      const visible=await page.evaluate(()=>{
       const ids=['family','boss','move','dir','play','prev','next','time'];
       const missing=ids.filter(id=>{const r=document.getElementById(id).getBoundingClientRect();return r.width===0||r.height===0||r.left<0||r.right>innerWidth;});
       return {missing,overflow:document.documentElement.scrollWidth>innerWidth,phase:document.querySelector('#phase').textContent,source:document.querySelector('#source').textContent};
      });
      if(visible.missing.length||visible.overflow||!visible.source||!visible.phase)throw Error(JSON.stringify({actor:actor.id,move,direction,visible}));
      samples++;
     }
    }
   }
  }
  await page.locator('#family').selectOption('shaolin');await page.locator('#boss').selectOption('dowon');
  await page.locator('#move').selectOption('slam');await page.locator('#dir').selectOption('2');
  await page.locator('#next').click();await page.locator('#next').click();
  await page.locator('#next').focus();await page.keyboard.press('Enter');
  if(await page.locator('#next').evaluate(el=>el!==document.activeElement))throw Error('Keyboard focus lost');
  await page.locator('#play').click();const first=await page.locator('#time').inputValue();
  await page.waitForTimeout(150);const second=await page.locator('#time').inputValue();
  await page.locator('#play').click();if(first===second)throw Error('Playback clock did not advance');
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:proof+'/review-'+viewport.width+'.png',fullPage:true});
  if(errors.length)throw Error(errors.join('\n'));
  results.push({viewport,samples,keyboardStep:true,playPause:true,errors});await context.close();
 }
 await writeFile(proof+'/review-ui.json',JSON.stringify({date:'2026-10-08',independentContexts:true,results},null,2)+'\n');
 console.log(JSON.stringify(results));
}finally{await browser.close();}
