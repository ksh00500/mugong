import { enemyAttack, STRIKE_TIMING } from '../domain/combat';
import { combatOrigin } from '../domain/combat-body';
import { isBossEnemy } from '../domain/boss-resilience';
import type { Enemy } from '../domain/model';

export type BossTell = {
  kind: 'sweep' | 'thrust' | 'dash' | 'projectile' | 'field' | 'cast';
  shape: 'sector' | 'line' | 'circle' | 'rays' | 'glyph';
  x: number;
  y: number;
  angle: number;
  range: number;
  width: number;
  arc: number;
  progress: number;
  contact: number;
  locked: boolean;
  angles?: number[];
  landing?: {
    x: number;
    y: number;
    range: number;
    arc: number;
    width: number;
    shape: 'line' | 'sector' | 'circle';
  };
};
const clamp = (v: number) => Math.max(0, Math.min(1, v));
/** Read the very same profile, endpoint, volley and contact clocks as damage. */
export function bossAttackTell(e: Enemy): BossTell | undefined {
  if (!isBossEnemy(e) || e.hp <= 0 || !['windup', 'strike'].includes(e.state)) return;
  const p = enemyAttack(e),
    spec = p.melee;
  const contacts = spec?.contacts ?? [p.ranged || p.move === 'hazard' ? 0 : STRIKE_TIMING.contact];
  const duration = e.strike?.duration ?? spec?.duration ?? STRIKE_TIMING.duration;
  const elapsed = e.state === 'strike' ? Math.max(0, duration - e.timer) : 0;
  const contact =
    e.state === 'windup'
      ? 0
      : contacts.findIndex((t, i) => i >= (e.strike?.contactsDone ?? 0) && t > elapsed);
  if (contact < 0) return;
  const previous = contacts[contact - 1];
  // Preserve visible follow-through before the next combo preparation.
  if (previous !== undefined && elapsed < previous + 0.18) return;
  const total = contact === 0 ? p.windup + contacts[0] : contacts[contact] - previous - 0.18;
  const time =
    contact === 0
      ? e.state === 'windup'
        ? p.windup - e.timer
        : p.windup + elapsed
      : elapsed - previous - 0.18;
  const origin = combatOrigin(e);
  const tell: BossTell = {
    kind: 'sweep',
    shape: 'sector',
    ...origin,
    angle: e.aim,
    range: p.range,
    width: spec?.width ?? 30,
    arc: p.arc,
    progress: clamp(time / Math.max(0.001, total)),
    contact,
    locked: e.state === 'strike' || e.timer <= Math.min(0.4, p.windup * 0.45),
  };
  // Cast marker only: the real damaging field has its own saved warning clock.
  if (spec?.zone || p.move === 'hazard')
    return { ...tell, kind: 'field', shape: 'glyph', x: p.origin.x, y: p.origin.y, range: 26 };
  if (spec?.shot || p.shots.length)
    return {
      ...tell,
      kind: 'projectile',
      shape: 'rays',
      range: Math.min(420, p.range),
      angles: p.shots.map((s) => s.angle),
    };
  if (spec?.shape === 'none')
    return { ...tell, kind: 'cast', shape: 'glyph', x: e.x, y: e.y, range: 32 };
  if (p.dash > 0) {
    const from = e.strike ? { x: e.strike.fromX, y: e.strike.fromY } : { x: e.x, y: e.y };
    const to = p.origin;
    // dashHits uses the fixed ground-point COMBAT_HEIGHT projection.
    const a = combatOrigin(from),
      b = combatOrigin(to);
    const end = spec?.shape === 'circle' ? to : combatOrigin(to);
    // Pressure's small approach step does not deal swept damage. Preview only
    // the actual weapon shape at its endpoint, never a damaging travel lane.
    if ((e.pressure?.advance ?? 0) > 0)
      return {
        ...tell,
        ...end,
        kind: spec?.shape === 'line' ? 'thrust' : 'sweep',
        shape: spec?.shape === 'line' ? 'line' : 'sector',
      };
    return {
      ...tell,
      kind: 'dash',
      shape: 'line',
      ...a,
      angle: Math.atan2(b.y - a.y, b.x - a.x),
      range: Math.hypot(b.x - a.x, b.y - a.y),
      width: 30,
      landing: {
        ...end,
        range: p.range,
        arc: p.arc,
        width: spec?.width ?? 30,
        shape: spec?.shape === 'line' ? 'line' : spec?.shape === 'circle' ? 'circle' : 'sector',
      },
    };
  }
  if (spec?.shape === 'circle') return { ...tell, shape: 'circle', x: e.x, y: e.y };
  if (spec?.shape === 'line') return { ...tell, kind: 'thrust', shape: 'line' };
  return tell;
}
