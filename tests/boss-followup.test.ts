import { expect, it } from 'vitest';
import { BOSS_KITS, BOSS_MELEE, meleeHits } from '../src/domain/boss-melee';
import { emptyGame, startRun, tick } from '../src/domain/game';
import { enemyAttack } from '../src/domain/combat';
import { REGIONS, type BossMove } from '../src/domain/campaign';
import { stepEncounters } from '../src/domain/boss-encounters';
import { isGameSave } from '../src/platform/save-validation';
import { tacticalBossMove } from '../src/domain/enemy-tactics';
import { signatureCast } from '../src/domain/boss-encounters';
import { hostileMotion } from '../src/game/hostile-motion';

const idle = { dx: 0, dy: 0, aim: 0, attack: false, ultimate: false, defense: false };
function fixture(id: string, move: BossMove, distance = 100) {
  const state = emptyGame();
  startRun(state, '후속 보스 검증', 123);
  const r = state.run!,
    e = r.enemies[0],
    f = r.fighter;
  const region = Number(id.split('-')[0]);
  r.regionRoute = [
    REGIONS[region].name,
    ...REGIONS.filter((_, n) => n !== region)
      .slice(0, 3)
      .map((x) => x.name),
  ];
  r.enemies = [e];
  r.offers = [];
  r.zones = [];
  r.encounterObjects = [];
  r.projectiles = [];
  Object.assign(e, {
    bossId: id,
    kind: 'chief',
    role: undefined,
    x: 900,
    y: 450,
    hp: 9000,
    maxHp: 10000,
    speed: 0,
    xp: 0,
    aim: 0,
    facing: 0,
    move,
    state: 'windup',
    timer: 0.001,
    skillClock: 0,
    targetX: 900 + distance,
    targetY: 450,
  });
  Object.assign(f, { x: 900 + distance, y: 450, hp: 120, invulnerable: 0, cooldown: 100 });
  const step = (seconds: number) => {
    for (let n = 0; n < Math.ceil(seconds * 120); n++) tick(r, idle, 1 / 120);
  };
  return { state, r, e, f, step };
}

for (const [id, kit] of Object.entries(BOSS_KITS).filter(([id]) => !BOSS_MELEE[id])) {
  it(`${id}: 실제 거리 변경 전투에서 세 종류 이상 사용하고 정지하지 않는다`, () => {
    const { state, r, e, f } = fixture(id, kit.sequence[0]);
    Object.assign(e, { state: 'approach', timer: 0 });
    const moves = new Set<string>();
    for (let n = 0; n < 2400; n++) {
      f.hp = 120;
      f.x = e.x + (e.x > 960 ? -1 : 1) * [80, 200, 400][Math.floor(n / 300) % 3];
      f.y = e.y;
      tick(r, idle, 1 / 60);
      if (e.state === 'strike') moves.add(e.move!);
      expect(r.phase).toBe('combat');
    }
    expect(moves.size, [...moves].join(',')).toBeGreaterThanOrEqual(3);
    expect(isGameSave(state)).toBe(true);
  });
  it(`${id}: 모든 패턴 팔방 판정·접촉 시점·저장 재개`, () => {
    expect(kit.sequence.length).toBeGreaterThanOrEqual(4);
    for (const move of kit.sequence) {
      const spec = kit.moves[move]!;
      expect(spec).toBeDefined();
      expect(spec.contacts.length).toBeLessThanOrEqual(3);
      expect(spec.contacts.every((t) => t > 0 && t < spec.duration)).toBe(true);
      const { state, r, e, f, step } = fixture(
        id,
        move,
        spec.shot || spec.zone ? 400 : (spec.dash ?? 0) + spec.range * 0.7,
      );
      expect(enemyAttack(e).melee).toBe(spec);
      if (spec.motion) expect(hostileMotion(e)).toBe(spec.motion);
      for (let n = 0; n < 8; n++) {
        const a = (n * Math.PI) / 4;
        e.aim = a;
        expect(
          meleeHits(
            e,
            { x: e.x + Math.cos(a) * spec.range * 0.7, y: e.y + Math.sin(a) * spec.range * 0.7 },
            spec,
          ),
        ).toBe(spec.shape !== 'none');
        expect(
          meleeHits(
            e,
            { x: e.x + Math.cos(a) * (spec.range + 60), y: e.y + Math.sin(a) * (spec.range + 60) },
            spec,
          ),
        ).toBe(false);
      }
      e.aim = 0;
      step(spec.contacts[0] * 0.5);
      expect(f.hp).toBe(120);
      expect(r.projectiles).toHaveLength(0);
      expect(r.encounterObjects).toHaveLength(0);
      step(spec.contacts[0] * 0.5 + 0.025);
      if (spec.shot) {
        expect(r.projectiles.filter((p) => p.owner === e.id)).toHaveLength(spec.shot.count);
        expect(r.projectiles.every((p) => p.visual === spec.shot!.visual)).toBe(true);
      } else if (spec.zone) {
        expect(r.projectiles).toHaveLength(1);
        expect(r.projectiles[0].landing?.kind).toBe(spec.zone.kind);
      } else if (spec.shape !== 'none') expect(f.hp).toBeLessThan(120);
      expect(isGameSave(state)).toBe(true);
      const resumed = structuredClone(r);
      tick(r, idle, 1 / 120);
      tick(resumed, idle, 1 / 120);
      expect(resumed).toEqual(r);
    }
  });
  it(`${id}: 대기 중 숨은 주기 시전 제거`, () => {
    const { r, e, f } = fixture(id, kit.sequence[0]);
    e.state = 'approach';
    e.timer = 100;
    for (let n = 0; n < 1200; n++)
      stepEncounters(r, 1 / 60, (amount) => {
        f.hp -= amount;
      });
    expect(r.projectiles).toEqual([]);
    expect(r.encounterObjects).toEqual([]);
  });
  it(`${id}: 원거리 기술은 최소 거리 밖에서만 고른다`, () => {
    const { r, e } = fixture(id, kit.sequence[0]);
    for (const move of kit.sequence) {
      const spec = kit.moves[move]!;
      if (!spec.minimum) continue;
      e.pattern = kit.sequence.indexOf(move);
      expect(tacticalBossMove(e, 100, r)).not.toBe(move);
      e.pattern = kit.sequence.indexOf(move);
      expect(tacticalBossMove(e, Math.max(spec.minimum, 400), r)).toBe(move);
    }
  });
}

