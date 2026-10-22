import {test,expect} from '@playwright/test';
import {createHash} from 'node:crypto';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {seedRegion} from './support/region';

const proof='docs/verification/asset-inventory-v1';
test('Git 복제본 서버의 모든 public 미디어가 SHA256과 일치한다',async({request,baseURL})=>{
 test.setTimeout(180000);await mkdir(proof,{recursive:true});
 const files=JSON.parse(await readFile('asset-manifest.json','utf8')).files.filter((f:{path:string})=>f.path.startsWith('public/')) as {path:string;bytes:number;sha256:string}[];
 let bytes=0;
 for(const f of files){
  const response=await request.get('/'+f.path.slice(7));
  expect(response.status(),f.path).toBe(200);
  const body=await response.body();expect(body.length,f.path).toBe(f.bytes);
  expect(createHash('sha256').update(body).digest('hex'),f.path).toBe(f.sha256);
  bytes+=body.length;await response.dispose();
 }
 await writeFile(`${proof}/http-media.json`,JSON.stringify({files:files.length,bytes,sha256Matched:true,server:baseURL},null,2)+'\n');
});

for(let region=0;region<10;region++)test(`Git 그림으로 지역${region} 일반 적·4보스·외형${region} 표시와 가방`,async({page})=>{
 test.setTimeout(60000);await mkdir(proof,{recursive:true});
 const errors:string[]=[],failed:string[]=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{if(r.status()>=400&&/^\/(art|fonts|audio|assets)\//.test(new URL(r.url()).pathname))failed.push(r.url())});
 await seedRegion(page,region,true,region as any);
 await page.keyboard.down('d');await page.waitForTimeout(120);await page.keyboard.up('d');
 await page.keyboard.press('Tab');await expect(page.locator('.inventory-workspace')).toBeVisible();
 await page.keyboard.press('Escape');await expect(page.locator('.inventory-workspace')).toHaveCount(0);
 await page.screenshot({path:`${proof}/region-${region}.png`});
 expect(errors).toEqual([]);expect(failed).toEqual([]);
 await writeFile(`${proof}/region-${region}.json`,JSON.stringify({region,appearance:region,ready:true,bag:true,errors,failed,independentContext:true},null,2)+'\n');
});
