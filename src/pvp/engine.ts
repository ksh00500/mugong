import { techniqueStats, DEFENSE_RULES } from '../domain/techniques';
import { combatOrigin, sectorHitsBody, projectileHitsBody } from '../domain/combat-body';
import type { ArtId } from '../domain/model';
import { PVP_RULES as R, pvpFighter } from './rules';
import type {
  PvpMatch,
  PvpActor,
  PvpInput,
  Seat,
  PvpAttack,
  PresetId,
  PvpMode,
  EndReason,
} from './model';
const DT = 1 / 60,
  clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const other = (s: Seat) => (1 - s) as Seat;
function effect(m: PvpMatch, seat: Seat, kind: 'hit' | 'guard' | 'evade' | 'ultimate', amount = 0) {
  const f = m.players[seat].fighter;
  m.effects.push({ id: ++m.sequence, seat, kind, x: f.x, y: f.y - 34, amount, life: 0.42 });
}
export function createPvpMatch(
  id: string,
  mode: PvpMode,
  players: [{ name: string; preset: PresetId }, { name: string; preset: PresetId }],
): PvpMatch {
  return {
    id,
    mode,
    phase: 'countdown',
    tick: 0,
    epoch: 1,
    round: 1,
    phaseTicks: R.countdown,
    roundTicks: R.roundTime,
    totalTicks: 0,
    wins: [0, 0],
    players: players.map((p, seat) => ({
      seat: seat as Seat,
      preset: p.preset,
      fighter: pvpFighter(p.preset, seat as Seat, p.name),
      maxHp: R.hp,
      poison: 0,
      poisonClock: 0,
      buff: 0,
      hurt: 0,
    })) as [PvpActor, PvpActor],
    attacks: [],
    effects: [],
    sequence: 0,
    roundWinner: null,
    winner: null,
  };
}
export function finishPvp(m: PvpMatch, winner: Seat | null, reason: EndReason) {
  if (m.phase === 'finished') return;
  m.phase = 'finished';
  m.winner = winner;
  m.reason = reason;
  if (winner !== null && (reason === 'surrender' || reason === 'disconnect'))
    m.wins[winner] = Math.max(2, m.wins[winner]);
  m.epoch++;
  m.attacks = [];
}
function finishRound(m: PvpMatch, winner: Seat | null, reason: EndReason) {
  m.roundWinner = winner;
  if (winner !== null) m.wins[winner]++;
  m.attacks = [];
  m.epoch++;
  if (m.wins.some((n) => n >= 2) || m.round >= R.maxRounds || m.totalTicks >= 8 * 60 * 60) {
    const result = m.wins[0] === m.wins[1] ? null : m.wins[0] > m.wins[1] ? 0 : 1;
    finishPvp(m, result, reason);
    return;
  }
  m.phase = 'interval';
  m.phaseTicks = R.interval;
  m.reason = reason;
}
function move(a: PvpActor, angle: number, distance: number) {
  const f = a.fighter;
  f.x = clamp(f.x + Math.cos(angle) * distance, R.left, R.right);
  f.y = clamp(f.y + Math.sin(angle) * distance, R.top, R.bottom);
}
function spawn(
  m: PvpMatch,
  a: PvpActor,
  art: ArtId,
  damage: number,
  options: Partial<PvpAttack> = {},
) {
  const f = a.fighter,
    o = combatOrigin(f);
  m.attacks.push({
    id: ++m.sequence,
    owner: a.seat,
    art,
    shape: 'sector',
    x: o.x,
    y: o.y,
    angle: f.facing,
    range: 140,
    arc: 0.9,
    damage,
    delay: 0.09,
    life: 0.11,
    speed: 0,
    radius: 8,
    heal: 0,
    poison: false,
    ...options,
  });
}
function defend(m: PvpMatch, a: PvpActor, input: PvpInput) {
  const f = a.fighter,
    art = f.arts[f.active];
  if (art.defenseCd > 0) return;
  art.defenseCd = techniqueStats(art.id, art.level, f).defenseCooldown;
  f.action = 'defense';
  f.actionTime = 0.3;
  f.cooldown = Math.max(f.cooldown, 0.25);
  m.attacks = m.attacks.filter((at) => at.owner !== a.seat || at.delay <= 0);
  const angle = input.dx || input.dy ? Math.atan2(input.dy, input.dx) : f.facing;
  if (['huashan', 'tang', 'gaebang'].includes(art.id)) {
    move(a, angle, art.id === 'huashan' ? 145 : 115);
    f.invulnerable = art.id === 'huashan' ? DEFENSE_RULES.evadeDuration : 0.22;
    effect(m, a.seat, 'evade');
  } else if (art.id === 'tianmo') {
    f.facing = input.aim;
    spawn(m, a, art.id, 25, { range: 130, heal: 0.25 });
    effect(m, a.seat, 'guard');
  } else {
    f.guard = techniqueStats(art.id, art.level, f).guardDuration;
    effect(m, a.seat, 'guard');
  }
}
function ultimate(m: PvpMatch, a: PvpActor) {
  const f = a.fighter,
    art = f.arts[f.active];
  if (
    art.gauge < 100 ||
    (f.cooldown > 0 && art.id !== 'huashan') ||
    (art.id === 'gaebang' && (art.queuedBoosts ?? 0) >= 2)
  )
    return;
  art.gauge -= 100;
  f.cooldown = art.id === 'gaebang' ? 0.18 : 0.65;
  effect(m, a.seat, 'ultimate');
  if (art.id === 'gaebang') {
    art.queuedBoosts = (art.queuedBoosts ?? 0) + 1;
    return;
  }
  f.action = 'ultimate';
  f.actionTime = 0.6;
  if (art.id === 'wudang') {
    a.buff = 4;
    f.guard = 0.35;
    return;
  }
  if (art.id === 'huashan') {
    move(a, f.facing, 150);
    f.invulnerable = 0.65;
    spawn(m, a, art.id, 62, { shape: 'burst', range: 155 });
    return;
  }
  if (art.id === 'shaolin') {
    f.fortify = 5;
    spawn(m, a, art.id, 45, { shape: 'burst', range: 185 });
    return;
  }
  if (art.id === 'samja') {
    spawn(m, a, art.id, 60, { shape: 'shot', range: 600, life: 1.1, speed: 640, radius: 24 });
    return;
  }
  if (art.id === 'jegal') {
    for (const offset of [-0.25, 0, 0.25])
      spawn(m, a, art.id, 22, {
        shape: 'shot',
        angle: f.facing + offset,
        life: 1.2,
        speed: 570,
        radius: 13,
      });
    return;
  }
  if (art.id === 'tang') {
    const target = m.players[other(a.seat)];
    spawn(m, a, art.id, 28 + target.poison * 12, { shape: 'burst', range: 280 });
    return;
  }
  spawn(m, a, art.id, 58, { shape: 'burst', range: 220, heal: 0.25 });
}
function attack(m: PvpMatch, a: PvpActor) {
  const f = a.fighter,
    art = f.arts[f.active];
  if (f.cooldown > 0) return;
  const stats = techniqueStats(art.id, art.level, f),
    boosted = art.id === 'gaebang' && (art.queuedBoosts ?? 0) > 0;
  if (boosted) art.queuedBoosts!--;
  f.cooldown = stats.attackInterval;
  f.action = 'attack';
  f.actionTime = 0.28;
  f.attackSeq++;
  art.combo = (art.combo + 1) % 3;
  const damage = 9 * stats.multiplier * (boosted ? 1.5 : 1) * (a.buff > 0 ? 1.25 : 1);
  if (art.id === 'tang' || art.id === 'jegal')
    spawn(m, a, art.id, damage * 0.8, {
      shape: 'shot',
      life: 1.0,
      speed: 650,
      radius: art.id === 'tang' ? 6 : 12,
      poison: art.id === 'tang',
    });
  else
    spawn(m, a, art.id, damage, {
      range:
        art.id === 'gaebang' ? 190 : art.id === 'samja' ? 160 : art.id === 'shaolin' ? 105 : 140,
      arc: art.id === 'gaebang' ? 0.45 : 0.9,
      heal: art.id === 'tianmo' ? 0.1 : 0,
    });
}
type Contact = {
  source: Seat;
  target: Seat;
  damage: number;
  heal: number;
  poison: boolean;
  art: ArtId;
  dot?: boolean;
};
/** Both sides' contacts are gathered before HP changes; simultaneous KOs stay draws. */
function resolveContacts(m: PvpMatch, contacts: Contact[]) {
  const loss = [0, 0],
    healing = [0, 0];
  for (const c of contacts) {
    const a = m.players[c.source],
      target = m.players[c.target],
      f = target.fighter;
    if (f.invulnerable > 0 && !c.dot) continue;
    const angle = Math.atan2(a.fighter.y - f.y, a.fighter.x - f.x),
      front = Math.abs(Math.atan2(Math.sin(angle - f.facing), Math.cos(angle - f.facing))) <= 1.35;
    let damage = c.damage;
    if (f.guard > 0 && front && !c.dot) {
      damage *= DEFENSE_RULES.guardDamageFactor;
      effect(m, c.target, 'guard');
      if (f.arts[f.active].id === 'wudang') {
        loss[c.source] += 18;
        f.guard = 0;
        f.arts[f.active].gauge = Math.min(100, f.arts[f.active].gauge + 12);
      }
    }
    if ((f.fortify ?? 0) > 0) damage *= 0.65;
    loss[c.target] += damage;
    healing[c.source] += damage * c.heal;
    if (c.poison) {
      target.poison = Math.min(3, target.poison + 1);
      target.poisonClock = 3;
    }
    const art = a.fighter.arts.find((at) => at.id === c.art);
    if (art && !c.dot) art.gauge = Math.min(c.art === 'gaebang' ? 200 : 100, art.gauge + 12);
  }
  for (const a of m.players) {
    const amount = Math.min(a.fighter.hp, loss[a.seat]);
    if (loss[a.seat] > 0) healing[other(a.seat)] *= amount / loss[a.seat];
    a.fighter.hp = Math.max(0, a.fighter.hp - amount);
    if (amount > 0) {
      a.hurt = 0.12;
      effect(m, a.seat, 'hit', Math.round(amount));
    }
  }
  for (const a of m.players)
    if (a.fighter.hp > 0) a.fighter.hp = Math.min(a.maxHp, a.fighter.hp + healing[a.seat]);
}
export function stepPvp(m: PvpMatch, inputs: readonly [PvpInput, PvpInput]) {
  if (m.phase === 'finished' || m.phase === 'waiting') return;
  m.tick++;
  m.totalTicks++;
  m.effects.forEach((e) => (e.life -= DT));
  m.effects = m.effects.filter((e) => e.life > 0);
  if (m.phase === 'countdown') {
    if (--m.phaseTicks <= 0) {
      m.phase = 'fighting';
      m.epoch++;
    }
    return;
  }
  if (m.phase === 'interval') {
    if (--m.phaseTicks <= 0) {
      m.round++;
      m.roundTicks = R.roundTime;
      m.phase = 'countdown';
      m.phaseTicks = R.countdown;
      m.epoch++;
      m.effects = [];
      for (const a of m.players) {
        a.fighter = pvpFighter(a.preset, a.seat, a.fighter.name);
        a.poison = a.poisonClock = a.buff = a.hurt = 0;
      }
    }
    return;
  }
  m.roundTicks--;
  const contacts: Contact[] = [];
  for (const a of m.players) {
    const f = a.fighter,
      input = inputs[a.seat];
    f.cooldown = Math.max(0, f.cooldown - DT);
    f.actionTime = Math.max(0, f.actionTime - DT);
    f.invulnerable = Math.max(0, f.invulnerable - DT);
    f.guard = Math.max(0, f.guard - DT);
    f.fortify = Math.max(0, (f.fortify ?? 0) - DT);
    a.buff = Math.max(0, a.buff - DT);
    a.hurt = Math.max(0, a.hurt - DT);
    for (const art of f.arts) art.defenseCd = Math.max(0, art.defenseCd - DT);
    if (a.poisonClock > 0) {
      const before = Math.floor(a.poisonClock);
      a.poisonClock = Math.max(0, a.poisonClock - DT);
      if (Math.floor(a.poisonClock) < before)
        contacts.push({
          source: other(a.seat),
          target: a.seat,
          damage: a.poison * 2,
          heal: 0,
          poison: false,
          art: 'tang',
          dot: true,
        });
      if (!a.poisonClock) a.poison = 0;
    }
    if (f.actionTime <= 0) {
      f.action = 'idle';
      if (input.switch) f.active = (f.active + input.switch + f.arts.length) % f.arts.length;
    }
    const length = Math.hypot(input.dx, input.dy);
    if (length && (f.actionTime <= 0 || f.action === 'attack')) {
      move(a, Math.atan2(input.dy, input.dx), R.speed * DT * (f.action === 'attack' ? 0.6 : 1));
      if (f.actionTime <= 0) {
        f.action = 'walk';
        f.facing = Math.atan2(input.dy, input.dx);
      }
    }
    if (input.defense) defend(m, a, input);
    else if (input.ultimate) {
      f.facing = input.aim;
      ultimate(m, a);
    } else if (input.attack) {
      if (f.cooldown <= 0) f.facing = input.aim;
      attack(m, a);
    }
  }
  for (const at of m.attacks) {
    const before = at.delay;
    at.delay -= DT;
    if (at.delay > 0) continue;
    const a = m.players[at.owner],
      target = m.players[other(at.owner)],
      f = target.fighter;
    if (at.shape === 'shot') {
      const from = { x: at.x, y: at.y };
      at.x += Math.cos(at.angle) * at.speed * DT;
      at.y += Math.sin(at.angle) * at.speed * DT;
      if (projectileHitsBody(from, at, f, at.radius)) {
        contacts.push({
          source: at.owner,
          target: target.seat,
          damage: at.damage,
          heal: at.heal,
          poison: at.poison,
          art: at.art,
        });
        at.life = 0;
      }
      at.life -= DT;
    } else {
      if (before > 0) {
        const hit =
          at.shape === 'burst'
            ? Math.hypot(a.fighter.x - f.x, a.fighter.y - f.y) <= at.range
            : sectorHitsBody(a.fighter, f, at.angle, at.range, at.arc);
        if (hit)
          contacts.push({
            source: at.owner,
            target: target.seat,
            damage: at.damage,
            heal: at.heal,
            poison: at.poison,
            art: at.art,
          });
      }
      at.life -= DT;
    }
  }
  m.attacks = m.attacks
    .filter(
      (at) =>
        at.life > 0 && at.x > -100 && at.x < R.width + 100 && at.y > -100 && at.y < R.height + 100,
    )
    .slice(-64);
  resolveContacts(m, contacts);
  if (m.players.some((a) => a.fighter.hp <= 0)) {
    finishRound(
      m,
      m.players.every((a) => a.fighter.hp <= 0) ? null : m.players[0].fighter.hp > 0 ? 0 : 1,
      'knockout',
    );
    return;
  }
  if (m.roundTicks <= 0 || m.totalTicks >= 8 * 60 * 60) {
    const [a, b] = m.players.map((p) => p.fighter.hp / p.maxHp);
    finishRound(m, Math.abs(a - b) < 0.000001 ? null : a > b ? 0 : 1, 'time');
  }
}
