const clamp = (n: number) => Math.max(0, Math.min(1, n));
const noise = (time: number, seed: number) => {
  const n = Math.floor(time),
    t = time - n,
    ease = t * t * (3 - 2 * t);
  const value = (i: number) => {
    const s = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453;
    return (s - Math.floor(s)) * 2 - 1;
  };
  return value(n) + (value(n + 1) - value(n)) * ease;
};
/** Bounded trauma² envelope and smooth value noise, in screen pixels.
 * GDC 2016 Juicing Your Cameras; no simulation time, zoom or rotation changes. */
export class CameraImpulse {
  private trauma = 0;
  private last = 0;
  reset(now = 0) {
    this.trauma = 0;
    this.last = now;
  }
  add(amount: number, now: number) {
    this.sample(now);
    this.trauma = Math.min(0.85, this.trauma + Math.max(0, amount));
  }
  sample(now: number, strength = 1) {
    this.trauma = Math.max(0, this.trauma - Math.max(0, now - this.last) * 2.8);
    this.last = now;
    const amplitude = 6 * this.trauma ** 2 * clamp(strength);
    if (amplitude === 0) return { x: 0, y: 0, trauma: this.trauma };
    return {
      x: noise(now * 22, 3) * amplitude,
      y: noise(now * 19, 7) * amplitude * 0.65,
      trauma: this.trauma,
    };
  }
}
