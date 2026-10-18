import { describe, expect, it } from 'vitest';
import { COMBAT_SOUNDS, fieldSound, weaponSound, projectileSound, synthesizeCombatSound } from '../src/platform/combat-sounds';
import { PoseTransition } from '../src/game/pose-transition';
import { sampleRig } from '../src/game/directional-motion';
import { emptyGame, command, tick } from '../src/domain/game';
import { isGameSave } from '../src/platform/save-validation';
import type { CombatCue } from '../src/domain/combat';

describe('presentation palette and event wiring', () => {
  it('preserves a recruited portrait through save/reload and rejects invalid portrait indices', () => {
    const state = emptyGame(); command(state, {type:'recruit'}, 1000);
    const appearances = state.family.recruitment!.candidates.map(c=>c.appearance);
    expect(new Set(appearances).size).toBe(3);
    const id=state.family.recruitment!.candidates[2].id;
    expect(command(state,{type:'startRecruit',id,name:'모집 검사'})).toBe(true);
    expect(state.run!.fighter.appearance).toBe(appearances[2]);
    expect(isGameSave(JSON.parse(JSON.stringify(state)))).toBe(true);
    (state.run!.fighter as any).appearance=10;
    expect(isGameSave(state)).toBe(false);
  });
  it('plays cold impact at the actual blast, including when the player is outside', () => {
    const state=emptyGame(); command(state,{type:'start',name:'빙탄 검사',seed:123});
    const r=state.run!;r.offers=[];r.zones=[{id:77,kind:'cold',x:100,y:100,radius:80,warning:.01,life:2,pulse:1,impactDamage:10}];
    const cues:CombatCue[]=[];
    tick(r,{dx:0,dy:0,aim:0,attack:false,ultimate:false,defense:false},1/60,c=>cues.push(c));
    expect(cues.filter(c=>c.kind==='field' && c.action==='cold')).toHaveLength(1);
    tick(r,{dx:0,dy:0,aim:0,attack:false,ultimate:false,defense:false},1/60,c=>cues.push(c));
    expect(cues.filter(c=>c.kind==='field' && c.action==='cold')).toHaveLength(1);
  });
  it('gives each sound different samples, with finite amplitude and headroom', () => {
    const fingerprints = new Set<string>();
    for (const kind of Object.keys(COMBAT_SOUNDS) as (keyof typeof COMBAT_SOUNDS)[]) {
      const samples=synthesizeCombatSound(kind,24000);
      expect(samples.length).toBeGreaterThan(2000);
      expect([...samples].every(n=>Number.isFinite(n)&&Math.abs(n)<=.36)).toBe(true);
      expect(samples.some(n=>Math.abs(n)>.02)).toBe(true);
      fingerprints.add(Array.from(samples.slice(200,216)).join(','));
    }
    expect(fingerprints.size).toBe(Object.keys(COMBAT_SOUNDS).length);
    expect(new Set(['sword','staff','gauntlet','fan','dart'].map(s=>weaponSound(s as any))).size).toBe(5);
    expect(fieldSound('cold')).not.toBe(fieldSound('fire'));
    expect(projectileSound('arrow')).not.toBe(projectileSound('steel-needle'));
  });
  it('smooths an action transition consistently across frame rates and responds to hurt immediately', () => {
    for (const hz of [60,120,144]) {
      const clock=new PoseTransition(),idle=sampleRig('idle',0,0,0),ready=sampleRig('windup',1,0,0);
      clock.sample('actor','idle',idle,0);
      expect(clock.sample('actor','windup',ready,1)).toEqual(idle);
      for(let n=1;n<=Math.ceil(.06*hz);n++) clock.sample('actor','windup',ready,1+n/hz);
      expect(clock.sample('actor','windup',ready,1.1)).toEqual(ready);
      const hurt=sampleRig('hurt',.5,0,0);
      expect(clock.sample('actor','hurt',hurt,1.11)).toEqual(hurt);
      expect(clock.sample('actor','idle',idle,1.12,true)).toEqual(idle);
    }
  });
});
