import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { seedLoadingRun } from './support/loading';
import { observeScene, seedRegion } from './support/region';
const proof = 'docs/verification/native-size-review-v1/after';
for (const webgl of [false, true])
  test(`제갈현 크기 감사 ${webgl ? 'WebGL' : 'Canvas'}`, async ({ page }) => {
    test.setTimeout(90000);
    await mkdir(proof, { recursive: true });
    if (webgl)
      await page.addInitScript(() => {
        for (const proto of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
          const get = proto.getExtension;
          proto.getExtension = function (name: string) {
            return name === 'WEBGL_debug_renderer_info' ? null : get.call(this, name);
          };
        }
      });
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await seedLoadingRun(page, 9, 20);
    await observeScene(page);
    const result = await page.evaluate(async () => {
      const w = window as any, scene = w.regionScene;
      const store = (await w.regionModule('/src/platform/store.ts')).gameStore;
      const { enemyAttack } = await w.regionModule('/src/domain/combat.ts');
      const { authoredEnemyArt, authoredEnemyFrame } = await w.regionModule('/src/game/authored-enemy.ts');
      store.paused = true;
      scene.scene.pause();
      const run = store.state.run, original = JSON.stringify(run);
      const enemy = run.enemies.find((e: any) => e.bossId === '9-4');
      if (!enemy) throw Error('Expected Zhuge Hyeon final encounter');
      const rows = [];
      for (let d = 0; d < 8; d++)
        for (const move of ['fan', 'stance', 'combo', 'sweep', 'hazard'])
          for (const state of ['approach', 'windup', 'strike', 'recover'])
            for (const progress of [0, .25, .5, .75, .99]) {
              const e = { ...enemy, id: 9900, move, state, x: 960, y: 540, facing: d * Math.PI / 4, aim: d * Math.PI / 4, moving: false, guardTime: 0, staggerTime: 0 };
              const profile = enemyAttack(e), spec = profile.melee ?? { duration: .18, contacts: [0] };
              const duration = state === 'windup' ? profile.windup : state === 'recover' ? profile.recovery : spec.duration;
              e.timer = duration * (1 - progress);
              e.strike = state === 'strike' ? { duration: spec.duration, fromX:e.x, fromY:e.y, toX:e.x, toY:e.y } : undefined;
              scene.motionClock.reset();
              scene.drawEnemy(e);
              const actor = scene.actors.get(String(e.id)), frame = actor.getData('authoredFrame'), bar = actor.getData('healthBar');
              const basic = authoredEnemyFrame(authoredEnemyArt(e,9),d,'idle',0,0).frame;
              rows.push({d,move,state,progress,frame:frame.name,texture:actor.texture.key,scale:[actor.scaleX,actor.scaleY],footToTop:(frame.footY-frame.bounds.top)*actor.scaleY,basicFootToTop:(basic.footY-basic.bounds.top)*.225*1.2,barGap:bar.renderedTop-bar.y-bar.height,origin:[actor.originX,actor.originY],rotation:actor.rotation});
            }
      scene.draw(run);
      // Three copies at the same feet line: basic / fan windup / fan contact.
      for (const [column,state,progress] of [[0,'approach',0],[1,'windup',.8],[2,'strike',.35]] as const) {
        const e = {...enemy,id:9950+column,x:500+column*430,y:760,move:'fan',state,facing:Math.PI/4,aim:Math.PI/4,moving:false,guardTime:0,staggerTime:0};
        const p=enemyAttack(e),spec=p.melee??{duration:.18,contacts:[0]};
        e.timer=(state==='windup'?p.windup:spec.duration)*(1-progress);
        e.strike=state==='strike'?{duration:spec.duration,fromX:e.x,fromY:e.y,toX:e.x,toY:e.y}:undefined;
        scene.motionClock.reset();scene.drawEnemy(e);
        scene.add.text(e.x,e.y+30,['기본','부채 준비','부채 접촉'][column],{fontSize:'24px',color:'#ffffff',backgroundColor:'#20382d'}).setOrigin(.5,0);
      }
      return {rows,renderer:scene.game.renderer.type,unchangedRun:JSON.stringify(run)===original};
    });
    for (const row of result.rows) {
      expect(row.scale).toEqual([.225*1.2,.225*1.2]);
      expect(row.rotation).toBe(0);
      expect(row.barGap).toBeGreaterThanOrEqual(7);
      expect(row.texture).not.toBe('__MISSING');
    }
    expect(result.renderer).toBe(webgl ? 2 : 1);
    expect(result.unchangedRun).toBe(true);
    expect(errors).toEqual([]);
    await page.screenshot({path:`${proof}/${webgl?'webgl':'canvas'}-zhugehyeon.png`});
    await writeFile(`${proof}/${webgl?'webgl':'canvas'}-runtime.json`,JSON.stringify({...result,errors,independentContext:true},null,2)+'\n');
  });

