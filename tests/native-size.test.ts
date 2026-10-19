import {describe,it,expect} from 'vitest';
import snow from '../src/game/snow-family-frames.json';
import zhuge from '../src/game/zhuge-family-frames.json';
import special from '../src/game/three-special-frames.json';
import complete from '../src/game/three-complete-frames.json';
import {regionArtManifest} from '../src/platform/region-art';
describe('reviewed source-group size correction',()=>{
 it('does not change runtime pixel scale or ordinary Snow ready body size on turns',()=>{
  const a=snow.characters.find(a=>a.id==='snowhunter')!;
  expect(a.pixelScale).toBe(.225);
  const heights=a.frames.filter(f=>f.kind==='locomotion'&&f.pose===0).map(f=>f.footY-f.bounds.top);
  // These five READYs have no raised weapon above the body. The previous
  // front/quarter turn varied by almost 30%; a crouched strike is not fitted.
  expect(heights).toHaveLength(5);
  expect(Math.max(...heights)/Math.min(...heights)).toBeLessThan(1.06);
 });
 it('uses the enlarged basic Mukyeon READY at both ends of every special',()=>{
  const base=zhuge.characters.find(a=>a.id==='mukyeon')!.frames.find(f=>f.view===1&&f.kind==='locomotion'&&f.pose===0)!;
  for(const bank of [special,complete])for(const f of bank.characters.find(a=>a.id==='mukyeon')!.frames.filter(f=>f.view===1&&(f.pose===0||f.pose===5))){
   expect([f.texture,f.x,f.y,f.width,f.height,f.footX,f.footY,f.bounds]).toEqual([base.texture,base.x,base.y,base.width,base.height,base.footX,base.footY,base.bounds]);
  }
 });
 it('corrects Zhuge Hyeon fan growth without suppressing weapon extension',()=>{
  const a=special.characters.find(a=>a.id==='zhugehyeon')!;
  const ready=zhuge.characters.find(a=>a.id==='zhugehyeon')!.frames.find(f=>f.view===1&&f.kind==='locomotion'&&f.pose===0)!;
  for(const f of a.frames.filter(f=>f.view===1&&f.move==='fan'))expect((f.footY-f.bounds.top)/(ready.footY-ready.bounds.top)).toBeLessThan(1.09);
  const contact=a.frames.find(f=>f.view===1&&f.move==='fan'&&f.pose===2)!;
  expect(contact.bounds.right-contact.bounds.left).toBeGreaterThan(ready.bounds.right-ready.bounds.left);
 });
 it('all corrections resolve to their own region and padded registered frames',()=>{
  for(const [region,bank]of [[3,snow],[9,zhuge],[9,special],[9,complete]] as const)
   for(const a of bank.characters)for(const f of a.frames){
    if(!f.texture.startsWith('native-size-'))continue;
    expect(a.pixelScale).toBe(.225);
    expect(regionArtManifest(region)[f.texture]).toMatch(/^\/art\/native-size-v1\//);
    expect(regionArtManifest(region===3?9:3)[f.texture]).toBeUndefined();
    expect(Math.min(f.bounds.left,f.bounds.top,f.width-f.bounds.right,f.height-f.bounds.bottom)).toBeGreaterThanOrEqual(32);
   }
 });
});
