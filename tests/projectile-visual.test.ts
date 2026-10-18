import { describe, expect, it } from 'vitest';
import { ART_WEAPONS, makeWeapon } from '../src/domain/content';
import { emptyGame, startRun, tick } from '../src/domain/game';
import { makeLootItem } from '../src/domain/items';
import type { ArtId, BoundFighter, InputFrame, Projectile } from '../src/domain/model';
import {
  projectileVisual,
  PROJECTILE_VISUALS,
  HOSTILE_PROJECTILE_FRAMES,
  hostileProjectileVisual,
} from '../src/domain/projectile-visual';
import { isGameSave } from '../src/platform/save-validation';
import frames from '../src/platform/projectile-frames.json';

const idle: InputFrame = { dx: 0, dy: 0, aim: 0, attack: false, defense: false, ultimate: false };
function shot(art: ArtId, level = 1, tier = 0) {
  const state = emptyGame();
  startRun(state, '투사체 검증', 123);
  const r = state.run!,
    f = r.fighter as BoundFighter;
  f.level = f.spent = r.spent = 16;
  f.arts = [{ id: art, level, gauge: 0, combo: 0, defenseCd: 0 }];
  f.items = [makeLootItem(`weapon-${ART_WEAPONS[art]}-${tier}`, 'weapon', 'weapon')];
  f.bindings = { [art]: 'weapon' };
  r.offers = [];
  r.enemies = [
    {
      ...r.enemies[0],
      role: undefined,
      x: f.x + 500,
      y: f.y,
      hp: 10000,
      maxHp: 10000,
      xp: 0,
      state: 'recover',
      timer: 100,
    },
  ];
  tick(r, { ...idle, attack: true }, 1 / 60);
  for (let n = 0; n < 8; n++) tick(r, idle, 1 / 60);
  return { state, r, f };
}
describe('전용 투사체를 실제 공격에 연결', () => {
  for (const [tier, visual] of [
    [0, 'bronze-dart'],
    [1, 'steel-needle'],
    [2, 'jade-needle'],
  ] as const)
    it(`당문 ${tier}등급의 무기가 ${visual}로 발사되고 비행 중 바뀌지 않는다`, () => {
      const { state, r, f } = shot('tang', 1, tier);
      expect(r.projectiles).toHaveLength(1);
      const p = r.projectiles[0],
        before = structuredClone(p);
      expect(p.visual).toBe(visual);
      f.items.push({ ...makeWeapon('fan', 'fan', 'weapon'), x: 2 });
      f.arts.push({ id: 'jegal', level: 1, gauge: 0, combo: 0, defenseCd: 0 });
      f.bindings!.jegal = 'fan';
      f.active = 1;
      tick(r, idle, 1 / 60);
      expect(p.x).toBeGreaterThan(before.x);
      expect(projectileVisual(p)).toBe(visual);
      expect(p.radius).toBe(12);
      expect(isGameSave(structuredClone(state))).toBe(true);
    });
  it('부채·검기·이기어검을 구분하고 공격 판정은 유지한다', () => {
    const fan = shot('jegal'),
      qi = shot('samja', 9),
      sword = shot('samja', 10);
    expect(fan.r.projectiles[0].visual).toBe('wind-blade');
    expect(qi.r.projectiles[0].visual).toBe('sword-wave');
    expect(sword.r.projectiles[0].visual).toBe('flying-sword');
    for (const sample of [fan, qi, sword]) {
      expect(sample.r.projectiles[0].radius).toBe(22);
      expect(sample.r.projectiles[0].damage).toBeGreaterThan(0);
      expect(isGameSave(sample.state)).toBe(true);
    }
    expect(shot('huashan').r.projectiles).toEqual([]);
  });
  it('삼재 궁극기의 추가 검은 무공 규칙을 변경하지 않고 전용 그림을 갖는다', () => {
    const { r, f } = shot('samja', 10);
    r.projectiles = [];
    f.arts[0].gauge = 100;
    f.cooldown = 0;
    tick(r, { ...idle, ultimate: true }, 1 / 60);
    expect(r.projectiles.length).toBeGreaterThan(0);
    expect(
      r.projectiles.every(
        (p) => p.visual === 'flying-sword' && p.art === undefined && p.damage === 90,
      ),
    ).toBe(true);
  });
  it('구형 저장의 암기·풍인·회전 칼날도 호환되고 잘못된 신규 값은 거부한다', () => {
    const { state, r } = shot('tang');
    const p = r.projectiles[0];
    delete p.visual;
    expect(projectileVisual(p)).toBe('steel-needle');
    expect(projectileVisual({ ...p, art: 'jegal' })).toBe('wind-blade');
    expect(projectileVisual({ ...p, friendly: false, returnAt: 1 })).toBe('returning-blade');
    expect(isGameSave(state)).toBe(true);
    (p as Projectile & { visual: unknown }).visual = 'invalid' as never;
    expect(isGameSave(state)).toBe(false);
  });
  it('여덟 그림의 프레임은 겹치지 않고 이미지 안에 있다', () => {
    expect(Object.keys(frames).sort()).toEqual(
      PROJECTILE_VISUALS.filter(
        (v) => v !== 'stone' && !(v in HOSTILE_PROJECTILE_FRAMES) && v !== 'palm-wave',
      ).sort(),
    );
    const rects = Object.values(frames);
    for (const [x, y, w, h] of rects) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x + w).toBeLessThanOrEqual(1774);
      expect(y + h).toBeLessThanOrEqual(887);
    }
    for (let i = 0; i < rects.length; i++)
      for (let j = i + 1; j < rects.length; j++) {
        const [x, y, w, h] = rects[i],
          [a, b, c, d] = rects[j];
        expect(
          Math.min(x + w, a + c) <= Math.max(x, a) || Math.min(y + h, b + d) <= Math.max(y, b),
        ).toBe(true);
      }
  });
  it('각 지역의 원거리 적이 자기 무기에 맞는 투사체를 실제 발사한다', () => {
    for (const [region, visual] of [
      ['청하현', 'arrow'],
      ['독무곡', 'jade-needle'],
      ['천검산', 'sword-wave'],
      ['폐사', 'stone'],
      ['죽림', 'steel-needle'],
    ] as const) {
      const { r } = shot('tang');
      r.projectiles = [];
      r.regionRoute = [region, '서역사막', '혈마전', '팔진고성'];
      Object.assign(r.enemies[0], {
        kind: 'archer',
        bossId: undefined,
        state: 'windup',
        timer: 0,
        aim: Math.PI,
      });
      tick(r, idle, 1 / 60);
      expect(r.projectiles).toHaveLength(1);
      expect(r.projectiles[0]).toMatchObject({ friendly: false, visual, radius: 12 });
    }
    const { r } = shot('tang');
    expect(hostileProjectileVisual(r, { kind: 'captain', bossId: '2-2' }, true)).toBe(
      'flying-sword',
    );
    expect(hostileProjectileVisual(r, { kind: 'captain', bossId: '7-2' }, true)).toBe(
      'returning-blade',
    );
  });
});
