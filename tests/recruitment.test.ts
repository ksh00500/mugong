import { describe, it, expect } from 'vitest';
import { emptyGame, command, grantXp } from '../src/domain/game';
import { recruitmentAction, recruitmentView, RECRUIT_INTERVAL } from '../src/domain/recruitment';
import { maximumHp } from '../src/domain/content';
import { isGameSave } from '../src/platform/save-validation';

describe('recruitment', () => {
  it('charges once, retains three candidates, and consumes the draft only after selection', () => {
    const state = emptyGame();
    expect(command(state, {type:'recruit'}, 1000)).toBe(true);
    const draft = structuredClone(state.family.recruitment!);
    expect(draft.tickets).toBe(2);
    expect(draft.candidates).toHaveLength(3);
    expect(command(state, {type:'recruit'}, 1001)).toBe(false);
    expect(state.family.recruitment).toEqual(draft);
    expect(isGameSave(state)).toBe(true);
    expect(command(state, {type:'startRecruit',id:'wrong',name:'검객'})).toBe(false);
    expect(command(state, {type:'startRecruit',id:draft.candidates[1].id,name:'검객'})).toBe(true);
    expect(state.run!.fighter.growth).toEqual(draft.candidates[1].growth);
    expect(state.family.recruitment!.candidates).toHaveLength(0);
    expect(command(state, {type:'startRecruit',id:draft.candidates[1].id,name:'검객'})).toBe(false);
    grantXp(state.run!, 20);
    expect(maximumHp(state.run!.fighter)).toBe(120 + Math.round(10 * draft.candidates[1].growth.constitution));
    expect(isGameSave(state)).toBe(true);
  });
  it('refills hourly, preserves partial time, caps offline replenishment and rejects clock rollback', () => {
    const family = emptyGame().family;
    recruitmentAction(family,'recruit',1000);
    family.recruitment!.candidates=[];
    recruitmentAction(family,'recruit',1000 + RECRUIT_INTERVAL / 2);
    expect(recruitmentView(family,1000 + RECRUIT_INTERVAL).tickets).toBe(2);
    expect(recruitmentView(family,0).tickets).toBe(1);
    expect(recruitmentView(family,1000 + RECRUIT_INTERVAL * 20).tickets).toBe(3);
  });
  it('charges currency only when a ticket fits; basic warrior cannot discard a paid draft', () => {
    const state=emptyGame(); state.family.silver=100;
    expect(command(state,{type:'buyRecruitTicket'},1000)).toBe(false);
    expect(state.family.silver).toBe(100);
    command(state,{type:'recruit'},1000);
    expect(command(state,{type:'buyRecruitTicket'},1001)).toBe(true);
    expect(state.family.silver).toBe(0);
    expect(command(state,{type:'buyRecruitTicket'},1002)).toBe(false);
    state.family.recruitment!.tickets=0;
    expect(command(state,{type:'startBasic',name:'기본'},1002)).toBe(false);
    state.family.recruitment!.candidates=[];
    expect(command(state,{type:'startBasic',name:'기본'},1002)).toBe(true);
    expect(state.run!.fighter.growth).toEqual({constitution:1,strength:1,agility:1,inner:1});
  });
});
