import type { WeaponStyle, FieldZone } from '../domain/model';
import type { ProjectileVisual } from '../domain/projectile-visual';

export const COMBAT_SOUNDS = {
  'sword-swing': { length: .19, pitch: 950, end: 260, noise: .75, notes: [] },
  'staff-swing': { length: .23, pitch: 420, end: 140, noise: .65, notes: [] },
  'fist-swing': { length: .12, pitch: 250, end: 80, noise: .3, notes: [] },
  'fan-swing': { length: .2, pitch: 1150, end: 500, noise: .55, notes: [] },
  'dart-shot': { length: .12, pitch: 1700, end: 950, noise: .3, notes: [] },
  'bow-shot': { length: .16, pitch: 440, end: 220, noise: .35, notes: [] },
  'magic-shot': { length: .22, pitch: 660, end: 1100, noise: .08, notes: [1,1.5,2] },
  'poison-burst': { length: .4, pitch: 380, end: 140, noise: .6, notes: [1,1.33,.8] },
  'ice-burst': { length: .38, pitch: 1500, end: 1000, noise: .18, notes: [1,1.5,2.4] },
  'fire-burst': { length: .42, pitch: 200, end: 65, noise: .85, notes: [] },
  'blood-burst': { length: .3, pitch: 300, end: 120, noise: .2, notes: [1,.75] },
  'trap-snap': { length: .2, pitch: 880, end: 300, noise: .5, notes: [1,2.7] },
  'brew-splash': { length: .3, pitch: 550, end: 220, noise: .6, notes: [1,1.25,1.5] },
  'sand-burst': { length: .32, pitch: 280, end: 100, noise: .9, notes: [] },
  'seal-pulse': { length: .32, pitch: 520, end: 820, noise: .08, notes: [1,1.5] },
  'health-exchange': { length: .48, pitch: 440, end: 880, noise: .05, notes: [1,1.25,1.5,2] },
  'drone-repair': { length: .18, pitch: 740, end: 990, noise: .12, notes: [1,2.7] },
} as const;
export type CombatSound = keyof typeof COMBAT_SOUNDS;
export function weaponSound(style?: WeaponStyle): CombatSound {
  return style === 'staff' ? 'staff-swing' : style === 'gauntlet' ? 'fist-swing' : style === 'fan' ? 'fan-swing' : style === 'dart' ? 'dart-shot' : 'sword-swing';
}
export function fieldSound(kind: FieldZone['kind']): CombatSound {
  return kind === 'poison' ? 'poison-burst' : kind === 'cold' ? 'ice-burst' : kind === 'fire' ? 'fire-burst' : kind === 'blood' ? 'blood-burst' : kind === 'brew' ? 'brew-splash' : kind === 'trap' ? 'trap-snap' : 'seal-pulse';
}
export function projectileSound(visual: ProjectileVisual): CombatSound {
  if (visual === 'arrow') return 'bow-shot';
  if (['bronze-dart','steel-needle','jade-needle'].includes(visual)) return 'dart-shot';
  if (visual === 'returning-blade') return 'fan-swing';
  if (visual === 'stone' || visual.endsWith('bomb') || visual === 'brew-pot') return 'staff-swing';
  return 'magic-shot';
}
/** A deterministic, headroom-limited comic sound palette; no speech or music. */
export function synthesizeCombatSound(kind: CombatSound, sampleRate: number) {
  const spec = COMBAT_SOUNDS[kind], data = new Float32Array(Math.ceil(sampleRate * spec.length));
  let phase = 0, seed = 481516, filtered = 0;
  for (let i = 0; i < data.length; i++) {
    const t = i / sampleRate, p = t / spec.length;
    seed = (Math.imul(seed,1664525) + 1013904223) >>> 0;
    filtered = filtered * .4 + (seed / 0xffffffff * 2 - 1) * .6;
    phase += Math.PI * 2 * (spec.pitch + (spec.end-spec.pitch) * p) / sampleRate;
    const sparkle = spec.notes.length ? spec.notes.reduce((n, note) => n + Math.sin(phase * note),0) / spec.notes.length : Math.sin(phase);
    const bubbles = kind === 'poison-burst' || kind === 'brew-splash' ? .35 + .65 * Math.abs(Math.sin(t * 85)) : 1;
    const envelope = Math.min(1,t/.005) * (1-p) ** 2;
    data[i] = ((1-spec.noise)*sparkle + spec.noise*filtered) * envelope * bubbles * .35;
  }
  return data;
}
