import { pendingChoices } from './character';
import { FIELD } from './content';
import { combatOrigin } from './combat-body';
import { bossById } from './campaign';
import { regionName } from './campaign';
import { applyFieldContact, FIELD_EFFECTS } from './field-effects';
import { hostileProjectileVisual } from './projectile-visual';
import { castMechanic, stepMechanic } from './boss-mechanics';
import { meleeKit } from './boss-melee';
import type { EncounterObject, Enemy, Run } from './model';
import type { CombatCueSink } from './combat';

type Signature =
  | 'call'
  | 'flag'
  | 'chain'
  | 'chase'
  | 'poison'
  | 'mine'
  | 'venom'
  | 'purify'
  | 'parry'
  | 'return'
  | 'wide'
  | 'ice'
  | 'silk'
  | 'snow'
  | 'icewall'
  | 'bottle'
  | 'grab'
  | 'armour'
  | 'counter'
  | 'smoke'
  | 'drunk'
  | 'bamboo'
  | 'reflect'
  | 'fire'
  | 'wall'
  | 'repair'
  | 'decoy'
  | 'sand'
  | 'pull'
  | 'oasis'
  | 'blood'
  | 'selfbuff'
  | 'healcut'
  | 'exchange'
  | 'gate'
  | 'turret'
  | 'rotate'
  | 'safe';
