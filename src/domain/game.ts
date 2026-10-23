import {
  augmentOffers,
  innateAttack,
  innateHit,
  pendingChoices,
  stepTraits,
  TRAIT_IDS,
  switchTrait,
  evadeTrait,
  counterTrait,
  damagedTrait,
} from './character';
import { fighterAttackPower, fighterMoveSpeed, fighterDamageTaken } from './fighter-combat-values';
import { addJegalFormation, jegalUltimate } from './tang-jegal';
import { recruitmentAction, recruitmentView } from './recruitment';
import { combatActionBlock } from './combat-actions';
import { isWalkablePreparation, walkWaystation } from './waystation';
import { resolveRestEvent } from './rest-event';
import {
  combatReport,
  trackCombatWave,
  finishCombatWave,
  recordDamage,
  enemyDamageSource,
  type DamageSource,
} from './combat-report';
import {
  BALANCE,
  encounterHp,
  balanceStage,
  ordinaryHpFactor,
  ordinaryDamageFactor,
} from './balance';
import { healingOffer } from './preparation';
import { isBossEnemy, clearBossControl } from './boss-resilience';
import { bossCommitRange, commitBossPressure, stepBossPressure } from './boss-pressure';
import { bossOpening } from './boss-recovery';
import {
  ARTS,
  ART_IDS,
  ART_WEAPONS,
  FIELD,
  isBoss,
  isPrep,
  makeWeapon,
  maximumHp,
  xpThreshold,
} from './content';
import { bossDefinition, drawRegionRoute, regionName } from './campaign';
import { dashHits, enemyAttack, STRIKE_TIMING, type CombatCueSink } from './combat';
import { meleeKit, meleeHits } from './boss-melee';
import { regionEnemy, ROLE_PROFILES } from './region-enemies';
import {
  steerEnemy,
  resetSteering,
  turnToward,
  observeTarget,
  observedVelocity,
  predictedTarget,
  tacticalBossMove,
  tacticalMovement,
  canCommitAttack,
  repositionFactor,
} from './enemy-tactics';
import { segmentDistance } from './enemy-geometry';
import { COMBAT_HEIGHT, combatOrigin, projectileHitsBody, sectorHitsBody } from './combat-body';
import { DEFENSE_RULES, techniqueStats } from './techniques';
import { supportStats } from './support';
import {
  friendlyProjectileVisual,
  hostileProjectileVisual,
  hazardProjectileVisual,
} from './projectile-visual';
import { movementFactor, stepEnvironment } from './environment';
import { stepFieldStatuses } from './field-effects';
import { reflectBamboo, stepBossBehavior } from './boss-mechanics';
import { canStack } from './boss-loot';
import { merchantSupplies, rollWaveLoot } from './loot';
import {
  isRefiningMaterial,
  itemValue,
  makeLootItem,
  refinePreview,
  REFINE_COST,
  stackable,
} from './items';
import {
  bossDamageFactor,
  encounterAttackRecovery,
  bossSignature,
  damageObject,
  objectBodyRadius,
  recoveryFactor,
  signatureCast,
  stepEncounters,
} from './boss-encounters';
import {
  canPlace,
  activeWeapon,
  compatibleWeapon,
  compactBags,
  equipmentSwapPlan,
  firstSpace,
  hasWeapon,
  removeBindings,
  useItem,
} from './inventory';
import type {
  ArtId,
  BoundFighter,
  Command,
  Enemy,
  Fighter,
  GameState,
  InputFrame,
  Item,
  Offer,
  Run,
} from './model';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);
const angularDistance = (a: number, b: number) =>
  Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
