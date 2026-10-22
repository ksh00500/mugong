import {test,expect} from '@playwright/test';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {seedLoadingRun} from './support/loading';
const proof='docs/verification/native-size-review-v1/after';
test('컴파일 JS와 새 원화13장의 HTTP 해시가 실제 출력과 같다',async({request})=>{
 await mkdir(proof,{recursive:true});
 const html=await request.get('/');expect(html.status()).toBe(200);
 const text=await html.text();expect(text).toBe(await readFile('dist-native-size-v1/index.html','utf8'));
 const urls=Object.values(JSON.parse(await readFile('src/game/native-size-textures.json','utf8'))) as string[];
 urls.push(...Array.from(text.matchAll(/(?:src|href)="(\/assets\/[^"?]+)"/g),m=>m[1]));
 const records=[];
 for(const url of urls){const r=await request.get(url);expect(r.status(),url).toBe(200);const sha=createHash('sha256').update(await r.body()).digest('hex');expect(sha,url).toBe(createHash('sha256').update(await readFile('dist-native-size-v1'+url)).digest('hex'));records.push({url,sha256:sha})}
 await writeFile(`${proof}/compiled-http.json`,JSON.stringify({records},null,2)+'\n');
});
for(const [region,wave,viewport]of [[3,1,{width:1440,height:900}],[9,10,{width:1366,height:768}],[9,15,{width:1093,height:614}],[9,20,{width:1093,height:614}]] as const)
test(`컴파일 전투 입장·이동·가방 R${region} W${wave}`,async({page})=>{
 test.setTimeout(60000);await page.setViewportSize(viewport);
 const errors:string[]=[],failed:string[]=[],loaded:string[]=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{const p=new URL(r.url()).pathname;if(r.status()>=400&&/^\/(art|assets)\//.test(p))failed.push(p);if(r.status()===200&&p.startsWith('/art/native-size-v1/')&&p.endsWith('.webp'))loaded.push(p)});
 await seedLoadingRun(page,region,wave);
 await expect(page.locator('.game-canvas')).toHaveAttribute('data-art-region',String(region));
 expect(loaded.length).toBeGreaterThan(0);
 await page.keyboard.down('d');await page.waitForTimeout(200);await page.keyboard.up('d');
 const c=page.locator('.game-canvas canvas').first();const box=(await c.boundingBox())!;
 await page.mouse.click(box.x+box.width*.7,box.y+box.height*.5);
 await page.keyboard.press('Tab');await expect(page.locator('.inventory-workspace')).toBeVisible();
 await page.keyboard.press('Escape');await expect(page.locator('.inventory-workspace')).toHaveCount(0);
 await page.screenshot({path:`${proof}/compiled-R${region}-W${wave}.png`});
 expect(errors).toEqual([]);expect(failed).toEqual([]);
 await writeFile(`${proof}/compiled-R${region}-W${wave}.json`,JSON.stringify({region,wave,viewport,loaded,errors,failed,independentContext:true},null,2)+'\n');
});
