import { describe, expect, it } from 'vitest';
import { emptyGame, startRun, tick } from '../src/domain/game';
import { enemyAttack, type CombatCue } from '../src/domain/combat';
import { ART_WEAPONS, FIELD, makeWeapon } from '../src/domain/content';
import type { BoundFighter, Enemy, InputFrame } from '../src/domain/model';
import { isGameSave } from '../src/platform/save-validation';

const idle: InputFrame = { dx: 0, dy: 0, aim: 0, attack: false, ultimate: false, defense: false };
function fixture() {
  const state = emptyGame();
  startRun(state, '검증 무인', 123);
  const r = state.run!;
  r.enemies = [
    {
      ...r.enemies[0],
      role: undefined,
      x: r.fighter.x + 60,
      y: r.fighter.y,
      hp: 10000,
      maxHp: 10000,
      xp: 0,
      timer: 100,
    },
  ];
  return { state, r, e: r.enemies[0] };
}
function learn(id: 'huashan' | 'wudang' | 'samja' | 'tianmo') {
  const f = fixture();
  f.r.fighter.items[0] = makeWeapon(ART_WEAPONS[id], f.r.fighter.items[0].id, 'weapon');
  f.r.fighter.arts = [{ id, level: 3, combo: 0, gauge: 0, defenseCd: 0 }];
  (f.r.fighter as BoundFighter).bindings = { [id]: f.r.fighter.items[0].id };
  return f;
}

it('베기 시작이 아닌 실제 접촉 때만 검격과 피해 신호가 발생하고 빗나감은 구별된다', () => {
  const { r, e } = fixture();
  const cues: CombatCue[] = [];
  for (let n = 0; n < 5; n++) tick(r, { ...idle, attack: true }, 1 / 60, (cue) => cues.push(cue));
  expect(cues).toEqual([]);
  expect(e.hp).toBe(10000);
  tick(r, idle, 1 / 60, (cue) => cues.push(cue));
  expect(cues.map((cue) => cue.kind)).toEqual(['strike', 'impact']);
  const impact = cues.find((cue) => cue.kind === 'impact');
  expect(impact).toMatchObject({ target: e.id, amount: 10000 - e.hp, killed: false });
  const miss = fixture();
  miss.e.x += 500;
  const missed: CombatCue[] = [];
  for (let n = 0; n < 6; n++)
    tick(miss.r, { ...idle, attack: true }, 1 / 60, (cue) => missed.push(cue));
  expect(missed.map((cue) => cue.kind)).toEqual(['strike']);
});

it('연출 신호를 구독해도 공격·이동·난수·성장·저장 값이 동일하다', () => {
  const { state } = learn('tianmo');
  const other = structuredClone(state);
  const cues: CombatCue[] = [];
  for (let n = 0; n < 240; n++) {
    const input = { ...idle, attack: n % 3 !== 0, defense: n === 6, dx: n % 60 < 30 ? 1 : -1 };
    tick(state.run!, input, 1 / 60, (cue) => cues.push(cue));
    tick(other.run!, input, 1 / 60);
  }
  expect(cues.some((cue) => cue.kind === 'impact')).toBe(true);
  expect(state).toEqual(other);
  expect(isGameSave(state)).toBe(true);
});

it('적 처치의 마지막 피해와 무인 사망도 한 번만 신호를 남긴다', () => {
  const { r, e } = fixture();
  e.hp = 1;
  const cues: CombatCue[] = [];
  for (let n = 0; n < 12; n++) tick(r, { ...idle, attack: true }, 1 / 60, (cue) => cues.push(cue));
  expect(cues.filter((cue) => cue.kind === 'impact')).toEqual([
    expect.objectContaining({ amount: 1, killed: true, target: e.id }),
  ]);
  const fatal = fixture();
  fatal.r.fighter.hp = 1;
  Object.assign(fatal.e, { state: 'windup', timer: 0.001, aim: Math.PI });
  const hurt: CombatCue[] = [];
  tick(fatal.r, idle, 1 / 60, (cue) => hurt.push(cue));
  for (let n = 0; n < 6; n++) tick(fatal.r, idle, 1 / 60, (cue) => hurt.push(cue));
  expect(hurt).toContainEqual(
    expect.objectContaining({ kind: 'impact', target: 'hero', amount: 1, killed: true }),
  );
});

