import { emptyGame, spawnWave, startRun, tick } from '../../src/domain/game';
import { maximumHp, xpThreshold } from '../../src/domain/content';
import { makeLootItem } from '../../src/domain/items';
import { REGIONS } from '../../src/domain/campaign';
import { enemyAttack } from '../../src/domain/combat';
import type { BoundFighter, InputFrame } from '../../src/domain/model';

export type ProbePolicy = 'ranged-lap' | 'melee-hold' | 'melee-punish';
export function balanceFixture(id: string, seed = 123) {
  const s = emptyGame();
  startRun(s, '밸런스 독립 검사', seed);
  const r = s.run!,
    [region, stage] = id.split('-').map(Number);
  r.regionRoute = REGIONS.filter((_, n) => n !== region)
    .slice(0, 4)
    .map((x) => x.name);
  r.regionRoute[stage - 1] = REGIONS[region].name;
  r.wave = stage * 5;
  spawnWave(r);
  r.offers = [];
  const e = r.enemies.find((x) => x.bossId === id)!;
  r.enemies = [e];
  r.zones = [];
  r.encounterObjects = [];
  Object.assign(e, { x: 800, y: 530, state: 'approach', timer: 0, skillClock: 0, xp: 0 });
  const f = r.fighter as BoundFighter;
  f.level = f.spent = r.spent = stage * 4;
  f.xp = xpThreshold(f.level);
  f.augmentOffers = [];
  f.augments = [];
  f.x = 1200;
  f.y = 350;
  return { s, r, e, f };
}

/** Fixed-input pressure probes, not a human skill estimate. HP is replenished
 * per frame on both actors so every policy is observed for the same duration.
 * Damage comes from real contacts/projectiles, including boss-owned summons.
 * No ultimate, defense, consumables, ambient reinforcements or leveling. */
export function bossBalanceProbe(
  id: string,
  policy: ProbePolicy,
  seed = 123,
  seconds = 45,
  duel = false,
) {
  const { r, e, f } = balanceFixture(id, seed);
  const ranged = policy === 'ranged-lap';
  const art = ranged ? 'tang' : 'huashan';
  const weapon = makeLootItem(ranged ? 'weapon-dart-1' : 'weapon-sword-1', 'probe', 'weapon', 80);
  f.items = [weapon];
  f.bindings = { [art]: weapon.id };
  f.arts = [{ id: art, level: 3, gauge: 0, combo: 0, defenseCd: 0 }];
  const hp = maximumHp(f),
    bossHp = e.maxHp;
  const points = [
    [1500, 300],
    [1500, 780],
    [420, 780],
    [420, 300],
  ];
  let point = 0,
    incoming = 0,
    outgoing = 0,
    hits = 0,
    recoverDamage = 0;
  let starts = 0,
    pressureStarts = 0,
    recoverFrames = 0,
    stationaryRecovery = 0,
    minDistance = Infinity,
    elapsed = 0;
  f.hp = hp;
  const moves = new Set<string>();
  for (let n = 0; n < seconds * 60; n++) {
    if (!duel) {
      f.hp = hp;
      e.hp = bossHp;
    }
    r.zoneClock = 0;
    const d = Math.hypot(e.x - f.x, e.y - f.y),
      angle = Math.atan2(e.y - f.y, e.x - f.x);
    let dx = 0,
      dy = 0,
      attack = true;
    if (ranged) {
      const p = points[point];
      dx = p[0] - f.x;
      dy = p[1] - f.y;
      if (Math.hypot(dx, dy) < 12) point = (point + 1) % points.length;
    } else {
      const p = enemyAttack(e);
      const punish = policy === 'melee-punish';
      const danger = punish && (e.state === 'windup' || e.state === 'strike');
      if (danger) {
        const line = p.melee?.shape === 'line' || p.dash > 0;
        dx = Math.cos(angle + (line ? Math.PI / 2 : Math.PI));
        dy = Math.sin(angle + (line ? Math.PI / 2 : Math.PI));
        attack = false;
      } else if (d > 85) {
        dx = e.x - f.x;
        dy = e.y - f.y;
      }
      if (punish) attack = !danger && d < 145;
    }
    const state = e.state,
      x = e.x,
      y = e.y;
    const input: InputFrame = { dx, dy, aim: angle, attack, defense: false, ultimate: false };
    tick(r, input, 1 / 60, (cue) => {
      if (cue.kind !== 'impact') return;
      if (cue.target === 'hero') {
        incoming += cue.amount;
        hits++;
      } else if (cue.target === e.id) {
        outgoing += cue.amount;
        if (e.state === 'recover') recoverDamage += cue.amount;
      }
    });
    elapsed = (n + 1) / 60;
    if (state !== 'windup' && e.state === 'windup') {
      starts++;
      moves.add(e.move!);
    }
    if (e.pressure?.warning === 0.32) pressureStarts++;
    if (state === 'recover' && e.state === 'recover') {
      recoverFrames++;
      if (Math.hypot(e.x - x, e.y - y) < 0.01) stationaryRecovery++;
    }
    minDistance = Math.min(minDistance, d);
    if (duel && (e.hp <= 0 || f.hp <= 0 || r.phase !== 'combat')) break;
    if (r.phase !== 'combat')
      throw new Error(`Probe unexpectedly ended: ${id}/${policy}/${r.phase}`);
  }
  return {
    id,
    seed,
    policy,
    seconds,
    heroHp: hp,
    bossHp,
    incoming,
    outgoing,
    hits,
    recoverDamage,
    starts,
    pressureStarts,
    recoverSeconds: recoverFrames / 60,
    stationaryRecoverySeconds: stationaryRecovery / 60,
    minDistance,
    moves: [...moves],
    playerAttacks: f.attackSeq,
    elapsed,
    outcome: !duel
      ? 'pressure-probe'
      : e.hp <= 0
        ? 'boss-defeated'
        : f.hp <= 0
          ? 'hero-dead'
          : 'timeout',
    remainingHeroHp: f.hp,
    remainingBossHp: e.hp,
  };
}
