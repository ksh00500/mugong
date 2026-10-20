import { expect, it } from 'vitest';
import { BOSS_MELEE, meleeHits } from '../src/domain/boss-melee';
import { emptyGame, startRun, tick } from '../src/domain/game';
import { enemyAttack } from '../src/domain/combat';
import { REGIONS, type BossMove } from '../src/domain/campaign';
import { stepEncounters } from '../src/domain/boss-encounters';
import { damageObject, bossDamageFactor, signatureCast } from '../src/domain/boss-encounters';
import { isGameSave } from '../src/platform/save-validation';
import { hostileDrawingPose } from '../src/game/hostile-pose';
import { hostileMotion, sampleHostileRig } from '../src/game/hostile-motion';
import { tacticalBossMove, tacticalMovement } from '../src/domain/enemy-tactics';
import { stepBossBehavior } from '../src/domain/boss-mechanics';

const idle = { dx: 0, dy: 0, aim: 0, attack: false, ultimate: false, defense: false };
function fixture(id: string, move: BossMove = 'thrust', distance = 100) {
  const state = emptyGame();
  startRun(state, '근접 검증', 123);
  const r = state.run!,
    e = r.enemies[0],
    f = r.fighter;
  r.regionRoute = [
    REGIONS[Number(id.split('-')[0])].name,
    ...REGIONS.filter((_, i) => i !== Number(id.split('-')[0]))
      .slice(0, 3)
      .map((x) => x.name),
  ];
  r.enemies = [e];
  r.offers = [];
  r.zones = [];
  r.encounterObjects = [];
  Object.assign(e, {
    bossId: id,
    kind: 'chief',
    role: undefined,
    x: 900,
    y: 450,
    hp: 10000,
    maxHp: 10000,
    speed: 0,
    xp: 0,
    aim: 0,
    facing: 0,
    move,
    state: 'windup',
    timer: 0.001,
    skillClock: 0,
  });
  Object.assign(f, { x: 900 + distance, y: 450, hp: 120, invulnerable: 0, cooldown: 100 });
  const step = (seconds: number) => {
    for (let n = 0; n < Math.round(seconds * 120); n++) tick(r, idle, 1 / 120);
  };
  return { state, r, e, f, step };
}
it('폐사의 금강 자세는 정면을 방어하고 뒤쪽은 온전한 피해를 받는다', () => {
  for (const id of ['4-2', '4-4']) {
    const { r, e, f } = fixture(id, 'stance');
    e.guardTime = 2;
    expect(bossDamageFactor(r, e)).toBe(0.45);
    f.x = e.x - 100;
    expect(bossDamageFactor(r, e)).toBe(1);
  }
});
it('삭제한 술병 시전을 직접 요청해도 공허와 노개는 함정을 만들지 않는다', () => {
  for (const id of ['4-1', '5-2']) {
    const { r, e } = fixture(id);
    signatureCast(r, e);
    expect(r.encounterObjects).toEqual([]);
    expect(r.projectiles).toEqual([]);
  }
});

for (const [id, kit] of Object.entries(BOSS_MELEE)) {
  it(`${id}: 실제 전투 순환에서 세 종류 이상 공격하고 원격 설치를 만들지 않는다`, () => {
    const { state, r, e, f } = fixture(id, kit.sequence[0]);
    Object.assign(e, { state: 'approach', timer: 0 });
    const moves = new Set<string>();
    for (let n = 0; n < 1800; n++) {
      f.hp = 120;
      f.x = Math.min(1690, e.x + (Math.floor(n / 240) % 2 ? 55 : 200));
      f.y = e.y;
      tick(r, idle, 1 / 60);
      if (e.state === 'strike' && e.move) moves.add(e.move);
      expect(r.phase).toBe('combat');
    }
    expect(moves.size).toBeGreaterThanOrEqual(3);
    expect(r.projectiles.filter((p) => p.owner === e.id)).toEqual([]);
    expect(
      r.encounterObjects?.every(
        (o) => o.kind === 'flag' || ['grab', 'bell'].includes(o.mechanic ?? ''),
      ) ?? true,
    ).toBe(true);
    expect(isGameSave(state)).toBe(true);
  });
  it(`${id}: 모든 전용 패턴의 팔방 판정과 원거리 발사 제거`, () => {
    const { e } = fixture(id);
    for (const move of kit.sequence) {
      e.move = move;
      const profile = enemyAttack(e),
        spec = profile.melee!;
      expect(profile.ranged).toBe(false);
      expect(profile.shots).toHaveLength(0);
      expect(profile.zone).toBeUndefined();
      for (let n = 0; n < 8; n++) {
        const a = (n * Math.PI) / 4;
        e.aim = a;
        const near = {
          x: e.x + Math.cos(a) * spec.range * 0.7,
          y: e.y + Math.sin(a) * spec.range * 0.7,
        };
        const far = {
          x: e.x + Math.cos(a) * (spec.range + 50),
          y: e.y + Math.sin(a) * (spec.range + 50),
        };
        expect(meleeHits(e, near, spec)).toBe(spec.shape !== 'none');
        expect(meleeHits(e, far, spec)).toBe(false);
      }
    }
  });
  it(`${id}: 대기 중 별도 8초 시전이나 원격 함정을 만들지 않는다`, () => {
    const { r, e, f } = fixture(id);
    e.state = 'approach';
    e.timer = 100;
    for (let n = 0; n < 1200; n++)
      stepEncounters(r, 1 / 60, (amount) => {
        f.hp -= amount;
      });
    expect(r.encounterObjects).toEqual([]);
    expect(r.projectiles).toEqual([]);
    expect(f.hp).toBe(120);
  });
}