it('반격·방어·회피와 실제 흡혈 회복을 구별하고 실패한 방어에는 성공 표시가 없다', () => {
  for (const [id, expected] of [
    ['wudang', 'counter'],
    ['samja', 'block'],
    ['huashan', 'evade'],
  ] as const) {
    const { r, e } = learn(id);
    Object.assign(e, { state: 'windup', timer: 0.001, aim: Math.PI });
    const cues: CombatCue[] = [];
    tick(r, { ...idle, defense: true }, 1 / 60, (cue) => cues.push(cue));
    for (let n = 0; n < 6; n++) tick(r, idle, 1 / 60, (cue) => cues.push(cue));
    expect(cues).toContainEqual(expect.objectContaining({ kind: 'defense', action: expected }));
    if (id === 'wudang' || id === 'huashan') expect(r.fighter.hp).toBe(120);
    if (id === 'huashan')
      expect(cues).toContainEqual(expect.objectContaining({ y: 505, fromY: 650 }));
    const failed: CombatCue[] = [];
    tick(r, { ...idle, defense: true }, 1 / 60, (cue) => failed.push(cue));
    expect(failed.filter((cue) => cue.kind === 'defense')).toEqual([]);
  }
  const { r } = learn('tianmo');
  r.fighter.hp = 60;
  Object.assign(r.fighter.arts[0], { rally: 20, rallyTime: 4 });
  const healing: CombatCue[] = [];
  for (let n = 0; n < 8; n++)
    tick(r, { ...idle, defense: n === 0 }, 1 / 60, (cue) => healing.push(cue));
  expect(healing).toContainEqual(expect.objectContaining({ kind: 'defense', action: 'leech' }));
});

describe('예고와 실제 적 공격이 같은 범위·발사 패턴을 쓴다', () => {
  for (const kind of ['sword', 'spear', 'chief', 'archer', 'captain'] as const)
    for (const elite of [false, true])
      it(`${kind} / elite ${elite}: 사거리 경계와 추가 패턴`, () => {
        const { r, e } = fixture();
        Object.assign(e, {
          kind,
          elite,
          pattern: 5,
          x: 850,
          y: 600,
          aim: 0,
          state: 'windup',
          timer: 0.001,
        });
        const profile = enemyAttack(e);
        if (profile.ranged) {
          r.fighter.x = FIELD.left;
          r.fighter.y = FIELD.bottom;
          tick(r, idle, 1 / 60);
          expect(r.projectiles).toHaveLength(profile.shots.length);
          for (const [n, shot] of profile.shots.entries()) {
            expect(r.projectiles[n].vx).toBeCloseTo(Math.cos(shot.angle) * shot.speed);
            expect(r.projectiles[n].vy).toBeCloseTo(Math.sin(shot.angle) * shot.speed);
          }
        } else {
          const saved = structuredClone(r);
          r.fighter.x = profile.origin.x + profile.range + 19;
          r.fighter.y = profile.origin.y;
          tick(r, idle, 1 / 60);
          expect(r.fighter.hp).toBe(120);
          for (let n = 0; n < 35; n++) {
            const before = e.state;
            tick(r, idle, 1 / 60);
            if (before === 'strike' && e.state === 'recover')
              expect({ x: e.x, y: e.y }).toEqual(profile.origin);
          }
          expect(r.fighter.hp).toBeLessThan(120);
          saved.fighter.x = profile.origin.x + profile.range + 21;
          saved.fighter.y = profile.origin.y;
          tick(saved, idle, 1 / 60);
          for (let n = 0; n < 35; n++) tick(saved, idle, 1 / 60);
          expect(saved.fighter.hp).toBe(120);
        }
      });
  it('벽에 막힌 돌진의 도착점도 실제 위치와 같다', () => {
    const { r, e } = fixture();
    Object.assign(e, {
      kind: 'chief',
      elite: true,
      pattern: 1,
      x: FIELD.right - 10,
      y: 500,
      aim: 0,
      state: 'windup',
      timer: 0.001,
    });
    const profile = enemyAttack(e as Enemy);
    expect(profile.origin.x).toBe(FIELD.right);
    tick(r, idle, 1 / 60);
    for (let n = 0; n < 12; n++) tick(r, idle, 1 / 60);
    expect(e.x).toBe(profile.origin.x);
  });
});
