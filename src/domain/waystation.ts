import type { Fighter, InputFrame, Run } from './model';

export const WAYSTATION_STOPS = [
  { id: 'physician', name: '의원', x: 490, y: 480 },
  { id: 'merchant', name: '정비 상인', x: 910, y: 460 },
  { id: 'blacksmith', name: '대장장이', x: 1320, y: 480 },
  { id: 'exit', name: '쉼터 출구', x: 1510, y: 800 },
] as const;
export type WaystationStop = (typeof WAYSTATION_STOPS)[number]['id'];
export const WAYSTATION_BOUNDS = { left: 310, right: 1630, top: 440, bottom: 890 };
export const WAYSTATION_REACH = 145;
/** First playable rollout; the later preparation screens keep their existing services. */
export const isWalkablePreparation = (run: Run | null | undefined) =>
  run?.phase === 'prep' && run.wave === 4;
export function nearestWaystationStop(fighter: Pick<Fighter, 'x' | 'y'>) {
  return WAYSTATION_STOPS.map((stop) => ({
    ...stop,
    distance: Math.hypot(stop.x - fighter.x, stop.y - fighter.y),
  }))
    .filter((stop) => stop.distance <= WAYSTATION_REACH)
    .sort((a, b) => a.distance - b.distance)[0];
}
export function waystationApproach(id: WaystationStop) {
  const stop = WAYSTATION_STOPS.find((stop) => stop.id === id)!;
  return { x: stop.x, y: stop.y + (id === 'exit' ? -85 : 95) };
}
/** Only locomotion: rest never advances combat timers, resources, attacks or random events. */
export function walkWaystation(fighter: Fighter, input: InputFrame, dt: number) {
  const time = Number.isFinite(dt) ? Math.max(0, Math.min(dt, 1 / 30)) : 0;
  const dx = Number.isFinite(input.dx) ? input.dx : 0;
  const dy = Number.isFinite(input.dy) ? input.dy : 0;
  const length = Math.hypot(dx, dy);
  const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
  let x = clamp(
    fighter.x + (length ? dx / length : 0) * 340 * time,
    WAYSTATION_BOUNDS.left,
    WAYSTATION_BOUNDS.right,
  );
  let y = clamp(
    fighter.y + (length ? dy / length : 0) * 340 * time,
    WAYSTATION_BOUNDS.top,
    WAYSTATION_BOUNDS.bottom,
  );
  // Small solid feet, not the whole portrait or its weapon extent.
  for (const stop of WAYSTATION_STOPS) {
    if (stop.id === 'exit') continue;
    const distance = Math.hypot(x - stop.x, y - stop.y);
    if (distance < 38) {
      const angle = distance > 0 ? Math.atan2(y - stop.y, x - stop.x) : Math.PI / 2;
      x = stop.x + Math.cos(angle) * 38;
      y = stop.y + Math.sin(angle) * 38;
    }
  }
  const moved = Math.hypot(x - fighter.x, y - fighter.y) > 0.01;
  fighter.x = x;
  fighter.y = y;
  fighter.actionTime = 0;
  fighter.action = moved ? 'walk' : 'idle';
  if (moved && length) fighter.facing = Math.atan2(dy, dx);
}
