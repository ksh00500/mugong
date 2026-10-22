import { FIELD, maximumHp } from './content';
import { segmentDistance } from './enemy-geometry';
import { combatOrigin } from './combat-body';
import type { EncounterObject, Enemy, Projectile, Run } from './model';
import type { CombatCueSink } from './combat';
import { applyFieldContact, FIELD_EFFECTS } from './field-effects';

type Spawn = (
  r: Run,
  e: Enemy,
  kind: EncounterObject['kind'],
  x: number,
  y: number,
  radius?: number,
  life?: number,
) => EncounterObject;
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
function impact(r: Run, x: number, y: number, radius: number, color: number) {
  r.effects.push({ kind: 'burst', x, y, radius, color, angle: 0, life: 0.3, duration: 0.3 });
}
/** Dedicated, serializable state machines. Timers advance only during active combat. */
export function castMechanic(
  r: Run,
  e: Enemy,
  spawn: Spawn,
  target = r.fighter as { x: number; y: number },
): boolean {
  const f = target,
    id = e.bossId;
  const replace = (...mechanics: NonNullable<EncounterObject['mechanic']>[]) => {
    r.encounterObjects = (r.encounterObjects ?? []).filter(
      (o) => o.owner !== e.id || !o.mechanic || !mechanics.includes(o.mechanic),
    );
  };
  const make = (
    mechanic: NonNullable<EncounterObject['mechanic']>,
    kind: EncounterObject['kind'],
    x: number,
    y: number,
    radius: number,
    life: number,
  ) => {
    const o = spawn(r, e, kind, x, y, radius, life);
    Object.assign(o, { mechanic, age: 0, stage: 0, anchorX: x, anchorY: y });
    return o;
  };
  if (id === '1-3') {
    const mode = e.pattern % 3;
    if (mode === 0)
      for (const offset of [-0.18, 0, 0.18]) {
        const aim = Math.atan2(f.y - e.y, f.x - e.x) + offset;
        r.projectiles.push({
          x: e.x,
          y: combatOrigin(e).y,
          vx: Math.cos(aim) * 400,
          vy: Math.sin(aim) * 400,
          life: 3,
          damage: 9,
          radius: 9,
          hits: [],
          friendly: false,
          owner: e.id,
          visual: 'jade-needle',
          status: 'poison',
        });
      }
    else
      make(
        mode === 1 ? 'poison-powder' : 'poison-mist',
        'mine',
        f.x,
        f.y,
        mode === 1 ? 110 : 150,
        5,
      );
  } else if (id === '5-4' || id === '5-3') {
    replace(id === '5-4' ? 'bamboo' : 'falling-bamboo');
    for (const offset of [-150, 150]) {
      const o = make(id === '5-4' ? 'bamboo' : 'falling-bamboo', 'wall', f.x + offset, f.y, 32, 9);
      o.aim = Math.atan2(f.y - e.y, f.x - e.x);
    }
    if (id === '5-4')
      for (const bamboo of (r.encounterObjects ?? [])
        .filter((o) => o.owner === e.id && o.mechanic === 'bamboo')
        .slice(-2)) {
        const aim = Math.atan2(bamboo.y - e.y, bamboo.x + 22 - e.x);
        r.projectiles.push({
          x: e.x,
          y: combatOrigin(e).y,
          vx: Math.cos(aim) * 320,
          vy: Math.sin(aim) * 320,
          life: 5,
          damage: 12,
          radius: 12,
          hits: [],
          friendly: false,
          owner: e.id,
          visual: 'steel-needle',
          delay: 1.25,
        });
      }
  } else if (id === '8-4') {
    replace('exchange');
    const o = make('exchange', 'seal', e.x, e.y, 360, 3.2);
    o.hp = o.maxHp = 35;
    o.warning = 0.7;
    o.pulse = 2.2;
  } else if (id === '4-2') {
    make('grab', 'tether', e.x, e.y, 78, 1.5).warning = 0.8;
    e.armourTime = 2.3;
  } else if (['9-1', '9-3', '6-4'].includes(id ?? '')) {
    replace('door', 'rotating-door', 'stone-door');
    if (id === '6-4')
      r.encounterObjects = r.encounterObjects?.filter(
        (o) => o.owner !== e.id || o.kind !== 'chest',
      );
    const count = id === '9-3' ? 8 : 4;
    for (let n = 0; n < count; n++) {
      const o = make(
        id === '9-1' ? 'door' : id === '9-3' ? 'rotating-door' : 'stone-door',
        'wall',
        960,
        535,
        42,
        10,
      );
      o.aim = (n * Math.PI * 2) / count;
      o.stage = n === 0 ? 1 : 0;
      o.anchorX = 960;
      o.anchorY = 535;
      o.x = 960 + Math.cos(o.aim) * 255;
      o.y = 535 + Math.sin(o.aim) * 175;
    }
    if (id === '6-4') spawn(r, e, 'chest', f.x, f.y, 75, 5);
  } else if (id === '9-2') {
    const turrets =
      r.encounterObjects?.filter(
        (o) => o.owner === e.id && o.kind === 'turret' && o.life > 0 && o.hp > 0,
      ) ?? [];
    if (!turrets.length)
      for (const offset of [-190, 190]) spawn(r, e, 'turret', e.x + offset, e.y + 100, 40, 24);
    const activeDrone = r.encounterObjects?.find(
      (o) => o.owner === e.id && o.mechanic === 'drone' && o.hp > 0 && o.life > 0,
    );
    if (activeDrone) activeDrone.life = 12;
    else {
      const drone = make('drone', 'flag', e.x, e.y, 24, 12);
      drone.hp = drone.maxHp = 28;
      drone.warning = 0.5;
    }
  } else if (id === '7-4') {
    replace('oasis', 'sandwall');
    const oasis = make('oasis', 'safe', 1280, 380, 125, 11);
    const x = oasis.x,
      y = oasis.y;
    for (const offset of [-105, 105]) make('sandwall', 'wall', x + offset, y + 120, 55, 7);
  } else if (id === '4-3') {
    const o = make('bell', 'flag', e.x + 100, e.y, 35, 4);
    o.hp = o.maxHp = 45;
    o.warning = 1;
    o.pulse = 0;
  } else if (id === '6-1') {
    replace('plate');
    for (const offset of [-150, 0, 150]) make('plate', 'mine', f.x + offset, f.y, 65, 9);
  } else if (id === '6-3') {
    replace('blade');
    for (let n = 0; n < 3; n++) {
      const o = make('blade', 'mine', e.x, e.y, 32, 9);
      o.aim = (n * Math.PI * 2) / 3;
      o.anchorX = e.x;
      o.anchorY = e.y;
    }
    const turret = r.encounterObjects?.find(
      (o) => o.owner === e.id && o.kind === 'turret' && o.hp > 0 && o.life > 0,
    );
    if (turret) turret.hp = Math.min(turret.maxHp, turret.hp + 20);
    else for (const offset of [-160, 160]) spawn(r, e, 'turret', e.x + offset, e.y, 40, 15);
  } else if (id === '9-4') {
    replace('formation');
    const o = make('formation', 'safe', 1240, 535, 220, 7);
    o.anchorX = 960;
    o.anchorY = 535;
    o.aim = e.pattern % 2 ? Math.PI : 0;
    o.stage = e.pattern % 2;
  } else return false;
  return true;
}

