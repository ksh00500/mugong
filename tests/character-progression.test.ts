import { describe, expect, it } from 'vitest';
import { emptyGame, startRun, command, grantXp, rollOffers, tick, spawnWave } from '../src/domain/game';
import { AUGMENTS, TRAITS, characterStats, innateHit, pendingChoices } from '../src/domain/character';
import { maximumHp, xpThreshold, makeWeapon } from '../src/domain/content';
import { supportStats } from '../src/domain/support';
import { techniqueStats } from '../src/domain/techniques';
import { useItem } from '../src/domain/inventory';
import { decodeCurrentSave } from '../src/platform/save-migrations';
import { isGameSave } from '../src/platform/save-validation';
import type { BoundFighter } from '../src/domain/model';
import { messages } from '../src/platform/messages';

const idle = {dx:0,dy:0,aim:0,attack:false,ultimate:false,defense:false};
function fixture(innate?: keyof typeof TRAITS) {
  const state=emptyGame(); startRun(state,'성장 검사',123);
  const r=state.run!, f=r.fighter;
  Object.assign(f,{progressionVersion:2,growth:{constitution:1,strength:1,agility:1,inner:1},innate,augments:[],augmentOffers:[],trainingPoints:0,traitState:{},x:900,y:500});
  f.arts=[{id:'huashan',level:1,gauge:0,combo:0,defenseCd:0}];
  (f as BoundFighter).bindings={huashan:f.items[0].id,wudang:f.items[0].id};
  r.offers=[]; r.zones=[];r.encounterObjects=[];
  r.regionRoute=['독무곡','천검산','설산','죽림'];
  r.enemies=[{...r.enemies[0],id:50,hp:10000,maxHp:10000,x:1500,y:700,xp:0,state:'windup',timer:100}];
  return {state,r,f};
}
function bolt(r: ReturnType<typeof fixture>['r'], damage=500) {
  r.projectiles=[{x:r.fighter.x,y:r.fighter.y,vx:0,vy:0,friendly:false,damage,radius:12,hits:[],life:1}];
  tick(r,idle,1/60);
}

