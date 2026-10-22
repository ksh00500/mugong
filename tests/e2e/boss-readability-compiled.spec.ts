import {test,expect} from '@playwright/test';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {seedLoadingRun} from './support/loading';
const proof='docs/verification/boss-readability-v1';
test('최종 컴파일 HTML/JS/CSS가 제공된 파일과 일치한다',async({request})=>{
 await mkdir(proof,{recursive:true});const html=await request.get('/');expect(html.status()).toBe(200);const text=await html.text();expect(text).toBe(await readFile('dist-boss-readability-v1/index.html','utf8'));
 const rows=[];for(const m of text.matchAll(/(?:src|href)="(\/assets\/[^"?]+)"/g)){const r=await request.get(m[1]);expect(r.status()).toBe(200);const digest=createHash('sha256').update(await r.body()).digest('hex');expect(digest).toBe(createHash('sha256').update(await readFile('dist-boss-readability-v1'+m[1])).digest('hex'));rows.push({url:m[1],sha256:digest});}
 await writeFile(`${proof}/compiled-http.json`,JSON.stringify(rows,null,2)+'\n');
});
for(const [region,viewport]of [[4,{width:1440,height:900}],[9,{width:1366,height:768}],[1,{width:1093,height:614}]] as const)
test(`컴파일 보스·상태·이동/가방 R${region}`,async({page})=>{
 test.setTimeout(60000);await page.setViewportSize(viewport);const errors:string[]=[],failed:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&/^\/(assets|art)\//.test(new URL(r.url()).pathname))failed.push(r.url())});
 await seedLoadingRun(page,region,5,6);await expect(page.locator('.boss-phase')).toContainText('교전');
 await page.keyboard.down('d');await page.waitForTimeout(150);await page.keyboard.up('d');await page.keyboard.press('Tab');await expect(page.locator('.inventory-workspace')).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('.inventory-workspace')).toHaveCount(0);
 await page.screenshot({path:`${proof}/compiled-R${region}.png`});expect(errors).toEqual([]);expect(failed).toEqual([]);
 await writeFile(`${proof}/compiled-R${region}.json`,JSON.stringify({region,viewport,errors,failed,phase:'combat',bagReturned:true,independentContext:true},null,2)+'\n');
});

test('컴파일 실제 준비→접촉 피해가 진행되고 가방은 저장 여정을 유지한다',async({page})=>{
 test.setTimeout(60000);const state=await seedLoadingRun(page,4,5);
 const r=state.run!,e=r.enemies.find(e=>e.bossId)!;r.enemies=[e];e.x=960;e.y=550;e.move='slam';e.state='windup';e.timer=1;e.hp=e.maxHp=900;r.fighter.x=960;r.fighter.y=670;
 await page.evaluate(async state=>{const db=await new Promise<IDBDatabase>(ok=>{const q=indexedDB.open('mugong-local-v1',1);q.onsuccess=()=>ok(q.result)});await new Promise<void>(ok=>{const tx=db.transaction('saves','readwrite');tx.objectStore('saves').put(state,'current');tx.oncomplete=()=>ok()});db.close()},state);
 await page.reload({waitUntil:'domcontentloaded'});await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready','true',{timeout:30000});
 const meter=page.locator('.hud-health [role="meter"]');
 await expect.poll(async()=>Number(await meter.getAttribute('aria-valuenow')),{timeout:10000}).toBeLessThan(120);
 await page.keyboard.press('Tab');await expect(page.locator('.inventory-workspace')).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('.inventory-workspace')).toHaveCount(0);
 await writeFile(`${proof}/compiled-real-contact.json`,JSON.stringify({realDamage:true,bagReturned:true,independentContext:true},null,2)+'\n');
});