/** Returns true when this object was handled, avoiding generic field substitutions. */
export function stepMechanic(
  r: Run,
  o: EncounterObject,
  e: Enemy,
  dt: number,
  damage: (n: number) => void,
  emit?: CombatCueSink,
): boolean {
  if (!o.mechanic) return false;
  const f = r.fighter,
    old = { x: o.x, y: o.y };
  o.age = (o.age ?? 0) + dt;
  const age = o.age;
  if (o.mechanic === 'poison-powder' || o.mechanic === 'poison-mist') {
    if (o.pulse <= 0 && distance(o, f) < o.radius + 18 && f.invulnerable <= 0) {
      const before = f.hp;
      damage(o.mechanic === 'poison-powder' ? 7 : 4);
      o.pulse = 0.9;
      if (f.hp > 0 && f.hp < before) {
        if (o.mechanic === 'poison-powder') f.slowTime = 2.4;
        else {
          f.poisonTime = 2.4;
          f.healSuppression = 2;
        }
      }
    }
  } else if (o.mechanic === 'exchange') {
    if (distance(e, f) > o.radius || f.invulnerable > 0) {
      o.life = 0;
      return true;
    }
    o.x = e.x;
    o.y = e.y;
    if (o.pulse <= 0) {
      const playerRatio = f.hp / maximumHp(f),
        bossRatio = e.hp / e.maxHp;
      f.hp = clamp(Math.round(bossRatio * maximumHp(f)), 1, maximumHp(f));
      e.hp = clamp(Math.round(playerRatio * e.maxHp), 1, e.maxHp);
      r.exchangeSeq = (r.exchangeSeq ?? 0) + 1;
      emit?.({ kind: 'mechanic', action: 'exchange', x: e.x, y: e.y });
      impact(r, f.x, f.y, 65, 0xc54867);
      impact(r, e.x, e.y, 65, 0xc54867);
      o.life = 0;
    }
  } else if (o.mechanic === 'grab') {
    if (o.stage === 0) {
      if (distance(e, f) > o.radius || f.invulnerable > 0) {
        o.life = 0;
        e.state = 'recover';
        e.timer = 1.2;
        return true;
      }
      o.stage = 1;
      o.pulse = 0.55;
      f.capturedTime = 0.6;
    }
    if (o.stage === 1) {
      f.x = e.x + Math.cos(e.facing) * 30;
      f.y = e.y + Math.sin(e.facing) * 30;
      if (o.pulse <= 0) {
        f.capturedTime = 0;
        f.x = clamp(e.x + Math.cos(e.facing) * 160, FIELD.left, FIELD.right);
        f.y = clamp(e.y + Math.sin(e.facing) * 160, FIELD.top, FIELD.bottom);
        damage(24);
        impact(r, f.x, f.y, 55, 0xcdae68);
        o.life = 0;
      }
    }
  } else if (o.mechanic === 'drone') {
    const targets = (r.encounterObjects ?? []).filter(
      (t) => t.owner === e.id && t.kind === 'turret' && t.hp > 0 && t.hp < t.maxHp && t.life > 0,
    );
    const target =
      targets.find((t) => t.id === o.target) ??
      targets.sort((a, b) => distance(o, a) - distance(o, b))[0];
    if (target) {
      o.target = target.id;
      const d = distance(o, target);
      if (d > 42) {
        o.x += ((target.x - o.x) / d) * 160 * dt;
        o.y += ((target.y - o.y) / d) * 160 * dt;
        o.stage = 0;
      } else {
        o.stage = 1;
        if (o.pulse <= 0) {
          target.hp = Math.min(target.maxHp, target.hp + 8);
          emit?.({ kind: 'mechanic', action: 'repair', x: o.x, y: o.y });
          o.pulse = 0.6;
          impact(r, target.x, target.y, 22, 0x78bbac);
        }
      }
    } else {
      o.stage = 0;
      o.x = e.x + Math.cos(age * 2) * 60;
      o.y = e.y - 70 + Math.sin(age * 2) * 20;
    }
  } else if (o.mechanic === 'bell') {
    if (o.stage === 0) {
      o.stage = 1;
      o.pulse = 1;
      e.rageTime = 4;
      e.armourTime = 3;
      impact(r, o.x, o.y, 200, 0xe4ce8d);
      emit?.({ kind: 'mechanic', action: 'bell', x: o.x, y: o.y });
      if (distance(o, f) < 200) damage(12);
    }
  } else if (o.mechanic === 'formation') {
    const a = o.aim + age * (o.stage === 0 ? 0.28 : -0.28);
    o.x = (o.anchorX ?? 960) + Math.cos(a) * 280;
    o.y = (o.anchorY ?? 535) + Math.sin(a) * 150;
    if (o.pulse <= 0 && distance(o, f) > o.radius) {
      damage(o.stage === 0 ? 7 : 10);
      o.pulse = 1;
    }
  } else if (o.mechanic === 'cleansing') {
    if (distance(o, f) < o.radius) {
      f.poisonTime = 0;
      f.burnTime = 0;
      f.fieldTick = 0;
      f.healSuppression = 0;
      f.slowTime = 0;
    }
    for (const z of r.zones ?? [])
      if (z.kind === 'poison' && distance(o, z) < o.radius + z.radius) z.life = 0;
    for (const h of r.encounterObjects ?? [])
      if (
        h.id !== o.id &&
        h.owner === o.owner &&
        h.kind === 'mine' &&
        distance(o, h) < o.radius + h.radius
      )
        h.life = 0;
  } else if (o.mechanic === 'oasis') {
    // A physical landmark, deliberately grants no unapproved healing.
  } else if (o.mechanic === 'plate') {
    o.stage = Math.floor(age / 1.6) % 2;
    if (o.stage === 0 && o.pulse <= 0 && distance(o, f) < o.radius + 18) {
      if (e.bossId === '6-1') {
        applyFieldContact(r, 'fire', damage);
        o.pulse = FIELD_EFFECTS.fire.interval;
      } else {
        damage(o.kind === 'chest' ? 14 : 16);
        o.pulse = 1.6;
      }
      impact(r, o.x, o.y, o.radius, 0xcbb79b);
      emit?.({ kind: 'field', action: e.bossId === '6-1' ? 'fire' : 'trap', x: o.x, y: o.y });
    }
  } else {
    if (['rotating-door', 'stone-door', 'blade'].includes(o.mechanic)) {
      const a = o.aim + age * (o.mechanic === 'blade' ? 1.1 : 0.34);
      o.x = (o.anchorX ?? 960) + Math.cos(a) * (o.mechanic === 'blade' ? 150 : 255);
      o.y = (o.anchorY ?? 535) + Math.sin(a) * (o.mechanic === 'blade' ? 110 : 175);
    }
    if (o.mechanic === 'door') {
      const phase = age % 4.8;
      // Open, visible closing preparation, solid closed, opening preparation.
      o.stage = phase < 1.8 ? 1 : phase < 2.4 ? 2 : phase < 4.2 ? 0 : 3;
    }
    if (o.mechanic === 'falling-bamboo') {
      if (age > 2 && o.stage === 0) {
        o.stage = 1;
        impact(r, o.x, o.y, 75, 0x80976a);
        if (distance(o, f) < 90) damage(18);
      }
    }
    const open =
      (o.mechanic === 'door' && o.stage !== 0) || (o.mechanic === 'rotating-door' && o.stage === 1);
    if (o.mechanic === 'sandwall') {
      const stage = o.life < 0.65 ? 2 : 1;
      if (stage === 2 && o.stage !== 2)
        emit?.({ kind: 'mechanic', action: 'sand', x: o.x, y: o.y });
      o.stage = stage;
    }
    if (
      !open &&
      !(o.mechanic === 'sandwall' && o.stage === 2) &&
      segmentDistance(old, o, f) < o.radius + 18
    ) {
      if (o.mechanic === 'blade') {
        if (o.pulse <= 0) {
          damage(14);
          o.pulse = 0.6;
        }
      } else {
        const a = Math.atan2(f.y - o.y, f.x - o.x);
        f.x = clamp(o.x + Math.cos(a) * (o.radius + 20), FIELD.left, FIELD.right);
        f.y = clamp(o.y + Math.sin(a) * (o.radius + 20), FIELD.top, FIELD.bottom);
        if (o.mechanic === 'rotating-door' && o.pulse <= 0) {
          damage(16);
          o.pulse = 1;
          impact(r, o.x, o.y, 65, 0xe4a066);
          o.life = 0;
        }
      }
    }
  }
  if (['rotating-door', 'stone-door', 'blade', 'drone'].includes(o.mechanic)) {
    o.x = clamp(o.x, FIELD.left + o.radius, FIELD.right - o.radius);
    o.y = clamp(o.y, FIELD.top + o.radius, FIELD.bottom - o.radius);
  }
  return true;
}

