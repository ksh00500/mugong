import { segmentDistance } from './enemy-geometry';

type Point = { x: number; y: number };
type Actor = Point & { kind?: string; bossId?: string; role?: string };
/** Simulation x/y remain feet on the ground. Weapon/shot coordinates are torso space. */
export const COMBAT_HEIGHT = 34;
export const combatOrigin = (actor: Point) => ({ x: actor.x, y: actor.y - COMBAT_HEIGHT });
export const combatAim = (source: Point, target: Point) => {
  const a = combatOrigin(source),
    b = combatOrigin(target);
  return Math.atan2(b.y - a.y, b.x - a.x);
};
export function combatBody(actor: Actor) {
  const boss = !!actor.bossId || actor.kind === 'chief' || actor.kind === 'captain';
  return {
    top: { x: actor.x, y: actor.y - (actor.role === 'rider' ? 76 : boss ? 62 : 52) },
    bottom: { x: actor.x, y: actor.y - 18 },
    radius: actor.role === 'rider' || boss ? 22 : actor.kind ? 18 : 20,
  };
}
/** Swept segment vs vertical body capsule: cannot tunnel through a torso at low FPS. */
export function bodyDistance(from: Point, to: Point, actor: Actor) {
  const { top, bottom } = combatBody(actor),
    dx = to.x - from.x;
  if (dx !== 0) {
    const t = (actor.x - from.x) / dx,
      y = from.y + (to.y - from.y) * t;
    if (t >= 0 && t <= 1 && y >= top.y && y <= bottom.y) return 0;
  }
  return Math.min(
    segmentDistance(from, to, top),
    segmentDistance(from, to, bottom),
    segmentDistance(top, bottom, from),
    segmentDistance(top, bottom, to),
  );
}
export const projectileHitsBody = (from: Point, to: Point, actor: Actor, radius: number) =>
  bodyDistance(from, to, actor) <= combatBody(actor).radius + radius;

/** A weapon sector intersects the body, rather than requiring the feet inside it. */
export function sectorHitsBody(
  source: Point,
  target: Actor,
  angle: number,
  range: number,
  arc: number,
) {
  const origin = combatOrigin(source),
    body = combatBody(target);
  const angularDistance = (a: number) =>
    Math.abs(Math.atan2(Math.sin(a - angle), Math.cos(a - angle)));
  const edge = (a: number) => ({
    x: origin.x + Math.cos(a) * range,
    y: origin.y + Math.sin(a) * range,
  });
  const edges = [edge(angle - arc), edge(angle + arc)];
  // Distance to finite radial edges prevents false hits beyond a sector's corner.
  if (edges.some((end) => bodyDistance(origin, end, target) <= body.radius)) return true;
  const nearest = { x: target.x, y: Math.max(body.top.y, Math.min(body.bottom.y, origin.y)) };
  for (const point of [body.top, body.bottom, nearest]) {
    const dx = point.x - origin.x,
      dy = point.y - origin.y,
      d = Math.hypot(dx, dy);
    if (angularDistance(Math.atan2(dy, dx)) <= arc && d <= range + body.radius) return true;
  }
  // The body axis can cross the curved boundary even with both endpoints outside.
  const dx = target.x - origin.x;
  if (Math.abs(dx) <= range) {
    const dy = Math.sqrt(Math.max(0, range * range - dx * dx));
    for (const y of [origin.y - dy, origin.y + dy]) {
      if (
        y >= body.top.y &&
        y <= body.bottom.y &&
        angularDistance(Math.atan2(y - origin.y, dx)) <= arc
      )
        return true;
    }
  }
  return false;
}
