import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

for (const [width,height] of [[1440,900],[1366,768],[1093,614]]) {
  test(`growth, training and inventory stay usable at ${width}x${height}`, async ({page}) => {
    test.setTimeout(90000);
    await page.setViewportSize({width,height});
    const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('/');
    await expect(page.getByRole('button',{name:'새 무인으로 출전 →'})).toBeVisible();
    await page.evaluate(async () => {
      const storePath='/src/platform/store.ts', gamePath='/src/domain/game.ts', contentPath='/src/domain/content.ts';
      const {gameStore}=await import(/* @vite-ignore */storePath);
      const {emptyGame,startRun,grantXp,tick}=await import(/* @vite-ignore */gamePath);
      const {xpThreshold}=await import(/* @vite-ignore */contentPath);
      const state=emptyGame();startRun(state,'성장 검증',123);const r=state.run,f=r.fighter;
      Object.assign(f,{progressionVersion:2,growth:{constitution:1,strength:1.3,agility:.9,inner:1.6},level:9,xp:xpThreshold(9),innate:'quickhands',augments:[],augmentOffers:[],trainingPoints:0,traitState:{}});
      f.arts=['huashan','wudang','tianmo','samja'].map(id=>({id,level:1,gauge:0,combo:0,defenseCd:0}));
      f.bindings={huashan:f.items[0].id,wudang:f.items[0].id,samja:f.items[0].id};
      r.offers=[];r.zones=[];r.encounterObjects=[];r.enemies=[];
      grantXp(r,xpThreshold(10)-f.xp);
      // Wave and level finish together; the augment must take precedence over training and bag.
      tick(r,{dx:0,dy:0,aim:0,attack:false,ultimate:false,defense:false},1/60);
      gameStore.state=state;gameStore.screen='field';gameStore.bagOpen=false;gameStore.paused=false;
      await gameStore.persist();gameStore.notify();
    });
    await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready','true',{timeout:30000});
    const augment=page.getByRole('dialog',{name:'성장 특성 선택'});
    await expect(augment).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(1);
    const offered=await page.locator('.augment-cards').textContent();
    await page.reload();
    await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready','true',{timeout:30000});
    await expect(augment).toBeVisible();expect(await page.locator('.augment-cards').textContent()).toBe(offered);
    await expect(page.locator('.augment-cards button').first()).toBeEnabled();
    await page.locator('.augment-cards button').first().click();
    await expect(page.getByRole('dialog',{name:'무공 성장 선택'})).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(1);
    await page.getByRole('button',{name:'수련 기회 보관'}).click();
    const bag=page.locator('.inventory-workspace');
    await expect(bag).toBeVisible();await expect(page.getByRole('dialog')).toHaveCount(1);
    await expect(page.locator('.character-profile')).toContainText('재빠른 손');
    await expect(page.locator('.character-training')).toContainText('수련 1');
    await page.evaluate(async()=>{
      const storePath='/src/platform/store.ts',contentPath='/src/domain/content.ts';
      const {gameStore}=await import(/* @vite-ignore */storePath);const {xpThreshold}=await import(/* @vite-ignore */contentPath);
      const f=gameStore.state.run.fighter;f.level=50;f.xp=xpThreshold(50);f.augments=['iron','reservoir','resolve'];
      await gameStore.persist();gameStore.notify();
    });
    await mkdir('docs/verification/character-growth-v2',{recursive:true});
    for(const language of ['ko','en','ja','zh-CN','zh-TW']) {
      await page.evaluate(async code=>{const path='/src/platform/i18n.ts';const {setLanguage}=await import(/* @vite-ignore */path);setLanguage(code);},language);
      const result=await page.locator('.inventory-character').evaluate(el=>{
        const box=el.getBoundingClientRect();return {bottom:box.bottom,scrollHeight:el.scrollHeight,clientHeight:el.clientHeight};
      });
      expect(result.bottom).toBeLessThanOrEqual(height);
      expect(result.scrollHeight).toBeLessThanOrEqual(result.clientHeight+1);
      const tray=await page.locator('.inventory-trays').boundingBox();
      expect(result.bottom).toBeLessThanOrEqual(tray!.y);
      await page.screenshot({path:`docs/verification/character-growth-v2/bag-${width}x${height}-${language}.png`,animations:'disabled'});
    }
    await page.evaluate(async()=>{const path='/src/platform/i18n.ts';const {setLanguage}=await import(/* @vite-ignore */path);setLanguage('ko');});
    await expect(page.getByRole('dialog',{name:'무인의 성장'})).toHaveCount(0);
    await page.getByRole('button',{name:'수련 1 →',exact:true}).click();
    await expect(page.getByRole('dialog',{name:'무공 성장 선택'})).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(1);
    await page.getByRole('button',{name:'수련 기회 보관'}).click();
    await expect(bag).toBeVisible();expect(errors).toEqual([]);
  });
}
