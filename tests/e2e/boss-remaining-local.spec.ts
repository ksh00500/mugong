import { test, expect } from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {regionArtManifest} from '../../src/platform/region-art';
import {seedRegion} from './support/region';
const proof='docs/verification/boss-remaining-v1';
test('local production serves current compiled bundle and selected remaining atlases',async({request})=>{
 const index=await request.get('/');expect(index.status()).toBe(200);
 const html=await index.text();
 expect(html).toBe(await readFile('dist/index.html','utf8'));
 const published=JSON.parse(await readFile(proof+'/local-publication.json','utf8'));
 const urls=[...published.files.map((f:any)=>'/art/boss-remaining-v1/'+f.name),...Array.from(html.matchAll(/(?:src|href)="(\/assets\/[^"?]+)"/g),m=>m[1])];
 const records=[];
 for(const url of urls){
  const res=await request.get(url);expect(res.status(),url).toBe(200);
  const digest=createHash('sha256').update(await res.body()).digest('hex');
  expect(digest,url).toBe(createHash('sha256').update(await readFile('dist'+url)).digest('hex'));
  records.push({url,sha256:digest});
 }
 await writeFile(proof+'/served-files.json',JSON.stringify(records,null,2)+'\n');
});
for(const [region,viewport] of [[4,{width:1093,height:614}],[2,{width:1440,height:900}],[1,{width:1366,height:768}],[0,{width:1093,height:614}]] as const){
 test(`local compiled region ${region} loads remaining action images and accepts combat input`,async({page})=>{
  await page.setViewportSize(viewport);const errors:string[]=[],failed:string[]=[],assets=new Set<string>();
  const expected=Object.values(regionArtManifest(region));
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{const path=new URL(r.url()).pathname;if(r.status()>=400&&/^\/(art|assets|fonts)\//.test(path))failed.push(path);if(r.status()===200&&expected.includes(path))assets.add(path);});
  await seedRegion(page,region);
  await expect(page.locator('script[src^="/assets/main-"]')).toHaveCount(1);
  await expect.poll(()=>assets.size).toBe(expected.length);
  await page.keyboard.down('d');await page.waitForTimeout(180);await page.keyboard.up('d');
  const box=(await page.locator('canvas').first().boundingBox())!;
  await page.mouse.click(box.x+box.width*.65,box.y+box.height*.5);await page.waitForTimeout(180);
  await page.getByRole('button',{name:'가방',exact:false}).first().click();
  await expect(page.getByRole('dialog',{name:'가방 · 정보 확인'})).toBeVisible();
  await page.getByRole('button',{name:'가방 · 정보 확인 닫기'}).click();
  await page.screenshot({path:proof+`/local-region-${region}.png`});
  expect(errors).toEqual([]);expect(failed).toEqual([]);
  await writeFile(proof+`/local-region-${region}.json`,JSON.stringify({region,viewport,expected:expected.length,loaded:assets.size,newRemainingLoaded:[...assets].filter(p=>p.includes('/boss-remaining-v1/')),compiled:true,combatInput:true,bagOpenClose:true,errors,failed,independentContext:true},null,2)+'\n');
 });
}