export function emptyGame(): GameState {
  return {
    version: 1,
    family: { roster: [], warehouse: [], runs: 0, victories: 0, deaths: 0, retired: 0 },
    run: null,
    selectedId: null,
  };
}
export function random(run: Pick<Run, 'seed'>) {
  run.seed = (Math.imul(run.seed, 1664525) + 1013904223) >>> 0;
  return run.seed / 4294967296;
}
export type OfferExclusion = 'max' | 'cost' | 'limit' | 'space';
/** One source for both selection and its explanation; never changes the budget. */
export function offerAvailability(f: Fighter) {
  const affordable = (cost: number) =>
    f.progressionVersion !== 2 || (f.trainingPoints ?? 0) >= cost;
  return ART_IDS.map((art) => {
    const known = f.arts.find((a) => a.id === art);
    const cost = known?.level ?? 1;
    const reasons: OfferExclusion[] = [];
    if (known) {
      if (known.level >= ARTS[art].max) reasons.push('max');
    } else {
      if (f.arts.length >= 4) reasons.push('limit');
      if (!(
        f.items.some((item) => item.place === 'weapon' && compatibleWeapon(item, art)) ||
        firstSpace(f.items, makeWeapon(ART_WEAPONS[art], `preview-${art}`, 'weapon'), 'weapon')
      ))
        reasons.push('space');
    }
    if (!affordable(cost)) reasons.push('cost');
    return { offer: { art, type: known ? 'upgrade' : 'learn' } as Offer, cost, reasons };
  });
}
export function eligibleOffers(f: Fighter): Offer[] {
  return offerAvailability(f)
    .filter((entry) => !entry.reasons.length)
    .map((entry) => entry.offer);
}
export function rollOffers(r: Run) {
  if (
    r.fighter.progressionVersion === 2 &&
    (r.fighter.trainingPoints ?? 0) <= (r.fighter.deferredTrainingPoints ?? -1)
  ) {
    augmentOffers(r.fighter, () => random(r));
    return;
  }
  if (
    pendingChoices(r) ||
    (r.fighter.progressionVersion === 2
      ? (r.fighter.trainingPoints ?? 0) < 1
      : r.spent >= r.fighter.level) ||
    r.phase === 'dead'
  ) {
    if (r.phase !== 'dead') augmentOffers(r.fighter, () => random(r));
    return;
  }
  if (r.fighter.progressionVersion === 2) {
    augmentOffers(r.fighter, () => random(r));
    if (pendingChoices(r)) return;
  }
  const pool = eligibleOffers(r.fighter);
  for (let n = pool.length - 1; n > 0; n--) {
    const i = Math.floor(random(r) * (n + 1));
    [pool[n], pool[i]] = [pool[i], pool[n]];
  }
  r.offers = pool.slice(0, 3);
}
function trainFamily(state: GameState, f: Fighter) {
  if (f.progressionVersion === 2) {
    const pending =
      state.family.training?.fighterId === f.id
        ? state.family.training
        : { fighterId: f.id, offers: [], seed: f.attackSeq + f.xp };
    augmentOffers(f, () => random(pending));
    pending.fighterId = f.id;
    if (f.augmentOffers?.length || (f.trainingPoints ?? 0) <= (f.deferredTrainingPoints ?? -1))
      pending.offers = [];
    else if (!pending.offers.length) {
      const pool = eligibleOffers(f);
      for (let n = pool.length - 1; n > 0; n--) {
        const i = Math.floor(random(pending) * (n + 1));
        [pool[n], pool[i]] = [pool[i], pool[n]];
      }
      pending.offers = pool.slice(0, 3);
    }
    state.family.training = pending.offers.length || f.augmentOffers?.length ? pending : undefined;
    return;
  }
  if ((f.spent ?? f.level) >= f.level) {
    state.family.training = undefined;
    return;
  }
  const pending =
    state.family.training?.fighterId === f.id
      ? state.family.training
      : { fighterId: f.id, offers: [] as Offer[], seed: f.attackSeq + f.xp };
  if (!pending.offers.length) {
    const pool = eligibleOffers(f);
    for (let n = pool.length - 1; n > 0; n--) {
      const i = Math.floor(random(pending) * (n + 1));
      [pool[n], pool[i]] = [pool[i], pool[n]];
    }
    pending.offers = pool.slice(0, 3);
  }
  state.family.training = pending.offers.length ? pending : undefined;
}
export function grantXp(r: Run, amount: number) {
  r.fighter.xp += amount;
  const before = maximumHp(r.fighter);
  while (r.fighter.xp >= xpThreshold(r.fighter.level + 1)) r.fighter.level++;
  r.fighter.hp += maximumHp(r.fighter) - before;
  rollOffers(r);
}
function budgets(total: number) {
  const weights = Array.from({ length: 20 }, (_, i) => (isPrep(i + 1) ? 0 : isBoss(i + 1) ? 2 : 1));
  const sum = weights.reduce<number>((a, b) => a + b, 0);
  const values = weights.map((w) => Math.floor((total * w) / sum));
  values[19] += total - values.reduce((a, b) => a + b, 0);
  return values;
}
export function startRun(
  state: GameState,
  name: string,
  seed = Math.floor(Math.random() * 0xffffffff),
) {
  if (state.run) return false;
  state.family.runs++;
  const id = `run-${state.family.runs}-${seed}`;
  const sword = makeLootItem('weapon-sword-0', `${id}-starter-sword`, 'weapon');
  const potion = makeLootItem('medicine-small', `${id}-starter-medicine`, 'general');
  const f: Fighter = {
    id,
    name: name.trim().slice(0, 12) || '무명',
    level: 0,
    xp: 0,
    hp: maximumHp(),
    arts: [],
    active: 0,
    items: [sword, potion],
    spent: 0,
    x: 960,
    y: 600,
    facing: -Math.PI / 2,
    action: 'idle',
    actionTime: 0,
    cooldown: 0,
    invulnerable: 0,
    guard: 0,
    shield: 0,
    attackSeq: 0,
  };
  const r: Run = {
    restEventRevision: 2,
    id,
    seed,
    wave: 1,
    phase: 'combat',
    fighter: f,
    enemies: [],
    projectiles: [],
    effects: [],
    attacks: [],
    formations: [],
    offers: [],
    spent: 0,
    xpBudget: [],
    gold: 0,
    kills: 0,
    elapsed: 0,
    message: '무공 없는 첫걸음. 전투 경험으로 첫 무공을 배우세요.',
    merchantStock: 3,
  };
  // Four boss manuals add 80 XP. The entire generated run remains below Lv.17.
  r.xpBudget = budgets(650 + Math.floor(random(r) * 271));
  r.regionRoute = drawRegionRoute(() => random(r));
  state.run = r;
  spawnWave(r);
  return true;
}
export function spawnWave(r: Run) {
  r.fighter.traitState = {};
  for (const enemy of r.enemies) enemy.moving = false;
  r.effects = [];
  r.projectiles = [];
  r.attacks = [];
  r.formations = [];
  r.zones = [];
  r.zoneClock = 0;
  r.zoneSeq = 0;
  r.encounterObjects = [];
  r.encounterSeq = 0;
  r.petalStrikes = [];
  r.fighter.slowTime = r.fighter.healSuppression = 0;
  r.fighter.poisonTime = r.fighter.burnTime = r.fighter.fieldTick = 0;
  r.fighter.bleedTime =
    r.fighter.coldStacks =
    r.fighter.coldTime =
    r.fighter.freezeTime =
    r.fighter.capturedTime =
      0;
  r.fighter.fortify = 0;
  for (const art of r.fighter.arts) {
    art.buffTime = 0;
    art.rally = 0;
    art.rallyTime = 0;
    art.chainTime = 0;
    art.bonus = 0;
  }
  r.enemies = [];
  r.fighter.x = 960;
  r.fighter.y = 650;
  r.fighter.action = 'idle';
  r.fighter.cooldown = 0;
  if (isPrep(r.wave)) {
    r.phase = 'prep';
    r.merchantStock = 3;
    r.supplies = merchantSupplies(r);
    r.message = '정비 구간 · 가방을 정리하고 다음 보스를 준비하세요.';
    return;
  }
  r.phase = 'combat';
  if (regionName(r) === '설산')
    r.zones.push({
      id: 0,
      x: 960,
      y: 535,
      radius: 190,
      kind: 'cold',
      warning: 0,
      life: 100000,
      pulse: 0,
    });
  const boss = isBoss(r.wave),
    count = boss ? 1 : 4 + Math.floor(r.wave / 3) + Math.floor((r.wave - 1) / 5);
  const featured = boss ? bossDefinition(r) : null;
  const waveXp = r.xpBudget[r.wave - 1];
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
    const stage = Math.floor((r.wave - 1) / 5);
    const regional = regionEnemy(r, i);
    const kind = boss ? (r.wave === 5 || r.wave === 15 ? 'chief' : 'captain') : regional.kind;
    const maxHp = encounterHp(stage, boss, kind === 'spear');
    r.enemies.push({
      id: r.wave * 100 + i,
      kind,
      role: boss ? undefined : regional.role,
      bossId: featured?.id,
      x: clamp(960 + Math.cos(angle) * 580, 220, 1700),
      y: clamp(520 + Math.sin(angle) * 250, 260, 770),
      hp: maxHp,
      maxHp,
      facing: 0,
      state: 'approach',
      timer: 0.25 + random(r) * 0.5,
      aim: 0,
      pattern: 0,
      xp: Math.floor(waveXp / count) + (i < waveXp % count ? 1 : 0),
      elite: r.wave >= 15,
      hitSeq: -1,
    });
  }
  r.message = boss
    ? '보스의 공격 예고를 읽고 빈틈을 노리세요.'
    : '적을 처치하면 전투 후 전리품을 챙길 수 있습니다.';
}
function fx(
  r: Run,
  x: number,
  y: number,
  kind: Run['effects'][number]['kind'],
  angle = 0,
  radius = 60,
  color = 0xf4e0af,
  duration = 0.25,
  weapon?: Run['effects'][number]['weapon'],
) {
  r.effects.push({
    x,
    y,
    kind,
    angle,
    radius,
    color,
    life: duration,
    duration,
    ...(weapon ? { weapon } : {}),
  });
}
function killEnemy(r: Run, e: Enemy) {
  if (r.fighter.innate === 'momentum') (r.fighter.traitState ??= {}).momentum = 2;
  r.kills++;
  r.gold +=
    e.bossId || e.kind === 'chief' || e.kind === 'captain'
      ? BALANCE.bossGoldByStage[balanceStage(Math.floor((r.wave - 1) / 5))]
      : e.xp
        ? BALANCE.ordinaryGold
        : 0;
  grantXp(r, e.xp);
  const art = r.fighter.arts[r.fighter.active];
  const support = supportStats(r.fighter);
  r.fighter.hp = Math.min(
    maximumHp(r.fighter),
    r.fighter.hp + support.killHealing * recoveryFactor(r.fighter),
  );
  if (art) art.gauge = Math.min(art.id === 'gaebang' ? 200 : 100, art.gauge + support.killGauge);
  if (art?.id === 'tianmo') {
    recoverRally(r, 0.6);
    if ((art.buffTime ?? 0) > 0) {
      const heal = Math.min(2.4, 12 - (art.ultimateHealing ?? 0));
      art.ultimateHealing = (art.ultimateHealing ?? 0) + heal;
      r.fighter.hp = Math.min(
        maximumHp(r.fighter),
        r.fighter.hp + heal * recoveryFactor(r.fighter),
      );
    }
  }
  if ((e.poisonLevel ?? 0) >= 4 && (e.poisonStacks ?? 0) > 0)
    for (const nearby of r.enemies
      .filter((enemy) => enemy.hp > 0 && enemy.id !== e.id && distance(enemy, e) < 160)
      .slice(0, 2))
      applyPoison(
        nearby,
        e.poisonDamage ?? 2,
        e.poisonLevel ?? 4,
        Math.ceil((e.poisonStacks ?? 0) / 2),
      );
}
function applyPoison(e: Enemy, damage: number, level: number, stacks = 1) {
  const existing = (e.poisonTime ?? 0) > 0 && (e.poisonStacks ?? 0) > 0;
  const effectiveLevel = existing ? Math.max(level, e.poisonLevel ?? 0) : level;
  e.poisonStacks = Math.min(
    effectiveLevel >= 4 ? 5 : 3,
    (existing ? (e.poisonStacks ?? 0) : 0) + stacks,
  );
  e.poisonTime = 3;
  e.poisonDamage = existing ? Math.max(damage, e.poisonDamage ?? 0) : damage;
  e.poisonLevel = effectiveLevel;
  if (!existing) e.poisonTick = 0.5;
  else e.poisonTick ??= 0.5;
}
function recoverRally(r: Run, factor: number, emit?: CombatCueSink) {
  const f = r.fighter,
    art = f.arts.find((a) => a.id === 'tianmo');
  if (!art || (art.rallyTime ?? 0) <= 0 || (art.rally ?? 0) <= 0) return;
  const amount = Math.min(
    art.rally ?? 0,
    (art.rally ?? 0) * factor * ((art.buffTime ?? 0) > 0 ? 1.5 : 1),
  );
  f.hp = Math.min(maximumHp(f), f.hp + amount * recoveryFactor(f));
  art.rally = Math.max(0, (art.rally ?? 0) - amount);
  emit?.({ kind: 'defense', x: f.x, y: f.y, angle: f.facing, action: 'leech' });
}
function hitEnemy(
  r: Run,
  e: Enemy,
  damage: number,
  heal = false,
  emit?: CombatCueSink,
  charge = true,
  sourceArt?: ArtId,
  basicHit = false,
  attackSequence?: number,
  meleeContact = false,
) {
  if (e.hp <= 0) return;
  const before = e.hp;
  const support = supportStats(r.fighter);
  if (basicHit && sourceArt !== 'tang' && support.poisonLevel)
    applyPoison(e, Math.max(1, damage * 0.04), support.poisonLevel);
  if (basicHit) damage *= innateHit(r.fighter, e.id, attackSequence);
  // Reward an actual close weapon contact in the stationary recovery. Poison,
  // ranged casts, ultimates and pre-existing projectiles get no opening bonus.
  if (
    basicHit &&
    meleeContact &&
    bossOpening(e) &&
    sourceArt !== 'tang' &&
    sourceArt !== 'jegal' &&
    distance(e, r.fighter) <= 180
  )
    damage *= BALANCE.meleeOpeningBonus;
  const factor = bossDamageFactor(r, e);
  damage *= factor;
  if (
    charge &&
    !bossOpening(e) &&
    (e.guardTime ?? 0) > 0 &&
    ['parry', 'counter'].includes(bossSignature(e) ?? '') &&
    angularDistance(Math.atan2(r.fighter.y - e.y, r.fighter.x - e.x), e.facing) < 0.8
  ) {
    e.guardTime = 0;
    const aim = Math.atan2(r.fighter.y - e.y, r.fighter.x - e.x);
    const kit = meleeKit(e);
    if (kit) {
      // A staff counter closes locally after a readable draw-back, never launches a bolt.
      if ((e.reactionTime ?? 0) <= 0 && e.state !== 'strike') {
        e.reactionTime = 1.6;
        e.state = 'windup';
        e.move = kit.moves.combo ? 'combo' : 'thrust';
        const counter = kit.moves[e.move]!;
        e.timer = counter.windup;
        if (distance(e, r.fighter) > counter.range + (counter.dash ?? 0) + 18) {
          e.state = 'approach';
          e.move = undefined;
          e.timer = 0.18;
        }
        e.aim = e.facing = aim;
        e.targetX = r.fighter.x;
        e.targetY = r.fighter.y;
        e.strike = undefined;
      }
    } else
      r.projectiles.push({
        x: e.x,
        y: combatOrigin(e).y,
        vx: Math.cos(aim) * 320,
        vy: Math.sin(aim) * 320,
        life: 2,
        friendly: false,
        visual: bossSignature(e) === 'counter' ? 'palm-wave' : 'sword-wave',
        damage: 12,
        radius: 13,
        hits: [],
        owner: e.id,
      });
    fx(r, e.x, e.y, 'guard', aim, 60, 0xd7cda0, 0.3);
  }
  if (
    regionName(r) === '천검산' &&
    e.state === 'windup' &&
    angularDistance(Math.atan2(r.fighter.y - e.y, r.fighter.x - e.x), e.facing) < 0.65
  )
    damage *= 0.65;
  e.hp = Math.max(0, e.hp - damage);
  if (damage > 0 && !isBossEnemy(e) && (e.armourTime ?? 0) <= 0 && e.state !== 'strike') {
    e.staggerTime = 0.09 + (basicHit ? (r.fighter.traitState?.staggerBoost ?? 0) : 0);
    if (basicHit && r.fighter.traitState) r.fighter.traitState.staggerBoost = 0;
  }
  emit?.({
    kind: 'impact',
    x: e.x,
    y: e.y,
    angle: Math.atan2(e.y - r.fighter.y, e.x - r.fighter.x),
    target: e.id,
    amount: before - e.hp,
    killed: e.hp === 0,
  });
  fx(r, e.x, e.y - 25, 'hit', 0, 15, 0xf6d285, 0.18);
  const art = sourceArt
    ? r.fighter.arts.find((a) => a.id === sourceArt)
    : r.fighter.arts[r.fighter.active];
  if (art && charge) {
    art.gauge = Math.min(art.id === 'gaebang' ? 200 : 100, art.gauge + 9 * support.gaugeFactor);
  }
  if (heal) recoverRally(r, 0.2, emit);
  if (!e.hp) killEnemy(r, e);
}
function damagePlayer(r: Run, amount: number, emit?: CombatCueSink, source?: DamageSource) {
  const f = r.fighter,
    art = f.arts[f.active];
  const support = supportStats(f);
  if (f.invulnerable > 0 || f.hp <= 0) return;
  if (f.guard > 0 && art?.id === 'wudang') {
    f.guard = 0;
    counterTrait(f);
    f.invulnerable = 0.3;
    emit?.({ kind: 'defense', x: f.x, y: f.y, angle: f.facing, action: 'counter' });
    fx(r, f.x, f.y, 'burst', 0, 125, ARTS.wudang.color);
    for (const e of r.enemies)
      if (distance(e, f) < 155)
        hitEnemy(r, e, techniqueStats(art.id, art.level, f).counterDamage, false, emit);
    art.gauge = Math.min(100, art.gauge + techniqueStats(art.id, art.level, f).counterGauge);
    return;
  }
  const actual = fighterDamageTaken(f as BoundFighter, amount);
  if (f.guard > 0) emit?.({ kind: 'defense', x: f.x, y: f.y, angle: f.facing, action: 'block' });
  const before = f.hp;
  f.hp = Math.max(0, f.hp - actual);
  damagedTrait(f);
  if (art?.id === 'tianmo') {
    art.rally = Math.min(maximumHp(f) * 0.2, (art.rally ?? 0) + before - f.hp);
    art.rallyTime = 4;
  }
  if (art) {
    art.chain = 0;
    art.lastHit = undefined;
  }
  emit?.({
    kind: 'impact',
    x: f.x,
    y: f.y,
    angle: f.facing,
    target: 'hero',
    amount: before - f.hp,
    killed: f.hp === 0,
  });
  recordDamage(r, before - f.hp, source);
  f.invulnerable = 0.45;
  if (!f.fortify && !(support.resistAttackStagger && f.action === 'attack')) {
    f.action = 'hurt';
    f.actionTime = 0.18;
  }
  fx(r, f.x, f.y - 30, 'hit', 0, 22, 0xeb6a58);
  if (!f.hp) {
    f.capturedTime = f.freezeTime = 0;
    r.phase = 'dead';
    r.offers = [];
    f.augmentOffers = [];
    r.attacks = [];
    r.fighter.items = [];
    r.message = '무인은 강호에 남았습니다. 새로운 무인의 여정이 기다립니다.';
  }
}
function resolveAttack(r: Run, a: Run['attacks'][number], emit?: CombatCueSink) {
  const report = combatReport(r),
    technique = a.art ?? 'basic';
  report.attacks[technique] = (report.attacks[technique] ?? 0) + 1;
  const f = r.fighter,
    color = a.art ? ARTS[a.art].color : 0xf4e0af,
    art = f.arts.find((known) => known.id === a.art);
  if (a.art === 'tang' || (a.art === 'jegal' && a.variant !== 'b')) {
    const count = a.art === 'tang' && a.variant === 'b' ? 3 : 1;
    for (let n = 0; n < count; n++) {
      const angle = a.angle + (n - (count - 1) / 2) * 0.18;
      r.projectiles.push({
        x: f.x + Math.cos(angle) * 42,
        y: combatOrigin(f).y + Math.sin(angle) * 42,
        vx: Math.cos(angle) * 680,
        vy: Math.sin(angle) * 680,
        life: (a.art === 'tang' ? 0.9 : 1.05) * supportStats(f).attackRangeFactor,
        friendly: true,
        damage: a.damage * (count === 3 ? 0.6 : 1),
        radius: a.art === 'tang' ? 12 : 22,
        hits: [],
        art: a.art,
        visual: friendlyProjectileVisual(f as BoundFighter, a.art, art?.level),
        seq: a.seq,
        variant: a.variant,
        level: art?.level,
      });
    }
    fx(r, f.x, f.y - 20, 'thrust', a.angle, 125, color);
    emit?.({
      kind: 'strike',
      x: f.x,
      y: f.y,
      angle: a.angle,
      friendly: true,
      thrust: true,
      weapon: activeWeapon(f as BoundFighter)?.weaponStyle,
    });
    return;
  }
  fx(r, f.x, f.y - 20, a.thrust ? 'thrust' : 'slash', a.angle, a.range, color);
  emit?.({
    kind: 'strike',
    x: f.x,
    y: f.y,
    angle: a.angle,
    friendly: true,
    thrust: a.thrust,
    weapon: activeWeapon(f as BoundFighter)?.weaponStyle,
  });
  let hits = 0;
  for (const object of r.encounterObjects ?? []) {
    if (
      distance(object, f) < a.range + objectBodyRadius(object) &&
      angularDistance(Math.atan2(object.y - f.y, object.x - f.x), a.angle) < a.arc
    )
      damageObject(r, object, a.damage);
  }
  const alternating = !!art && art.lastHit !== a.variant && !!art.lastHit;
  for (const e of r.enemies) {
    const angle = Math.atan2(e.y - f.y, e.x - f.x);
    if (
      !(a.art === 'samja' && (art?.level ?? 0) >= 9) &&
      sectorHitsBody(f, e, a.angle, a.range, a.arc)
    ) {
      hits++;
      const damage = a.damage;
      hitEnemy(
        r,
        e,
        damage,
        a.heal,
        emit,
        a.art !== 'gaebang',
        a.art,
        a.seq !== undefined,
        a.seq,
        true,
      );
      if (a.art === 'jegal') {
        addFormation(r, e.x, e.y, 'earth', a.damage, art?.level ?? 1);
        if (!isBossEnemy(e)) {
          e.x = clamp(e.x + (f.x - e.x) * 0.15, FIELD.left, FIELD.right);
          e.y = clamp(e.y + (f.y - e.y) * 0.15, FIELD.top, FIELD.bottom);
        }
      }
      if (a.art === 'shaolin' && (f.fortify ?? 0) > 0) {
        fx(r, e.x, e.y, 'burst', 0, 70, color, 0.2);
        for (const nearby of r.enemies)
          if (nearby.hp > 0 && distance(nearby, e) < 70)
            hitEnemy(r, nearby, a.damage * 0.35, false, emit, false, a.art);
      }
      if (a.art === 'gaebang' && a.boosted && a.variant === 'b' && !isBossEnemy(e)) {
        e.x = clamp(e.x + Math.cos(angle) * 55, FIELD.left, FIELD.right);
        e.y = clamp(e.y + Math.sin(angle) * 55, FIELD.top, FIELD.bottom);
      }
    }
  }
  if (hits && art) {
    if (art.id === 'samja' && art.level >= 6 && alternating) art.bonus = 0.3;
    if (art.id === 'gaebang') {
      art.gauge = Math.min(200, art.gauge + Math.min(24, hits * 14) * supportStats(f).gaugeFactor);
      if (a.boosted) {
        if (art.level >= 5 && (art.chainTime ?? 0) > 0) {
          for (const nearby of r.enemies)
            if (!isBossEnemy(nearby) && nearby.hp > 0 && distance(nearby, f) < 230)
              nearby.confused = 3;
          fx(r, f.x, f.y, 'burst', 0, 230, color, 0.35);
          art.chainTime = 0;
        } else art.chainTime = 3;
      }
    }
    art.lastHit = a.variant ?? 'a';
  }
  if (a.art === 'samja' && art && art.level >= 9) {
    const target =
      art.level >= 10
        ? r.enemies.filter((e) => e.hp > 0).sort((a, b) => distance(a, f) - distance(b, f))[0]
        : undefined;
    const angle = target ? Math.atan2(target.y - f.y, target.x - f.x) : a.angle;
    r.projectiles.push({
      x: f.x + Math.cos(angle) * 80,
      y: combatOrigin(f).y + Math.sin(angle) * 80,
      vx: Math.cos(angle) * 680,
      vy: Math.sin(angle) * 680,
      life: 1.7 * supportStats(f).attackRangeFactor,
      friendly: true,
      damage: a.damage,
      radius: 22,
      hits: [],
      art: 'samja',
      visual: friendlyProjectileVisual(f as BoundFighter, 'samja', art.level),
      level: art.level,
      seq: a.seq,
    });
  }
}
function addFormation(
  r: Run,
  x: number,
  y: number,
  kind: 'heaven' | 'earth',
  damage: number,
  level: number,
) {
  addJegalFormation((r.formations ??= []), x, y, kind, damage, level);
}
function attack(r: Run, input: InputFrame) {
  const f = r.fighter,
    art = f.arts[f.active];
  if (f.cooldown > 0 || !hasWeapon(f as BoundFighter, art?.id)) return;
  f.facing = input.aim;
  f.attackSeq++;
  f.action = 'attack';
  f.actionTime = STRIKE_TIMING.duration;
  const samjaCycle = art?.id === 'samja' && art.level >= 8;
  const comboB = !!art && art.level >= 3 && art.combo % (samjaCycle ? 3 : 2) === 1;
  const comboC = !!art && samjaCycle && art.combo % 3 === 2;
  if (art) art.combo++;
  const power = fighterAttackPower(f as BoundFighter);
  const stats = techniqueStats(art?.id, art?.level, f);
  const mult = stats.multiplier;
  const empowered = (art?.buffTime ?? 0) > 0;
  f.cooldown = stats.attackInterval * (art?.id === 'tianmo' && empowered ? 0.8 : 1);
  const thrust =
    (art?.id === 'shaolin' && !comboB) || art?.id === 'tang' || (art?.id === 'jegal' && !comboB);
  let range = thrust ? 145 : art?.id === 'huashan' || art?.id === 'gaebang' ? 135 : 115;
  if (comboB && art?.id === 'samja') range *= 1.25;
  if (comboB && art?.id === 'jegal') range = 165;
  if (art?.id === 'samja' && art.level >= 7) range *= 1.1;
  if (art?.id === 'tianmo' && empowered) range *= 1.25;
  range *= supportStats(f).attackRangeFactor;
  const innateFactor = innateAttack(f, maximumHp(f));
  const boosted = art?.id === 'gaebang' && (art.queuedBoosts ?? 0) > 0;
  if (boosted && art) {
    art.queuedBoosts = Math.max(0, (art.queuedBoosts ?? 0) - 1);
  }
  if (art?.id === 'wudang') f.guard = empowered ? 0.22 : comboB ? 0.09 : 0.06;
  const lowHealth = art?.id === 'tianmo' ? 1 + Math.max(0, 0.5 - f.hp / maximumHp(f)) * 0.3 : 1;
  const coefficient =
    art?.id === 'tang'
      ? 0.65
      : art?.id === 'jegal'
        ? 0.9
        : art?.id === 'shaolin'
          ? comboB
            ? 1.4
            : 1.15
          : art?.id === 'tianmo'
            ? comboB
              ? 1.5
              : 1.2
            : art?.id === 'gaebang'
              ? comboB
                ? 1.1
                : 0.95
              : comboB
                ? 1.15
                : 1;
  const bonus = art?.id === 'samja' ? (art.bonus ?? 0) : 0;
  if (art) art.bonus = 0;
  if (comboB && art?.id === 'tianmo') {
    const cost = Math.min(f.hp - 1, maximumHp(f) * 0.03);
    f.hp -= cost;
    art.rally = Math.min(24, (art.rally ?? 0) + cost);
    art.rallyTime = 4;
  }
  r.attacks.push({
    timer: STRIKE_TIMING.contact,
    angle: input.aim,
    damage:
      power *
      innateFactor *
      mult *
      coefficient *
      (comboC ? 1.45 : 1) *
      lowHealth *
      (1 + bonus) *
      (boosted ? (comboB ? 1.41 : 1.53) : 1) *
      (art?.id === 'tianmo' && empowered ? 1.15 : 1),
    range,
    arc:
      art?.id === 'shaolin' && comboB
        ? Math.PI
        : art?.id === 'gaebang' && comboB && boosted
          ? Math.PI
          : thrust
            ? 0.34
            : comboB && art?.id === 'wudang'
              ? Math.PI
              : 1.1,
    thrust,
    art: art?.id,
    heal: art?.id === 'tianmo',
    variant: comboC ? 'c' : comboB ? 'b' : 'a',
    boosted,
    seq: f.attackSeq,
  });
}
function defend(r: Run, input: InputFrame, emit?: CombatCueSink) {
  const f = r.fighter,
    art = f.arts[f.active];
  if (!art || combatActionBlock(f as BoundFighter, 'defense')) return;
  const moveAngle = input.dx || input.dy ? Math.atan2(input.dy, input.dx) : f.facing;
  f.action = 'defense';
  f.actionTime = 0.3;
  f.cooldown = 0.25;
  r.attacks = [];
  const stats = techniqueStats(art.id, art.level, f);
  art.defenseCd = stats.defenseCooldown;
  if (art.id === 'huashan') {
    const fromX = f.x,
      fromY = f.y;
    f.x = clamp(f.x + Math.cos(moveAngle) * 145, FIELD.left, FIELD.right);
    f.y = clamp(f.y + Math.sin(moveAngle) * 145, FIELD.top, FIELD.bottom);
    emit?.({ kind: 'defense', x: f.x, y: f.y, fromX, fromY, angle: moveAngle, action: 'evade' });
    f.invulnerable = DEFENSE_RULES.evadeDuration;
    evadeTrait(f);
    fx(r, f.x, f.y, 'guard', moveAngle, 55, ARTS.huashan.color);
  } else if (art.id === 'wudang') {
    emit?.({ kind: 'defense', x: f.x, y: f.y, angle: f.facing, action: 'guard' });
    f.guard = stats.guardDuration;
    fx(r, f.x, f.y, 'guard', f.facing, 50, ARTS.wudang.color, 0.32);
  } else if (art.id === 'samja' || art.id === 'shaolin' || art.id === 'jegal') {
    emit?.({ kind: 'defense', x: f.x, y: f.y, angle: f.facing, action: 'guard' });
    f.guard = stats.guardDuration;
    fx(r, f.x, f.y, 'guard', f.facing, 50, ARTS[art.id].color, f.guard);
  } else if (art.id === 'tang' || art.id === 'gaebang') {
    const fromX = f.x,
      fromY = f.y;
    f.x = clamp(f.x + Math.cos(moveAngle) * 115, FIELD.left, FIELD.right);
    f.y = clamp(f.y + Math.sin(moveAngle) * 115, FIELD.top, FIELD.bottom);
    f.invulnerable = 0.22;
    evadeTrait(f);
    fx(r, f.x, f.y, 'guard', moveAngle, 45, ARTS[art.id].color);
    emit?.({ kind: 'defense', x: f.x, y: f.y, fromX, fromY, angle: moveAngle, action: 'evade' });
  } else {
    f.facing = input.aim;
    r.attacks.push({
      timer: 0.1,
      angle: input.aim,
      range: 130,
      arc: 0.7,
      thrust: false,
      damage: stats.leechDamage,
      art: art.id,
      heal: true,
    });
  }
}
function ultimate(r: Run, input: InputFrame, emit?: CombatCueSink) {
  const f = r.fighter,
    art = f.arts[f.active];
  if (!art || combatActionBlock(f as BoundFighter, 'ultimate')) return;
  if (art.id === 'gaebang') {
    if ((art.queuedBoosts ?? 0) >= 2) return;
    if (f.innate === 'circulation')
      f.hp = Math.min(maximumHp(f), f.hp + maximumHp(f) * 0.05 * recoveryFactor(f));
    art.gauge -= 100;
    emit?.({ kind: 'ultimate', art: art.id, x: f.x, y: f.y });
    art.queuedBoosts = Math.min(2, (art.queuedBoosts ?? 0) + 1);
    f.cooldown = 0.18;
    fx(r, f.x, f.y - 20, 'guard', 0, 90, ARTS.gaebang.color, 0.3);
    return;
  }
  if (f.innate === 'circulation')
    f.hp = Math.min(maximumHp(f), f.hp + maximumHp(f) * 0.05 * recoveryFactor(f));
  art.gauge = 0;
  emit?.({ kind: 'ultimate', art: art.id, x: f.x, y: f.y });
  f.cooldown = 0.65;
  f.action = 'ultimate';
  f.actionTime = 0.6;
  f.facing = input.aim;
  if (art.id === 'huashan') {
    f.invulnerable = 0.9;
    r.attacks = [];
  }
  if (art.id === 'shaolin') f.fortify = 5;
  const stats = techniqueStats(art.id, art.level, f),
    radius = stats.ultimateRadius;
  if (art.id === 'huashan') {
    r.petalStrikes = r.enemies
      .filter((e) => e.hp > 0 && distance(e, f) < radius)
      .sort((a, b) => distance(a, f) - distance(b, f))
      .slice(0, 3)
      .map((enemy, n) => ({
        target: enemy.id,
        timer: 0.08 + n * 0.14,
        damage: stats.ultimateDamage,
      }));
    fx(r, f.x, f.y, 'guard', input.aim, 90, ARTS.huashan.color, 0.25);
    return;
  }
  if (art.id === 'tang') {
    for (const e of r.enemies)
      if (e.hp > 0 && distance(e, f) < radius && (e.poisonStacks ?? 0) > 0) {
        const stacks = e.poisonStacks ?? 0;
        e.poisonStacks = Math.floor(stacks / 2);
        hitEnemy(r, e, stats.ultimateDamage * stacks, false, emit, false);
      }
    fx(r, f.x, f.y, 'burst', 0, radius, ARTS.tang.color, 0.45);
    return;
  }
  if (art.id === 'jegal') {
    r.formations = jegalUltimate(f.x, f.y, input.aim, stats.ultimateDamage, FIELD);
    fx(r, f.x, f.y, 'burst', 0, radius, ARTS.jegal.color, 0.45);
    return;
  }
  if (art.id === 'wudang' || art.id === 'tianmo') {
    art.buffTime = art.id === 'wudang' ? 4 : 5;
    art.ultimateHealing = 0;
    fx(r, f.x, f.y, 'guard', input.aim, 100, ARTS[art.id].color, 0.4);
    return;
  }
  fx(r, f.x, f.y - 20, 'burst', 0, radius, ARTS[art.id].color, 0.6);
  for (const e of r.enemies)
    if (
      distance(e, f) < radius &&
      (art.id !== 'samja' || angularDistance(Math.atan2(e.y - f.y, e.x - f.x), input.aim) < 0.8)
    )
      hitEnemy(r, e, stats.ultimateDamage, false, emit, false, art.id);
  if (art.id === 'samja' && art.level >= 10)
    for (const e of r.enemies.filter((e) => e.hp > 0)) {
      const a = Math.atan2(e.y - f.y, e.x - f.x);
      r.projectiles.push({
        x: f.x,
        y: combatOrigin(f).y,
        vx: Math.cos(a) * 700,
        vy: Math.sin(a) * 700,
        life: 2.5,
        friendly: true,
        damage: 90,
        visual: 'flying-sword',
        radius: 24,
        hits: [],
      });
    }
}
function summonReinforcements(r: Run, e: Enemy) {
  if (e.summoned) return;
  e.summoned = true;
  for (let n = 0; n < 2; n++) {
    const hp = Math.round(
      (28 + Math.floor(r.wave / 5) * 9) * ordinaryHpFactor(Math.floor((r.wave - 1) / 5)),
    );
    r.enemies.push({
      id: e.id * 10 + n + 1,
      ...regionEnemy(r, n),
      x: clamp(e.x + (n ? 110 : -110), FIELD.left, FIELD.right),
      y: clamp(e.y + 80, FIELD.top, FIELD.bottom),
      hp,
      maxHp: hp,
      facing: 0,
      state: 'approach',
      timer: 1,
      aim: 0,
      pattern: 0,
      xp: 0,
      elite: false,
      hitSeq: -1,
    });
  }
}
function enemyStep(r: Run, e: Enemy, dt: number, emit?: CombatCueSink) {
  clearBossControl(e);
  const currentKit = meleeKit(e);
  if (currentKit && e.move && !currentKit.moves[e.move]) {
    // Resume an older save without retaining the removed throw/cast attack.
    e.move = undefined;
    e.strike = undefined;
    e.state = 'approach';
    e.timer = 0.15;
    e.targetX = e.targetY = undefined;
  }
  if (currentKit && e.move && e.strike && e.strike.contactsDone === undefined) {
    const spec = currentKit.moves[e.move];
    if (spec) {
      // Old shared strikes had a shorter lifetime. Keep their remaining progress,
      // but use the new contact clock so resuming cannot silently miss a hit.
      const remaining = clamp(e.timer / e.strike.duration, 0, 1);
      e.strike.duration = spec.duration;
      e.timer = spec.duration * remaining;
      e.strike.contactsDone = e.strike.hit ? spec.contacts.length : 0;
    }
  }
  if ((e.staggerTime ?? 0) > 0) {
    e.staggerTime = Math.max(0, e.staggerTime! - dt);
    return;
  }
  const f = r.fighter;
  stepBossBehavior(r, e, dt);
  const confusedTarget =
    !e.bossId && (e.confused ?? 0) > 0
      ? r.enemies
          .filter((other) => other.id !== e.id && other.hp > 0)
          .sort((a, b) => distance(e, a) - distance(e, b))[0]
      : undefined;
  const target = confusedTarget ?? f;
  if (stepBossPressure(r, e, dt, observedVelocity(r))) {
    fx(r, e.x, e.y - 20, 'guard', e.facing, 55, 0xe5b764, 0.32);
  }
  e.timer -= dt;
  let profile = enemyAttack(e);
  // Follow during preparation, then hold still for the final readable warning.
  // The released attack never follows a dodging player.
  if (e.state === 'windup' && e.timer > Math.min(0.4, profile.windup * 0.45)) {
    const predicted = predictedTarget(r, e, target, profile.ranged || profile.move === 'hazard');
    e.aim = Math.atan2(predicted.y - e.y, predicted.x - e.x);
    e.facing = e.aim;
    e.targetX = predicted.x;
    e.targetY = predicted.y;
    profile = enemyAttack(e);
  }
  const { boss } = profile;
  const dist = distance(e, target);
  const reposition = repositionFactor(e, profile);
  if (e.state !== 'approach' && reposition > 0) {
    const movement = steerEnemy(e, tacticalMovement(r, e, target, profile), dt);
    const formation = r.formations?.find((node) => distance(e, node) < 105);
    const jegal = f.arts.find((art) => art.id === 'jegal');
    const slow =
      !isBossEnemy(e) && formation && (formation.kind === 'ultimate' || (jegal?.level ?? 0) >= 2)
        ? formation.kind === 'ultimate'
          ? 0.75
          : 0.85
        : 1;
    e.x += movement.x * dt * reposition * slow;
    e.y += movement.y * dt * reposition * slow;
    // Moving the origin changes aim: finish early preparation by aiming again.
    if (e.state === 'windup') {
      e.aim = Math.atan2((e.targetY ?? target.y) - e.y, (e.targetX ?? target.x) - e.x);
      e.facing = e.aim;
    } else e.facing = turnToward(e.facing, Math.atan2(target.y - e.y, target.x - e.x), dt);
  }
  if (e.state === 'approach') {
    if (e.bossId) {
      e.move = tacticalBossMove(e, dist, r);
      profile = enemyAttack(e);
    }
    if ((e.confused ?? 0) <= 0 || confusedTarget)
      e.facing = turnToward(e.facing, Math.atan2(target.y - e.y, target.x - e.x), dt);
    const roleMovement = steerEnemy(e, tacticalMovement(r, e, target, profile), dt);
    {
      const jegal = f.arts.find((art) => art.id === 'jegal');
      const zone = r.formations?.find((node) => distance(e, node) < 105);
      const factor =
        !isBossEnemy(e) && zone && (zone.kind === 'ultimate' || (jegal?.level ?? 0) >= 2)
          ? zone.kind === 'ultimate'
            ? 0.75
            : 0.85
          : 1;
      e.x += roleMovement.x * dt * factor;
      e.y += roleMovement.y * dt * factor;
      if (e.role && ROLE_PROFILES[e.role].guard) e.guardTime = 0.2;
      if (e.role === 'assassin') e.veilTime = dist > 210 ? 0.15 : 0;
    }
    if (
      e.timer <= 0 &&
      (e.pressure?.warning ?? 0) <= 0 &&
      distance(e, target) < bossCommitRange(e, profile, observedVelocity(r), target) &&
      distance(e, target) >= (profile.melee?.minimum ?? 0) &&
      canCommitAttack(r, e)
    ) {
      resetSteering(e);
      e.state = 'windup';
      e.timer = profile.windup;
      e.aim = Math.atan2(target.y - e.y, target.x - e.x);
      e.facing = e.aim;
      e.windDeflection =
        regionName(r) === '서역사막' && r.elapsed % 14 > 10
          ? Math.sin(r.elapsed * 3 + e.id) * 0.13
          : 0;
      e.targetX = clamp(target.x, FIELD.left, FIELD.right);
      e.targetY = clamp(target.y, FIELD.top, FIELD.bottom);
      e.move = profile.move;
      e.strike = undefined;
      commitBossPressure(e, profile);
    }
  } else if (e.state === 'windup' && e.timer <= 0) {
    e.move = profile.move;
    e.state = 'strike';
    e.timer = 0.18;
    const damage =
      (boss ? 16 + Math.floor(r.wave / 5) * 3 : 7 + Math.floor(r.wave / 5) * 2) *
      (boss ? BALANCE.bossDamageFactor : ordinaryDamageFactor(Math.floor((r.wave - 1) / 5))) *
      (regionName(r) === '폐사' && !e.bossId && r.elapsed % 12 < 3 ? 1.2 : 1) *
      ((e.rageTime ?? 0) > 0 ? 1.25 : 1);
    if (profile.move === 'summon' && !profile.melee) {
      summonReinforcements(r, e);
    } else if (!profile.melee && (profile.move === 'pulse' || profile.move === 'hazard')) {
      const center = profile.move === 'hazard' ? profile.origin : e;
      const radius = profile.move === 'hazard' ? profile.radius : profile.range;
      if (profile.move === 'hazard' && profile.zone) {
        r.projectiles.push({
          x: e.x,
          y: combatOrigin(e).y,
          vx: (center.x - e.x) / 0.65,
          vy: (center.y - combatOrigin(e).y) / 0.65,
          life: 0.65,
          friendly: false,
          damage: profile.zone === 'brew' ? 0 : damage,
          radius: 14,
          hits: [],
          owner: e.id,
          visual: hazardProjectileVisual(profile.zone),
          landing: { x: center.x, y: center.y, radius, kind: profile.zone },
          hostileToEnemies: !!confusedTarget,
        });
      } else {
        fx(r, center.x, center.y - 20, 'burst', 0, radius, 0xd6513e, 0.36);
        if (distance(center, target) < radius + 18) {
          if (confusedTarget) hitEnemy(r, confusedTarget, damage, false, emit, false);
          else damagePlayer(r, damage, emit, enemyDamageSource(e, 'hazard'));
        }
      }
    } else if (profile.ranged && !profile.melee) {
      for (const shot of profile.shots) {
        const a = shot.angle;
        r.projectiles.push({
          x: e.x,
          y: combatOrigin(e).y,
          vx: Math.cos(a) * shot.speed,
          vy: Math.sin(a) * shot.speed,
          life: shot.life,
          friendly: false,
          damage,
          radius: e.bossId === '2-4' && e.hp <= e.maxHp * 0.5 ? 25 : 12,
          visualScale: e.bossId === '2-4' && e.hp <= e.maxHp * 0.5 ? 2 : 1,
          hits: [],
          owner: e.id,
          delay: shot.delay,
          // returnAt is remaining lifetime: all shots get a full outbound leg,
          // independent of whether the projectile lives for three or four seconds.
          returnAt:
            profile.returning && e.bossId !== '5-4'
              ? Math.max(0, shot.life - Math.min(1.6, Math.max(1, profile.range / shot.speed)))
              : undefined,
          visual: hostileProjectileVisual(r, e, profile.returning),
          hostileToEnemies: !!confusedTarget,
        });
      }
    } else {
      const travel = distance(e, profile.origin);
      const duration =
        profile.melee?.duration ??
        (profile.dash
          ? clamp(travel / (e.role === 'rider' ? 720 : 800), 0.16, 0.55)
          : STRIKE_TIMING.duration);
      e.timer = duration;
      e.strike = {
        fromX: e.x,
        fromY: e.y,
        toX: profile.origin.x,
        toY: profile.origin.y,
        duration,
        damage: damage * (profile.melee?.damage ?? 1),
        hit: false,
        target: confusedTarget?.id,
        ...(profile.melee ? { contactsDone: 0 } : {}),
      };
    }
    const kit = meleeKit(e);
    e.pattern = kit
      ? (kit.sequence.indexOf(profile.move!) + 1) % kit.sequence.length
      : e.pattern + 1;
  } else if (e.state === 'strike') {
    const strike = e.strike;
    if (strike) {
      const from = { x: e.x, y: e.y };
      const progress = clamp(1 - e.timer / strike.duration, 0, 1);
      const travelProgress =
        (e.pressure?.advance ?? 0) > 0
          ? clamp(
              (strike.duration - e.timer) / Math.max(0.15, profile.melee?.contacts[0] ?? 0.15),
              0,
              1,
            )
          : progress;
      const eased = travelProgress * travelProgress * (3 - 2 * travelProgress);
      if (profile.dash) {
        e.x = strike.fromX + (strike.toX - strike.fromX) * eased;
        e.y = strike.fromY + (strike.toY - strike.fromY) * eased;
      }
      const victim =
        strike.target === undefined
          ? f
          : r.enemies.find((other) => other.id === strike.target && other.hp > 0);
      const contact = profile.dash
        ? progress >= 1
        : strike.duration - e.timer >= STRIKE_TIMING.contact;
      const swept =
        profile.dash > 0 && !(e.pressure?.advance ?? 0) && victim && dashHits(from, e, victim);
      if (profile.melee) {
        const spec = profile.melee,
          elapsed = strike.duration - e.timer;
        let done = strike.contactsDone ?? (strike.hit ? spec.contacts.length : 0);
        while (
          done < spec.contacts.length &&
          (elapsed >= spec.contacts[done] || (done === 0 && swept))
        ) {
          const index = done++;
          strike.contactsDone = done;
          strike.hit = done === spec.contacts.length;
          if (spec.shot) {
            const shot = spec.shot;
            for (const volley of profile.shots) {
              const { angle, life } = volley;
              const wide = e.bossId === '2-4' && e.hp <= e.maxHp * 0.5;
              r.projectiles.push({
                x: e.x,
                y: combatOrigin(e).y,
                vx: Math.cos(angle) * shot.speed,
                vy: Math.sin(angle) * shot.speed,
                life,
                damage: strike.damage,
                radius: wide ? 25 : 12,
                visualScale: wide ? 2 : 1,
                hits: [],
                friendly: false,
                owner: e.id,
                visual: shot.visual,
                status: shot.status,
                returnAt: shot.returning
                  ? Math.max(0, life - Math.min(1.6, Math.max(1, spec.range / shot.speed)))
                  : undefined,
              });
            }
            emit?.({
              kind: 'strike',
              x: e.x,
              y: e.y,
              angle: e.aim,
              friendly: false,
              thrust: true,
              weapon: currentKit!.weapon,
            });
          } else if (spec.zone) {
            const center = { x: e.targetX ?? e.x, y: e.targetY ?? e.y };
            r.projectiles.push({
              x: e.x,
              y: combatOrigin(e).y,
              vx: (center.x - e.x) / 0.65,
              vy: (center.y - combatOrigin(e).y) / 0.65,
              life: 0.65,
              friendly: false,
              damage: strike.damage,
              radius: 14,
              hits: [],
              owner: e.id,
              visual: hazardProjectileVisual(spec.zone.kind),
              landing: { ...center, radius: spec.zone.radius, kind: spec.zone.kind },
            });
          } else if (spec.mechanic === 'reinforcements') {
            summonReinforcements(r, e);
            fx(r, e.x, e.y - 20, 'guard', e.aim, 55, 0xd7cda0, 0.35);
          } else if (spec.mechanic === 'stance') {
            e.guardTime = 2.2;
            e.armourTime = 2.2;
            fx(r, e.x, e.y - 20, 'guard', e.aim, 65, 0xd7cda0, 0.35);
          } else if (spec.mechanic) {
            const nextPattern = e.pattern;
            if (spec.variant !== undefined) e.pattern = spec.variant;
            signatureCast(r, e, { x: e.targetX ?? f.x, y: e.targetY ?? f.y });
            e.pattern = nextPattern;
            if (spec.mechanic === 'grab') {
              const grab = r.encounterObjects?.find(
                (o) => o.owner === e.id && o.mechanic === 'grab' && o.stage === 0,
              );
              if (grab) grab.warning = 0;
            }
          } else {
            const angle =
              e.aim +
              (profile.move === 'combo' && spec.shape === 'sector'
                ? index % 2
                  ? 0.28
                  : -0.28
                : 0);
            const thrust = spec.shape === 'line';
            const pulse = profile.move === 'slam';
            const weapon = currentKit!.weapon;
            if (spec.shape === 'circle' && !pulse) {
              for (let n = 0; n < 4; n++)
                fx(
                  r,
                  e.x,
                  e.y - 20,
                  'slash',
                  angle + (n * Math.PI) / 2,
                  spec.range,
                  0xd6513e,
                  0.32,
                  weapon,
                );
            } else
              fx(
                r,
                e.x,
                pulse ? e.y : e.y - 20,
                spec.visual === 'chain' ? 'chain' : pulse ? 'burst' : thrust ? 'thrust' : 'slash',
                angle,
                spec.range,
                pulse ? 0xb99c70 : 0xd6513e,
                0.32,
                weapon,
              );
            emit?.({
              kind: 'strike',
              x: e.x,
              y: e.y,
              angle,
              friendly: false,
              thrust,
              weapon: currentKit!.weapon,
            });
            const hit = victim && (swept || meleeHits(e, victim, spec, angle));
            if (hit) {
              if (strike.target !== undefined)
                hitEnemy(r, victim as Enemy, strike.damage, false, emit, false);
              else {
                const before = f.hp;
                damagePlayer(r, strike.damage, emit, enemyDamageSource(e, 'melee'));
                if (f.hp > 0 && f.hp < before) {
                  if (spec.bleed) f.bleedTime = Math.max(f.bleedTime ?? 0, spec.bleed);
                  if (spec.poison) f.poisonTime = Math.max(f.poisonTime ?? 0, spec.poison);
                  if (spec.leech) e.hp = Math.min(e.maxHp, e.hp + (before - f.hp) * spec.leech);
                  if (spec.slow) f.slowTime = Math.max(f.slowTime ?? 0, spec.slow);
                  if (spec.pull) {
                    // The physical hook must hit first. No persistent radial suction;
                    // a side step, missed aim, dodge or complete block prevents the pull.
                    const d = distance(e, f);
                    const pull = Math.min(spec.pull, Math.max(0, d - 75));
                    if (d > 0) {
                      f.x = clamp(f.x + ((e.x - f.x) / d) * pull, FIELD.left, FIELD.right);
                      f.y = clamp(f.y + ((e.y - f.y) / d) * pull, FIELD.top, FIELD.bottom);
                    }
                  }
                  if (spec.knockback) {
                    const pushAngle =
                      spec.shape === 'circle' ? Math.atan2(f.y - e.y, f.x - e.x) : angle;
                    f.x = clamp(
                      f.x + Math.cos(pushAngle) * spec.knockback,
                      FIELD.left,
                      FIELD.right,
                    );
                    f.y = clamp(
                      f.y + Math.sin(pushAngle) * spec.knockback,
                      FIELD.top,
                      FIELD.bottom,
                    );
                  }
                }
              }
            }
          }
          if (r.phase !== 'combat' || pendingChoices(r)) break;
        }
      } else if (!strike.hit && (contact || swept)) {
        // A normal swing resolves once at contact. A dash may only hit the
        // portion it has actually crossed, then its final warned sector.
        const hit =
          victim &&
          (swept || (contact && sectorHitsBody(e, victim, e.aim, profile.range, profile.arc)));
        if (contact || hit) {
          strike.hit = true;
          const thrust = profile.move === 'thrust' || e.kind === 'spear';
          fx(r, e.x, e.y - 20, thrust ? 'thrust' : 'slash', e.aim, profile.range, 0xd6513e);
          emit?.({ kind: 'strike', x: e.x, y: e.y, angle: e.aim, friendly: false, thrust });
          if (hit) {
            if (strike.target !== undefined)
              hitEnemy(r, victim as Enemy, strike.damage, false, emit, false);
            else {
              const before = f.hp;
              damagePlayer(r, strike.damage, emit, enemyDamageSource(e, 'melee'));
              if (f.hp > 0 && f.hp < before && e.bossId === '8-1') f.bleedTime = 3.2;
            }
          }
        }
      }
    }
    if (e.timer <= 0) {
      e.state = 'recover';
      e.timer = profile.recovery;
      e.strike = undefined;
    }
  } else if (e.state === 'recover' && e.timer <= 0) {
    e.state = 'approach';
    e.timer = boss ? 0.12 : 0.18 + (e.id % 5) * 0.07;
    e.move = undefined;
    e.strike = undefined;
    e.targetX = e.targetY = undefined;
  }
  e.x = clamp(e.x, FIELD.left, FIELD.right);
  e.y = clamp(e.y, FIELD.top, FIELD.bottom);
}
function clearWave(r: Run) {
  finishCombatWave(r);
  if (r.fighter.progressionVersion === 2) {
    r.fighter.trainingPoints = (r.fighter.trainingPoints ?? 0) + (isBoss(r.wave) ? 3 : 1);
    rollOffers(r);
  }
  r.phase = 'loot';
  r.projectiles = [];
  r.attacks = [];
  r.zones = [];
  r.formations = [];
  r.encounterObjects = [];
  r.petalStrikes = [];
  r.fighter.action = 'idle';
  r.fighter.items.push(...rollWaveLoot(r, () => random(r)));
  r.message =
    r.wave === 20
      ? '강호를 완주했습니다. 전리품을 챙긴 뒤 세가로 돌아가세요.'
      : '전투 종료 · 전리품을 수납하고 다음 웨이브로 진행하세요.';
}
export function tick(r: Run, input: InputFrame, dt: number, emit?: CombatCueSink) {
  if (isWalkablePreparation(r) && !pendingChoices(r)) {
    walkWaystation(r.fighter, input, dt, r);
    return;
  }
  if (r.phase !== 'combat' || pendingChoices(r)) {
    r.fighter.capturedTime = 0;
    r.encounterObjects = r.encounterObjects?.filter(
      (o) => o.mechanic !== 'grab' && o.mechanic !== 'exchange',
    );
    return;
  }
  dt = clamp(dt, 0, 1 / 30);
  trackCombatWave(r);
  r.elapsed += dt;
  const f = r.fighter;
  stepTraits(f, dt);
  f.cooldown = Math.max(0, f.cooldown - dt * encounterAttackRecovery(r));
  f.actionTime = Math.max(0, f.actionTime - dt);
  f.invulnerable = Math.max(0, f.invulnerable - dt);
  f.guard = Math.max(0, f.guard - dt);
  f.fortify = Math.max(0, (f.fortify ?? 0) - dt);
  f.slowTime = Math.max(0, (f.slowTime ?? 0) - dt);
  f.healSuppression = Math.max(0, (f.healSuppression ?? 0) - dt);
  stepFieldStatuses(r, dt, (amount) =>
    damagePlayer(r, amount, emit, { kind: 'status', label: '지속 피해' }),
  );
  if (r.phase !== 'combat' || pendingChoices(r)) return;
  for (const a of f.arts) {
    a.defenseCd = Math.max(0, a.defenseCd - dt);
    a.chainTime = Math.max(0, (a.chainTime ?? 0) - dt);
    a.buffTime = Math.max(0, (a.buffTime ?? 0) - dt);
    a.rallyTime = Math.max(0, (a.rallyTime ?? 0) - dt);
    if (a.rallyTime <= 0) a.rally = 0;
    if (a.id === 'shaolin' && a.chainTime <= 0) a.bonus = 0;
    if (a.id === 'tianmo' && a.buffTime > 0) {
      const loss = Math.min(Math.max(0, f.hp - 1), maximumHp(f) * 0.015 * dt);
      f.hp -= loss;
      a.rally = Math.min(24, (a.rally ?? 0) + loss);
      a.rallyTime = 4;
    }
  }
  const length = Math.hypot(input.dx, input.dy);
  const restrained = (f.freezeTime ?? 0) > 0 || (f.capturedTime ?? 0) > 0;
  if (restrained) {
    f.action = 'hurt';
    f.actionTime = 0.05;
  }
  if (length && !restrained && (f.actionTime <= 0 || f.action === 'attack')) {
    const speed =
      fighterMoveSpeed(f as BoundFighter) *
      movementFactor(r) *
      ((f.slowTime ?? 0) > 0 ? 0.7 : 1) *
      (f.action === 'attack' &&
      f.actionTime > 0 &&
      !(f.arts[f.active]?.id === 'samja' && f.arts[f.active].level >= 10)
        ? supportStats(f).attackMovementFactor
        : 1);
    f.x = clamp(f.x + (input.dx / length) * speed * dt, FIELD.left, FIELD.right);
    f.y = clamp(f.y + (input.dy / length) * speed * dt, FIELD.top, FIELD.bottom);
    if (f.actionTime <= 0) {
      f.facing = Math.atan2(input.dy, input.dx);
      f.action = 'walk';
    }
  } else if (f.actionTime <= 0) f.action = 'idle';
  if (!restrained) {
    if (input.defense) {
      defend(r, input, emit);
      if (f.invulnerable > 0) f.coldStacks = 0;
    } else if (input.ultimate) ultimate(r, input, emit);
    else if (input.attack) attack(r, input);
  }
  for (const a of r.attacks) {
    a.timer -= dt;
    if (a.timer <= 0) resolveAttack(r, a, emit);
  }
  r.attacks = r.attacks.filter((a) => a.timer > 0);
  if (pendingChoices(r)) return;
  for (const strike of r.petalStrikes ?? []) {
    if (strike.timer < 0) continue;
    strike.timer -= dt;
    if (strike.timer <= 0) {
      strike.timer = -1;
      const target = r.enemies.find((e) => e.id === strike.target && e.hp > 0);
      if (target) {
        const angle = Math.atan2(target.y - f.y, target.x - f.x);
        f.x = clamp(target.x - Math.cos(angle) * 60, FIELD.left, FIELD.right);
        f.y = clamp(target.y - Math.sin(angle) * 60, FIELD.top, FIELD.bottom);
        f.facing = angle;
        fx(r, target.x, target.y - 20, 'slash', angle, 100, ARTS.huashan.color, 0.2);
        hitEnemy(r, target, strike.damage, false, emit, false, 'huashan');
        if (pendingChoices(r)) return;
      }
    }
  }
  r.petalStrikes = r.petalStrikes?.filter((strike) => strike.timer >= 0);
  if (r.enemies.every((enemy) => enemy.hp <= 0)) {
    clearWave(r);
    return;
  }
  stepEnvironment(
    r,
    dt,
    () => random(r),
    (damage, zone) =>
      damagePlayer(r, damage, emit, {
        kind: 'field',
        label: zone
          ? (
              {
                poison: '독 장판',
                cold: '한기 장판',
                fire: '화염 장판',
                blood: '혈기 장판',
                trap: '함정',
                gate: '기관 장판',
                brew: '술 장판',
              } as const
            )[zone.kind]
          : '위험 장판',
      }),
    (zone) => {
      emit?.({ kind: 'field', action: zone.kind, x: zone.x, y: zone.y });
      fx(
        r,
        zone.x,
        zone.y,
        'burst',
        0,
        zone.radius,
        zone.kind === 'cold' ? 0x83cce4 : zone.kind === 'poison' ? 0x8fa860 : 0xc59b71,
        0.3,
      );
    },
    (zone) => emit?.({ kind: 'field', action: zone.kind, x: zone.x, y: zone.y }),
  );
  if (r.fighter.hp <= 0) return;
  stepEncounters(
    r,
    dt,
    (damage, object) =>
      damagePlayer(
        r,
        damage,
        emit,
        object
          ? enemyDamageSource(
              r.enemies.find((e) => e.id === object.owner),
              'hazard',
            )
          : { kind: 'hazard', label: '보스 기믹' },
      ),
    emit,
  );
  if (r.fighter.hp <= 0 || pendingChoices(r)) return;
  // Stop simulation as soon as a reward opens or death occurs, including within a tick.
  observeTarget(r, dt);
  if (!pendingChoices(r))
    for (const e of r.enemies) {
      if (e.hp > 0 && r.phase === 'combat') {
        const x = e.x,
          y = e.y;
        enemyStep(r, e, dt, emit);
        e.moving = Math.hypot(e.x - x, e.y - y) > 0.05;
      }
      if (pendingChoices(r)) break;
    }
  if (r.fighter.hp <= 0 || pendingChoices(r)) return;
  for (const e of r.enemies) {
    e.blossomTime = Math.max(0, (e.blossomTime ?? 0) - dt);
    if (e.blossomTime <= 0) e.blossom = 0;
    e.confused = Math.max(0, (e.confused ?? 0) - dt);
    if (e.hp <= 0 || !e.poisonStacks || !e.poisonTime) continue;
    e.poisonTime = Math.max(0, e.poisonTime - dt);
    e.poisonTick = (e.poisonTick ?? 0.5) - dt;
    if (e.poisonTick <= 0) {
      e.poisonTick += 0.5;
      hitEnemy(
        r,
        e,
        Math.max(1, e.poisonDamage ?? 2) * (e.poisonStacks >= 5 ? 2 : 1),
        false,
        emit,
        false,
        'tang',
      );
    }
    if (e.poisonTime <= 0) e.poisonStacks = 0;
    if (pendingChoices(r)) return;
  }
  for (const node of r.formations ?? []) {
    node.life -= dt;
    node.pulse -= dt;
    if (node.life <= 0 || node.pulse > 0 || (node.pulses ?? 0) <= 0) continue;
    node.pulses = Math.max(0, (node.pulses ?? 0) - 1);
    node.pulse += 0.7;
    fx(r, node.x, node.y, 'burst', 0, 105, ARTS.jegal.color, 0.24);
    for (const e of r.enemies) {
      if (e.hp > 0 && distance(e, node) < 105) {
        hitEnemy(r, e, node.damage, false, emit, false);
        if (pendingChoices(r)) return;
      }
    }
  }
  if (r.formations) r.formations = r.formations.filter((node) => node.life > 0);
  for (const p of r.projectiles) {
    if (pendingChoices(r) || r.fighter.hp <= 0) break;
    if ((p.delay ?? 0) > 0) {
      p.delay = Math.max(0, p.delay! - dt);
      continue;
    }
    const reachesWall =
      p.x + p.vx * dt < FIELD.left ||
      p.x + p.vx * dt > FIELD.right ||
      p.y + p.vy * dt < FIELD.top - COMBAT_HEIGHT ||
      p.y + p.vy * dt > FIELD.bottom - COMBAT_HEIGHT;
    if (p.returnAt !== undefined && (p.life <= p.returnAt || reachesWall) && !p.returned) {
      p.returned = true;
      p.vx *= -1;
      p.vy *= -1;
    }
    if (p.returned) {
      const owner = r.enemies.find((e) => e.id === p.owner && e.hp > 0);
      if (owner) {
        if (distance(p, combatOrigin(owner)) < 20) {
          p.life = 0;
          continue;
        }
        const angle = Math.atan2(combatOrigin(owner).y - p.y, owner.x - p.x);
        const speed = Math.max(360, Math.hypot(p.vx, p.vy));
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed;
      }
    }
    const previous = { x: p.x, y: p.y };
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.landing) {
      if (p.life <= 0) {
        const landing = p.landing;
        if (p.hostileToEnemies) {
          for (const enemy of r.enemies.filter(
            (enemy) =>
              enemy.hp > 0 &&
              enemy.id !== p.owner &&
              distance(enemy, landing) < landing.radius + 18,
          ))
            hitEnemy(r, enemy, p.damage, false, emit, false);
        } else {
          r.zoneSeq = (r.zoneSeq ?? 0) + 1;
          (r.zones ??= []).push({
            id: r.zoneSeq,
            ...landing,
            owner: p.owner,
            warning: 0.2,
            life: 4.2,
            pulse: 0.2,
            impactDamage: p.damage,
          });
          r.zones = r.zones.slice(-8);
        }
        if (p.hostileToEnemies)
          emit?.({ kind: 'field', action: landing.kind, x: landing.x, y: landing.y });
        if (p.hostileToEnemies)
          fx(
            r,
            landing.x,
            landing.y,
            'burst',
            0,
            landing.radius,
            landing.kind === 'poison' ? 0x8fa860 : 0xc59b71,
            0.3,
          );
      }
      continue;
    }
    if (p.friendly) {
      for (const object of r.encounterObjects ?? [])
        if (
          object.hp > 0 &&
          object.life > 0 &&
          segmentDistance(previous, p, object) < objectBodyRadius(object) + p.radius
        ) {
          damageObject(r, object, p.damage);
          p.life = 0;
          break;
        }
    }
    reflectBamboo(r, p, previous, dt, emit);
    if ((p.friendly && p.life > 0) || p.hostileToEnemies) {
      for (const e of r.enemies) {
        if (
          e.hp > 0 &&
          e.id !== p.owner &&
          !p.hits.includes(e.id) &&
          projectileHitsBody(previous, p, e, p.radius)
        ) {
          p.hits.push(e.id);
          if (p.art === 'tang' && e.hp > 0) {
            if (e.poisonSeq !== p.seq) {
              e.poisonSeq = p.seq;
              e.poisonVolley = 0;
            }
            if ((e.poisonVolley ?? 0) < (p.variant === 'b' ? 2 : 1)) {
              applyPoison(e, Math.max(2, p.damage * 0.15), supportStats(f).poisonLevel || 1);
              e.poisonVolley = (e.poisonVolley ?? 0) + 1;
            }
          }
          if (p.art === 'jegal') addFormation(r, e.x, e.y, 'heaven', p.damage, p.level ?? 1);
          hitEnemy(
            r,
            e,
            p.damage,
            false,
            emit,
            p.friendly,
            p.art,
            p.friendly && p.seq !== undefined,
            p.seq,
          );
          if (p.art !== 'samja' || (p.level ?? 0) < 9 || p.hits.length >= 3) p.life = 0;
          break;
        }
      }
    } else if (!p.friendly && !p.hostileToEnemies && projectileHitsBody(previous, p, f, p.radius)) {
      const before = f.hp;
      damagePlayer(
        r,
        p.damage,
        emit,
        enemyDamageSource(
          r.enemies.find((e) => e.id === p.owner),
          'projectile',
        ),
      );
      if (f.hp > 0 && f.hp < before) {
        if (p.status === 'poison') f.poisonTime = 3.2;
        if (p.status === 'bleed') f.bleedTime = 3.2;
        if (p.status === 'cold') f.slowTime = Math.max(f.slowTime ?? 0, 1.6);
      }
      p.life = 0;
    }
  }
  r.projectiles = r.projectiles.filter(
    (p) =>
      p.life > 0 &&
      p.x > FIELD.left - 80 &&
      p.x < FIELD.right + 80 &&
      p.y > FIELD.top - 80 &&
      p.y < FIELD.bottom + 80,
  );
  for (const e of r.effects) e.life -= dt;
  r.effects = r.effects.filter((e) => e.life > 0);
  if (r.phase === 'combat' && r.enemies.every((e) => e.hp <= 0)) clearWave(r);
}
export function selectedFighter(state: GameState): Fighter | undefined {
  return state.run?.fighter ?? state.family.roster.find((f) => f.id === state.selectedId);
}
export function expireFighters(state: GameState, now: number) {
  const expired = state.family.roster.filter(
    (f) => f.expiresAt !== undefined && f.expiresAt <= now,
  );
  for (const f of expired)
    for (const item of f.items) {
      item.place = 'warehouse';
      state.family.warehouse.push(item);
    }
  state.family.roster = state.family.roster.filter((f) => !expired.includes(f));
  state.family.retired += expired.length;
  if (state.family.training && expired.some((f) => f.id === state.family.training?.fighterId))
    state.family.training = undefined;
  if (!state.family.roster.some((f) => f.id === state.selectedId))
    state.selectedId = state.family.roster[0]?.id ?? null;
  return expired.length > 0;
}
export function command(state: GameState, cmd: Command, now = Date.now()): boolean {
  if (cmd.type === 'restEvent')
    return !!state.run && !pendingChoices(state.run) && resolveRestEvent(state.run, cmd.choice);
  const r = state.run,
    f = selectedFighter(state) as BoundFighter | undefined;
  if (cmd.type === 'openTraining') {
    if (
      !f ||
      f.progressionVersion !== 2 ||
      r?.phase === 'dead' ||
      pendingChoices(r) ||
      state.family.training ||
      !eligibleOffers(f).length
    )
      return false;
    delete f.deferredTrainingPoints;
    if (r) rollOffers(r);
    else trainFamily(state, f);
    return true;
  }
  if (cmd.type === 'deferTraining') {
    const target =
      r?.fighter ?? state.family.roster.find((f) => f.id === state.family.training?.fighterId);
    if (
      !target ||
      target.progressionVersion !== 2 ||
      !target.arts.length ||
      target.augmentOffers?.length ||
      !(r?.offers.length || state.family.training?.offers.length)
    )
      return false;
    target.deferredTrainingPoints = target.trainingPoints;
    if (r) r.offers = [];
    else state.family.training = undefined;
    return true;
  }
  if (cmd.type === 'chooseAugment') {
    const target =
      r?.fighter ?? state.family.roster.find((f) => f.id === state.family.training?.fighterId);
    if (
      !target ||
      target.progressionVersion !== 2 ||
      r?.phase === 'dead' ||
      !target.augmentOffers?.includes(cmd.id) ||
      target.augments?.includes(cmd.id)
    )
      return false;
    const before = maximumHp(target);
    (target.augments ??= []).push(cmd.id);
    target.augmentOffers = [];
    target.hp += maximumHp(target) - before;
    if (r) rollOffers(r);
    else trainFamily(state, target);
    return true;
  }
  if (cmd.type === 'recruit' || cmd.type === 'buyRecruitTicket')
    return !r && !state.family.training && recruitmentAction(state.family, cmd.type, now);
  if (cmd.type === 'startRecruit') {
    if (r || state.family.training || !cmd.name.trim()) return false;
    const candidate = state.family.recruitment?.candidates.find((c) => c.id === cmd.id);
    if (!candidate || !startRun(state, cmd.name, candidate.seed)) return false;
    state.run!.fighter.growth = { ...candidate.growth };
    state.run!.fighter.appearance = candidate.appearance;
    if (candidate.appearance === undefined)
      state.run!.fighter.portrait = candidate.portrait ?? ((candidate.seed % 3) as 0 | 1 | 2);
    initializeCharacter(
      state.run!,
      candidate.innate ?? TRAIT_IDS[candidate.seed % TRAIT_IDS.length],
    );
    state.family.recruitment!.candidates = [];
    return true;
  }
  if (cmd.type === 'startBasic') {
    const recruitment = recruitmentView(state.family, now);
    if (
      r ||
      state.family.training ||
      recruitment.tickets !== 0 ||
      recruitment.candidates.length ||
      !cmd.name.trim() ||
      !startRun(state, cmd.name, 481516)
    )
      return false;
    state.run!.fighter.growth = { constitution: 1, strength: 1, agility: 1, inner: 1 };
    initializeCharacter(state.run!, undefined);
    return true;
  }
  if (cmd.type === 'start') {
    // Compatibility entry point still pays for recruitment; it cannot reroll a saved draft.
    if (r || state.family.training) return false;
    const next = recruitmentView(state.family, now);
    if (next.candidates.length) return false;
    if (next.tickets > 0) {
      if (!recruitmentAction(state.family, 'recruit', now)) return false;
      state.family.recruitment!.candidates = [];
    }
    return startRun(state, cmd.name, next.tickets > 0 ? cmd.seed : 481516);
  }
  if (cmd.type === 'select') {
    if (r || !state.family.roster.some((f) => f.id === cmd.id)) return false;
    state.selectedId = cmd.id;
    if (!state.family.training) {
      const selected = selectedFighter(state);
      if (selected?.augmentOffers?.length) trainFamily(state, selected);
    }
    return true;
  }
  if (cmd.type === 'choose') {
    const target =
      r?.fighter ?? state.family.roster.find((f) => f.id === state.family.training?.fighterId);
    const offers = r?.offers ?? state.family.training?.offers ?? [];
    if (
      !target ||
      target.augmentOffers?.length ||
      !offers.some((o) => o.art === cmd.offer.art && o.type === cmd.offer.type)
    )
      return false;
    const art = target.arts.find((a) => a.id === cmd.offer.art);
    if (cmd.offer.type === 'learn' && !art && target.arts.length < 4) {
      let sword = target.items.find(
        (item) => item.place === 'weapon' && compatibleWeapon(item, cmd.offer.art),
      );
      if (!sword) {
        const training = makeLootItem(
          `weapon-${ART_WEAPONS[cmd.offer.art]}-0`,
          `${target.id}-training-${cmd.offer.art}`,
          'weapon',
        );
        const space = firstSpace(target.items, training, 'weapon');
        if (!space) return false;
        Object.assign(training, space);
        target.items.push(training);
        sword = training;
      }
      target.arts.push({ id: cmd.offer.art, level: 1, gauge: 0, combo: 0, defenseCd: 0 });
      if (sword) {
        const bf = target as BoundFighter;
        bf.bindings ??= {};
        bf.bindings[cmd.offer.art] = sword.id;
      }
    } else if (art && art.level < ARTS[art.id].max && cmd.offer.type === 'upgrade') art.level++;
    else return false;
    if (target.progressionVersion === 2)
      target.trainingPoints =
        (target.trainingPoints ?? 0) -
        (cmd.offer.type === 'learn'
          ? 1
          : target.arts.find((a) => a.id === cmd.offer.art)!.level - 1);
    target.spent = (target.spent ?? r?.spent ?? target.level - 1) + 1;
    if (r) {
      r.spent++;
      r.offers = [];
      rollOffers(r);
    } else {
      if (state.family.training) state.family.training.offers = [];
      trainFamily(state, target);
    }
    return true;
  }
  if (cmd.type === 'switch') {
    if (!r || pendingChoices(r) || r.fighter.arts.length < 2 || r.fighter.actionTime > 0)
      return false;
    switchTrait(r.fighter);
    r.fighter.active =
      (r.fighter.active + cmd.delta + r.fighter.arts.length) % r.fighter.arts.length;
    return true;
  }
  if (pendingChoices(r)) return false;
  if (cmd.type === 'next') {
    if (!r || !['loot', 'prep'].includes(r.phase) || pendingChoices(r)) return false;
    r.fighter.items = r.fighter.items.filter((i) => i.place !== 'ground');
    if (r.wave === 20) {
      state.family.silver = (state.family.silver ?? 0) + r.gold;
      recordJourney(state, r, 'victory', now);
      r.fighter.bornAt = now;
      r.fighter.expiresAt = now + 7 * 24 * 60 * 60 * 1000;
      state.family.roster.push(structuredClone(r.fighter));
      state.family.victories++;
      state.selectedId = r.fighter.id;
      state.run = null;
    } else {
      r.wave++;
      spawnWave(r);
    }
    return true;
  }
  if (cmd.type === 'claim') {
    if (r?.phase !== 'dead') return false;
    recordJourney(state, r, 'dead', now);
    state.family.deaths++;
    state.run = null;
    return true;
  }
  if (!f) return false;
  if (cmd.type === 'buySupply') {
    if (!r || r.phase !== 'prep') return false;
    const supplies = r.supplies ?? merchantSupplies(r);
    const entry = supplies.find((supply) => supply.templateId === cmd.templateId);
    if (!entry || entry.stock < 1 || r.gold < entry.price) return false;
    const item = makeLootItem(
      entry.templateId,
      `${r.id}-vendor-${r.wave}-${entry.templateId}-${entry.stock}`,
      'ground',
    );
    r.gold -= entry.price;
    entry.stock--;
    r.supplies = supplies;
    r.merchantStock = supplies[0].stock;
    const stack =
      stackable(item) && f.items.find((entry) => entry.place === 'ground' && canStack(entry, item));
    if (stack) stack.count += item.count;
    else f.items.push(item);
    return true;
  }
  if (cmd.type === 'refine' || cmd.type === 'sellMaterial') {
    if (!r || r.phase !== 'prep') return false;
    const item = f.items.find((entry) => entry.id === cmd.id);
    if (!item || !['weapon', 'general', 'equipped', 'ground'].includes(item.place)) return false;
    if (cmd.type === 'sellMaterial') {
      if (item.kind !== 'ore') return false;
      r.gold += itemValue(item) * item.count;
      f.items = f.items.filter((entry) => entry.id !== item.id);
      return true;
    }
    const next = refinePreview(item);
    const materials = f.items.filter(
      (entry) => isRefiningMaterial(entry) && ['general', 'ground'].includes(entry.place),
    );
    if (
      !next ||
      r.gold < REFINE_COST.gold ||
      materials.reduce((total, entry) => total + entry.count, 0) < REFINE_COST.materials
    )
      return false;
    let needed = REFINE_COST.materials;
    for (const material of materials) {
      const take = Math.min(needed, material.count);
      material.count -= take;
      needed -= take;
      if (!needed) break;
    }
    f.items = f.items.filter((entry) => entry.count > 0);
    r.gold -= REFINE_COST.gold;
    Object.assign(item, next, { upgrades: (item.upgrades ?? 0) + 1 });
    return true;
  }
  if (cmd.type === 'bind') {
    if (
      r?.phase === 'dead' ||
      !f.arts.some((a) => a.id === cmd.art) ||
      !f.items.some(
        (i) => i.id === cmd.item && i.place === 'weapon' && compatibleWeapon(i, cmd.art),
      )
    )
      return false;
    f.bindings ??= {};
    f.bindings[cmd.art] = cmd.item;
    return true;
  }
  if (cmd.type === 'discardItem') {
    if (r?.phase === 'combat' || r?.phase === 'dead') return false;
    const item = f.items.find((i) => i.id === cmd.id && i.place === 'ground');
    if (!item) return false;
    f.items = f.items.filter((i) => i.id !== cmd.id);
    return true;
  }
  if (cmd.type === 'buy' || cmd.type === 'heal') {
    if (!r || r.phase !== 'prep') return false;
    if (cmd.type === 'heal') {
      const offer = healingOffer(f, r.gold, r.wave);
      if (!offer.available) return false;
      r.gold -= offer.price;
      f.hp += offer.amount;
      return true;
    }
    // Old clients use the same persisted stock and price; there is no second purchase path.
    if (cmd.kind !== 'medicine') return false;
    return command(
      state,
      { type: 'buySupply', templateId: (r.supplies ?? merchantSupplies(r))[0].templateId },
      now,
    );
  }
  if (r?.phase === 'combat' || r?.phase === 'dead') return false;
  if (cmd.type === 'arrangeItems') {
    compactBags(f.items);
    // Same first-space/split-stack command as the individual Stow button.
    const waiting = f.items.filter((item) => item.place === 'ground');
    for (const source of waiting) {
      const place = source.kind === 'sword' ? 'weapon' : 'general';
      let item = f.items.find((entry) => entry.id === source.id);
      while (item && item.place === 'ground') {
        const space = firstSpace(f.items, item, place);
        if (!space || !command(state, { type: 'moveItem', id: item.id, place, ...space }, now))
          break;
        item = f.items.find((entry) => entry.id === source.id);
      }
    }
    compactBags(f.items);
    return true;
  }
  const item =
    f.items.find((i) => i.id === ('id' in cmd ? cmd.id : '')) ??
    state.family.warehouse.find((i) => i.id === ('id' in cmd ? cmd.id : ''));
  if (!item) return false;
  if (r && item.place === 'warehouse') return false;
  if (cmd.type === 'use') {
    if (item.place === 'warehouse' || !useItem(f, item)) return false;
    if (r && item.kind === 'medicine') combatReport(r).potionsUsed++;
    if (item.kind === 'manual') {
      if (r) grantXp(r, item.power);
      else {
        const before = maximumHp(f);
        f.xp += item.power;
        while (f.xp >= xpThreshold(f.level + 1)) f.level++;
        f.hp += maximumHp(f) - before;
        trainFamily(state, f);
      }
    }
    return true;
  }
  if (cmd.type !== 'moveItem') return false;
  if (cmd.place === 'warehouse' && r) return false;
  if (cmd.place === 'equipped' && !['robe', 'boots', 'charm'].includes(item.kind)) return false;
  const target = cmd.place,
    x = cmd.x ?? 0,
    y = cmd.y ?? 0,
    rotated = cmd.rotated ?? item.rotated;
  if (!canPlace(f.items, item, target, x, y, rotated)) return false;
  // Split incoming stacks. Move legacy bag stacks intact to avoid overlapping copies.
  const destination = target === 'warehouse' ? state.family.warehouse : f.items;
  if (
    item.count > 1 &&
    item.place !== 'weapon' &&
    item.place !== 'general' &&
    (target === 'weapon' || target === 'general')
  ) {
    item.count--;
    state.family.itemSequence = (state.family.itemSequence ?? 0) + 1;
    const copy = {
      ...item,
      id: `${item.id}-piece-${state.family.itemSequence}`,
      count: 1,
      place: target,
      x,
      y,
      rotated,
    };
    destination.push(copy);
    return true;
  }
  if (item.place === 'weapon' && target !== 'weapon') removeBindings(f, item.id);
  if (target === 'equipped') {
    const swap = equipmentSwapPlan(f.items, item);
    if (!swap) return false;
    for (const position of swap) {
      const old = f.items.find((entry) => entry.id === position.id)!;
      Object.assign(old, { place: 'general', x: position.x, y: position.y });
    }
  }
  if (item.place === 'warehouse') {
    state.family.warehouse = state.family.warehouse.filter((i) => i.id !== item.id);
    f.items.push(item);
  }
  if (target === 'warehouse') {
    f.items = f.items.filter((i) => i.id !== item.id);
    state.family.warehouse.push(item);
  }
  item.place = target;
  item.x = x;
  item.y = y;
  item.rotated = rotated;
  if (
    (target === 'ground' || target === 'warehouse') &&
    ['medicine', 'manual', 'ore'].includes(item.kind)
  ) {
    const stack = destination.find(
      (i) =>
        i.id !== item.id && canStack(i, item) && i.place === target && i.quality === item.quality,
    );
    if (stack) {
      stack.count += item.count;
      if (target === 'warehouse')
        state.family.warehouse = state.family.warehouse.filter((i) => i.id !== item.id);
      else f.items = f.items.filter((i) => i.id !== item.id);
    }
  }
  return true;
}
function recordJourney(state: GameState, r: Run, outcome: 'victory' | 'dead', now: number) {
  if (outcome === 'victory' && r.combatReport) {
    r.combatReport.loadout = r.fighter.arts.map(({ id, level }) => ({ id, level }));
    r.combatReport.remainingMedicine = r.fighter.items
      .filter((i) => i.kind === 'medicine' && i.place !== 'warehouse')
      .reduce((sum, i) => sum + i.count, 0);
  }
  const result = {
    ...(r.combatReport ? { combatReport: structuredClone(r.combatReport) } : {}),
    id: r.id,
    name: r.fighter.name,
    outcome,
    wave: r.wave,
    level: r.fighter.level,
    kills: r.kills,
    elapsed: r.elapsed,
    gold: outcome === 'victory' ? r.gold : 0,
    items:
      outcome === 'victory' ? r.fighter.items.reduce((count, item) => count + item.count, 0) : 0,
    route: [...(r.regionRoute ?? [])],
    endedAt: now,
  };
  state.family.journeys = [result, ...(state.family.journeys ?? [])].slice(0, 10);
}
export function stashGroundItem(state: GameState, id: string, place: 'weapon' | 'general') {
  const f = selectedFighter(state),
    item = f?.items.find((i) => i.id === id);
  if (!f || !item || state.run?.phase === 'combat') return false;
  const pos = firstSpace(f.items, item, place);
  return pos ? command(state, { type: 'moveItem', id, place, ...pos }) : false;
}

function initializeCharacter(r: Run, innate: Fighter['innate']) {
  const f = r.fighter;
  f.progressionVersion = 2;
  f.trainingPoints = 1;
  f.innate = innate;
  f.augments = [];
  f.augmentOffers = [];
  f.traitState = {};
  rollOffers(r);
}
