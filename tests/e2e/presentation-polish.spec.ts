import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

test('dedicated art, selected portrait, sound playback and reduced-motion remain connected', async ({page}) => {
  test.setTimeout(120000);
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  const missing:string[]=[];page.on('response',r=>{if(r.status()>=400 && /character-polish|hero-roster/.test(r.url())) missing.push(r.url());});
  const directory='docs/verification/character-polish-v1';await mkdir(directory,{recursive:true});
  await page.goto('/');
  await page.getByRole('button',{name:'새 무인으로 출전 →'}).click();
  await page.getByRole('button',{name:'모집권 1장 사용'}).click();
  const sources=await page.locator('.recruitment-portrait').evaluateAll(images=>images.map(i=>(i as HTMLImageElement).getAttribute('src')));
  expect(new Set(sources).size).toBe(3);
  await page.screenshot({path:`${directory}/recruitment.png`});
  await page.locator('.recruitment-candidate').nth(2).click();
  await page.getByRole('button',{name:'강호에 나서기 →'}).click();
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready','true',{timeout:45000});
  await expect(page.locator('.hud-portrait img')).toHaveAttribute('src',sources[2]!);
  await expect(page.locator('.choice-card').first()).toBeEnabled();
  await page.locator('.choice-card').first().click();
  await page.getByRole('button',{name:/가방/}).first().click();
  const audio=await page.evaluate(async()=>{
    const path='/src/platform/audio.ts',palettePath='/src/platform/combat-sounds.ts';
    const {unlockAudio,sound,audioDiagnostics}=await import(/* @vite-ignore */path);
    const {COMBAT_SOUNDS}=await import(/* @vite-ignore */palettePath);
    unlockAudio();
    await new Promise(resolve=>setTimeout(resolve,150));
    for(const kind of Object.keys(COMBAT_SOUNDS)) {
      sound(kind); await new Promise(resolve=>setTimeout(resolve,100));
    }
    return audioDiagnostics();
  });
  expect(audio.context).toBe('running');
  expect(audio.recentSounds.filter((s:string)=>s in {'ice-burst':1,'poison-burst':1,'drone-repair':1,'sword-swing':1,'fist-swing':1})).toHaveLength(5);
  await page.reload();
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready','true',{timeout:45000});
  await expect(page.locator('.hud-portrait img')).toHaveAttribute('src',sources[2]!);
  await page.evaluate(async()=>{
    const path='/src/platform/store.ts'; const {gameStore}=await import(/* @vite-ignore */path);
    const f=gameStore.state.run.fighter;
    Object.assign(f,{level:10,augments:[],augmentOffers:['vigor','might','swift']});
    gameStore.state.run.offers=[];gameStore.bagOpen=false;gameStore.notify();
  });
  await expect(page.locator('.augment-artwork')).toHaveCount(3);
  await expect(page.locator('.augment-cards button').first()).toBeEnabled();
  await page.screenshot({path:`${directory}/augment-cards.png`});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.screenshot({path:`${directory}/reduced-motion.png`});
  expect(errors).toEqual([]);expect(missing).toEqual([]);
  await writeFile(`${directory}/browser-result.json`,JSON.stringify({sources,audio,errors,missing},null,2));
});