const signatures: Signature[][] = [
  ['call', 'flag', 'chain', 'chase'],
  ['poison', 'mine', 'venom', 'purify'],
  ['parry', 'return', 'parry', 'wide'],
  ['ice', 'silk', 'snow', 'icewall'],
  ['bottle', 'grab', 'armour', 'counter'],
  ['smoke', 'drunk', 'bamboo', 'reflect'],
  ['fire', 'wall', 'repair', 'decoy'],
  ['sand', 'return', 'pull', 'oasis'],
  ['blood', 'selfbuff', 'healcut', 'exchange'],
  ['gate', 'turret', 'rotate', 'safe'],
];
export function bossSignature(e: Enemy) {
  const boss = bossById(e.bossId);
  return boss ? signatures[Number(boss.id.split('-')[0])][boss.phase - 1] : null;
}
/** One semantic resolver serves simulation, artwork and contextual copy, including old saves. */
export function encounterEffect(r: Run, object: EncounterObject) {
  const owner = r.enemies.find((e) => e.id === object.owner);
  const signature = owner ? bossSignature(owner) : null;
  if (object.kind === 'mine') {
    if (signature === 'fire') return 'fire';
    if (signature === 'bottle' || signature === 'drunk') return 'brew';
    if (signature === 'gate' || signature === 'rotate') return 'gate';
    return regionName(r) === '독무곡' ? 'poison' : 'trap';
  }
  if (object.kind === 'smoke')
    return signature === 'sand' ? 'sand' : signature === 'snow' ? 'cold' : 'smoke';
  return object.kind;
}
function activeField(r: Run, effects: readonly string[]) {
  return r.encounterObjects?.some(
    (o) =>
      o.life > 0 &&
      o.warning <= 0 &&
      r.enemies.some((e) => e.id === o.owner && e.hp > 0) &&
      dist(o, r.fighter) < o.radius + 18 &&
      effects.includes(encounterEffect(r, o)),
  );
}
export function encounterMovementFactor(r: Run) {
  return activeField(r, ['sand']) ? 0.55 : activeField(r, ['cold']) ? 0.7 : 1;
}
export function encounterAttackRecovery(r: Run) {
  return activeField(r, ['smoke', 'brew']) ? 0.65 : 1;
}
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
function add(
  r: Run,
  e: Enemy,
  kind: EncounterObject['kind'],
  x: number,
  y: number,
  radius = 65,
  life = 7,
) {
  const objects = (r.encounterObjects ??= []);
  r.encounterSeq = (r.encounterSeq ?? 0) + 1;
  const hp = ['wall', 'ice', 'flag', 'herb', 'turret', 'chest'].includes(kind)
    ? kind === 'turret'
      ? 65
      : 40
    : 0;
  const object: EncounterObject = {
    id: r.encounterSeq,
    owner: e.id,
    kind,
    x: clamp(x, FIELD.left + radius, FIELD.right - radius),
    y: clamp(y, FIELD.top + radius, FIELD.bottom - radius),
    radius,
    warning: 1.2,
    life: life + 1.2,
    hp,
    maxHp: hp,
    pulse: kind === 'turret' ? 1 : 0,
    aim: 0,
  };
  // Prevent unbounded arenas; expire the oldest object without granting anything.
  if (objects.length >= 12) objects.shift();
  objects.push(object);
  return object;
}
export function signatureCast(r: Run, e: Enemy, target = r.fighter as { x: number; y: number }) {
  const signature = bossSignature(e),
    f = target;
  if (!signature) return;
  // Removed throws must also stay removed if a caller requests the old signature.
  // Previously saved brew fields are still resolved by encounterEffect below.
  if (['4-1', '5-2', '0-3', '7-3', '2-2'].includes(e.bossId ?? '')) return;
  if (e.bossId === '3-3') {
    if (!r.encounterObjects?.some((o) => o.owner === e.id && o.kind === 'smoke' && o.life > 0))
      add(r, e, 'smoke', e.x, e.y, 180, 3).warning = 0;
    return;
  }
  if (castMechanic(r, e, add, target)) return;
  if (signature === 'poison' || signature === 'venom') {
    if (signature === 'venom' && e.pattern % 3 === 1) {
      const tether = add(r, e, 'tether', e.x, e.y, 330, 3);
      tether.aim = 1;
    } else if (signature === 'venom' && e.pattern % 3 === 2) {
      add(r, e, 'seal', f.x, f.y, 110, 4);
    } else {
      for (const offset of [-100, 100]) {
        r.zoneSeq = (r.zoneSeq ?? 0) + 1;
        (r.zones ??= []).push({
          id: r.zoneSeq,
          x: clamp(f.x + offset, FIELD.left + 90, FIELD.right - 90),
          y: f.y,
          radius: 90,
          kind: 'poison',
          warning: 1.2,
          life: 6.2,
          pulse: 0,
        });
      }
      r.zones = r.zones?.slice(-8);
    }
  } else if (signature === 'mine') {
    for (const offset of [-135, 0, 135]) add(r, e, 'mine', f.x + offset, f.y, 70, 5);
    add(r, e, 'smoke', e.x, e.y, 120, 3);
  } else if (['flag', 'parry', 'counter'].includes(signature)) {
    if (signature === 'flag') {
      // A single destructible standard near its owner; destruction ends the buff.
      if (
        !r.encounterObjects?.some(
          (o) => o.owner === e.id && o.kind === 'flag' && o.hp > 0 && o.life > 0,
        )
      )
        add(r, e, 'flag', e.x + 70, e.y + 55, 180, 12).warning = 0;
    } else e.guardTime = 2.5;
  } else if (['chain', 'silk', 'healcut'].includes(signature)) {
    const tether = add(r, e, 'tether', e.x, e.y, signature === 'pull' ? 320 : 360, 4);
    tether.aim = signature === 'silk' ? 1 : signature === 'healcut' ? 2 : 0;
    if (signature === 'healcut') add(r, e, 'seal', f.x, f.y, 100, 5);
  } else if (['wall', 'icewall'].includes(signature)) {
    const kind = signature === 'icewall' ? 'ice' : 'wall';
    r.encounterObjects = r.encounterObjects?.filter((o) => o.owner !== e.id || o.kind !== kind);
    for (const offset of [-150, 150])
      add(r, e, signature === 'icewall' ? 'ice' : 'wall', f.x + offset, f.y - 30, 60, 7);
    if (signature === 'icewall') {
      const warm = r.zones?.find((z) => z.kind === 'cold' && z.id === 0);
      if (warm) {
        warm.x = f.x < 960 ? 1400 : 520;
        warm.y = 535;
      }
    }
  } else if (signature === 'purify') {
    add(r, e, 'herb', f.x + (f.x < 960 ? 170 : -170), f.y, 40, 18);
    add(r, e, 'mine', f.x, f.y, 150, 7);
  } else if (['smoke', 'snow', 'sand'].includes(signature)) {
    add(r, e, 'smoke', signature === 'sand' ? e.x : f.x, signature === 'sand' ? e.y : f.y, 160, 4);
  } else if (signature === 'selfbuff') {
    e.hp = Math.max(1, e.hp - e.maxHp * 0.03);
    e.rageTime = 5;
  } else if (signature === 'return') {
    const object = add(r, e, 'volley', e.x, e.y, 35, 2);
    object.aim = Math.atan2(f.y - object.y, f.x - object.x);
  } else if (signature === 'chase' || signature === 'wide') {
    if (e.hp <= e.maxHp * (signature === 'chase' ? 0.3 : 0.5)) e.rageTime = 8;
  } else if (signature === 'blood') {
    // Blood recovery comes from actual damage, never from an unattended cast.
    add(r, e, 'blood', e.x, e.y, 150, 6);
  } else if (signature !== 'call') {
    add(r, e, signature === 'ice' ? 'ice' : 'mine', f.x, f.y, 95, signature === 'bottle' ? 3 : 6);
  }
}