it('설원 장창은 멀리 찌르되 측면에 있는 플레이어는 피할 수 있다', () => {
  const { e } = fixture('3-1', 'thrust');
  const spec = enemyAttack(e).melee!;
  expect(meleeHits(e, { x: e.x + 360, y: e.y }, spec)).toBe(true);
  expect(meleeHits(e, { x: e.x + 360, y: e.y + 80 }, spec)).toBe(false);
});

it('혈도의 흡혈·출혈은 실제 피해에만 연결하고 무적이면 발생하지 않는다', () => {
  for (const invulnerable of [0, 2]) {
    const { e, f, step } = fixture('8-1', 'slash');
    f.invulnerable = invulnerable;
    const hp = e.hp;
    step(0.14);
    if (invulnerable) {
      expect(e.hp).toBe(hp);
      expect(f.bleedTime ?? 0).toBe(0);
    } else {
      expect(e.hp - hp).toBeCloseTo((120 - f.hp) * 0.6);
      expect(f.bleedTime).toBeGreaterThan(0);
    }
  }
});
it('얼음 파편의 실제 충돌은 피해와 둔화를 남긴다', () => {
  const { f, step } = fixture('3-2', 'fan', 320);
  step(1.2);
  expect(f.hp).toBeLessThan(120);
  expect(f.slowTime).toBeGreaterThan(0);
});
it('독화 분말은 준비 때 고정한 위치에 설치하고 순환 인덱스를 보존한다', () => {
  const { r, e, f, step } = fixture('1-3', 'hazard', 300);
  e.pattern = 2;
  f.x = 1600;
  step(0.25);
  const object = r.encounterObjects!.find((o) => o.mechanic === 'poison-powder')!;
  expect(object.x).toBe(1200);
  expect(object.y).toBe(450);
  expect(e.pattern).toBe(2);
});
it('가까운 플레이어에게 거리용 원거리 기술을 억지로 발동하지 않는다', () => {
  const { r, e, step } = fixture('9-2', 'fan', 200);
  e.state = 'approach';
  e.timer = 0;
  e.pattern = 0;
  e.guardTime = 2; // The installation slot is unavailable; no close thrust reaches 200.
  step(0.01);
  expect(e.state).toBe('approach');
  expect(r.projectiles).toHaveLength(0);
});
it('안전 진법·회전문·회전날과 드론은 재전개해도 모순된 구역으로 중첩되지 않는다', () => {
  for (const [id, mechanic, count] of [
    ['9-4', 'formation', 1],
    ['9-3', 'rotating-door', 8],
    ['6-3', 'blade', 3],
    ['9-2', 'drone', 1],
  ] as const) {
    const { r, e } = fixture(id, 'stance');
    for (let n = 0; n < 5; n++) {
      e.pattern = n;
      signatureCast(r, e);
    }
    expect(r.encounterObjects!.filter((o) => o.mechanic === mechanic)).toHaveLength(count);
    expect(r.encounterObjects!.length).toBeLessThanOrEqual(12);
  }
});
