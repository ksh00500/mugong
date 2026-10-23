import type { Formation } from './model';

/** Authored Gangho rules shared by local combat and owned-fighter raids. */
export function tangJegalBasic(id: 'tang' | 'jegal', level: number, combo: number) {
  const variant = level >= 3 && combo % 2 === 1 ? 'b' : 'a';
  return {
    variant,
    coefficient: id === 'tang' ? 0.65 : 0.9,
    shots: id === 'tang' && variant === 'b' ? 3 : 1,
    shotFactor: id === 'tang' && variant === 'b' ? 0.6 : 1,
    life: id === 'tang' ? 0.9 : 1.05,
    radius: id === 'tang' ? 12 : 22,
    poisonLimit: variant === 'b' ? 2 : 1,
  } as const;
}

export function addJegalFormation(
  nodes: Formation[],
  x: number,
  y: number,
  kind: 'heaven' | 'earth',
  damage: number,
  level: number,
) {
  const same = nodes.filter((node) => node.kind === kind);
  if (same.length >= 2) nodes.splice(nodes.indexOf(same[0]), 1);
  if (nodes.length >= 4) nodes.shift();
  const near = (node: Formation) => node.kind !== kind && Math.hypot(node.x - x, node.y - y) < 230;
  const link = level >= 3 && nodes.some(near);
  nodes.push({
    x,
    y,
    kind,
    life: 4,
    pulse: 0.4,
    damage: link ? damage * 0.65 : 0,
    pulses: link ? 2 : 0,
  });
  if (link)
    for (const node of nodes)
      if (near(node)) {
        node.pulses = 2;
        node.damage = damage * 0.65;
        node.pulse = 0.4;
      }
}

export function jegalUltimate(
  x: number,
  y: number,
  aim: number,
  damage: number,
  bounds: { left: number; right: number; top: number; bottom: number },
): Formation[] {
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  return Array.from({ length: 4 }, (_, n) => ({
    x: clamp(x + Math.cos(aim + (n * Math.PI) / 2) * 130, bounds.left, bounds.right),
    y: clamp(y + Math.sin(aim + (n * Math.PI) / 2) * 130, bounds.top, bounds.bottom),
    life: 5,
    pulse: 0.3,
    damage,
    kind: 'ultimate',
    pulses: 7,
  }));
}
