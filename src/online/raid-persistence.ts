import type { OnlineRepository } from './repository';
import type { Fighter, Item, Run, Command, BoundFighter } from '../domain/model';
import type { RaidState, RaidReceipt } from '../raid/model';
import { command, grantXp, expireFighters } from '../domain/game';
import { maximumHp } from '../domain/content';
import { firstSpace } from '../domain/inventory';
import { makeLootItem } from '../domain/items';
import { carriedItems } from './raid-persistence-view';
export { carriedItems } from './raid-persistence-view';
export interface PersonalMember {
  account: { id: string; name?: string };
  fighterId?: string;
}
export function reserveFighter(
  repo: OnlineRepository,
  account: string,
  id: string,
  room: string,
  checkpoint?: (f: BoundFighter) => string,
) {
  return repo.transaction(() => {
    const save = repo.refresh(account),
      f = save.state.family.roster.find((f) => f.id === id);
    if (
      save.locked ||
      save.state.run ||
      save.state.family.training ||
      !f ||
      !f.arts.length ||
      f.hp <= 0 ||
      !f.expiresAt ||
      f.expiresAt - Date.now() < 30 * 60000
    )
      throw Error(
        '강호를 완주한 생존 무인이 필요합니다. 수련을 마치고 수명 30분 이상을 남겨 두세요',
      );
    repo.db
      .prepare('INSERT INTO online_reservations(account,fighter,room) VALUES(?,?,?)')
      .run(account, id, room);
    if (checkpoint)
      repo.db
        .prepare(
          'INSERT INTO online_raids(code,run,state) VALUES(?,NULL,?) ON CONFLICT(code) DO UPDATE SET state=excluded.state',
        )
        .run(room, checkpoint(f));
    return f as BoundFighter;
  });
}
export function releaseWaitingFighter(
  repo: OnlineRepository,
  account: string,
  room: string,
  checkpoint: string | null,
  now = Date.now(),
) {
  repo.transaction(() => {
    const save = repo.read(account);
    if (save.locked !== room) throw Error('출전 잠금이 변경되었습니다');
    repo.db
      .prepare('DELETE FROM online_reservations WHERE account=? AND room=?')
      .run(account, room);
    if (expireFighters(save.state, now)) repo.write(account, save.revision, save.state);
    if (checkpoint)
      repo.db.prepare('UPDATE online_raids SET state=? WHERE code=?').run(checkpoint, room);
    else repo.db.prepare('DELETE FROM online_raids WHERE code=?').run(room);
  });
}
export function recoverHeir(m: RaidState, seat: number, id: string) {
  if (!m.personal || m.phase !== 'rest' || m.status[seat] !== 'active')
    throw Error('정비 중에만 유품을 수습할 수 있습니다');
  const h = m.heirs?.find((h) => h.id === id);
  if (!h || h.returned || h.lost || h.carrier !== undefined)
    throw Error('수습할 수 없는 유품입니다');
  const space = firstSpace(
    [...m.players[seat].fighter.items, ...carriedItems(m, seat)],
    h.item,
    'general',
  );
  if (!space) throw Error('유품을 넣을 일반 가방 공간이 부족합니다');
  Object.assign(h, { carrier: seat, x: space.x, y: space.y });
}
// All participant families, deaths, inherited items, locks and the exact room checkpoint share one commit.
export function savePersonalRaid(
  repo: OnlineRepository,
  code: string,
  members: readonly (null | PersonalMember)[],
  match: RaidState | null,
  serialized: (m: RaidState | null) => string,
  now = Date.now(),
) {
  const next = match ? structuredClone(match) : null;
  repo.transaction(() => {
    const saves = members.map((p) => (p?.fighterId ? repo.read(p.account.id) : null));
    const original = saves.map((s) => (s ? JSON.stringify(s.state) : ''));
    if (next) {
      for (const p of members)
        if (p?.fighterId)
          repo.db
            .prepare(
              "INSERT OR IGNORE INTO raid_results(run,account,state,created) VALUES(?,?,'playing',?)",
            )
            .run(next.id, p.account.id, now);
      next.heirs ??= [];
      for (let i = 0; i < 4; i++) {
        const p = members[i],
          save = saves[i];
        if (!p || !save) continue;
        if (save.locked !== code) continue;
        const index = save.state.family.roster.findIndex((f) => f.id === p.fighterId),
          a = next.players[i];
        if (next.status[i] === 'dead') {
          if (index >= 0) {
            save.state.family.roster.splice(index, 1);
            save.state.family.deaths++;
            if (save.state.family.training?.fighterId === p.fighterId)
              save.state.family.training = undefined;
            if (save.state.selectedId === p.fighterId)
              save.state.selectedId = save.state.family.roster[0]?.id ?? null;
          }
          if (a.fighter.items.length) {
            for (const item of a.fighter.items)
              next.heirs.push({
                id: `${next.id}:${i}:${item.id}`,
                owner: i,
                item: structuredClone(item),
              });
            a.fighter.items = [];
            a.fighter.bindings = {};
          }
          for (const h of next.heirs)
            if (h.carrier === i && !h.returned) {
              delete h.carrier;
              delete h.x;
              delete h.y;
            }
        } else if (index >= 0) save.state.family.roster[index] = structuredClone(a.fighter);
      }
      // Exactly one seeded reward per cleared floor. No client victory/XP/item data exists.
      for (let floor = (next.rewardFloor ?? 0) + 1; floor <= next.cleared; floor++) {
        for (let i = 0; i < 4; i++) {
          const save = saves[i],
            p = members[i];
          if (!save || !p || next.status[i] !== 'active') continue;
          const f = save.state.family.roster.find((f) => f.id === p.fighterId)!;
          f.trainingPoints = (f.trainingPoints ?? 0) + 3;
          const r = {
            fighter: f,
            seed: floor * 104729 + next.id.split('').reduce((n, c) => n + c.charCodeAt(0), 0),
            phase: 'loot',
            offers: [],
            spent: f.spent ?? 0,
          } as unknown as Run;
          grantXp(r, [30, 40, 50, 60, 80][floor - 1]);
          if (r.offers.length || f.augmentOffers?.length)
            save.state.family.training = { fighterId: f.id, offers: r.offers, seed: r.seed };
          const item = makeLootItem(
            floor % 2 ? 'manual-training' : 'gear-robe-1',
            `${next.id}:${i}:reward:${floor}`,
            'ground',
            80 + Math.floor((r.seed >>> 0) % 41),
          );
          f.items.push(item);
          next.players[i].fighter = structuredClone(f);
          next.players[i].maxHp = maximumHp(f);
        }
        next.rewardFloor = floor;
      }
      for (let i = 0; i < 4; i++) {
        const p = members[i],
          save = saves[i];
        if (!p || !save) continue;
        const released = next.status[i] !== 'active' || next.phase === 'finished';
        const expired = next.status[i] === 'expired';
        const success =
          next.status[i] === 'returned' ||
          (next.phase === 'finished' && next.result === 'complete' && next.status[i] === 'active');
        if (success || expired)
          for (const h of next.heirs)
            if (h.carrier === i && !h.returned && !h.lost) {
              const owner = saves[h.owner];
              if (!owner) throw Error('유품 소유 기록을 찾을 수 없습니다');
              owner.state.family.warehouse.push({ ...h.item, place: 'warehouse' });
              h.returned = true;
            }
        if (released) {
          const held = repo.db
            .prepare('SELECT room FROM online_reservations WHERE account=? AND room=?')
            .get(p.account.id, code);
          if (held && success)
            save.state.family.silver = (save.state.family.silver ?? 0) + next.cleared * 20;
          repo.db
            .prepare('DELETE FROM online_reservations WHERE account=? AND room=?')
            .run(p.account.id, code);
          expireFighters(save.state, now);
          const receipt: RaidReceipt = {
            id: `${next.id}:${i}`,
            runId: next.id,
            name: p.account.name ?? next.players[i].fighter.name,
            outcome:
              next.status[i] === 'dead'
                ? 'dead'
                : expired
                  ? 'expired'
                  : next.status[i] === 'returned'
                    ? 'returned'
                    : (next.result ?? 'abandoned'),
            floor: next.cleared,
            damage: Math.round(next.damage[i]),
            taken: Math.round(next.taken[i]),
            finishedAt: now,
          };
          repo.db
            .prepare(
              "UPDATE raid_results SET state='complete',floor=?,receipt=? WHERE run=? AND account=? AND state='playing'",
            )
            .run(next.cleared, JSON.stringify(receipt), next.id, p.account.id);
        }
      }
      repo.db
        .prepare("UPDATE raid_results SET floor=MAX(floor,?) WHERE run=? AND state='playing'")
        .run(next.cleared, next.id);
      if (next.phase === 'finished') for (const h of next.heirs) if (!h.returned) h.lost = true;
    }
    for (let i = 0; i < 4; i++) {
      const p = members[i],
        save = saves[i];
      if (p && save && JSON.stringify(save.state) !== original[i])
        repo.write(p.account.id, save.revision, save.state);
    }
    repo.db
      .prepare(
        'INSERT INTO online_raids(code,run,state) VALUES(?,?,?) ON CONFLICT(code) DO UPDATE SET run=excluded.run,state=excluded.state',
      )
      .run(code, next?.id ?? null, serialized(next));
  });
  return next;
}
export function raidPersonalCommand(
  repo: OnlineRepository,
  code: string,
  members: readonly (null | PersonalMember)[],
  m: RaidState,
  seat: number,
  intent: Command,
  op: string,
  serialized: (m: RaidState) => string,
) {
  if (m.phase !== 'rest' || m.status[seat] !== 'active' || !m.personal)
    throw Error('정비 중에만 성장과 가방을 변경할 수 있습니다');
  if (
    ![
      'choose',
      'chooseAugment',
      'deferTraining',
      'openTraining',
      'arrangeItems',
      'moveItem',
      'bind',
      'use',
      'discardItem',
    ].includes(intent.type) ||
    (intent.type === 'moveItem' && intent.place === 'warehouse')
  )
    throw Error('레이드 정비에서 사용할 수 없는 행동입니다');
  const p = members[seat]!;
  const next = structuredClone(m);
  repo.transaction(() => {
    const repeated = repo.db
      .prepare('SELECT intent FROM online_operations WHERE account=? AND op=?')
      .get(p.account.id, op);
    if (repeated) {
      if (repeated.intent !== JSON.stringify(intent)) throw Error('중복 요청 번호입니다');
      return;
    }
    const save = repo.read(p.account.id);
    save.state.selectedId = p.fighterId!;
    const f = save.state.family.roster.find((f) => f.id === p.fighterId)!;
    if ('id' in intent && save.state.family.warehouse.some((i) => i.id === intent.id))
      throw Error('레이드에서는 창고를 사용할 수 없습니다');
    // Reserved heirlooms occupy real cells but are never usable/equippable items.
    const carried = carriedItems(next, seat);
    f.items.push(...carried);
    if (
      ('id' in intent && carried.some((i) => i.id === intent.id)) ||
      (intent.type === 'arrangeItems' && carried.length)
    )
      throw Error('유품은 원래 주인에게 귀환 시 전달합니다');
    if (!command(save.state, intent)) throw Error('지금은 할 수 없는 행동입니다');
    f.items = f.items.filter((i) => !carried.some((h) => h.id === i.id));
    repo.write(p.account.id, save.revision, save.state);
    next.players[seat].fighter = structuredClone(f);
    next.players[seat].maxHp = maximumHp(f);
    repo.db
      .prepare('INSERT INTO online_operations(account,op,intent,revision) VALUES(?,?,?,?)')
      .run(p.account.id, op, JSON.stringify(intent), save.revision + 1);
    repo.db.prepare('UPDATE online_raids SET state=? WHERE code=?').run(serialized(next), code);
  });
  return next;
}