it('장봉 직자는 먼 정면을 찌르지만 옆과 뒤를 맞히지 않는다', () => {
  const { e } = fixture('5-2');
  const spec = enemyAttack(e).melee!;
  expect(meleeHits(e, { x: e.x + 340, y: e.y }, spec)).toBe(true);
  expect(meleeHits(e, { x: e.x + 340, y: e.y + 65 }, spec)).toBe(false);
  expect(meleeHits(e, { x: e.x - 40, y: e.y }, spec)).toBe(false);
});
it('회전 봉격은 뒤도 타격하고 한 번의 휘두르기에 중복 피해를 주지 않는다', () => {
  const { r, e, f, step } = fixture('5-2', 'sweep', -160);
  step(0.24);
  expect(f.hp).toBe(120);
  step(0.04);
  expect(f.hp).toBeLessThan(120);
  const hp = f.hp;
  step(0.3);
  expect(f.hp).toBe(hp);
  expect(r.projectiles).toEqual([]);
  expect(e.state).toBe('recover');
});

for (const id of Object.keys(BOSS_MELEE)) {
  it(`${id}: 지면 강타는 contact 이후 적중할 때만 둔화를 준다`, () => {
    const { f, step } = fixture(id, 'slam');
    step(0.2);
    expect(f.hp).toBe(120);
    expect(f.slowTime ?? 0).toBe(0);
    step(0.16);
    expect(f.hp).toBeLessThan(120);
    expect(f.slowTime).toBeGreaterThan(0.8);
    for (const mode of ['outside', 'evade'] as const) {
      const avoided = fixture(id, 'slam', mode === 'outside' ? 450 : 100);
      if (mode === 'evade') avoided.f.invulnerable = 2;
      avoided.step(0.6);
      expect(avoided.f.hp).toBe(120);
      expect(avoided.f.slowTime ?? 0).toBe(0);
    }
  });
}
for (const id of ['4-1', '4-3', '4-4', '5-2', '0-2', '0-3', '0-4', '7-3']) {
  it(`${id}: 연타의 각 접촉이 무적 시간 후 적중하며 중간 저장을 재개한다`, () => {
    const { state, r, e, f, step } = fixture(id, 'combo');
    const contacts = enemyAttack(e).melee!.contacts;
    let last = 120;
    for (let n = 0; n < contacts.length; n++) {
      step(n === 0 ? contacts[0] + 0.04 : contacts[n] - contacts[n - 1]);
      expect(f.hp).toBeLessThan(last);
      last = f.hp;
      expect(e.strike?.contactsDone).toBe(n + 1);
      expect(isGameSave(state)).toBe(true);
      const resumed = structuredClone(r);
      tick(r, idle, 1 / 120);
      tick(resumed, idle, 1 / 120);
      expect(resumed).toEqual(r);
    }
    expect(
      r.effects.filter((x) => x.kind === 'slash').every((x) => x.weapon === BOSS_MELEE[id].weapon),
    ).toBe(true);
  });
}
it('잡기는 몸으로 접근한 뒤에만 포획하고 회피 또는 거리 이탈로 피할 수 있다', () => {
  for (const mode of ['hit', 'outside', 'evade'] as const) {
    const { f, step } = fixture('4-2', 'grab', mode === 'outside' ? 100 : 50);
    if (mode === 'evade') f.invulnerable = 2;
    step(0.14);
    expect((f.capturedTime ?? 0) > 0).toBe(mode === 'hit');
    step(0.65);
    expect(f.hp < 120).toBe(mode === 'hit');
    expect(f.capturedTime ?? 0).toBe(0);
  }
});
it('종은 전용 타격으로 준비하며 종을 파괴하면 강화와 종 충격을 차단한다', () => {
  const { r, e, f, step } = fixture('4-3', 'bell');
  step(0.2);
  const bell = r.encounterObjects!.find((o) => o.mechanic === 'bell')!;
  expect(bell.warning).toBeGreaterThan(0.8);
  expect(e.rageTime ?? 0).toBe(0);
  damageObject(r, bell, 1000);
  step(1.1);
  expect(e.rageTime ?? 0).toBe(0);
  expect(f.hp).toBe(120);
});
it('봉과 진각의 시각 접촉은 실제 타격 시점과 일치하고 승인된 준비/타격 원화를 사용한다', () => {
  for (const move of ['thrust', 'slam', 'combo', 'sweep'] as const) {
    const { e } = fixture('5-2', move);
    const spec = enemyAttack(e).melee!;
    e.state = 'strike';
    e.strike = {
      fromX: e.x,
      fromY: e.y,
      toX: e.x,
      toY: e.y,
      duration: spec.duration,
      damage: 10,
      hit: false,
      contactsDone: 0,
    };
    e.timer = spec.duration;
    expect(hostileDrawingPose(e, 0, -1, false, 5)).toBe(2);
    for (const contact of spec.contacts) {
      e.timer = spec.duration - contact;
      expect(hostileDrawingPose(e, 0, -1, false, 5)).toBe(3);
      const pose = sampleHostileRig(e, 'strike', contact / spec.duration, 0, 0);
      const before = sampleHostileRig(
        e,
        'strike',
        Math.max(0, contact - 0.05) / spec.duration,
        0,
        0,
      );
      expect(pose).not.toEqual(before);
    }
  }
});
it('삭제된 술병 패턴을 가진 이전 저장은 접근으로 복구해 새 패턴을 선택한다', () => {
  const { r, e, step } = fixture('5-2', 'hazard');
  e.timer = 0;
  step(0.04);
  expect(['approach', 'windup']).toContain(e.state);
  expect(e.move).not.toBe('hazard');
  expect(r.projectiles).toHaveLength(0);
});
it('구형 짧은 근접 strike 저장도 새 접촉 시간으로 환산하여 타격을 잃지 않는다', () => {
  const { state, r, e, f, step } = fixture('5-2', 'thrust');
  e.state = 'strike';
  e.timer = 0.28;
  e.strike = { fromX: e.x, fromY: e.y, toX: e.x, toY: e.y, duration: 0.28, damage: 10, hit: false };
  step(0.14);
  expect(f.hp).toBeLessThan(120);
  expect(e.strike?.contactsDone).toBe(1);
  expect(e.strike?.duration).toBe(0.3);
  expect(isGameSave(state)).toBe(true);
});