/** All object timers and interactions are saved; warnings and hits share these exact shapes. */
export function stepEncounters(
  r: Run,
  dt: number,
  damage: (amount: number, object?: EncounterObject) => void,
  emit?: CombatCueSink,
) {
  for (const e of r.enemies) {
    e.guardTime = Math.max(0, (e.guardTime ?? 0) - dt);
    e.rageTime = Math.max(0, (e.rageTime ?? 0) - dt);
    e.veilTime = Math.max(0, (e.veilTime ?? 0) - dt);
    e.armourTime = Math.max(0, (e.armourTime ?? 0) - dt);
    e.reactionTime = Math.max(0, (e.reactionTime ?? 0) - dt);
    if (e.bossId === '8-2' && e.hp > 0 && e.hp < e.maxHp * 0.35) e.rageTime = 0.2;
    if (e.hp <= 0 || !e.bossId) continue;
    // These mechanics now have an explicit prepared move, not an independent timer.
    if (meleeKit(e)) continue;
    e.skillClock = (e.skillClock ?? 0) + dt;
    if (e.skillClock >= 8) {
      e.skillClock -= 8;
      signatureCast(r, e);
    }
  }
  const f = r.fighter;
  for (const object of r.encounterObjects ?? []) {
    if (r.phase !== 'combat' || pendingChoices(r)) break;
    const owner = r.enemies.find((e) => e.id === object.owner && e.hp > 0);
    if (!owner) {
      object.life = 0;
      continue;
    }
    object.life -= dt;
    object.warning = Math.max(0, object.warning - dt);
    if (object.life <= 0 || object.warning > 0) continue;
    object.pulse -= dt;
    const objectDamage = (amount: number) => damage(amount, object);
    if (stepMechanic(r, object, owner, dt, objectDamage, emit)) continue;
    const inside = dist(object, f) < object.radius + 18;
    if (object.kind === 'wall' || object.kind === 'ice') {
      if (inside && object.hp > 0) {
        const angle = Math.atan2(f.y - object.y, f.x - object.x);
        f.x = clamp(object.x + Math.cos(angle) * (object.radius + 19), FIELD.left, FIELD.right);
        f.y = clamp(object.y + Math.sin(angle) * (object.radius + 19), FIELD.top, FIELD.bottom);
        if (object.kind === 'ice' && object.pulse <= 0) {
          object.pulse = 1;
          applyFieldContact(r, 'cold', objectDamage);
        }
      }
    } else if (object.kind === 'tether') {
      if (!inside) {
        object.life = 0;
        continue;
      }
      if (f.invulnerable > 0) {
        object.life = 0;
        continue;
      }
      const length = dist(object, f);
      if (length > 85) {
        f.x += ((object.x - f.x) / length) * 95 * dt;
        f.y += ((object.y - f.y) / length) * 95 * dt;
      }
      if (object.aim === 1) f.slowTime = 0.5;
      if (owner.bossId === '3-2' && object.pulse <= 0) {
        object.pulse = 1;
        applyFieldContact(r, 'cold', objectDamage);
      }
      if (object.aim === 2) f.healSuppression = 3;
    } else if (object.kind === 'herb') {
      // Cleansing is triggered by destroying the plant, never by touching it.
      continue;
    } else if (object.kind === 'volley') {
      for (let n = 0; n < 3; n++) {
        const angle = object.aim + (n - 1) * 0.25;
        r.projectiles.push({
          x: object.x,
          y: combatOrigin(object).y,
          vx: Math.cos(angle) * 260,
          vy: Math.sin(angle) * 260,
          life: 2.6,
          damage: 8 + (bossById(owner.bossId)?.phase ?? 1) * 2,
          radius: 14,
          hits: [],
          friendly: false,
          owner: owner.id,
          returnAt: 1.3,
          visual: hostileProjectileVisual(r, owner, true),
        });
      }
      object.life = 0;
    } else if (object.kind === 'turret') {
      // The next shot is aimed once, then visibly charged for one second.
      if (object.pulse <= 0) {
        if (object.pulse <= -1) {
          r.projectiles.push({
            x: object.x,
            y: combatOrigin(object).y,
            vx: Math.cos(object.aim) * 350,
            vy: Math.sin(object.aim) * 350,
            life: 3,
            damage: 10,
            visual: 'arrow',
            radius: 12,
            hits: [],
            friendly: false,
            owner: owner.id,
          });
          object.pulse = 2.5;
        } else if (object.pulse + dt > 0) object.aim = Math.atan2(f.y - object.y, f.x - object.x);
      }
    } else if (object.kind === 'smoke') {
      const effect = encounterEffect(r, object);
      if (dist(object, owner) < object.radius + 18) owner.veilTime = 0.12;
      if (inside && effect === 'cold' && object.pulse <= 0) {
        object.pulse = FIELD_EFFECTS.cold.interval;
        applyFieldContact(r, 'cold', objectDamage);
      }
    } else if (
      (object.kind === 'safe' ? !inside : inside) &&
      object.pulse <= 0 &&
      !['flag', 'smoke'].includes(object.kind)
    ) {
      if (object.kind === 'chest') {
        objectDamage(14);
        object.life = 0;
      } else {
        const effect = encounterEffect(r, object);
        if (!(effect in FIELD_EFFECTS)) continue;
        const contact = effect as keyof typeof FIELD_EFFECTS;
        object.pulse = FIELD_EFFECTS[contact].interval;
        const loss = applyFieldContact(r, contact, (amount) =>
          objectDamage(object.kind === 'mine' && contact === 'poison' ? amount * 3 : amount),
        );
        if (loss > 0 || contact === 'brew')
          emit?.({
            kind: 'field',
            action: contact === 'safe' || contact === 'seal' ? 'gate' : contact,
            x: object.x,
            y: object.y,
          });
        if (contact === 'blood') owner.hp = Math.min(owner.maxHp, owner.hp + loss * 0.6);
        // Armed mines and spike mechanisms are single-trigger traps, even when evaded.
        if (contact === 'trap' || (object.kind === 'mine' && contact === 'poison')) object.life = 0;
      }
      if (f.hp <= 0 || pendingChoices(r)) break;
    }
  }
  r.encounterObjects = (r.encounterObjects ?? []).filter((o) => o.life > 0);
  if (!r.encounterObjects.some((o) => o.mechanic === 'grab' && o.stage === 1)) f.capturedTime = 0;
}

