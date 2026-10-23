/** Offline deterministic observation of the real domain. Never opens a user database.
 * Run: esbuild this entry with --bundle --platform=node, then node output.mjs <report.json>.
 * Reactive bots read simulation state; their outcomes are not human win rates.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { PvpDatabase } from '../src/pvp/server/database';
import {
  reserveFighter,
  savePersonalRaid,
  raidPersonalCommand,
} from '../src/online/raid-persistence';
import { command, emptyGame, tick } from '../src/domain/game';
import { ART_IDS, maximumHp } from '../src/domain/content';
import { enemyAttack } from '../src/domain/combat';
import { compatibleWeapon, firstSpace } from '../src/domain/inventory';
import { rollGrowth } from '../src/domain/growth-roll';
import { TRAIT_IDS } from '../src/domain/character';
import { techniqueStats } from '../src/domain/techniques';
import { waystationApproach, type WaystationStop } from '../src/domain/waystation';
import { isGameSave } from '../src/platform/save-validation';
import type { ArtId, BoundFighter, GameState, InputFrame, Command } from '../src/domain/model';
import { createRaid, stepRaid, nextRaidFloor, raidMedicine } from '../src/raid/engine';
import type { RaidState } from '../src/raid/model';
import { neutralInput, type PvpInput, type PresetId } from '../src/pvp/model';

const now = 1800000000000;
const idle: InputFrame = { dx: 0, dy: 0, aim: 0, attack: false, ultimate: false, defense: false };
function rng(seed: number) {
  return () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
}
const round = (n: number) => Math.round(n * 100) / 100;
function choices(s: GameState, preferred: ArtId) {
  for (let count = 0; count < 100; count++) {
    const f = s.run?.fighter ?? s.family.roster.find((f) => f.id === s.family.training?.fighterId);
    if (!f) return;
    const augment = f.augmentOffers?.[0];
    if (augment) {
      if (!command(s, { type: 'chooseAugment', id: augment }, now)) throw Error('Augment blocked');
      continue;
    }
    const offers = s.run?.offers ?? s.family.training?.offers ?? [];
    if (!offers.length) return;
    const order = [preferred, ...ART_IDS.filter((id) => id !== preferred)];
    const offer = [...offers].sort((a, b) => order.indexOf(a.art) - order.indexOf(b.art))[0];
    if (!command(s, { type: 'choose', offer }, now)) throw Error('Offer blocked');
  }
  throw Error('Choice loop');
}
function moveTo(s: GameState, stop: WaystationStop) {
  const r = s.run!,
    target = waystationApproach(stop, r);
  for (let n = 0; n < 600; n++) {
    const dx = target.x - r.fighter.x,
      dy = target.y - r.fighter.y,
      d = Math.hypot(dx, dy);
    if (d < 12) return;
    tick(r, { ...idle, dx: dx / d, dy: dy / d }, 1 / 60);
  }
  throw Error('Waystation path blocked');
}
function supplies(s: GameState, preferred: ArtId) {
  const r = s.run!,
    f = r.fighter;
  const apply = (c: Command) => command(s, c, now);
  for (const item of [...f.items]) {
    if (item.kind === 'manual') {
      apply({ type: 'use', id: item.id });
      choices(s, preferred);
    } else if (item.kind === 'medicine' && f.hp < maximumHp(f) * 0.65)
      apply({ type: 'use', id: item.id });
    else if (['robe', 'boots', 'charm'].includes(item.kind) && item.place === 'ground') {
      const old = f.items.find((i) => i.kind === item.kind && i.place === 'equipped');
      if (!old || item.power > old.power)
        apply({ type: 'moveItem', id: item.id, place: 'equipped' });
    } else if (item.kind === 'sword' && item.place === 'ground') {
      const matching = f.arts.filter((a) => compatibleWeapon(item, a.id));
      const space = firstSpace(f.items, item, 'weapon');
      if (
        matching.length &&
        space &&
        apply({ type: 'moveItem', id: item.id, place: 'weapon', ...space })
      )
        for (const a of matching) {
          const old = f.items.find((i) => i.id === f.bindings?.[a.id]);
          if (!old || item.power > old.power) apply({ type: 'bind', art: a.id, item: item.id });
        }
    }
  }
  if (r.phase === 'prep') {
    moveTo(s, 'physician');
    if (f.hp < maximumHp(f) * 0.85) apply({ type: 'heal' });
    moveTo(s, 'blacksmith');
    const bound = f.bindings?.[f.arts[f.active]?.id];
    if (bound) apply({ type: 'refine', id: bound });
    moveTo(s, 'merchant');
    for (const item of [...f.items].filter((i) => i.kind === 'ore'))
      apply({ type: 'sellMaterial', id: item.id });
    if (f.items.filter((i) => i.kind === 'medicine').reduce((n, i) => n + i.count, 0) < 2)
      apply({ type: 'buySupply', templateId: r.supplies![0].templateId });
  }
  apply({ type: 'arrangeItems' });
  if (r.phase === 'prep') moveTo(s, 'exit');
}
export function naturalJourney(seed: number, preferred: ArtId) {
  const s = emptyGame(),
    random = rng(seed);
  // A reproducible saved recruitment candidate, using the production growth distribution.
  // No post-start HP/XP/phase/enemy/loot writes or free equipment.
  s.family.recruitment = {
    tickets: 2,
    anchor: now,
    observedAt: now,
    sequence: 1,
    candidates: [
      {
        id: 'probe',
        seed,
        appearance: 0,
        growth: rollGrowth(random),
        innate: TRAIT_IDS[Math.floor(random() * TRAIT_IDS.length)],
      },
    ],
  };
  if (!command(s, { type: 'startRecruit', id: 'probe', name: '독립 관측' }, now))
    throw Error('Start blocked');
  const route = [...s.run!.regionRoute!],
    growth = s.run!.fighter.growth,
    innate = s.run!.fighter.innate;
  let frames = 0,
    incoming = 0,
    outgoing = 0,
    lastWave = 0;
  const waves: object[] = [];
  while (s.run && frames < 180000) {
    choices(s, preferred);
    const r = s.run!,
      f = r.fighter as BoundFighter;
    if (r.phase === 'dead') {
      command(s, { type: 'claim' }, now);
      break;
    }
    if (r.phase === 'loot' || r.phase === 'prep') {
      supplies(s, preferred);
      waves.push({
        wave: r.wave,
        hp: round(f.hp),
        maxHp: maximumHp(f),
        level: f.level,
        gold: r.gold,
      });
      if (!isGameSave(s)) throw Error('Invalid journey save');
      if (!command(s, { type: 'next' }, now)) throw Error('Next wave blocked');
      continue;
    }
    lastWave = r.wave;
    const active = f.arts.findIndex((a) => a.id === preferred);
    if (active >= 0 && active !== f.active)
      command(s, { type: 'switch', delta: active - f.active }, now);
    if (f.hp < maximumHp(f) * 0.4) {
      const medicine = f.items.find((i) => i.kind === 'medicine' && i.place === 'general');
      if (medicine) command(s, { type: 'use', id: medicine.id }, now);
    }
    const target = r.enemies
      .filter((e) => e.hp > 0)
      .sort((a, b) => Math.hypot(a.x - f.x, a.y - f.y) - Math.hypot(b.x - f.x, b.y - f.y))[0];
    let input = idle;
    if (target) {
      const d = Math.hypot(target.x - f.x, target.y - f.y),
        aim = Math.atan2(target.y - f.y, target.x - f.x);
      const art = f.arts[f.active],
        ranged = art?.id === 'tang' || art?.id === 'jegal';
      const danger = (target.state === 'windup' && target.timer < 0.3) || target.state === 'strike';
      const pattern = enemyAttack(target);
      const angle = ranged
        ? d < 300
          ? aim + Math.PI
          : d > 430
            ? aim
            : aim + Math.PI / 2
        : danger
          ? aim + (pattern.dash || pattern.melee?.shape === 'line' ? Math.PI / 2 : Math.PI)
          : d > 85
            ? aim
            : aim + Math.PI / 2;
      let dx = Math.cos(angle),
        dy = Math.sin(angle);
      if (f.x < 280) dx = Math.max(0.65, dx);
      if (f.x > 1640) dx = Math.min(-0.65, dx);
      if (f.y < 270) dy = Math.max(0.65, dy);
      if (f.y > 820) dy = Math.min(-0.65, dy);
      input = {
        dx,
        dy,
        aim,
        attack: ranged || (!danger && d < 150),
        ultimate:
          !!art && art.gauge >= 100 && art.level >= techniqueStats(art.id, art.level).ultimateLevel,
        defense: !!art && danger && art.defenseCd <= 0 && d < 240,
      };
    }
    tick(r, input, 1 / 60, (cue) => {
      if (cue.kind === 'impact') {
        if (cue.target === 'hero') incoming += cue.amount;
        else outgoing += cue.amount;
      }
    });
    frames++;
  }
  if (s.run) throw Error(`Journey frame bound ${seed}/${preferred}/wave${s.run.wave}`);
  if (!isGameSave(s)) throw Error('Invalid completed save');
  return {
    state: s,
    result: {
      seed,
      preferred,
      route,
      growth,
      innate,
      frames,
      seconds: round(frames / 60),
      lastWave,
      incoming: round(incoming),
      outgoing: round(outgoing),
      waves,
      journey: s.family.journeys![0],
      survivor: s.family.roster[0]
        ? {
            hp: round(s.family.roster[0].hp),
            maxHp: maximumHp(s.family.roster[0]),
            level: s.family.roster[0].level,
            arts: s.family.roster[0].arts.map((a) => ({ id: a.id, level: a.level })),
          }
        : null,
    },
  };
}
export function raidInput(
  m: RaidState,
  seat: number,
  policy: 'reactive' | 'hold' = 'reactive',
): PvpInput {
  const f = m.players[seat].fighter,
    b = m.players[4].fighter;
  const aim = Math.atan2(b.y - f.y, b.x - f.x),
    d = Math.hypot(b.x - f.x, b.y - f.y),
    art = f.arts[f.active];
  const ranged = art.id === 'tang' || art.id === 'jegal',
    orbit = seat % 2 ? -1 : 1;
  const danger = m.boss.phase === 'windup' && m.boss.clock < 0.35;
  let dx = 0,
    dy = 0;
  if (policy === 'reactive') {
    const radial = ranged ? (d > 440 ? 1 : d < 320 ? -1 : 0) : danger ? -1 : d > 90 ? 1 : 0;
    dx = Math.cos(aim) * radial - Math.sin(aim) * 0.7 * orbit;
    dy = Math.sin(aim) * radial + Math.cos(aim) * 0.7 * orbit;
    if (m.boss.phase === 'windup' && m.boss.pattern === 'charge') {
      dx = -Math.sin(m.boss.aim) * orbit;
      dy = Math.cos(m.boss.aim) * orbit;
    }
    if (f.x < 130) dx = Math.max(0.6, dx);
    if (f.x > 1150) dx = Math.min(-0.6, dx);
    if (f.y < 190) dy = Math.max(0.6, dy);
    if (f.y > 630) dy = Math.min(-0.6, dy);
  }
  const len = Math.max(1, Math.hypot(dx, dy));
  return {
    ...neutralInput(),
    dx: dx / len,
    dy: dy / len,
    aim,
    attack: ranged || (!danger && d < 155),
    defense: policy === 'reactive' && danger && d < 240 && art.defenseCd <= 0,
    ultimate: art.gauge >= 100 && art.level >= techniqueStats(art.id, art.level).ultimateLevel,
  };
}
export function normalRaid(
  participants: { name: string; preset: PresetId; fighter?: BoundFighter }[],
  policy: 'reactive' | 'hold',
) {
  const m = createRaid('normal-probe', participants),
    floors: object[] = [];
  let ticks = 0,
    floorTick = 0;
  while (m.phase !== 'finished' && ticks++ < 60 * 60 * 26) {
    if (m.phase === 'rest') {
      floors.push({
        floor: m.cleared,
        seconds: round((m.tick - floorTick) / 60),
        hp: m.players.slice(0, participants.length).map((a) => round(a.fighter.hp)),
        taken: m.taken.map(round),
      });
      for (let i = 0; i < participants.length; i++)
        while (m.players[i].fighter.hp < m.players[i].maxHp * 0.85 && raidMedicine(m, i)) {
          /* finite real medicine */
        }
      nextRaidFloor(m);
      floorTick = m.tick;
    }
    stepRaid(
      m,
      participants.map((_, i) => raidInput(m, i, policy)),
    );
  }
  return {
    party: participants.length,
    personal: m.personal,
    policy,
    result: m.result ?? 'bound',
    cleared: m.cleared,
    seconds: round(m.tick / 60),
    floors,
    hp: m.players.slice(0, participants.length).map((a) => round(a.fighter.hp)),
    taken: m.taken.map(round),
    damage: m.damage.map(round),
  };
}
/** Use the real reservation/reward/management transactions in a disposable memory DB.
 * Only prior natural graduates enter; no test boss HP or free floor/HP/XP edits.
 */