for (const viewport of [{width:1440,height:900},{width:1366,height:768},{width:1093,height:614}])
test(`원화 교정 비교 ${viewport.width}`,async({page})=>{
  await page.setViewportSize(viewport);
  const errors:string[]=[],failed:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400)failed.push(new URL(r.url()).pathname)});
  await page.goto('/art/native-size-v1/review.html');
  for(const [id,action]of [['4','three-special/fan/0'],['2','locomotion'],['3','three-special/stance/0'],['1','three-special/sweep/0'],['0','combat']]){
    await page.locator('#actor').selectOption(id);
    await page.locator('#action').selectOption(action);
    for(const direction of ['1','6']){
      await page.locator('#direction').selectOption(direction);
      await page.locator('#pose').selectOption({index:2});
      await expect(page.locator('#before')).toHaveAttribute('data-ready','true');
      await expect(page.locator('#after')).toHaveAttribute('data-ready','true');
      await page.getByRole('button',{name:'다음 자세'}).click();
    }
  }
  await page.locator('#actor').selectOption('4');
  await page.locator('#action').selectOption('three-special/fan/0');
  await page.locator('#direction').selectOption('1');
  await page.locator('#pose').selectOption({index:2});
  await page.waitForTimeout(200);
  await page.screenshot({path:`${proof}/review-${viewport.width}.png`});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.keyboard.press('Tab');
  expect(errors).toEqual([]);expect(failed).toEqual([]);
});

for(const region of [3,9])for(const webgl of [false,true])
test(`교정 대상 전체 실제 렌더 R${region} ${webgl?'WebGL':'Canvas'}`,async({page})=>{
 test.setTimeout(90000);
 if(webgl)await page.addInitScript(()=>{for(const proto of [WebGLRenderingContext.prototype,WebGL2RenderingContext.prototype]){const get=proto.getExtension;proto.getExtension=function(n:string){return n==='WEBGL_debug_renderer_info'?null:get.call(this,n)}}});
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await seedRegion(page,region,true,undefined,region===3?['icehunter','iceweaver','bowman']:['engineer','gatekeeper','crossbow']);
 await observeScene(page);
 const result=await page.evaluate(async(region)=>{
  const w=window as any,scene=w.regionScene,store=(await w.regionModule('/src/platform/store.ts')).gameStore;
  const {enemyAttack}=await w.regionModule('/src/domain/combat.ts');
  const {BOSS_KITS}=await w.regionModule('/src/domain/boss-melee.ts');
  const run=store.state.run,original=JSON.stringify(run);store.paused=true;scene.scene.pause();
  const targets=run.enemies.filter((e:any)=>region===3?!e.bossId&&e.role==='icehunter':!!e.bossId),records=[];
  for(const reduced of [false,true]){
   scene.reducedMotion=reduced;
   for(const target of targets)for(let d=0;d<8;d++)for(const move of target.bossId?Object.keys(BOSS_KITS[target.bossId].moves):['thrust'])
    for(const state of ['approach','windup','strike','recover'])for(const p of [0,.2,.5,.8,.99]){
     const e={...target,id:9800,move,state,moving:state==='approach',guardTime:0,staggerTime:0,aim:d*Math.PI/4,facing:d*Math.PI/4};
     const attack=enemyAttack(e),spec=attack.melee??{duration:.18,contacts:[0]};
     e.timer=(state==='windup'?attack.windup:state==='recover'?attack.recovery:spec.duration)*(1-p);
     e.strike=state==='strike'?{duration:spec.duration,fromX:e.x,fromY:e.y,toX:e.x,toY:e.y}:undefined;
     scene.motionClock.reset();scene.drawEnemy(e);
     const actor=scene.actors.get(String(e.id)),f=actor.getData('authoredFrame'),bar=actor.getData('healthBar');
     records.push({id:target.bossId??target.role,reduced,d,move,state,p,texture:actor.texture.key,name:f.name,scale:[actor.scaleX,actor.scaleY],origin:[actor.originX,actor.originY],expectedOrigin:[actor.flipX?1-f.footX/f.width:f.footX/f.width,f.footY/f.height],gap:bar.renderedTop-bar.y-bar.height,view:actor.getData('view'),flip:actor.flipX,footDelta:[actor.x-e.x,actor.y-e.y]});
    }
  }
  return {records,renderer:scene.game.renderer.type,unchanged:JSON.stringify(run)===original};
 },region);
 for(const r of result.records){expect(r.scale).toEqual(region===3?[.225,.225]:[.225*1.2,.225*1.2]);expect(r.origin).toEqual(r.expectedOrigin);expect(r.gap).toBeGreaterThanOrEqual(7);expect(r.view).toBe([2,1,0,1,2,3,4,3][r.d]);expect(r.flip).toBe(!![0,0,0,1,1,1,0,0][r.d]);expect(r.texture).not.toBe('__MISSING');}
 expect(result.unchanged).toBe(true);expect(result.renderer).toBe(webgl?2:1);expect(errors).toEqual([]);
 await writeFile(`${proof}/${webgl?'webgl':'canvas'}-R${region}.json`,JSON.stringify({...result,errors},null,2)+'\n');
});
