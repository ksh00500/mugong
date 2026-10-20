import { expect, it } from 'vitest';
import { emptyGame, startRun, tick } from '../src/domain/game';
import { isBossEnemy } from '../src/domain/boss-resilience';
import { meleeKit } from '../src/domain/boss-melee';
import { hostileDrawingPose, hostileRecoil } from '../src/game/hostile-pose';
import type { ArtId, Enemy } from '../src/domain/model';

const idle = { dx: 0, dy: 0, aim: 0, attack: false, defense: false, ultimate: false };
function fixture(bossId?: string, kind: Enemy['kind'] = bossId ? 'chief' : 'sword') {
  const s = emptyGame();
  startRun(s, '보스 내성 검증', 123);
  const r = s.run!,
    e = r.enemies[0],
    f = r.fighter;
  r.offers = [];
  r.zones = [];
  r.encounterObjects = [];
  r.enemies = [e];
  Object.assign(f, { x: 800, y: 500, arts: [], cooldown: 100, invulnerable: 100 });
  Object.assign(e, {
    bossId,
    kind,
    role: undefined,
    x: 875,
    y: 500,
    hp: 10000,
    maxHp: 10000,
    state: 'windup',
    timer: 0.25,
    skillClock: 0,
    facing: 0,
    aim: 0,
    move: bossId ? meleeKit({ bossId })?.sequence[0] : undefined,
  });
  return { r, e, f };
}
function hit(r: ReturnType<typeof fixture>['r'], art?: ArtId, boosted = false) {
  r.attacks = [
    {
      timer: 0,
      angle: 0,
      damage: 10,
      range: 200,
      arc: 2,
      thrust: false,
      heal: false,
      art,
      boosted,
      variant: 'b',
    },
  ];
  tick(r, idle, 1 / 60);
}

for (let n = 0; n < 40; n++) {
  const id = `${Math.floor(n / 4)}-${(n % 4) + 1}`;
  it(`${id}: 피격·이전 저장의 경직·혼란이 준비 시간을 멈추지 않는다`, () => {
    const { r, e } = fixture(id);
    e.staggerTime = 4;
    e.confused = 4;
    hit(r);
    expect(e.hp).toBeLessThan(10000);
    expect(e.staggerTime).toBe(0);
    expect(e.confused).toBe(0);
    expect(e.state).toBe('windup');
    expect(e.timer).toBeCloseTo(0.25 - 1 / 60);
    for (let i = 0; i < 4; i++) {
      r.projectiles.push({
        x: e.x,
        y: e.y,
        vx: 0,
        vy: 0,
        life: 1,
        friendly: true,
        damage: 1,
        radius: 8,
        hits: [],
      });
      tick(r, idle, 1 / 60);
    }
    expect(e.timer).toBeCloseTo(0.25 - 5 / 60);
    expect(e.staggerTime).toBe(0);
    for (let d = 0; d < 8; d++)
      expect(hostileDrawingPose({ ...e, staggerTime: 4 }, d, 0.01, false, Math.floor(n / 4))).toBe(
        2,
      );
  });
}
it('구버전 chief/captain도 동일한 내성이며 일반·정예 적은 경직된다', () => {
  for (const kind of ['chief', 'captain', 'sword'] as const) {
    const { r, e } = fixture(undefined, kind);
    e.elite = true;
    hit(r);
    expect((e.staggerTime ?? 0) > 0).toBe(kind === 'sword');
    expect(isBossEnemy(e)).toBe(kind !== 'sword');
  }
});
it('끌기·취권 밀기·혼란은 보스를 제외하고 피해와 진법 설치는 유지한다', () => {
  for (const id of [undefined, '4-3'])
    for (const art of ['jegal', 'gaebang'] as const) {
      const { r, e, f } = fixture(id);
      f.arts = [{ id: art, level: 5, gauge: 0, combo: 0, defenseCd: 0, chainTime: 3 }];
      const x = e.x;
      hit(r, art, true);
      expect(e.hp).toBeLessThan(10000);
      if (id) {
        expect(e.x).toBe(x);
        expect(e.confused ?? 0).toBe(0);
      } else {
        expect(e.x).not.toBe(x);
        if (art === 'gaebang') expect(e.confused).toBeGreaterThan(0);
      }
      if (art === 'jegal') expect(r.formations?.length).toBeGreaterThan(0);
    }
});
it('진법 감속은 접근·준비·회수에서 보스에게 적용되지 않는다', () => {
  for (const state of ['approach', 'windup', 'recover'] as const)
    for (const bossId of [undefined, '4-3']) {
      const a = fixture(bossId),
        b = fixture(bossId);
      for (const { e, f } of [a, b]) {
        e.state = state;
        e.timer = state === 'recover' ? 0.1 : 1;
        if (bossId) e.move = 'thrust'; // Quick recovery can reposition; heavy openings stay still.
        f.x = 1200;
      }
      b.f.arts = [{ id: 'jegal', level: 2, gauge: 0, combo: 0, defenseCd: 0 }];
      b.r.formations = [{ x: b.e.x, y: b.e.y, kind: 'ultimate', life: 2, pulse: 1, damage: 0 }];
      const x = a.e.x,
        y = a.e.y;
      tick(a.r, idle, 1 / 60);
      tick(b.r, idle, 1 / 60);
      const distance = (e: Enemy) => Math.hypot(e.x - x, e.y - y);
      expect(distance(a.e)).toBeGreaterThan(0);
      expect(distance(b.e) / distance(a.e)).toBeCloseTo(bossId ? 1 : 0.75);
    }
});
it('독 피해는 보스 내성과 독립이며 피격 반동은 작고 짧다', () => {
  const { r, e } = fixture('4-3');
  Object.assign(e, { poisonStacks: 1, poisonTime: 2, poisonTick: 0, poisonDamage: 4 });
  tick(r, idle, 1 / 60);
  expect(e.hp).toBeLessThan(10000);
  expect(e.staggerTime ?? 0).toBe(0);
  expect(hostileRecoil(e, 0, false, false)).toBe(0.35);
  expect(hostileRecoil(e, 0.1, false, false)).toBe(0);
  expect(hostileRecoil(e, 0, true, false)).toBe(0);
  expect(hostileRecoil(e, 0, false, true)).toBe(0);
  expect(hostileRecoil({ ...e, bossId: undefined, kind: 'sword' }, 0, false, false)).toBe(3);
});
