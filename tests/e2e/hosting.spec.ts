import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {seedRegion} from './support/region';
const proof=process.env.MUGONG_HOSTING_PROOF??'docs/verification/self-hosting-v1';
for(const viewport of [{width:1440,height:900},{width:1366,height:768},{width:1093,height:614}]){
 test(`hosted lobby and recruitment ${viewport.width}`,async({page})=>{
  await page.setViewportSize(viewport);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await expect(page.locator('.home-scene')).toBeVisible({timeout:45000});
  const launch=page.getByRole('button',{name:'새 무인으로 출전 →',exact:true});await expect(launch).toBeEnabled();
  await launch.focus();await page.keyboard.press('Enter');await expect(page.getByRole('dialog',{name:'무인 모집',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'무인 모집 닫기',exact:true}).click();
  await expect(launch).toBeFocused();
  const box=await launch.boundingBox();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.y+box!.height).toBeLessThanOrEqual(viewport.height);
  await mkdir(proof,{recursive:true});await page.screenshot({path:`${proof}/lobby-${viewport.width}.png`});expect(errors).toEqual([]);
 });
}
test('hosted compiled combat loads images and accepts input',async({page})=>{
 await page.setViewportSize({width:1093,height:614});const errors:string[]=[],failed:string[]=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&/\/(art|audio|fonts|assets)\//.test(new URL(r.url()).pathname))failed.push(new URL(r.url()).pathname);});
 await seedRegion(page,4);await expect(page.locator('script[src^="/assets/main-"]')).toHaveCount(1);
 await page.keyboard.down('d');await page.waitForTimeout(180);await page.keyboard.up('d');
 const canvas=(await page.locator('canvas').first().boundingBox())!;await page.mouse.click(canvas.x+canvas.width*.65,canvas.y+canvas.height*.5);
 await page.getByRole('button',{name:'가방',exact:false}).first().click();await expect(page.getByRole('dialog',{name:'가방 · 정보 확인'})).toBeVisible();
 await page.getByRole('button',{name:'가방 · 정보 확인 닫기'}).click();
 await mkdir(proof,{recursive:true});await page.screenshot({path:`${proof}/combat-1093.png`});
 expect(errors).toEqual([]);expect(failed).toEqual([]);await writeFile(`${proof}/browser.json`,JSON.stringify({errors,failed,independentContexts:true,actualUserSaveTouched:false},null,2)+'\n');
});
test('nginx health, cache rules and missing asset responses',async({request})=>{
 test.skip(process.env.MUGONG_HOSTING_NGINX!=='1','Nginx container only');
 const health=await request.get('/healthz');expect(health.status()).toBe(200);expect(await health.text()).toBe('ok\n');
 const index=await request.get('/');expect(index.headers()['cache-control']).toMatch(/no-store|no-cache/);
 const script=(await index.text()).match(/src="(\/assets\/main-[^"]+\.js)"/)![1];
 const js=await request.get(script);expect(js.status()).toBe(200);expect(js.headers()['cache-control']).toContain('immutable');
 const font=await request.get('/fonts/GowunBatang-Regular.woff2');expect(font.status()).toBe(200);expect(font.headers()['cache-control']).toBe('no-cache');
 const absent=await request.get('/art/definitely-missing.webp');expect(absent.status()).toBe(404);
 const subpage=await request.get('/next-stage/');expect(subpage.status()).toBe(200);expect(await subpage.text()).toContain('다음 단계');
});