export function damageObject(r: Run, object: EncounterObject, damage: number) {
  if (object.hp <= 0 || object.life <= 0) return;
  object.hp = Math.max(0, object.hp - damage);
  if (!object.hp) {
    if (object.kind === 'herb') {
      object.mechanic = 'cleansing';
      object.radius = 190;
      object.warning = 0;
      object.life = 4;
      object.age = 0;
    } else object.life = 0;
  }
}
export function objectBodyRadius(object: EncounterObject) {
  return object.kind === 'wall'
    ? object.radius
    : object.kind === 'ice'
      ? 45
      : object.kind === 'flag'
        ? 25
        : 35;
}
export function bossDamageFactor(r: Run, e: Enemy) {
  const directional =
    e.role === 'guard' ||
    e.role === 'staffguard' ||
    e.role === 'gatekeeper' ||
    !!meleeKit(e)?.moves.stance ||
    bossSignature(e) === 'parry';
  const guarded =
    (e.guardTime ?? 0) > 0 &&
    (!directional || Math.cos(Math.atan2(r.fighter.y - e.y, r.fighter.x - e.x) - e.facing) > 0.3);
  const flag = r.encounterObjects?.some(
    (o) =>
      o.kind === 'flag' &&
      o.owner === e.id &&
      !o.mechanic &&
      o.hp > 0 &&
      o.life > 0 &&
      o.warning <= 0 &&
      dist(o, e) < o.radius,
  );
  return guarded || flag ? 0.45 : 1;
}
export function recoveryFactor(f: Run['fighter']) {
  return (f.healSuppression ?? 0) > 0 ? 0.5 : 1;
}
export function encounterHint(r: Run) {
  if ((r.fighter.capturedTime ?? 0) > 0) return '붙잡힘';
  if ((r.fighter.freezeTime ?? 0) > 0) return '동결 · 온기로 해빙';
  if ((r.fighter.coldStacks ?? 0) > 0) return '냉기 누적 · 회피 또는 온기로 해제';
  if ((r.fighter.bleedTime ?? 0) > 0) return '출혈 · 지속 피해';
  if (r.encounterObjects?.some((o) => o.mechanic === 'oasis' && o.life > 0))
    return '모래벽 · 오아시스 통로 차단';
  if (r.encounterObjects?.some((o) => o.mechanic === 'formation' && o.life > 0))
    return '빛나는 진 안으로 이동';
  if (r.encounterObjects?.some((o) => o.mechanic === 'exchange' && o.life > 0))
    return '체력 교환 · 연결을 파괴하거나 회피하세요';
  if (r.encounterObjects?.some((o) => o.mechanic === 'drone' && o.stage === 1))
    return '수리 중 · 드론을 파괴하세요';
  if (
    r.encounterObjects?.some(
      (o) => o.mechanic === 'poison-powder' && o.warning <= 0 && dist(o, r.fighter) < o.radius,
    )
  )
    return '독분 · 피해와 둔화';
  if (
    r.encounterObjects?.some(
      (o) => o.mechanic === 'poison-mist' && o.warning <= 0 && dist(o, r.fighter) < o.radius,
    )
  )
    return '독무 · 중독과 회복 감소';
  if (activeField(r, ['sand'])) return '모래 · 이동 속도 감소';
  if (activeField(r, ['smoke'])) return '연막 · 공격 속도 감소';
  if (activeField(r, ['brew'])) return '취기 · 이동과 공격 속도 감소';
  if (activeField(r, ['cold'])) return '눈보라 · 냉기 피해와 둔화';
  if ((r.fighter.burnTime ?? 0) > 0) return '화상 · 지속 피해';
  if ((r.fighter.poisonTime ?? 0) > 0) return '중독 · 지속 피해';
  if ((r.fighter.healSuppression ?? 0) > 0) return '회복량 감소';
  const object = r.encounterObjects?.find((o) => o.life > 0 && o.kind !== 'smoke');
  if (!object) return '';
  return object.kind === 'tether'
    ? '거리 벌리기 · 회피로 연결 끊기'
    : object.kind === 'herb'
      ? '정화초를 공격해 해독'
      : object.kind === 'safe'
        ? '녹색 안전지대로 이동'
        : ['wall', 'ice', 'flag', 'turret'].includes(object.kind)
          ? '공격으로 파괴 가능'
          : '위험 구역에서 벗어나세요';
}
