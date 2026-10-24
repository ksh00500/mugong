import type { CombatWorld } from './model';
import type { RaidState } from '../raid/model';
import { SnapshotMotion } from '../game/snapshot-motion';
import { PVP_RULES as R } from './rules';
type World = CombatWorld & { id: string; tick: number; phase: string; epoch?: number };

export class ArenaPresentation {
  private motion = new SnapshotMotion(0.05);
  sample<T extends World>(
    world: T | null | undefined,
    now: number,
    connected: boolean,
  ): T | null | undefined {
    if (!world || !connected || world.phase !== 'fighting') {
      this.motion.reset();
      return world;
    }
    const m = this.motion;
    m.begin(`${world.id}:${world.epoch}:${world.phase}`, world.tick / 60, now);
    const result = { ...world };
    result.players = world.players.map((a) => {
      const f = a.fighter,
        dead = a.inactive || f.hp <= 0;
      const copy = m.body(
        `actor:${a.seat}:${f.id}`,
        f,
        `${f.action}:${f.attackSeq}:${f.active}`,
        dead || f.action === 'defense' || f.action === 'ultimate',
      );
      copy.x = Math.max(R.left, Math.min(R.right, copy.x));
      copy.y = Math.max(R.top, Math.min(R.bottom, copy.y));
      copy.actionTime = m.remaining(f.actionTime);
      return {
        ...a,
        fighter: copy,
        ownedFormations: a.ownedFormations?.map((n) => ({
          ...n,
          life: m.remaining(n.life),
          pulse: n.pulse - m.age,
        })),
      };
    });
    result.attacks = world.attacks.map((at) =>
      m.body(
        `shot:${at.id}`,
        at,
        at.shape,
        at.shape !== 'shot' || at.delay > 0 || at.life <= 0,
        { x: Math.cos(at.angle) * at.speed, y: Math.sin(at.angle) * at.speed },
        at.life,
      ),
    );
    result.effects = world.effects.map((e) => ({ ...e, life: m.remaining(e.life) }));
    const raid = world as T & Partial<Pick<RaidState, 'boss'>>;
    if (raid.boss)
      (result as typeof raid).boss = { ...raid.boss, clock: m.remaining(raid.boss.clock) };
    m.end();
    return result;
  }
}
