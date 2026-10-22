import { pvpFighter, PVP_RULES as R } from '../pvp/rules';
import type { CombatActor, PresetId, PvpAttack, PvpInput } from '../pvp/model';
import { stepCombat } from '../pvp/engine';
import { RAID_FLOORS, type RaidState, type RaidPattern } from './model';
const dt = 1 / 60,
  clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const alive = (m: RaidState) =>
  m.players.slice(0, 4).filter((a, i) => m.status[i] === 'active' && a.fighter.hp > 0);
export const raidScale = (n: number) => 1 + 0.65 * (clamp(n, 1, 4) - 1);
export function createRaid(
  id: string,
  participants: readonly (null | { name: string; preset: PresetId })[],
): RaidState {
  const players: CombatActor[] = Array.from({ length: 5 }, (_, seat) => {
    const p = participants[seat],
      fighter = pvpFighter(p?.preset ?? 'monk', 0, p?.name ?? '');
    fighter.x = 320 + (seat % 2) * 140;
    fighter.y = 340 + Math.floor(seat / 2) * 160;
    fighter.hp = p ? R.hp : 0;
    return {
      seat,
      team: seat === 4 ? 1 : 0,
      passive: seat === 4,
      inactive: !p && seat !== 4,
      preset: p?.preset ?? 'monk',
      fighter,
      maxHp: R.hp,
      poison: 0,
      poisonClock: 0,
      buff: 0,
      hurt: 0,
    };
  });
  const m: RaidState = {
    id,
    players,
    attacks: [],
    effects: [],
    sequence: 0,
    phase: 'rest',
    tick: 0,
    epoch: 0,
    floor: 0,
    phaseTicks: 0,
    floorTicks: 0,
    scaledFor: 1,
    status: Array.from({ length: 4 }, (_, i) => (participants[i] ? 'active' : 'returned')),
    damage: [0, 0, 0, 0],
    taken: [0, 0, 0, 0],
    medicine: [2, 2, 2, 2],
    cleared: 0,
    boss: {
      pattern: 'cleave',
      phase: 'approach',
      clock: 1,
      duration: 1,
      target: 0,
      cycle: 0,
      x: 850,
      y: 420,
      aim: Math.PI,
      chargeLeft: 0,
      nextCharge: 0,
    },
  };
  nextRaidFloor(m);
  return m;
}
export function nextRaidFloor(m: RaidState) {
  if (m.phase !== 'rest' || m.floor >= 5 || !alive(m).length) return false;
  m.floor++;
  m.scaledFor = alive(m).length;
  m.phase = 'countdown';
  m.phaseTicks = 180;
  m.floorTicks = 5 * 60 * 60;
  m.epoch++;
  m.attacks = [];
  m.effects = [];
  const b = m.players[4],
    spec = RAID_FLOORS[m.floor - 1];
  b.fighter.hp = b.maxHp = Math.round(spec.hp * raidScale(m.scaledFor));
  b.fighter.name = spec.boss;
  b.fighter.x = 850;
  b.fighter.y = 420;
  b.fighter.facing = Math.PI;
  b.fighter.guard = 0;
  b.fighter.invulnerable = 0;
  b.poison = b.poisonClock = 0;
  Object.assign(b.fighter, { kind: 'chief' });
  m.boss = {
    pattern: spec.patterns[0],
    phase: 'approach',
    clock: 1.5,
    duration: 1.5,
    target: 0,
    cycle: 0,
    x: 850,
    y: 420,
    aim: Math.PI,
    chargeLeft: 0,
    nextCharge: 0,
  };
  for (const a of alive(m)) {
    a.fighter.x = 300 + (a.seat % 2) * 120;
    a.fighter.y = 310 + Math.floor(a.seat / 2) * 160;
    a.fighter.cooldown = 0;
    a.fighter.guard = a.fighter.invulnerable = 0;
    a.fighter.fortify = 0;
    a.poison = a.poisonClock = a.buff = 0;
    for (const art of a.fighter.arts) art.defenseCd = 0;
    a.fighter.action = 'idle';
    a.fighter.actionTime = 0;
  }
  return true;
}
function spawn(m: RaidState, opts: Partial<PvpAttack>) {
  const f = m.players[4].fighter;
  m.attacks.push({
    id: ++m.sequence,
    owner: 4,
    art: 'gaebang',
    shape: 'sector',
    x: f.x,
    y: f.y - 34,
    angle: m.boss.aim,
    range: 190,
    arc: 1,
    damage: 32,
    delay: 0.95,
    life: 0.2,
    speed: 0,
    radius: 10,
    heal: 0,
    poison: false,
    ...opts,
  });
}
function windup(m: RaidState) {
  const b = m.boss,
    f = m.players[4].fighter,
    targets = alive(m).sort((a, c) => a.seat - c.seat);
  if (!targets.length) return;
  const t = targets[b.cycle % targets.length];
  b.target = t.seat;
  const spec = RAID_FLOORS[m.floor - 1];
  b.pattern = spec.patterns[b.cycle % spec.patterns.length] as RaidPattern;
  b.cycle++;
  b.aim = Math.atan2(t.fighter.y - f.y, t.fighter.x - f.x);
  f.facing = b.aim;
  b.phase = 'windup';
  b.clock = b.duration = 1.05;
  b.x = f.x;
  b.y = f.y;
  f.action = 'attack';
  f.actionTime = 1.5;
  if (b.pattern === 'marks') {
    const rotated = [
      ...targets.slice((b.cycle - 1) % targets.length),
      ...targets.slice(0, (b.cycle - 1) % targets.length),
    ];
    for (const a of rotated.slice(0, Math.min(2, m.scaledFor))) {
      spawn(m, {
        shape: 'burst',
        x: a.fighter.x,
        y: a.fighter.y - 34,
        range: 85,
        damage: 35,
        delay: 1.05,
      });
    }
  } else if (b.pattern === 'volley') {
    for (const angle of [-0.3, 0, 0.3])
      spawn(m, {
        shape: 'shot',
        angle: b.aim + angle,
        life: 2.5,
        speed: 390,
        delay: 1.05,
        radius: 10,
        range: 1000,
        damage: 26,
      });
  } else if (b.pattern === 'charge') {
    b.chargeLeft = 300;
    b.nextCharge = 0;
  } else {
    if (b.pattern === 'guard') f.guard = 2.4;
    spawn(m, {
      range: b.pattern === 'guard' ? 155 : 210,
      arc: b.pattern === 'guard' ? 0.7 : 1.15,
      delay: 1.05,
      damage: 34,
    });
  }
}
function bossStep(m: RaidState) {
  const b = m.boss,
    f = m.players[4].fighter;
  b.clock -= dt;
  if (b.phase === 'approach') {
    const targets = alive(m);
    const t = targets[b.cycle % targets.length];
    if (!t) return;
    const angle = Math.atan2(t.fighter.y - f.y, t.fighter.x - f.x),
      d = Math.hypot(f.x - t.fighter.x, f.y - t.fighter.y);
    f.facing = angle;
    f.action = d > 145 ? 'walk' : 'idle';
    if (d > 145) {
      f.x = clamp(f.x + Math.cos(angle) * 145 * dt, R.left, R.right);
      f.y = clamp(f.y + Math.sin(angle) * 145 * dt, R.top, R.bottom);
    }
    if (b.clock <= 0) windup(m);
  } else if (b.phase === 'windup' && b.clock <= 0) {
    b.phase = 'strike';
    b.clock = b.duration = b.pattern === 'charge' ? 0.6 : 0.28;
    f.actionTime = b.clock;
    f.action = 'attack';
  } else if (b.phase === 'strike') {
    if (b.pattern === 'charge') {
      const dist = Math.min(b.chargeLeft, 500 * dt);
      f.x = clamp(f.x + Math.cos(b.aim) * dist, R.left, R.right);
      f.y = clamp(f.y + Math.sin(b.aim) * dist, R.top, R.bottom);
      b.chargeLeft -= dist;
      b.nextCharge -= dt;
      if (b.nextCharge <= 0) {
        spawn(m, { shape: 'burst', range: 53, delay: 0.001, damage: 18 });
        b.nextCharge = 0.2;
      }
    }
    if (b.clock <= 0) {
      b.phase = 'recover';
      b.clock = b.duration = 1.1;
      f.action = 'idle';
      f.actionTime = 0;
    }
  } else if (b.phase === 'recover' && b.clock <= 0) {
    b.phase = 'approach';
    b.clock = b.duration = 0.7;
  }
}
export function finishRaid(m: RaidState, result: NonNullable<RaidState['result']>) {
  if (m.phase === 'finished') return;
  m.phase = 'finished';
  m.result = result;
  m.attacks = [];
  m.epoch++;
}
export function returnRaidPlayer(m: RaidState, seat: number) {
  if (m.phase !== 'rest' || m.status[seat] !== 'active') return false;
  m.status[seat] = 'returned';
  m.players[seat].inactive = true;
  if (!alive(m).length) finishRaid(m, 'retreat');
  return true;
}
export function cancelRaidCountdown(m: RaidState) {
  if (m.phase !== 'countdown' || m.floor <= 1) return false;
  m.floor--;
  m.phase = 'rest';
  m.epoch++;
  m.attacks = [];
  m.players[4].fighter.hp = 0;
  return true;
}
export function raidMedicine(m: RaidState, seat: number) {
  const a = m.players[seat];
  if (
    m.phase !== 'rest' ||
    m.status[seat] !== 'active' ||
    !m.medicine[seat] ||
    a.fighter.hp >= a.maxHp
  )
    return false;
  m.medicine[seat]--;
  a.fighter.hp = Math.min(a.maxHp, a.fighter.hp + 75);
  return true;
}
export function stepRaid(m: RaidState, inputs: readonly (PvpInput | undefined)[]) {
  if (m.phase === 'finished' || m.phase === 'rest') return;
  m.tick++;
  m.effects.forEach((e) => (e.life -= dt));
  m.effects = m.effects.filter((e) => e.life > 0);
  if (m.phase === 'countdown') {
    if (--m.phaseTicks <= 0) {
      m.phase = 'fighting';
      m.epoch++;
    }
    return;
  }
  m.floorTicks--;
  bossStep(m);
  stepCombat(m, inputs);
  for (let i = 0; i < 4; i++) {
    m.damage[i] = m.players[i].damageDealt ?? 0;
    m.taken[i] = m.players[i].damageTaken ?? 0;
    if (m.status[i] === 'active' && m.players[i].fighter.hp <= 0) m.status[i] = 'dead';
  }
  // A simultaneous party wipe never grants a clear or resurrects players.
  if (!alive(m).length) {
    finishRaid(m, 'wipe');
    return;
  }
  if (m.players[4].fighter.hp <= 0) {
    m.cleared = m.floor;
    m.attacks = [];
    m.epoch++;
    if (m.floor === 5) finishRaid(m, 'complete');
    else m.phase = 'rest';
  } else if (m.floorTicks <= 0) finishRaid(m, 'time');
}
