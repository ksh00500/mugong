import type { Enemy } from '../domain/model';
import { isBossEnemy } from '../domain/boss-resilience';
import { enemyAttack } from '../domain/combat';
import { enemyPose, type EnemyPose } from './enemy-motion';
import { enemyArtSlot, enemyRepairSlot } from '../platform/region-art';
import approvals from '../platform/character-identities.json';

/** Native sheets require a recorded visual identity review of the source row. */
export const APPROVED_HOSTILE_ACTION_IDENTITIES: ReadonlySet<string> = new Set(
  approvals
    .filter((entry) => entry.status === 'approved')
    .flatMap((entry) =>
      entry.region >= 0 ? [entry.id, `region:${entry.region}:slot:${entry.slot}`] : [entry.id],
    ),
);

/** Cosmetic contact only. Bosses keep their current pose, size and attack clock. */
export function hostileRecoil(enemy: Enemy, hitAge: number, reducedMotion: boolean, dead: boolean) {
  if (reducedMotion || dead || hitAge < 0) return 0;
  if (isBossEnemy(enemy)) return hitAge < 0.1 ? 0.35 * (1 - hitAge / 0.1) ** 3 : 0;
  return hitAge < 0.2 ? 3 * (1 - Math.min(1, Math.max(0, hitAge - 0.025) / 0.175)) ** 3 : 0;
}

export function hostileDrawingPose(
  enemy: Enemy,
  direction: number,
  hitAge: number,
  dead: boolean,
  region = -1,
  movement?: { gait: number; moving: boolean },
): EnemyPose | null {
  const repair = enemyRepairSlot(enemy);
  const identity =
    repair !== undefined
      ? enemy.bossId
        ? `special:boss:${enemy.bossId}`
        : `role:${enemy.role}`
      : !enemy.bossId && enemy.role === 'rider' && region === 7
        ? 'role:rider'
        : enemy.bossId
          ? `boss:${enemy.bossId}`
          : `region:${region}:slot:${enemyArtSlot(enemy, region)}`;
  if (!APPROVED_HOSTILE_ACTION_IDENTITIES.has(identity)) return null;
  if (dead) return 5;
  // Rear views have dedicated ready/contact plates. Reactions retain the
  // matching rear identity and are composited by the rig instead of turning
  // the entire character toward the camera.
  if (direction >= 5 && !['windup', 'strike'].includes(enemy.state)) return null;
  if (
    !isBossEnemy(enemy) &&
    direction >= 5 &&
    (enemy.staggerTime ?? 0) > 0 &&
    enemy.state !== 'strike'
  )
    return null;
  if (
    !isBossEnemy(enemy) &&
    (enemy.staggerTime ?? 0) > 0 &&
    enemy.state !== 'strike' &&
    hitAge >= 0 &&
    hitAge < 0.2
  )
    return 4;
  // Mounted gallop uses the direction-specific horse rig, not alternating
  // frontal/quarter-view key drawings that make the whole mount turn.
  if (
    enemy.role === 'rider' &&
    movement?.moving &&
    (enemy.state === 'approach' || enemy.state === 'recover')
  )
    return null;
  if (
    movement?.moving &&
    [1, 2, 3].includes(direction) &&
    (enemy.state === 'approach' || enemy.state === 'recover')
  )
    return Math.floor(movement.gait * 2) % 2 === 0 ? 0 : 1;
  if (movement?.moving && enemy.state === 'recover') return null;
  if (enemy.state === 'recover') return 0;
  if (enemy.state === 'approach') return null;
  if (enemy.state === 'strike' && enemy.strike) {
    const spec = enemyAttack(enemy).melee;
    if (spec) {
      const elapsed = enemy.strike.duration - enemy.timer;
      // Hold the approved ready drawing, then show the matching contact drawing.
      return spec.contacts.some((time) => elapsed >= time - 0.055 && elapsed < time + 0.16) ? 3 : 2;
    }
  }
  return enemyPose(enemy.state, 0, enemy.id, 100, false, true);
}