/** Swept collision, finite ricochets and a per-surface cooldown prevent trapped bullets. */
export function reflectBamboo(
  r: Run,
  p: Projectile,
  previous: { x: number; y: number },
  dt: number,
  emit?: CombatCueSink,
) {
  p.bounceCooldown = Math.max(0, (p.bounceCooldown ?? 0) - dt);
  if (p.friendly || p.landing || (p.bounces ?? 0) >= 3) return;
  for (const o of r.encounterObjects ?? []) {
    if (
      o.mechanic !== 'bamboo' ||
      o.warning > 0 ||
      o.hp <= 0 ||
      o.life <= 0 ||
      (p.bounceObject === o.id && (p.bounceCooldown ?? 0) > 0)
    )
      continue;
    if (segmentDistance(previous, p, o) > o.radius + p.radius) continue;
    let nx = previous.x - o.x,
      ny = previous.y - o.y;
    const length = Math.hypot(nx, ny) || 1;
    nx /= length;
    ny /= length;
    const dot = p.vx * nx + p.vy * ny;
    if (dot >= 0) continue;
    p.vx -= 2 * dot * nx;
    p.vy -= 2 * dot * ny;
    p.x = o.x + nx * (o.radius + p.radius + 2);
    p.y = o.y + ny * (o.radius + p.radius + 2);
    p.bounces = (p.bounces ?? 0) + 1;
    p.bounceObject = o.id;
    p.bounceCooldown = 0.15;
    p.returnAt = undefined;
    p.returned = false;
    impact(r, p.x, p.y, 22, 0xb5d38b);
    emit?.({ kind: 'mechanic', action: 'reflect', x: p.x, y: p.y });
    break;
  }
}

