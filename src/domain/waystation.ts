import type { Fighter, InputFrame, Run } from './model';
import { regionName, REGIONS } from './campaign';

export const WAYSTATION_STOPS = [
  { id: 'physician', name: '의원', x: 490, y: 480 },
  { id: 'merchant', name: '정비 상인', x: 910, y: 460 },
  { id: 'blacksmith', name: '대장장이', x: 1320, y: 480 },
  { id: 'exit', name: '쉼터 출구', x: 1510, y: 800 },
  { id: 'fortune', name: '기연', x: 570, y: 780 },
] as const;
export type WaystationStop = (typeof WAYSTATION_STOPS)[number]['id'];
export const WAYSTATION_BOUNDS = { left: 310, right: 1630, top: 440, bottom: 890 };
export const WAYSTATION_REACH = 145;
/** All four rests share the same proximity/interaction/save rules. */
export const isWalkablePreparation = (run: Run | null | undefined) =>
  run?.phase === 'prep' && [4, 9, 14, 19].includes(run.wave);
export function waystationTheme(run: Run) {
  const index = Math.max(
    0,
    REGIONS.findIndex((r) => r.name === regionName(run)),
  );
  const names = [
    '마을 장터',
    '독초 정원',
    '산문 객잔',
    '설산 야영지',
    '산사 마당',
    '죽림 정자',
    '고묘 회랑',
    '오아시스 쉼터',
    '붉은 전각',
    '기관 정원',
  ];
  const colors = [
    0xc7ac76, 0x84966a, 0x8ca5a4, 0xb6ced8, 0xc5aa72, 0x719d7a, 0x9294a6, 0xd8b474, 0xa87975,
    0x9baeb5,
  ];
  return { index, name: names[index], color: colors[index] };
}
export function waystationStops(run?: Run) {
  if (!run || run.wave === 4) return WAYSTATION_STOPS.map((s) => ({ ...s }));
  const index = waystationTheme(run).index;
  const offsets = [
    [-70, 45],
    [20, 75],
    [70, 15],
    [-40, 85],
    [55, 30],
    [-65, 70],
    [35, 65],
    [80, 50],
    [-20, 20],
    [0, 90],
  ][index];
  return WAYSTATION_STOPS.map((s) => ({
    ...s,
    x: s.x + (s.id === 'exit' ? -70 : s.id === 'fortune' ? 100 : offsets[0]),
    y: s.y + (s.id === 'exit' ? -25 : s.id === 'fortune' ? -10 : offsets[1]),
  }));
}
export function nearestWaystationStop(fighter: Pick<Fighter, 'x' | 'y'>, run?: Run) {
  return waystationStops(run)
    .map((stop) => ({
      ...stop,
      distance: Math.hypot(stop.x - fighter.x, stop.y - fighter.y),
    }))
    .filter((stop) => stop.distance <= WAYSTATION_REACH)
    .sort((a, b) => a.distance - b.distance)[0];
}
export function waystationApproach(id: WaystationStop, run?: Run) {
  const stop = waystationStops(run).find((stop) => stop.id === id)!;
  return { x: stop.x, y: stop.y + (id === 'exit' ? -85 : 95) };
}
/** Only locomotion: rest never advances combat timers, resources, attacks or random events. */
export function walkWaystation(fighter: Fighter, input: InputFrame, dt: number, run?: Run) {
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
  for (const stop of waystationStops(run)) {
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
