import type { RigPose, MotionAction } from './directional-motion';

/** Brief pose interpolation only. Simulation position, aim and timers stay authoritative. */
export class PoseTransition {
  private records = new Map<string, { action: MotionAction; pose: RigPose; from: RigPose; start: number }>();
  sample(id: string, action: MotionAction, target: RigPose, time: number, reduced = false): RigPose {
    const previous = this.records.get(id);
    if (!previous || reduced || action === 'death' || action === 'hurt' || action === 'strike') {
      this.records.set(id, { action, pose: {...target}, from: {...target}, start: time - 1 });
      return target;
    }
    if (previous.action !== action) {
      previous.from = {...previous.pose}; previous.start = time; previous.action = action;
    }
    const p = Math.max(0, Math.min(1, (time-previous.start) / .055));
    const blend = p*p*(3-2*p);
    const pose = {...target};
    for (const key of Object.keys(pose) as (keyof RigPose)[]) pose[key] = previous.from[key] + (target[key]-previous.from[key])*blend;
    previous.pose = pose;
    return pose;
  }
  delete(id: string) { this.records.delete(id); }
  reset() { this.records.clear(); }
}