export async function personalRaid(states: GameState[], n: number) {
  const db = new PvpDatabase(':memory:');
  try {
    const members = [];
    const fighters = [];
    let startingSilver = 0,
      startingXp = 0;
    for (let i = 0; i < n; i++) {
      const account = await db.register(
        `probe${i}`,
        'isolated-synthetic-probe-password',
        `관측${i}`,
      );
      const state = structuredClone(states[i]);
      startingSilver += state.family.silver ?? 0;
      startingXp += state.family.roster[0].xp;
      db.online.write(account.id, db.online.read(account.id).revision, state);
      const fighter = reserveFighter(db.online, account.id, state.family.roster[0].id, 'PROBEA');
      members.push({ account, fighterId: fighter.id });
      fighters.push({ name: fighter.name, preset: 'shadow' as const, fighter });
    }
    let m = createRaid('natural-persistent-probe', fighters);
    const persist = () => {
      m = savePersonalRaid(db.online, 'PROBEA', members, m, (value) => JSON.stringify(value), now)!;
    };
    const apply = (seat: number, intent: Command) => {
      m = raidPersonalCommand(
        db.online,
        'PROBEA',
        members,
        m,
        seat,
        intent,
        randomUUID(),
        (value) => JSON.stringify(value),
      );
    };
    const train = (seat: number) => {
      for (let count = 0; count < 100; count++) {
        const save = db.online.read(members[seat].account.id),
          f = m.players[seat].fighter;
        if (f.augmentOffers?.length) apply(seat, { type: 'chooseAugment', id: f.augmentOffers[0] });
        else if (save.state.family.training?.offers.length) {
          const art = f.arts[f.active].id;
          const offer =
            save.state.family.training.offers.find((o) => o.art === art) ??
            save.state.family.training.offers[0];
          apply(seat, { type: 'choose', offer });
        } else return;
      }
      throw Error('Personal training loop');
    };
    persist();
    let ticks = 0;
    const floors: object[] = [];
    while (m.phase !== 'finished' && ticks++ < 26 * 60 * 60) {
      if (m.phase === 'rest') {
        floors.push({
          floor: m.cleared,
          hp: m.players.slice(0, n).map((a) => round(a.fighter.hp)),
          taken: m.taken.map(round),
        });
        for (let i = 0; i < n; i++)
          if (m.status[i] === 'active') {
            train(i);
            for (const item of [...m.players[i].fighter.items]) {
              if (item.kind === 'manual') {
                apply(i, { type: 'use', id: item.id });
                train(i);
              }
              if (item.kind === 'robe' && item.place === 'ground') {
                const old = m.players[i].fighter.items.find(
                  (j) => j.kind === 'robe' && j.place === 'equipped',
                );
                if (!old || item.power > old.power)
                  apply(i, { type: 'moveItem', id: item.id, place: 'equipped' });
              }
            }
            apply(i, { type: 'arrangeItems' });
            for (const item of [...m.players[i].fighter.items].filter((j) => j.place === 'ground'))
              apply(i, { type: 'discardItem', id: item.id });
            while (m.players[i].fighter.hp < m.players[i].maxHp * 0.85) {
              const item = m.players[i].fighter.items.find(
                (j) => j.kind === 'medicine' && j.place === 'general',
              );
              if (!item) break;
              apply(i, { type: 'use', id: item.id });
            }
          }
        if (!nextRaidFloor(m)) throw Error('Personal next floor blocked');
        persist();
      }
      const status = m.status.join(',');
      stepRaid(
        m,
        members.map((_, i) => raidInput(m, i)),
      );
      if (m.phase === 'finished' && m.result === 'time')
        for (let i = 0; i < n; i++)
          if (m.status[i] === 'active') {
            m.status[i] = 'dead';
            m.players[i].fighter.hp = 0;
          }
      if (m.status.join(',') !== status || m.phase === 'rest' || m.phase === 'finished') persist();
    }
    const saves = members.map((p) => db.online.read(p.account.id));
    if (saves.some((s) => !isGameSave(s.state))) throw Error('Personal raid invalid save');
    return {
      party: n,
      personal: true,
      policy: 'reactive',
      result: m.result ?? 'bound',
      cleared: m.cleared,
      seconds: round(m.tick / 60),
      floors,
      hp: m.players.slice(0, n).map((a) => round(a.fighter.hp)),
      taken: m.taken.map(round),
      damage: m.damage.map(round),
      startingSilver,
      finalSilver: saves.reduce((total, s) => total + (s.state.family.silver ?? 0), 0),
      startingXp,
      finalLivingXp: saves.reduce((total, s) => total + (s.state.family.roster[0]?.xp ?? 0), 0),
      deaths: saves.map((s) => s.state.family.deaths),
      unlocked: saves.every((s) => !s.locked),
    };
  } finally {
    db.close();
  }
}
if (process.argv[1]?.endsWith('probe-online-balance.mjs')) {
  const report = process.argv[2];
  if (!report) throw Error('Provide a report output path');
  const journeys = [];
  for (const seed of [123, 222, 777, 2026, 4099, 8713, 19087, 30011, 481516, 90101, 104729, 999983])
    for (const art of ['huashan', 'tang', 'tianmo', 'jegal'] as const) {
      const observation = naturalJourney(seed, art);
      journeys.push(observation);
      console.log(
        JSON.stringify({
          seed,
          art,
          survivor: !!observation.result.survivor,
          lastWave: observation.result.lastWave,
        }),
      );
    }
  const raids = [];
  for (const preset of ['sword', 'shadow', 'monk', 'mystic'] as const)
    for (const n of [1, 2, 3, 4])
      raids.push({
        preset,
        ...normalRaid(
          Array.from({ length: n }, (_, i) => ({ name: `독립${i}`, preset })),
          'reactive',
        ),
      });
  const survivors = journeys.filter((j) => j.state.family.roster.length);
  for (const n of [1, 2, 3, 4])
    if (survivors.length >= n)
      raids.push({
        preset: 'natural',
        ...normalRaid(
          survivors.slice(0, n).map((j) => ({
            name: '자연완주',
            preset: 'shadow' as const,
            fighter: j.state.family.roster[0] as BoundFighter,
          })),
          'reactive',
        ),
      });
  const persistent = [];
  for (const n of [1, 2, 3, 4])
    if (survivors.length >= n)
      persistent.push(
        await personalRaid(
          survivors.map((j) => j.state),
          n,
        ),
      );
  mkdirSync(dirname(report), { recursive: true });
  writeFileSync(
    report,
    JSON.stringify(
      {
        date: '2026-10-23',
        methodology:
          'Deterministic saved candidates; real 60Hz natural combat and legal choices/items/rests; no HP/phase/XP/loot edits. Reactive omniscient bots, not human win rates. The raids array is engine-only without floor rewards. The persistent array uses actual owned survivors, their carried HP/medicine, real reservation/reward/growth/return transactions in a disposable memory SQLite database.',
        journeys: journeys.map((j) => j.result),
        raids,
        persistent,
      },
      null,
      2,
    ) + '\n',
  );
  writeFileSync(
    report.replace(/\.json$/, '-survivors.json'),
    JSON.stringify(survivors.map((j) => j.state)),
  );
  console.log(
    JSON.stringify({
      report,
      graduates: survivors.length,
      raids: raids.map((r) => ({
        party: r.party,
        preset: r.preset,
        cleared: r.cleared,
        result: r.result,
      })),
    }),
  );
}