it('쇄겸은 좁은 정면 적중 때만 끌고 옆·뒤·회피에는 피해와 끌기가 없다', () => {
  for (const mode of ['hit', 'side', 'behind', 'evade'] as const) {
    const { state, r, e, f, step } = fixture('0-3', 'thrust', mode === 'behind' ? -290 : 290);
    if (mode === 'side') f.y += 65;
    if (mode === 'evade') f.invulnerable = 2;
    const old = { x: f.x, y: f.y };
    step(0.12);
    expect(f.hp).toBe(120);
    step(0.06);
    expect(f.hp < 120).toBe(mode === 'hit');
    expect(f.x < old.x).toBe(mode === 'hit');
    if (mode === 'hit') {
      expect(f.x).toBeCloseTo(old.x - 180, 3);
      e.state = 'approach';
      expect(tacticalBossMove(e, Math.hypot(f.x - e.x, f.y - e.y), r)).toBe('combo');
    } else expect({ x: f.x, y: f.y }).toEqual(old);
    expect(r.effects.some((x) => x.kind === 'chain')).toBe(true);
    expect(r.encounterObjects).toEqual([]);
    expect(r.projectiles).toEqual([]);
    expect(isGameSave(state)).toBe(true);
    const clone = structuredClone(r);
    tick(clone, idle, 1 / 120);
    tick(r, idle, 1 / 120);
    expect(clone).toEqual(r);
  }
});
it('호령은 준비와 실제 접촉 후 2명만 부르고 저장 재개나 반복 시전으로 늘지 않는다', () => {
  const { state, r, e, step } = fixture('0-1', 'summon', 250);
  step(0.15);
  expect(r.enemies).toHaveLength(1);
  step(0.1);
  expect(r.enemies).toHaveLength(3);
  expect(e.summoned).toBe(true);
  expect(isGameSave(state)).toBe(true);
  const clone = structuredClone(r);
  tick(clone, idle, 1 / 120);
  tick(r, idle, 1 / 120);
  expect(clone).toEqual(r);
  Object.assign(e, { state: 'windup', timer: 0.001, move: 'summon', strike: undefined });
  step(0.3);
  expect(r.enemies).toHaveLength(3);
  e.pattern = 2;
  expect(tacticalBossMove(e, 250, r)).not.toBe('summon');
});
it('호위기는 접촉 때 하나만 설치되고 소유자 근처에서만 강화하며 파괴 즉시 끝난다', () => {
  const { r, e, f, step } = fixture('0-2', 'stance');
  step(0.15);
  expect(r.encounterObjects).toEqual([]);
  step(0.1);
  const flag = r.encounterObjects![0];
  expect(flag.kind).toBe('flag');
  expect(flag.warning).toBe(0);
  expect(bossDamageFactor(r, e)).toBe(0.45);
  signatureCast(r, e);
  expect(r.encounterObjects).toHaveLength(1);
  e.pattern = 2;
  expect(tacticalBossMove(e, 250, r)).not.toBe('stance');
  e.x = flag.x + 300;
  expect(bossDamageFactor(r, e)).toBe(1);
  e.x = flag.x;
  // A flag never buffs a different enemy by proximity.
  expect(bossDamageFactor(r, { ...e, id: e.id + 99 })).toBe(1);
  damageObject(r, flag, 999);
  expect(bossDamageFactor(r, e)).toBe(1);
  expect(e.guardTime ?? 0).toBe(0);
  expect(f.hp).toBe(120);
});
it('표두는 긴 창의 옆 판정을 좁히고 가까이 붙으면 창 거리를 되찾는다', () => {
  const { r, e, f } = fixture('0-2', 'thrust', 50);
  const spec = enemyAttack(e).melee!;
  expect(meleeHits(e, { x: e.x + 350, y: e.y }, spec)).toBe(true);
  // A 60px foot offset still puts the upper body in the spear's corridor.
  expect(meleeHits(e, { x: e.x + 350, y: e.y + 60 }, spec)).toBe(true);
  expect(meleeHits(e, { x: e.x + 350, y: e.y + 100 }, spec)).toBe(false);
  expect(tacticalMovement(r, e, f, enemyAttack(e)).x).toBeLessThan(0);
  e.move = 'combo';
  expect(hostileMotion(e)).toBe('thrust');
  e.bossId = '0-4';
  expect(hostileMotion(e)).toBe('slash');
});
it('패도 대회전은 뒤쪽 피해자를 보스 쪽이 아니라 몸 바깥으로 밀어낸다', () => {
  const { f, step } = fixture('0-4', 'sweep', -200);
  const x = f.x;
  step(0.27);
  expect(f.hp).toBeLessThan(120);
  expect(f.x).toBeCloseTo(x - 45, 3);
});
it('한무극 저체력 추격은 이동을 강화하되 큰 기술 반격 기회와 고정 조준을 유지한다', () => {
  const { r, e, f } = fixture('0-4', 'dash', 500);
  e.hp = 3000;
  e.state = 'approach';
  const x = e.x;
  stepBossBehavior(r, e, 0.1);
  expect(e.x).toBeGreaterThan(x);
  expect(e.rageTime).toBe(0.2);
  expect(enemyAttack(e).recovery).toBeGreaterThanOrEqual(0.85);
  e.state = 'windup';
  const locked = { x: e.x, y: e.y, aim: e.aim };
  f.y += 200;
  stepBossBehavior(r, e, 0.1);
  expect({ x: e.x, y: e.y, aim: e.aim }).toEqual(locked);
  expect(r.projectiles).toEqual([]);
});
it('삭제한 사슬 원형 흡인과 발타 원격 모래벽을 다시 시전하지 않는다', () => {
  for (const id of ['0-3', '7-3']) {
    const { r, e } = fixture(id);
    signatureCast(r, e);
    expect(r.encounterObjects).toEqual([]);
    expect(r.projectiles).toEqual([]);
  }
});
it('구형 사슬 저장은 만료까지 유지하지만 이후 시전으로 재생성하지 않는다', () => {
  const { state, r, e, f } = fixture('0-3', 'thrust', 250);
  r.encounterObjects = [
    {
      id: 1,
      owner: e.id,
      kind: 'tether',
      x: e.x,
      y: e.y,
      radius: 360,
      warning: 0,
      life: 0.1,
      hp: 0,
      maxHp: 0,
      pulse: 0,
      aim: 0,
    },
  ];
  expect(isGameSave(state)).toBe(true);
  const x = f.x;
  stepEncounters(r, 0.02, () => {});
  expect(f.x).toBeLessThan(x);
  stepEncounters(r, 0.1, () => {});
  expect(r.encounterObjects).toEqual([]);
  signatureCast(r, e);
  expect(r.encounterObjects).toEqual([]);
});
