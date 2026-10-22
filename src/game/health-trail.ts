/** Presentation only: the live value never waits for the damage trail. */
export const HEALTH_FEEDBACK = { flash: 0.07, hold: 0.18, drain: 0.42, heal: 0.32 } as const;
const clamp = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
export const healthRatio = (value: number, maximum: number) =>
  maximum > 0 ? clamp(value / maximum) : 0;

export class HealthTrail {
  private ratio = 0;
  private maximum = -1;
  private identity: string | number = '';
  private hits: { from: number; at: number }[] = [];
  private healedAt = -Infinity;

  update(value: number, maximum: number, now: number, identity: string | number = '') {
    const next = healthRatio(value, maximum);
    if (maximum !== this.maximum || identity !== this.identity) {
      this.hits = [];
      this.healedAt = -Infinity;
    } else if (next < this.ratio) {
      // Each hit expires independently. Rapid damage cannot keep an old white
      // full-health bar pinned forever, and a new hit does not restart old loss.
      this.hits.push({ from: this.ratio, at: now });
      this.hits = this.hits.slice(-24);
      this.healedAt = -Infinity;
    } else if (next > this.ratio) {
      this.hits = [];
      this.healedAt = now;
    }
    this.ratio = next;
    this.maximum = maximum;
    this.identity = identity;
    return this.sample(now);
  }

  sample(now: number, reduced = false) {
    const end = HEALTH_FEEDBACK.hold + HEALTH_FEEDBACK.drain;
    this.hits = this.hits.filter((h) => now - h.at < end);
    const latest = this.hits.at(-1);
    const age = latest ? Math.max(0, now - latest.at) : Infinity;
    let trail = this.ratio;
    if (!reduced)
      for (const h of this.hits) {
        const progress = clamp((now - h.at - HEALTH_FEEDBACK.hold) / HEALTH_FEEDBACK.drain);
        trail = Math.max(trail, this.ratio + (h.from - this.ratio) * (1 - progress) ** 3);
      }
    const healing = !reduced && now - this.healedAt < HEALTH_FEEDBACK.heal;
    const phase = reduced
      ? 'idle'
      : age < HEALTH_FEEDBACK.flash
        ? 'hit'
        : age < HEALTH_FEEDBACK.hold
          ? 'hold'
          : latest
            ? 'drain'
            : healing
              ? 'heal'
              : 'idle';
    return {
      ratio: this.ratio,
      trail: clamp(trail),
      phase,
      flash: reduced ? 0 : Math.max(0, 1 - age / HEALTH_FEEDBACK.flash),
      active: !reduced && (!!latest || healing),
      level: this.ratio <= 0.25 ? 'critical' : this.ratio <= 0.5 ? 'low' : 'healthy',
    };
  }
}
