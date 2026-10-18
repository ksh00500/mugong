import { expect, it } from 'vitest';
import { MotionClock } from '../src/game/directional-motion';
import { emptyGame, startRun, tick } from '../src/domain/game';
import { steerEnemy, tacticalMovement, turnToward } from '../src/domain/enemy-tactics';
import { enemyAttack } from '../src/domain/combat';

const input={dx:0,dy:0,aim:0,attack:false,ultimate:false,defense:false};
function fixture() {
  const state=emptyGame();startRun(state,'이동 검증',123);
  const r=state.run!,e=r.enemies[0];r.enemies=[e];r.zones=[];r.encounterObjects=[];
  Object.assign(e,{x:800,y:500,state:'recover',timer:1,role:'bowman',kind:'archer',bossId:undefined});
  e.timer=enemyAttack(e).recovery-.2;
  Object.assign(r.fighter,{x:1100,y:500});return {r,e};
}
for(const fps of [60,120,144]) it(`${fps}Hz recovery uses simulation movement on every render frame`,()=>{
  const {r,e}=fixture();const clock=new MotionClock();let accumulator=0,previous=false,transitions=0;
  const states:boolean[]=[];
  for(let frame=0;frame<fps*.25;frame++) {
    accumulator+=1/fps;
    while(accumulator>=1/60-1e-9) {tick(r,input,1/60);accumulator-=1/60;}
    const moved=e.moving??false;
    if(frame>0 && moved!==previous)transitions++;
    states.push(moved);previous=moved;
    clock.sample(String(e.id),e.x,e.y,e.facing,frame/fps,moved);
  }
  expect(states.some(Boolean)).toBe(true);
  expect(transitions).toBeLessThanOrEqual(1);
});
it('stationary anticipation and stagger really stop walking',()=>{
  const {r,e}=fixture();Object.assign(e,{state:'windup',timer:.1,moving:true});tick(r,input,1/60);expect(e.moving).toBe(false);
  Object.assign(e,{state:'recover',timer:1,staggerTime:.09,moving:true});tick(r,input,1/60);expect(e.moving).toBe(false);
});
it('measures abrupt tactical orbit reversal and smooths only steering, preserving speed bounds',()=>{
  const {r,e}=fixture();e.id=2;
  const boundary=2.4-e.id*.37;r.elapsed=boundary-.001;
  const before=tacticalMovement(r,e,r.fighter,enemyAttack(e));
  r.elapsed=boundary+.001;const after=tacticalMovement(r,e,r.fighter,enemyAttack(e));
  expect(before.y*after.y).toBeLessThan(0);
  const velocityBefore=steerEnemy(e,before,1/60);
  const velocityAfter=steerEnemy(e,after,1/60);
  expect(Math.hypot(velocityAfter.x-velocityBefore.x,velocityAfter.y-velocityBefore.y)).toBeLessThan(Math.hypot(after.x-before.x,after.y-before.y)*.25);
  expect(Math.hypot(velocityAfter.x,velocityAfter.y)).toBeLessThanOrEqual(Math.hypot(after.x,after.y)+.001);
  const clone=structuredClone(e);
  expect(steerEnemy(clone,after,1/60)).toEqual(steerEnemy(e,after,1/60));
});
it('facing turns along the short arc at a bounded rate',()=>{
  expect(turnToward(0,Math.PI,1/60)).toBeCloseTo(1/6);
  expect(turnToward(Math.PI-.02,-Math.PI+.02,1/60)).toBeCloseTo(Math.PI+.02);
});