describe('character progression', () => {
  it('separates the four abilities and grants augments without martial training on level-up', () => {
    const {r,f}=fixture();f.growth={constitution:1,strength:1.3,agility:.9,inner:2};
    grantXp(r,xpThreshold(10));
    expect(characterStats(f)).toMatchObject({constitution:100,strength:65,agility:27,inner:100});
    expect(f.hp).toBe(220);expect(r.offers).toEqual([]);expect(f.augmentOffers).toHaveLength(3);
    const original=techniqueStats('huashan',5);
    expect(techniqueStats('huashan',5,f).ultimateDamage).toBeCloseTo(original.ultimateDamage*1.4);
  });
  it('earns training on wave clear, can save it, and spends the actual next-rank cost', () => {
    const {state,r,f}=fixture();r.enemies=[];
    tick(r,idle,1/60);
    expect(f.trainingPoints).toBe(1);expect(r.phase).toBe('loot');expect(r.offers.length).toBeGreaterThan(0);
    expect(command(state,{type:'deferTraining'})).toBe(true);expect(f.trainingPoints).toBe(1);
    grantXp(r,20);expect(r.offers).toEqual([]);
    expect(command(state,{type:'openTraining'})).toBe(true);expect(r.offers.length).toBeGreaterThan(0);
    command(state,{type:'deferTraining'});
    f.trainingPoints=4;f.arts[0].level=4;
    f.arts.push(...(['wudang','tianmo','samja'] as const).map(id=>({id,level:5,gauge:0,combo:0,defenseCd:0})));
    rollOffers(r);
    expect(command(state,{type:'choose',offer:{art:'huashan',type:'upgrade'}})).toBe(true);
    expect(f.arts[0].level).toBe(5);expect(f.trainingPoints).toBe(0);expect(isGameSave(state)).toBe(true);
  });
  it('queues all earned augment milestones, retains offers on save, and allows only three unique choices', () => {
    const {state,r,f}=fixture();grantXp(r,xpThreshold(50));
    const clone=decodeCurrentSave(state)!;expect(clone.run!.fighter.augmentOffers).toEqual(f.augmentOffers);
    for(let n=0;n<3;n++) expect(command(state,{type:'chooseAugment',id:f.augmentOffers![0]})).toBe(true);
    expect(f.augments).toHaveLength(3);expect(new Set(f.augments).size).toBe(3);expect(pendingChoices(r)).toBe(false);
    expect(command(state,{type:'chooseAugment',id:'vigor'})).toBe(false);expect(isGameSave(state)).toBe(true);
  });
  it('preserves legacy HP, equipment and earned progression with an idempotent migration', () => {
    const state=emptyGame();startRun(state,'기존',123);const f=state.run!.fighter;f.level=20;f.spent=state.run!.spent=20;f.xp=xpThreshold(20);f.hp=73;
    const before=structuredClone(state);const decoded=decodeCurrentSave(state)!;
    expect(decoded.run!.fighter.hp).toBe(73);expect(maximumHp(decoded.run!.fighter)).toBe(120);
    expect(decoded.run!.fighter.items).toEqual(f.items);expect(decoded.run!.fighter.level).toBe(20);
    expect(decoded.run!.fighter.augmentOffers).toHaveLength(3);expect(state).toEqual(before);
    expect(decodeCurrentSave(decoded)).toEqual(decoded);
  });
  it('uses identical HP growth when reading a manual in the lobby', () => {
    const {state,r,f}=fixture();f.level=9;f.xp=xpThreshold(9);f.hp=150;state.run=null;state.family.roster=[f];state.selectedId=f.id;
    const manual={...f.items[1],id:'manual',kind:'manual' as const,power:xpThreshold(10)-f.xp,count:1};f.items.push(manual);
    expect(command(state,{type:'use',id:'manual'})).toBe(true);expect(f.level).toBe(10);expect(f.hp).toBe(160);expect(f.augmentOffers).toHaveLength(3);
    expect(isGameSave(state)).toBe(true);
  });
  it('preserves higher-rank Samja lobby offers and spends their training cost after migration', () => {
    const state=emptyGame();startRun(state,'삼재 이전',123);const f=state.run!.fighter;
    f.level=20;f.spent=19;f.xp=xpThreshold(20);
    f.arts=(['samja','huashan','wudang','tianmo'] as const).map(id=>({id,level:id==='samja'?7:5,gauge:0,combo:0,defenseCd:0}));
    state.run=null;state.family.roster=[f];state.selectedId=f.id;
    state.family.training={fighterId:f.id,seed:123,offers:[{art:'samja',type:'upgrade'}]};
    const migrated=decodeCurrentSave(state)!;
    expect(migrated).not.toBeNull();expect(migrated.family.training!.offers).toEqual([{art:'samja',type:'upgrade'}]);
    expect(migrated.family.roster[0].arts[0].level).toBe(7);
    expect(command(migrated,{type:'choose',offer:{art:'samja',type:'upgrade'}})).toBe(true);
    expect(migrated.family.roster[0].arts[0].level).toBe(8);
    expect(migrated.family.roster[0].trainingPoints).toBe(0);
    expect(isGameSave(migrated)).toBe(true);
  });
  it('Samja trains through ten stars, other arts cap at five, and its ultimate opens at eight', () => {
    const {r,f}=fixture();f.arts=['samja','huashan','wudang','tianmo'].map(id=>({id:id as 'samja'|'huashan'|'wudang'|'tianmo',level:5,gauge:100,combo:0,defenseCd:0}));f.trainingPoints=20;
    rollOffers(r);expect(r.offers.some(o=>o.art==='samja')).toBe(true);
    expect(techniqueStats('samja',5).attackInterval).toBe(.43); // Base, before the other capped arts' passives.
    expect(techniqueStats('samja',5,f).ultimateLevel).toBe(8);
    f.arts[0].level=10;r.offers=[];rollOffers(r);
    expect(r.offers.some(o=>o.art==='samja')).toBe(false);
  });
  it('restores actual sword-wave at nine and enemy-directed flying blade at ten, never at five', () => {
    for (const level of [5, 8, 9, 10]) {
      const {r,f}=fixture();f.arts=[{id:'samja',level,gauge:0,combo:0,defenseCd:0}];
      (f as BoundFighter).bindings={samja:f.items[0].id};
      Object.assign(r.enemies[0],{x:f.x,y:f.y+400});
      tick(r,{...idle,aim:0,attack:true},1/60);
      for(let n=0;n<8;n++)tick(r,idle,1/60);
      const swords=r.projectiles.filter(p=>p.art==='samja');
      if(level<9)expect(swords).toHaveLength(0);
      else {
        expect(swords).toHaveLength(1);
        expect(swords[0].level).toBe(level);
        if(level===9)expect(swords[0].vx).toBeGreaterThan(600);
        else expect(swords[0].vy).toBeGreaterThan(600);
      }
    }
  });
  it('spends ranks five through nine without stopping at the former five-star cap', () => {
    const {state,r,f}=fixture();
    f.arts=(['samja','huashan','wudang','tianmo'] as const).map(id=>({id,level:5,gauge:0,combo:0,defenseCd:0}));
    f.trainingPoints=35;
    for(let level=5;level<10;level++) {
      rollOffers(r);
      expect(r.offers).toEqual([{art:'samja',type:'upgrade'}]);
      const before=f.trainingPoints!;
      expect(command(state,{type:'choose',offer:r.offers[0]})).toBe(true);
      expect(f.arts[0].level).toBe(level+1);
      expect(f.trainingPoints).toBe(before-level);
      expect(isGameSave(state)).toBe(true);
    }
    expect(f.trainingPoints).toBe(0);
  });
});

