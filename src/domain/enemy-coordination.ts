import { FIELD } from './content';
import { enemyAttack } from './combat';
import type { Enemy, Run } from './model';

type Point = { x: number; y: number };
export type SquadRole = 'pressure' | 'intercept' | 'volley';
type Assignment = { role: SquadRole; goal?: Point; pressed: boolean };
const squads = new WeakMap<Run, Map<Enemy, Assignment>>();
const leaders = new WeakMap<Run, { id: number; wave: number; until: number; observedAt: number }>();
export const SQUAD_RULES = {
  radius: 800,
  minimumMembers: 3,
  attackGap: 0.22,
  maximumAttackers: 3,
} as const;

export function squadRole(e: Enemy): SquadRole | undefined {
  if (
    e.hp <= 0 ||
    e.bossId ||
    e.kind === 'chief' ||
    e.kind === 'captain' ||
    (e.confused ?? 0) > 0 ||
    (e.staggerTime ?? 0) > 0
  )
    return undefined;
  const p = enemyAttack(e);
  return p.ranged || p.move === 'hazard' ? 'volley' : e.kind === 'spear' ? 'intercept' : 'pressure';
}
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const inside = (p: Point): Point => ({
  x: Math.max(FIELD.left + 45, Math.min(FIELD.right - 45, p.x)),
  y: Math.max(FIELD.top + 45, Math.min(FIELD.bottom - 45, p.y)),
});

/** One immutable assignment snapshot before the enemy loop. No future input,
 * new save fields, RNG, teleports, speed or attack-stat bonuses. */
export function observeSquad(r: Run, velocity: Point) {
  const members = r.enemies.filter(
    (e) => squadRole(e) && distance(e, r.fighter) <= SQUAD_RULES.radius,
  );
  const assignments = new Map<Enemy, Assignment>();
  squads.set(r, assignments);
  if (members.length < SQUAD_RULES.minimumMembers) return;
  const byDistance = (a: Enemy, b: Enemy) =>
    distance(a, r.fighter) - distance(b, r.fighter) || a.id - b.id;
  const melee = members.filter((e) => squadRole(e) !== 'volley').sort(byDistance);
  const previous = leaders.get(r);
  const retained =
    previous &&
    previous.wave === r.wave &&
    r.elapsed >= previous.observedAt &&
    r.elapsed < previous.until
      ? melee.find((e) => e.id === previous.id)
      : undefined;
  const front = retained ?? melee.find((e) => squadRole(e) === 'pressure') ?? melee[0];
  // A group made only of casters retains its existing individual positioning.
  if (!front) return;
  if (!retained)
    leaders.set(r, { id: front.id, wave: r.wave, until: r.elapsed + 1.5, observedAt: r.elapsed });
  const bearing = Math.atan2(front.y - r.fighter.y, front.x - r.fighter.x);
  const speed = Math.hypot(velocity.x, velocity.y);
  const travel = speed > 35 ? { x: velocity.x / speed, y: velocity.y / speed } : undefined;
  const pressed = melee.some(
    (e) => distance(e, r.fighter) < 220 && (e.state === 'windup' || e.state === 'strike'),
  );
  let flanks = 0,
    interceptors = 0,
    shooters = 0;
  for (const e of [...members].sort((a, b) => a.id - b.id)) {
    const role = squadRole(e)!;
    let goal: Point | undefined;
    if (role === 'pressure' && e !== front) {
      const n = flanks++,
        side = n % 2 ? -1 : 1;
      // Both wings stay on the front hemisphere, preserving a retreat sector.
      const angle = bearing + side * 1.1;
      const radius = Math.min(120, enemyAttack(e).range * 0.9) + Math.floor(n / 2) * 75;
      goal = {
        x: r.fighter.x + Math.cos(angle) * radius,
        y: r.fighter.y + Math.sin(angle) * radius,
      };
    } else if (role === 'intercept') {
      const n = interceptors++,
        side = n % 2 ? -1 : 1;
      const lead = Math.min(140, speed * 0.45);
      const angle = bearing + side * 0.95;
      goal = travel
        ? {
            x: r.fighter.x + travel.x * lead - travel.y * side * (65 + Math.floor(n / 2) * 75),
            y: r.fighter.y + travel.y * lead + travel.x * side * (65 + Math.floor(n / 2) * 75),
          }
        : {
            x: r.fighter.x + Math.cos(angle) * (140 + Math.floor(n / 2) * 75),
            y: r.fighter.y + Math.sin(angle) * (140 + Math.floor(n / 2) * 75),
          };
    } else if (role === 'volley') {
      const n = shooters++,
        side = n % 2 ? -1 : 1;
      const angle = bearing + side * (0.65 + Math.min(0.4, Math.floor(n / 2) * 0.25));
      const radius = Math.min(370, enemyAttack(e).range * 0.65 + Math.floor(n / 2) * 45);
      goal = {
        x: r.fighter.x + Math.cos(angle) * radius,
        y: r.fighter.y + Math.sin(angle) * radius,
      };
    }
    assignments.set(e, { role, goal: goal ? inside(goal) : undefined, pressed });
  }
}

export function squadAssignment(r: Run, e: Enemy) {
  // Effects may kill/confuse a member later in the same simulation tick.
  return squadRole(e) ? squads.get(r)?.get(e) : undefined;
}

export function squadAim(r: Run, e: Enemy, velocity: Point): Point | undefined {
  const a = squadAssignment(r, e);
  if (a?.role !== 'volley' || !a.pressed) return undefined;
  const speed = Math.hypot(velocity.x, velocity.y),
    lead = speed > 0 ? Math.min(0.4, 120 / speed) : 0;
  return {
    x: Math.max(FIELD.left, Math.min(FIELD.right, r.fighter.x + velocity.x * lead)),
    y: Math.max(FIELD.top, Math.min(FIELD.bottom, r.fighter.y + velocity.y * lead)),
  };
}

/** Do not shoot a narrow volley through a teammate. Blocked FIFO heads are
 * skipped, never allowed to starve a melee ally whose lane is ready. */
export function clearFiringLane(r: Run, e: Enemy) {
  const p = enemyAttack(e);
  if (!squadRole(e) || !p.ranged) return true;
  const dx = r.fighter.x - e.x,
    dy = r.fighter.y - e.y,
    length2 = dx * dx + dy * dy;
  if (length2 < 1) return true;
  return !r.enemies.some((other) => {
    if (other === e || other.hp <= 0 || (other.confused ?? 0) > 0) return false;
    const t = ((other.x - e.x) * dx + (other.y - e.y) * dy) / length2;
    return (
      t > 0.1 && t < 0.82 && Math.hypot(other.x - (e.x + dx * t), other.y - (e.y + dy * t)) < 38
    );
  });
}

export function squadCanJoin(r: Run, e: Enemy, active: Enemy[]) {
  // Admission spacing is derived from saved windup clocks, so reloading does
  // not erase a recent commitment. It does not shorten any existing warning.
  if (
    active.some(
      (other) =>
        other.state === 'windup' &&
        enemyAttack(other).windup - other.timer >= -0.001 &&
        enemyAttack(other).windup - other.timer < SQUAD_RULES.attackGap,
    )
  )
    return false;
  const a = squadAssignment(r, e);
  if (a && active.filter((other) => squadRole(other) === a.role).length >= 2) return false;
  return clearFiringLane(r, e);
}
