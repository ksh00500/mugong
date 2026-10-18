import { describe, expect, it } from 'vitest';
import { ARTS, ART_IDS, isBoss, isPrep, makeItem, xpThreshold } from '../src/domain/content';
import {
  command,
  eligibleOffers,
  emptyGame,
  expireFighters,
  grantXp,
  spawnWave,
  startRun,
  tick,
} from '../src/domain/game';
import { canPlace, hasWeapon } from '../src/domain/inventory';
import type { ArtId, BoundFighter, GameState, InputFrame, Run } from '../src/domain/model';
const idle: InputFrame = { dx: 0, dy: 0, aim: 0, attack: false, ultimate: false, defense: false };
function game(seed = 123) {
  const g = emptyGame();
  startRun(g, '청하연', seed);
  return g;
}
function chooseAll(g: GameState, preferred: ArtId[] = ['tianmo', 'huashan', 'wudang', 'samja']) {
  while (g.run?.offers.length) {
    const offer = [...g.run.offers].sort(
      (a, b) => preferred.indexOf(a.art) - preferred.indexOf(b.art),
    )[0];
    expect(command(g, { type: 'choose', offer })).toBe(true);
  }
}
describe('입문과 성장', () => {
  it('새 무인은 0레벨, 무공 없이 시작하며 기존 자산을 반입하지 않는다', () => {
    const g = emptyGame();
    g.family.warehouse.push(makeItem('sword', 'old', 'warehouse', 120));
    startRun(g, '청하연', 123);
    expect(g.run?.fighter.level).toBe(0);
    expect(g.run?.fighter.arts).toEqual([]);
    expect(g.run?.fighter.items.map((i) => i.id)).not.toContain('old');
    const r = g.run!;
    tick(r, { ...idle, defense: true }, 1 / 60);
    expect(r.fighter.invulnerable).toBe(0);
    expect(r.fighter.action).not.toBe('defense');
  });
  it('첫 레벨에서 중복 없는 3장 선택, 무공은 Lv.1으로 습득한다', () => {
    const g = game(),
      r = g.run!;
    grantXp(r, 20);
    expect(r.fighter.level).toBe(1);
    expect(r.offers).toHaveLength(3);
    expect(new Set(r.offers.map((o) => o.art)).size).toBe(3);
    command(g, { type: 'choose', offer: r.offers[0] });
    expect(r.fighter.arts[0].level).toBe(1);
    expect(r.spent).toBe(1);
    expect(r.offers).toHaveLength(0);
  });
  it('선택지와 난수 상태를 복원해도 같은 카드가 남고, 없는 선택은 거부한다', () => {
    const g = game();
    grantXp(g.run!, 20);
    const saved = structuredClone(g);
    expect(saved.run?.offers).toEqual(g.run?.offers);
    expect(saved.run?.seed).toBe(g.run?.seed);
    expect(
      command(g, { type: 'choose', offer: { art: g.run!.offers[0].art, type: 'upgrade' } }),
    ).toBe(false);
  });
  it('네 무공이 채워지면 신규 습득이 없으며 최대 레벨을 후보에서 제외한다', () => {
    const f = game().run!.fighter;
    f.arts = ART_IDS.slice(0, 4).map((id) => ({
      id,
      level: ARTS[id].max - 1,
      combo: 0,
      gauge: 0,
      defenseCd: 0,
    }));
    expect(eligibleOffers(f).every((o) => o.type === 'upgrade')).toBe(true);
    f.arts[0].level = 5;
    expect(eligibleOffers(f).map((o) => o.art)).not.toContain('huashan');
  });
  it('여러 레벨을 한꺼번에 올리면 레벨당 정확히 한 번 투자한다', () => {
    const g = game();
    grantXp(g.run!, xpThreshold(16));
    chooseAll(g);
    expect(g.run!.spent).toBe(16);
    expect(g.run!.fighter.arts.reduce((n, a) => n + a.level, 0)).toBe(16);
    expect(
      g.run!.fighter.arts.filter((a) => a.level === ARTS[a.id].max).length,
    ).toBeLessThanOrEqual(3);
  });
  it('많은 시드에서 유한한 경험치 총량이 Lv.13~16을 보장한다', () => {
    for (let seed = 0; seed < 300; seed++) {
      const g = game(seed),
        r = g.run!;
      const combatXp = r.xpBudget.reduce((a, b) => a + b, 0);
      grantXp(r, combatXp);
      expect(r.fighter.level).toBeGreaterThanOrEqual(13);
      grantXp(r, 80);
      expect(r.fighter.level).toBeLessThanOrEqual(16);
    }
  });
});
describe('전투 판정', () => {
  it('기본 공격은 준비 뒤 한 번 적중하고 뒤쪽 적을 맞추지 않는다', () => {
    const r = game().run!,
      f = r.fighter;
    r.enemies = r.enemies.slice(0, 2);
    r.enemies[0].x = f.x + 75;
    r.enemies[0].y = f.y;
    r.enemies[1].x = f.x - 75;
    r.enemies[1].y = f.y;
    const hp = r.enemies.map((e) => e.hp);
    tick(r, { ...idle, attack: true }, 1 / 60);
    expect(r.enemies[0].hp).toBe(hp[0]);
    for (let n = 0; n < 7; n++) tick(r, idle, 1 / 60);
    expect(r.enemies[0].hp).toBeLessThan(hp[0]);
    expect(r.enemies[1].hp).toBe(hp[1]);
    const hitHp = r.enemies[0].hp;
    for (let n = 0; n < 4; n++) tick(r, idle, 1 / 60);
    expect(r.enemies[0].hp).toBe(hitHp);
  });
  it('궁극기는 레벨과 게이지가 충족될 때만 실행한다', () => {
    const r = game().run!;
    r.fighter.arts = [{ id: 'huashan', level: 4, gauge: 100, combo: 0, defenseCd: 0 }];
    (r.fighter as BoundFighter).bindings = { huashan: r.fighter.items[0].id };
    tick(r, { ...idle, ultimate: true }, 1 / 60);
    expect(r.fighter.arts[0].gauge).toBe(100);
    r.fighter.arts[0].level = 5;
    tick(r, { ...idle, ultimate: true }, 1 / 60);
    expect(r.fighter.arts[0].gauge).toBe(0);
    expect(r.fighter.invulnerable).toBeGreaterThan(0);
  });
  it('무공 전환 후 게이지·A/B 순서·방어 대기시간을 유지한다', () => {
    const g = game();
    g.run!.fighter.arts = ['huashan', 'wudang'].map((id) => ({
      id: id as ArtId,
      level: 3,
      gauge: 77,
      combo: 1,
      defenseCd: 2,
    }));
    command(g, { type: 'switch', delta: 1 });
    command(g, { type: 'switch', delta: -1 });
    expect(g.run!.fighter.arts[0]).toMatchObject({ gauge: 77, combo: 1, defenseCd: 2 });
  });
  it('사망은 즉시 기록되며 같은 무인을 이어서 되살릴 수 없다', () => {
    const g = game(),
      r = g.run!;
    r.fighter.hp = 1;
    const e = r.enemies[0];
    e.role = undefined;
    e.kind = 'sword';
    e.x = r.fighter.x - 40;
    e.y = r.fighter.y;
    e.state = 'windup';
    e.timer = 0;
    e.aim = 0;
    tick(r, idle, 1 / 60);
    for (let n = 0; n < 6; n++) tick(r, idle, 1 / 60);
    expect(r.phase).toBe('dead');
    expect(r.fighter.items).toEqual([]);
    const restored = structuredClone(g);
    expect(command(restored, { type: 'next' })).toBe(false);
    command(restored, { type: 'claim' });
    expect(restored.run).toBeNull();
    expect(restored.family.deaths).toBe(1);
  });
  it('삼재 Lv.9에서 검기, Lv.10에서 이기어검을 제공한다', () => {
    for (const level of [8, 9, 10]) {
      const r = game().run!;
      r.fighter.arts = [{ id: 'samja', level, gauge: 0, combo: 0, defenseCd: 0 }];
      (r.fighter as BoundFighter).bindings = { samja: r.fighter.items[0].id };
      tick(r, { ...idle, attack: true }, 1 / 60);
      for (let i = 0; i < 7; i++) tick(r, idle, 1 / 60);
      expect(r.projectiles.length).toBe(level >= 9 ? 1 : 0);
    }
  });
});
describe('가방·물품', () => {
  it('전투 후 전리품에서 품질에 맞는 약을 하나씩 사용하고 가득 찬 체력에는 소모하지 않는다', () => {
    const g = game(),
      r = g.run!,
      f = r.fighter;
    const potion = { ...makeItem('medicine', 'ground-potion', 'ground', 60), count: 2 };
    f.items.push(potion);
    f.hp = 80;
    expect(command(g, { type: 'use', id: potion.id })).toBe(false);
    r.phase = 'loot';
    expect(command(g, { type: 'use', id: potion.id })).toBe(true);
    expect(f.hp).toBe(101);
    expect(potion.count).toBe(1);
    expect(potion.place).toBe('ground');
    f.hp = 120;
    expect(command(g, { type: 'use', id: potion.id })).toBe(false);
    expect(potion.count).toBe(1);
    f.hp = 119;
    expect(command(g, { type: 'use', id: potion.id })).toBe(true);
    expect(f.hp).toBe(120);
    expect(f.items.some((item) => item.id === potion.id)).toBe(false);
  });
  it('전리품 비급은 바로 경험치와 성장 선택을 주고 창고 소모품은 직접 사용할 수 없다', () => {
    const g = game(),
      r = g.run!;
    r.phase = 'loot';
    const manual = makeItem('manual', 'ground-study', 'ground');
    r.fighter.items.push(manual);
    expect(command(g, { type: 'use', id: manual.id })).toBe(true);
    expect(r.fighter.level).toBe(1);
    expect(r.offers).toHaveLength(3);
    expect(r.fighter.items.some((item) => item.id === manual.id)).toBe(false);
    r.offers = [];
    g.family.warehouse.push(makeItem('medicine', 'stored-potion', 'warehouse'));
    r.fighter.hp = 50;
    expect(command(g, { type: 'use', id: 'stored-potion' })).toBe(false);
    expect(g.family.warehouse[0].count).toBe(1);
  });
  it('경계·겹침·회전·무장 물품 종류를 검사한다', () => {
    const sword = makeItem('sword', 'a', 'weapon'),
      other = makeItem('sword', 'b', 'ground');
    expect(canPlace([sword], other, 'weapon', 0, 0)).toBe(false);
    expect(canPlace([sword], other, 'weapon', 1, 0)).toBe(true);
    expect(canPlace([], other, 'weapon', 2, 0, true)).toBe(false);
    expect(canPlace([], other, 'weapon', 0, 6, true)).toBe(true);
    expect(canPlace([], makeItem('medicine', 'c', 'ground'), 'weapon')).toBe(false);
  });
  it('전투 중 가방 변경·소모품·습득 및 배우지 않은 무공 연결을 거부한다', () => {
    const g = game();
    const potion = g.run!.fighter.items.find((i) => i.kind === 'medicine')!;
    expect(command(g, { type: 'use', id: potion.id })).toBe(false);
    expect(command(g, { type: 'moveItem', id: potion.id, place: 'ground' })).toBe(false);
    expect(command(g, { type: 'bind', art: 'huashan', item: g.run!.fighter.items[0].id })).toBe(
      false,
    );
  });
  it('일반 가방의 무기는 연결할 수 없고 무장 밖으로 옮기면 연결을 해제한다', () => {
    const g = game(),
      r = g.run!;
    grantXp(r, 20);
    command(g, { type: 'choose', offer: r.offers[0] });
    r.phase = 'loot';
    const a = r.fighter.arts[0].id,
      sword = r.fighter.items.find(
        (item) => item.id === (r.fighter as BoundFighter).bindings?.[a],
      )!;
    expect(hasWeapon(r.fighter as BoundFighter, a)).toBe(true);
    expect(command(g, { type: 'moveItem', id: sword.id, place: 'general', x: 2, y: 0 })).toBe(true);
    expect(hasWeapon(r.fighter as BoundFighter, a)).toBe(false);
    expect(command(g, { type: 'bind', art: a, item: sword.id })).toBe(false);
  });
  it('정리판·창고에서만 중첩하며 가방으로 하나씩 나눠 수납한다', () => {
    const g = game(),
      r = g.run!;
    r.phase = 'loot';
    r.fighter.items.push({ ...makeItem('medicine', 'p2', 'general'), x: 9, y: 7 });
    const first = r.fighter.items.find((i) => i.kind === 'medicine')!;
    command(g, { type: 'moveItem', id: first.id, place: 'ground' });
    command(g, { type: 'moveItem', id: 'p2', place: 'ground' });
    expect(first.count).toBe(2);
    command(g, { type: 'moveItem', id: first.id, place: 'general', x: 3, y: 1 });
    expect(first.count).toBe(1);
    expect(r.fighter.items.find((i) => i.place === 'general' && i.x === 3)?.count).toBe(1);
  });
  it('이전 저장의 가방 중첩 물품을 옮겨도 수량을 보존하고 겹친 복사본을 만들지 않는다', () => {
    const g = game(),
      r = g.run!;
    r.phase = 'loot';
    const item = r.fighter.items.find((i) => i.kind === 'medicine')!;
    item.count = 3;
    expect(
      command(g, { type: 'moveItem', id: item.id, place: 'general', x: item.x, y: item.y }),
    ).toBe(true);
    expect(r.fighter.items.filter((i) => i.kind === 'medicine')).toHaveLength(1);
    expect(command(g, { type: 'moveItem', id: item.id, place: 'general', x: 8, y: 6 })).toBe(true);
    expect(item).toMatchObject({ count: 3, x: 8, y: 6 });
    expect(r.fighter.items.filter((i) => i.kind === 'medicine')).toHaveLength(1);
  });
  it('꺼낸 물품은 하나만 명시적으로 폐기하고 진행한다', () => {
    const g = game();
    g.run!.phase = 'loot';
    const id = g.run!.fighter.items[0].id;
    command(g, { type: 'moveItem', id, place: 'ground' });
    expect(command(g, { type: 'discardItem', id })).toBe(true);
    expect(g.run!.fighter.items.some((i) => i.id === id)).toBe(false);
    expect(command(g, { type: 'next' })).toBe(true);
  });
  it.each(['robe', 'boots', 'charm'] as const)(
    '%s 착용 교체는 기존 장비를 일반 가방에 보존한다',
    (kind) => {
      const g = game(),
        f = g.run!.fighter;
      g.run!.phase = 'loot';
      const old = makeItem(kind, `old-${kind}`, 'equipped');
      const incoming = makeItem(kind, `new-${kind}`, 'general');
      Object.assign(incoming, { x: 3, y: 2 });
      f.items.push(old, incoming);
      const ids = f.items.map((entry) => entry.id).sort();
      expect(command(g, { type: 'moveItem', id: incoming.id, place: 'equipped' })).toBe(true);
      expect(incoming.place).toBe('equipped');
      expect(old).toMatchObject({ place: 'general', x: 3, y: 2 });
      expect(f.items.map((entry) => entry.id).sort()).toEqual(ids);
      expect(f.items.some((entry) => entry.place === 'ground')).toBe(false);
      expect(command(g, { type: 'discardItem', id: old.id })).toBe(false);
      expect(f.items.some((entry) => entry.id === old.id)).toBe(true);
    },
  );
  it.each(['robe', 'boots', 'charm'] as const)(
    '%s 교체 장비를 보관할 공간이 없으면 아무 물품도 움직이지 않는다',
    (kind) => {
      const g = game(),
        f = g.run!.fighter;
      g.run!.phase = 'loot';
      const old = makeItem(kind, `old-${kind}`, 'equipped');
      const incoming = makeItem(kind, `new-${kind}`, 'ground');
      f.items = [f.items[0], old, incoming];
      for (let y = 0; y < 8; y++)
        for (let x = 0; x < 10; x++)
          f.items.push({ ...makeItem('ore', `fill-${x}-${y}`, 'general'), x, y });
      const before = structuredClone(f.items);
      expect(command(g, { type: 'moveItem', id: incoming.id, place: 'equipped' })).toBe(false);
      expect(f.items).toEqual(before);
    },
  );
  it('이전 저장에 같은 부위 장비가 중복되어도 모두 가방에 보존한다', () => {
    const g = game(),
      f = g.run!.fighter;
    g.run!.phase = 'loot';
    const first = makeItem('robe', 'legacy-robe-1', 'equipped');
    const second = makeItem('robe', 'legacy-robe-2', 'equipped');
    const incoming = makeItem('robe', 'new-robe', 'ground');
    f.items.push(first, second, incoming);
    expect(command(g, { type: 'moveItem', id: incoming.id, place: 'equipped' })).toBe(true);
    expect(f.items.filter((entry) => entry.kind === 'robe' && entry.place === 'equipped')).toEqual([
      incoming,
    ]);
    expect(first.place).toBe('general');
    expect(second.place).toBe('general');
    expect(`${first.x},${first.y}`).not.toBe(`${second.x},${second.y}`);
    expect(f.items.filter((entry) => entry.kind === 'robe')).toHaveLength(3);
  });
});
describe('강호·세가', () => {
  it('20웨이브의 정비·보스 구조와 성공 귀환을 연결하고 체력을 유지한다', () => {
    const g = game(),
      r = g.run!,
      now = 1800000000000;
    for (let wave = 1; wave <= 20; wave++) {
      expect(r.wave).toBe(wave);
      if (isPrep(wave)) expect(r.phase).toBe('prep');
      else {
        expect(r.enemies.some((e) => ['chief', 'captain'].includes(e.kind))).toBe(isBoss(wave));
        grantXp(r, r.xpBudget[wave - 1]);
        chooseAll(g);
        r.phase = 'loot';
      }
      r.fighter.hp = 47;
      expect(command(g, { type: 'next' }, now)).toBe(true);
    }
    expect(g.run).toBeNull();
    expect(g.family.roster).toHaveLength(1);
    const f = g.family.roster[0];
    expect(f.hp).toBe(47);
    expect(f.expiresAt).toBe(now + 7 * 86400000);
    expect(g.family.victories).toBe(1);
  });
  it('수명 만료를 여러 번 검사해도 자산을 한 번만 창고로 회수한다', () => {
    const g = game(),
      f = g.run!.fighter;
    f.expiresAt = 100;
    g.run = null;
    g.family.roster.push(f);
    g.selectedId = f.id;
    expect(expireFighters(g, 99)).toBe(false);
    expect(expireFighters(g, 100)).toBe(true);
    const count = g.family.warehouse.length;
    expect(count).toBe(2);
    expect(expireFighters(g, 101)).toBe(false);
    expect(g.family.warehouse).toHaveLength(count);
    expect(g.family.retired).toBe(1);
  });
  it('정비에만 의원과 보급을 제공하고 무한 수련품을 판매하지 않는다', () => {
    const g = game(),
      r = g.run!;
    r.gold = 100;
    r.fighter.hp = 40;
    expect(command(g, { type: 'heal' })).toBe(false);
    r.wave = 4;
    spawnWave(r);
    expect(command(g, { type: 'heal' })).toBe(true);
    expect(r.fighter.hp).toBe(85);
    expect(command(g, { type: 'buy', kind: 'manual' })).toBe(false);
  });
  it('귀환 후 수련품으로 레벨이 오르면 동일한 성장 선택을 받는다', () => {
    const g = game(),
      f = g.run!.fighter;
    f.spent = 0;
    f.xp = 0;
    g.run = null;
    g.family.roster.push(f);
    g.selectedId = f.id;
    const manual = makeItem('manual', 'study', 'general');
    f.items.push(manual);
    expect(command(g, { type: 'use', id: 'study' })).toBe(true);
    expect(f.level).toBe(1);
    expect(g.family.training?.offers.length).toBe(3);
    command(g, { type: 'choose', offer: g.family.training!.offers[0] });
    expect(f.arts).toHaveLength(1);
    expect(g.family.training).toBeUndefined();
  });
  it('강호의 전투 종료 후에도 세가 창고 자산을 반입하지 못한다', () => {
    const g = game();
    g.run!.phase = 'loot';
    g.family.warehouse.push(makeItem('sword', 'stored', 'warehouse'));
    expect(command(g, { type: 'moveItem', id: 'stored', place: 'weapon', x: 2, y: 0 })).toBe(false);
    expect(g.family.warehouse).toHaveLength(1);
  });
  it('창고 중첩 물품을 직접 수납하면 한 개만 꺼내고 나머지는 유지한다', () => {
    const g = game(),
      f = g.run!.fighter;
    g.run = null;
    g.family.roster.push(f);
    g.selectedId = f.id;
    const potion = makeItem('medicine', 'stored-potion', 'warehouse');
    potion.count = 3;
    g.family.warehouse.push(potion);
    expect(command(g, { type: 'moveItem', id: potion.id, place: 'general', x: 2, y: 2 })).toBe(
      true,
    );
    expect(potion.count).toBe(2);
    const piece = f.items.find((i) => i.id.startsWith('stored-potion-piece'))!;
    expect(piece).toMatchObject({ count: 1, place: 'general', x: 2, y: 2 });
    expect(command(g, { type: 'moveItem', id: piece.id, place: 'warehouse' })).toBe(true);
    expect(g.family.warehouse).toHaveLength(1);
    expect(potion.count).toBe(3);
  });
});
