import { pendingChoices } from './character';
import { FIELD } from './content';
import { regionName } from './campaign';
import type { FieldZone, Run } from './model';
import { regionEnemy } from './region-enemies';
import { encounterMovementFactor } from './boss-encounters';
import { applyFieldContact, FIELD_EFFECTS } from './field-effects';

const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);
export function movementFactor(r: Run) {
  const ambient =
    regionName(r) === '설산' &&
    !r.zones?.some(
      (zone) => zone.kind === 'cold' && zone.id === 0 && distance(zone, r.fighter) < zone.radius,
    )
      ? 0.8
      : 1;
  return (
    ambient *
    encounterMovementFactor(r) *
    (r.zones?.some(
      (zone) =>
        zone.kind === 'cold' &&
        zone.id !== 0 &&
        zone.warning <= 0 &&
        distance(zone, r.fighter) < zone.radius,
    )
      ? 0.7
      : 1)
  );
}

/** Region interactions use the same saved shapes that the renderer warns about. */
export function stepEnvironment(
  r: Run,
  dt: number,
  random: () => number,
  damage: (amount: number, zone?: FieldZone) => void,
  impact?: (zone: FieldZone) => void,
  contact?: (zone: FieldZone) => void,
) {
  const region = regionName(r);
  r.zoneClock = (r.zoneClock ?? 0) + dt;
  const zones = (r.zones ??= []);
  const cadence = region === '청하현' || region === '죽림' ? 14 : 8;
  if (r.zoneClock >= cadence) {
    r.zoneClock -= cadence;
    r.zoneSeq = (r.zoneSeq ?? 0) + 1;
    if (region === '청하현' || region === '죽림') {
      const hp = 24 + Math.floor(r.wave / 5) * 8;
      r.enemies.push({
        id: 100000 + r.wave * 100 + r.zoneSeq,
        ...regionEnemy(r, r.zoneSeq),
        x: random() < 0.5 ? FIELD.left + 50 : FIELD.right - 50,
        y: 290 + random() * 400,
        hp,
        maxHp: hp,
        facing: 0,
        state: 'approach',
        timer: 1.5,
        aim: 0,
        pattern: 0,
        xp: 0,
        elite: false,
        hitSeq: -1,
      });
    } else if (region === '독무곡' || region === '고묘' || region === '팔진고성') {
      zones.push({
        id: r.zoneSeq,
        x: Math.max(
          FIELD.left + 120,
          Math.min(FIELD.right - 120, r.fighter.x + (random() - 0.5) * 230),
        ),
        y: Math.max(
          FIELD.top + 110,
          Math.min(FIELD.bottom - 110, r.fighter.y + (random() - 0.5) * 150),
        ),
        radius: region === '팔진고성' ? 135 : 85,
        kind: region === '독무곡' ? 'poison' : region === '고묘' ? 'trap' : 'gate',
        warning: 1.5,
        life: region === '고묘' ? 2.5 : 6,
        pulse: 0,
      });
    }
  }
  for (const zone of zones) {
    if (r.phase !== 'combat' || pendingChoices(r)) break;
    zone.warning = Math.max(0, zone.warning - dt);
    zone.life -= dt;
    zone.pulse -= dt;
    if (zone.life <= 0 || zone.warning > 0) continue;
    const inside = distance(zone, r.fighter) < zone.radius + 18;
    if (zone.impactDamage !== undefined) {
      const blastDamage = zone.impactDamage;
      zone.impactDamage = undefined;
      zone.pulse = 0.8;
      impact?.(zone);
      if (inside && blastDamage > 0 && !(zone.kind === 'cold' && zone.id === 0))
        damage(blastDamage, zone);
      if (r.phase !== 'combat' || pendingChoices(r)) break;
    }
    if (!inside) continue;
    if (!(zone.kind === 'cold' && zone.id === 0) && zone.pulse <= 0) {
      zone.pulse = FIELD_EFFECTS[zone.kind].interval;
      const loss = applyFieldContact(r, zone.kind, (amount) => damage(amount, zone));
      if (loss > 0 || zone.kind === 'brew') contact?.(zone);
      if (zone.kind === 'blood') {
        const owner = r.enemies.find((e) => e.id === zone.owner && e.hp > 0);
        if (owner) owner.hp = Math.min(owner.maxHp, owner.hp + loss * 0.6);
      }
      if (zone.kind === 'trap') zone.life = 0;
      if (r.phase !== 'combat' || pendingChoices(r)) break;
    }
  }
  r.zones = zones.filter((zone) => zone.life > 0).slice(-8);
}
