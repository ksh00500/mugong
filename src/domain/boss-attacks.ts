import type { BossMove } from './campaign';
import type { FieldZone } from './model';
import { BOSS_KITS } from './boss-melee';
type Style = {
  sequence: BossMove[];
  melee: number;
  thrust: number;
  arc: number;
  dash: number;
  shots: number;
  spread: number;
  speed: number;
  ring: number;
  radius: number;
  windup: number;
  recovery: number;
  burst?: boolean;
  returning?: boolean;
  zone?: FieldZone['kind'];
};
function style(sequence: BossMove[], details: Partial<Omit<Style, 'sequence'>> = {}): Style {
  return {
    sequence,
    melee: 170,
    thrust: 235,
    arc: 1.05,
    dash: 220,
    shots: 3,
    spread: 0.22,
    speed: 330,
    ring: 8,
    radius: 100,
    windup: 1,
    recovery: 0.95,
    ...details,
  };
}
/** Every row follows the workbook's four named bosses. Geometry, cadence and
 * follow-ups express their identities; shared moves remain readable primitives. */
export const BOSS_ATTACKS: Style[][] = [
  [
    style(['pulse', 'slash', 'summon'], { melee: 210, arc: 1.5, windup: 1.3, recovery: 1.5 }),
    style(['dash', 'thrust', 'thrust', 'thrust'], {
      thrust: 290,
      arc: 0.25,
      dash: 310,
      windup: 0.85,
      recovery: 0.5,
    }),
    style(['hazard', 'thrust', 'summon'], { zone: 'trap', radius: 115, thrust: 260, windup: 1.15 }),
    style(['slash', 'fan', 'dash', 'slash'], {
      melee: 255,
      arc: 1.3,
      shots: 1,
      dash: 350,
      windup: 1.2,
      recovery: 1.2,
    }),
  ],
  [
    style(['fan', 'slash', 'hazard'], {
      shots: 1,
      speed: 270,
      melee: 230,
      zone: 'poison',
      radius: 110,
    }),
    style(['hazard', 'fan', 'hazard'], {
      shots: 3,
      burst: true,
      speed: 285,
      zone: 'poison',
      radius: 100,
      windup: 1.2,
      recovery: 1.35,
    }),
    style(['fan', 'hazard', 'ring'], {
      shots: 5,
      spread: 0.12,
      ring: 10,
      zone: 'poison',
      radius: 135,
      windup: 0.95,
    }),
    style(['hazard', 'ring', 'hazard', 'fan'], {
      zone: 'poison',
      radius: 165,
      ring: 12,
      shots: 7,
      spread: 0.2,
      speed: 240,
      windup: 1.4,
      recovery: 1.4,
    }),
  ],
  [
    style(['thrust', 'fan', 'slash'], {
      thrust: 260,
      arc: 0.35,
      shots: 1,
      windup: 0.9,
      recovery: 1.2,
    }),
    style(['slash', 'slash', 'dash', 'fan'], {
      melee: 145,
      arc: 0.75,
      dash: 230,
      shots: 2,
      spread: 0.35,
      returning: true,
      windup: 0.7,
      recovery: 0.45,
    }),
    style(['dash', 'thrust', 'fan', 'fan'], {
      dash: 300,
      shots: 3,
      burst: true,
      windup: 0.8,
      recovery: 0.6,
    }),
    style(['slash', 'thrust', 'slash', 'fan'], {
      melee: 235,
      thrust: 280,
      shots: 3,
      spread: 0.3,
      windup: 0.9,
      recovery: 0.65,
    }),
  ],
  [
    style(['dash', 'slash', 'hazard'], {
      dash: 320,
      thrust: 300,
      zone: 'cold',
      radius: 120,
      windup: 1.15,
    }),
    style(['hazard', 'fan', 'hazard'], {
      zone: 'cold',
      radius: 80,
      shots: 3,
      spread: 0.4,
      speed: 280,
      windup: 1.2,
    }),
    style(['dash', 'pulse', 'slash'], {
      dash: 260,
      melee: 260,
      arc: 1.55,
      windup: 1.3,
      recovery: 1.4,
    }),
    style(['hazard', 'fan', 'ring', 'hazard'], {
      zone: 'cold',
      radius: 140,
      shots: 5,
      ring: 12,
      speed: 265,
      windup: 1.3,
    }),
  ],
  [
    style(['thrust', 'dash', 'hazard'], {
      melee: 125,
      thrust: 135,
      dash: 160,
      zone: 'brew',
      radius: 75,
      windup: 1.25,
      recovery: 1.5,
    }),
    style(['dash', 'pulse', 'thrust'], {
      dash: 240,
      melee: 165,
      thrust: 130,
      windup: 1.2,
      recovery: 1.4,
    }),
    style(['pulse', 'slash', 'pulse'], { melee: 300, arc: 1.4, windup: 1.4, recovery: 1.4 }),
    style(['thrust', 'pulse', 'slash'], {
      thrust: 190,
      melee: 270,
      arc: 1.35,
      windup: 1.15,
      recovery: 1.25,
    }),
  ],
  [
    style(['fan', 'dash', 'fan'], {
      shots: 3,
      spread: 0.14,
      speed: 370,
      dash: 230,
      windup: 0.85,
      recovery: 0.7,
    }),
    style(['slash', 'dash', 'hazard'], {
      melee: 240,
      arc: 1.5,
      dash: 150,
      zone: 'brew',
      radius: 85,
      windup: 1.1,
    }),
    style(['dash', 'thrust', 'thrust'], {
      dash: 380,
      thrust: 245,
      arc: 0.22,
      windup: 0.8,
      recovery: 0.5,
    }),
    style(['fan', 'ring', 'slash'], {
      shots: 3,
      spread: 0.4,
      returning: true,
      ring: 6,
      speed: 295,
      melee: 280,
      windup: 1.15,
    }),
  ],
  [
    style(['hazard', 'dash', 'slash'], {
      zone: 'fire',
      radius: 90,
      melee: 110,
      arc: 0.6,
      windup: 0.9,
      recovery: 0.6,
    }),
    style(['dash', 'pulse', 'hazard'], {
      dash: 200,
      melee: 140,
      zone: 'trap',
      radius: 125,
      windup: 1.3,
      recovery: 1.4,
    }),
    style(['fan', 'ring', 'hazard'], {
      shots: 5,
      spread: 0.09,
      ring: 6,
      zone: 'trap',
      radius: 70,
      speed: 400,
      windup: 1.15,
    }),
    style(['fan', 'hazard', 'ring'], {
      shots: 2,
      returning: true,
      zone: 'trap',
      radius: 120,
      ring: 8,
      speed: 290,
      windup: 1.1,
    }),
  ],
  [
    style(['dash', 'slash', 'summon'], { dash: 280, melee: 215, arc: 1.25, windup: 1.15 }),
    style(['fan', 'ring', 'slash'], {
      shots: 2,
      spread: 0.45,
      returning: true,
      ring: 4,
      melee: 180,
      windup: 0.95,
    }),
    style(['pulse', 'hazard', 'thrust'], {
      melee: 240,
      thrust: 165,
      zone: 'trap',
      radius: 150,
      windup: 1.4,
      recovery: 1.4,
    }),
    style(['dash', 'fan', 'dash', 'slash'], {
      dash: 480,
      shots: 3,
      spread: 0.25,
      speed: 365,
      melee: 215,
      windup: 1.25,
      recovery: 1.1,
    }),
  ],
  [
    style(['slash', 'hazard', 'thrust'], {
      melee: 175,
      zone: 'blood',
      radius: 110,
      windup: 0.95,
      recovery: 0.8,
    }),
    style(['dash', 'slash', 'pulse'], { dash: 340, melee: 180, windup: 0.8, recovery: 0.6 }),
    style(['hazard', 'fan', 'thrust'], {
      zone: 'blood',
      radius: 125,
      shots: 4,
      spread: 0.18,
      thrust: 250,
      windup: 1.15,
    }),
    style(['hazard', 'pulse', 'ring', 'dash'], {
      zone: 'blood',
      radius: 180,
      melee: 240,
      ring: 10,
      dash: 270,
      windup: 1.3,
    }),
  ],
  [
    style(['hazard', 'thrust', 'fan'], {
      zone: 'gate',
      radius: 110,
      thrust: 250,
      shots: 1,
      speed: 290,
      windup: 1.2,
    }),
    style(['fan', 'hazard', 'fan'], {
      shots: 3,
      burst: true,
      zone: 'trap',
      radius: 80,
      speed: 390,
      windup: 1.1,
    }),
    style(['hazard', 'thrust', 'ring'], {
      zone: 'gate',
      radius: 140,
      thrust: 320,
      ring: 8,
      windup: 1.35,
      recovery: 1.2,
    }),
    style(['ring', 'hazard', 'pulse', 'ring'], {
      zone: 'gate',
      radius: 180,
      ring: 8,
      melee: 310,
      speed: 235,
      windup: 1.5,
      recovery: 1.4,
    }),
  ],
];

// Reviewed melee kits replace the old generic sequence; other bosses retain their current kit.
for (const [id, kit] of Object.entries(BOSS_KITS)) {
  const [region, phase] = id.split('-').map(Number);
  BOSS_ATTACKS[region][phase - 1].sequence = kit.sequence;
}