describe('all ten innate traits', () => {
  it('unyielding survives only once and resets on a new battle', () => {
    const {r,f}=fixture('unyielding');bolt(r);expect(f.hp).toBe(1);expect(f.traitState!.survived).toBe(true);
    f.invulnerable=0;bolt(r);expect(r.phase).toBe('dead');expect(f.hp).toBe(0);
    f.hp=120;r.wave=2;spawnWave(r);expect(f.traitState!.survived).toBeUndefined();
  });
  it('gambler boosts an actual queued basic attack only at low health', () => {
    const high=fixture('gambler'), low=fixture('gambler');low.f.hp=30;
    tick(high.r,{...idle,attack:true},1/60);tick(low.r,{...idle,attack:true},1/60);
    expect(low.r.attacks[0].damage/high.r.attacks[0].damage).toBeCloseTo(1.2);
  });
  it('calm requires five undamaged seconds and resets on damage', () => {
    const {r,f}=fixture('calm');f.traitState={untouched:5};expect(supportStats(f).gaugeFactor).toBe(1.2);
    bolt(r,5);expect(supportStats(f).gaugeFactor).toBe(1);
  });
  it('quickhands boosts one attack and blocks repeated switch exploitation', () => {
    const {state,r,f}=fixture('quickhands');f.arts.push({...f.arts[0],id:'wudang'});
    expect(command(state,{type:'switch',delta:1})).toBe(true);expect(f.traitState!.attackBoost).toBe(.25);
    tick(r,{...idle,attack:true},1/60);expect(f.traitState!.attackBoost).toBe(0);
    f.actionTime=0;expect(command(state,{type:'switch',delta:1})).toBe(true);expect(f.traitState!.attackBoost).toBe(0);
  });
  it('counter grants a boost after a successful counter, not a normal hit', () => {
    const {r,f}=fixture('counter');f.arts[0].id='wudang';f.guard=.3;bolt(r,10);
    expect(f.hp).toBe(120);expect(f.traitState!.attackBoost).toBe(.35);
  });
  it('flexible grants extra stagger after a real dodge', () => {
    const {r,f}=fixture('flexible');tick(r,{...idle,defense:true},1/60);
    expect(f.traitState!.staggerBoost).toBe(.12);
    f.invulnerable=0;f.cooldown=f.actionTime=0;
    Object.assign(r.enemies[0],{x:f.x+70,y:f.y,state:'windup',timer:100});
    tick(r,{...idle,attack:true},1/60);for(let n=0;n<8;n++)tick(r,idle,1/60);
    expect(f.traitState!.staggerBoost).toBe(0);
  });
  it('focus rewards separate consecutive attacks, not multiple pellets of one volley', () => {
    const {f}=fixture('focus');f.attackSeq=1;expect(innateHit(f,50)).toBe(1);expect(innateHit(f,50)).toBe(1);
    f.attackSeq=2;expect(innateHit(f,50)).toBe(1);f.attackSeq=3;expect(innateHit(f,50)).toBe(1.15);
    f.attackSeq=4;expect(innateHit(f,51)).toBe(1);
  });
  it('momentum applies and expires after a kill', () => {
    const {r,f}=fixture('momentum');Object.assign(r.enemies[0],{x:f.x+70,y:f.y,hp:1});
    tick(r,{...idle,attack:true},1/60);for(let n=0;n<8;n++)tick(r,idle,1/60);
    expect(supportStats(f).movementFactor).toBe(1.15);
  });
  it('herbal modifies real medicine consumption', () => {
    const {f}=fixture('herbal');f.hp=30;const medicine=f.items[1];const power=medicine.power;
    expect(useItem(f,medicine)).toBe(true);expect(f.hp).toBe(30+power*1.25);
  });
  it('circulation heals only when the ultimate actually activates', () => {
    const {r,f}=fixture('circulation');f.arts[0].level=5;f.hp=60;
    tick(r,{...idle,ultimate:true},1/60);expect(f.hp).toBe(60);
    f.arts[0].gauge=100;tick(r,{...idle,ultimate:true},1/60);expect(f.hp).toBe(66);
  });
});

it('each growth augment has an implemented effect and translated descriptions', () => {
  const {f}=fixture();f.augments=['vigor'];expect(maximumHp(f)).toBe(180);
  f.augments=['might'];expect(characterStats(f).strength).toBe(45);
  f.augments=['swift'];expect(characterStats(f).agility).toBe(20);
  f.augments=['reservoir'];expect(techniqueStats('huashan',5,f).ultimateDamage).toBeGreaterThan(80);
  f.augments=['iron'];expect(supportStats(f).incomingDamageFactor).toBe(.9);
  f.augments=['tempo'];expect(supportStats(f).attackIntervalFactor).toBe(.9);
  f.augments=['resolve'];expect(supportStats(f).defenseCooldownFactor).toBe(.85);
  f.augments=['medicine'];f.hp=30;const medicine=f.items[1],power=medicine.power;useItem(f,medicine);expect(f.hp).toBe(30+power*1.25);
  expect(Object.keys(AUGMENTS)).toHaveLength(8);
  for (const definition of [...Object.values(TRAITS),...Object.values(AUGMENTS)])
    for(const text of definition) expect(messages[text]?.every(value=>value.length>0)).toBe(true);
});