/** Reactive movement preserves a readable locked windup; it never inflicts instant damage. */
export function stepBossBehavior(r: Run, e: Enemy, dt: number) {
  const f = r.fighter;
  // Low-health pursuit belongs to the swordsman's phase, not an invisible 8-second cast.
  // It changes cadence and approach only; locked windups and contact geometry remain intact.
  if (e.bossId === '0-4' && e.hp > 0 && e.hp <= e.maxHp * 0.3) {
    e.rageTime = 0.2;
    if (e.state === 'approach') {
      const a = Math.atan2(f.y - e.y, f.x - e.x);
      e.x += Math.cos(a) * 55 * dt;
      e.y += Math.sin(a) * 55 * dt;
    }
  }
  if (
    e.bossId === '2-3' &&
    f.action === 'attack' &&
    f.attackSeq !== e.observedAttack &&
    (e.reactionTime ?? 0) <= 0 &&
    distance(e, f) < 420 &&
    e.state === 'approach'
  ) {
    e.observedAttack = f.attackSeq;
    e.reactionTime = 2.5;
    e.state = 'windup';
    e.timer = 0.65;
    e.move = 'dash';
    e.aim = e.facing = Math.atan2(f.y - e.y, f.x - e.x);
    e.targetX = f.x;
    e.targetY = f.y;
  }
  if (e.bossId === '5-2') {
    const a = Math.atan2(f.y - e.y, f.x - e.x);
    if (e.state === 'approach') {
      const weave = Math.sin(r.elapsed * 2 + e.id) * 48;
      e.x -= Math.sin(a) * weave * dt;
      e.y += Math.cos(a) * weave * dt;
    }
    if (e.state === 'recover' && e.move === 'thrust' && e.timer > 0.2) {
      // A short withdrawal after the long jab; wide swings leave a punishable recovery.
      e.x -= Math.cos(a) * 70 * dt;
      e.y -= Math.sin(a) * 70 * dt;
    }
  }
  if (['5-1', '3-3'].includes(e.bossId ?? '') && (e.veilTime ?? 0) > 0 && e.state === 'approach') {
    const a = Math.atan2(f.y - e.y, f.x - e.x) + Math.PI / 2;
    e.x += Math.cos(a) * 110 * dt;
    e.y += Math.sin(a) * 110 * dt;
    // Discrete physical footsteps reveal the flank without a targeting preview.
    if (Math.floor((r.elapsed - dt) * 4) !== Math.floor(r.elapsed * 4))
      r.effects.push({
        kind: 'hit',
        x: e.x,
        y: e.y,
        radius: 12,
        color: e.bossId === '3-3' ? 0xb7dbec : 0x98af7d,
        angle: 0,
        life: 0.6,
        duration: 0.6,
      });
  }
  e.x = clamp(e.x, FIELD.left, FIELD.right);
  e.y = clamp(e.y, FIELD.top, FIELD.bottom);
}
