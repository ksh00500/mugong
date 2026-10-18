import type { BossMove } from './campaign';
import type { Enemy } from './model';
import { segmentDistance } from './enemy-geometry';
import { attack as punch, type MeleeMove, type BossKit } from './boss-kit';
import { BOSS_WAVE3 } from './boss-wave3';
import { BOSS_WAVE4 } from './boss-wave4';
import { BOSS_WAVE5 } from './boss-wave5';
export type { MeleeMove, BossKit } from './boss-kit';

/** Bespoke melee groups. Times are actual seconds, not generic boss multipliers. */
export const BOSS_MELEE: Record<string, BossKit> = {
  '0-1': {
    weapon: 'dao',
    sequence: ['slash', 'sweep', 'summon', 'slam', 'dash'],
    moves: {
      slash: punch('흑풍 내려베기', {
        range: 240,
        arc: 0.38,
        windup: 0.94,
        contacts: [0.18],
        duration: 0.42,
        damage: 1.5,
        recovery: 0.85,
      }),
      sweep: punch('산채 횡베기', {
        range: 215,
        arc: 1.65,
        windup: 0.7,
        contacts: [0.16],
        duration: 0.4,
        damage: 1,
        knockback: 50,
        recovery: 0.65,
      }),
      summon: punch('산채 호령', {
        shape: 'none',
        range: 320,
        windup: 0.95,
        contacts: [0.2],
        duration: 0.45,
        damage: 0,
        mechanic: 'reinforcements',
        recovery: 0.9,
      }),
      slam: punch('흑풍 발구르기', {
        shape: 'circle',
        range: 175,
        windup: 0.85,
        contacts: [0.26],
        duration: 0.5,
        damage: 0.85,
        slow: 1.4,
        recovery: 0.8,
      }),
      dash: punch('채주 들이받기', {
        range: 110,
        arc: 0.65,
        dash: 210,
        windup: 0.72,
        contacts: [0.3],
        duration: 0.35,
        damage: 0.9,
        knockback: 55,
        recovery: 0.7,
      }),
    },
  },
  '0-2': {
    weapon: 'staff',
    sequence: ['thrust', 'combo', 'stance', 'sweep', 'slam', 'dash'],
    moves: {
      thrust: punch('표두 장창 직자', {
        shape: 'line',
        range: 365,
        width: 24,
        windup: 0.52,
        contacts: [0.09],
        damage: 1.1,
        recovery: 0.4,
      }),
      combo: punch('삼연 찌르기', {
        shape: 'line',
        range: 305,
        width: 30,
        motion: 'thrust',
        windup: 0.65,
        contacts: [0.1, 0.6, 1.1],
        duration: 1.25,
        damage: 0.58,
        recovery: 0.85,
      }),
      stance: punch('청하 호위기', {
        shape: 'none',
        range: 320,
        windup: 0.9,
        contacts: [0.2],
        duration: 0.4,
        damage: 0,
        mechanic: 'flag',
        recovery: 0.75,
      }),
      sweep: punch('창대 밀어내기', {
        range: 200,
        arc: 1.3,
        windup: 0.65,
        contacts: [0.14],
        duration: 0.36,
        damage: 0.85,
        knockback: 85,
        recovery: 0.65,
      }),
      slam: punch('창대 진각', {
        shape: 'circle',
        range: 155,
        windup: 0.85,
        contacts: [0.26],
        duration: 0.5,
        damage: 0.8,
        slow: 1.3,
        recovery: 0.75,
      }),
      dash: punch('추격 돌진창', {
        shape: 'line',
        range: 165,
        width: 28,
        dash: 245,
        windup: 0.82,
        contacts: [0.36],
        duration: 0.4,
        damage: 1.25,
        recovery: 0.85,
      }),
    },
  },
  '0-3': {
    weapon: 'dao',
    sequence: ['thrust', 'combo', 'sweep', 'slam'],
    moves: {
      thrust: punch('쇄겸 포획', {
        shape: 'line',
        range: 355,
        width: 22,
        visual: 'chain',
        windup: 0.82,
        contacts: [0.14],
        duration: 0.4,
        damage: 0.65,
        pull: 180,
        recovery: 0.32,
      }),
      combo: punch('쌍쇄 근접 연격', {
        range: 175,
        arc: 1.1,
        windup: 0.5,
        contacts: [0.1, 0.6],
        duration: 0.85,
        damage: 0.8,
        recovery: 0.65,
      }),
      sweep: punch('쇄겸 회전', {
        shape: 'circle',
        range: 225,
        windup: 0.88,
        contacts: [0.22],
        duration: 0.48,
        damage: 1,
        recovery: 0.9,
      }),
      slam: punch('쇄추 지면 강타', {
        shape: 'circle',
        range: 165,
        windup: 0.94,
        contacts: [0.28],
        duration: 0.52,
        damage: 1.05,
        slow: 1.5,
        recovery: 0.85,
      }),
    },
  },
  '0-4': {
    weapon: 'dao',
    sequence: ['slash', 'combo', 'dash', 'sweep', 'slam'],
    moves: {
      slash: punch('패도 축적 참격', {
        range: 290,
        arc: 0.42,
        windup: 1.08,
        contacts: [0.2],
        duration: 0.48,
        damage: 1.65,
        recovery: 1,
      }),
      combo: punch('좌우 연환도', {
        range: 230,
        arc: 1.15,
        windup: 0.6,
        contacts: [0.12, 0.62],
        duration: 0.87,
        damage: 0.75,
        recovery: 0.7,
      }),
      dash: punch('패도 추격', {
        range: 150,
        arc: 0.75,
        dash: 285,
        windup: 0.72,
        contacts: [0.34],
        duration: 0.4,
        damage: 1.2,
        recovery: 0.8,
      }),
      sweep: punch('패도 대회전', {
        shape: 'circle',
        range: 265,
        windup: 0.92,
        contacts: [0.22],
        duration: 0.5,
        damage: 1.25,
        knockback: 45,
        recovery: 1,
      }),
      slam: punch('패도 지면 파쇄', {
        shape: 'circle',
        range: 220,
        windup: 1.05,
        contacts: [0.28],
        duration: 0.55,
        damage: 1.3,
        slow: 1.8,
        recovery: 1,
      }),
    },
  },
  '7-3': {
    weapon: 'gauntlet',
    sequence: ['thrust', 'dash', 'combo', 'slam'],
    moves: {
      thrust: punch('흑사 쌍장', {
        shape: 'line',
        range: 205,
        width: 50,
        dash: 65,
        windup: 0.62,
        contacts: [0.16],
        duration: 0.32,
        damage: 1.1,
        knockback: 70,
        recovery: 0.5,
      }),
      dash: punch('사막 철산고', {
        range: 115,
        arc: 0.7,
        dash: 270,
        windup: 0.8,
        contacts: [0.34],
        duration: 0.4,
        damage: 1.2,
        knockback: 75,
        recovery: 0.85,
      }),
      combo: punch('흑사 삼연장', {
        range: 165,
        arc: 0.9,
        windup: 0.6,
        contacts: [0.1, 0.6, 1.1],
        duration: 1.25,
        damage: 0.6,
        recovery: 0.85,
      }),
      slam: punch('황사 진각', {
        shape: 'circle',
        range: 240,
        windup: 1.02,
        contacts: [0.28],
        duration: 0.55,
        damage: 1.1,
        slow: 2.2,
        recovery: 1,
      }),
    },
  },
  '4-1': {
    weapon: 'gauntlet',
    sequence: ['thrust', 'dash', 'combo', 'slam'],
    moves: {
      thrust: punch('정권', { shape: 'line', range: 190, width: 32, damage: 1.15 }),
      dash: punch('어깨박치기', {
        range: 110,
        dash: 200,
        arc: 0.75,
        windup: 0.74,
        duration: 0.35,
        contacts: [0.3],
        knockback: 65,
      }),
      combo: punch('좌우 취권', {
        range: 150,
        arc: 1,
        windup: 0.52,
        duration: 0.82,
        contacts: [0.12, 0.62],
        damage: 0.62,
        recovery: 0.65,
      }),
      slam: punch('취승 진각', {
        shape: 'circle',
        range: 180,
        windup: 0.92,
        duration: 0.52,
        contacts: [0.26],
        recovery: 0.85,
        damage: 1.1,
        slow: 1.2,
      }),
    },
  },
  '4-2': {
    weapon: 'gauntlet',
    sequence: ['dash', 'grab', 'stance', 'slam'],
    moves: {
      dash: punch('철산고', {
        range: 120,
        dash: 250,
        arc: 0.7,
        windup: 0.78,
        duration: 0.4,
        contacts: [0.35],
        damage: 1.25,
        knockback: 90,
      }),
      grab: punch('철완 포획', {
        shape: 'none',
        range: 78,
        windup: 0.68,
        duration: 0.25,
        contacts: [0.08],
        damage: 0,
        recovery: 1.2,
        mechanic: 'grab',
      }),
      stance: punch('금강 자세', {
        shape: 'none',
        range: 190,
        windup: 0.38,
        duration: 0.25,
        contacts: [0.08],
        damage: 0,
        mechanic: 'stance',
        recovery: 0.55,
      }),
      slam: punch('나한 지면 강타', {
        shape: 'circle',
        range: 215,
        windup: 1.05,
        duration: 0.55,
        contacts: [0.28],
        damage: 1.3,
        recovery: 1,
        slow: 1.6,
      }),
    },
  },
  '4-3': {
    weapon: 'gauntlet',
    sequence: ['bell', 'combo', 'thrust', 'slam'],
    moves: {
      bell: punch('금강 종 타격', {
        shape: 'none',
        range: 250,
        windup: 0.8,
        duration: 0.3,
        contacts: [0.12],
        damage: 0,
        mechanic: 'bell',
        recovery: 0.45,
      }),
      combo: punch('삼연 금강장', {
        range: 190,
        arc: 0.85,
        windup: 0.6,
        duration: 1.2,
        contacts: [0.1, 0.6, 1.1],
        damage: 0.55,
        recovery: 0.72,
      }),
      thrust: punch('쌍장 밀치기', {
        shape: 'line',
        range: 225,
        width: 55,
        windup: 0.7,
        damage: 1.1,
        knockback: 75,
      }),
      slam: punch('금강 진각', {
        shape: 'circle',
        range: 245,
        windup: 1,
        duration: 0.52,
        contacts: [0.26],
        damage: 1.2,
        recovery: 0.95,
        slow: 1.5,
      }),
    },
  },
  '4-4': {
    weapon: 'staff',
    sequence: ['stance', 'combo', 'sweep', 'slam'],
    moves: {
      stance: punch('주지 금강세', {
        shape: 'none',
        range: 220,
        windup: 0.4,
        duration: 0.25,
        contacts: [0.08],
        damage: 0,
        mechanic: 'stance',
        recovery: 0.4,
      }),
      combo: punch('반격 연환봉', {
        range: 210,
        arc: 0.8,
        windup: 0.58,
        duration: 1.2,
        contacts: [0.1, 0.6, 1.1],
        damage: 0.6,
        recovery: 0.75,
      }),
      sweep: punch('선장 횡소', {
        range: 270,
        arc: 1.8,
        windup: 0.78,
        duration: 0.42,
        contacts: [0.17],
        damage: 1.1,
        recovery: 0.6,
      }),
      slam: punch('대범 진각', {
        shape: 'circle',
        range: 300,
        windup: 1.12,
        duration: 0.58,
        contacts: [0.3],
        damage: 1.35,
        recovery: 1.1,
        slow: 2,
      }),
    },
  },
  '5-2': {
    weapon: 'staff',
    sequence: ['thrust', 'sweep', 'combo', 'slam', 'dash'],
    moves: {
      thrust: punch('장봉 직자', {
        shape: 'line',
        range: 355,
        width: 26,
        windup: 0.5,
        duration: 0.3,
        contacts: [0.09],
        damage: 1.1,
        recovery: 0.4,
      }),
      sweep: punch('취봉 회전 횡소', {
        shape: 'circle',
        range: 255,
        windup: 0.88,
        duration: 0.55,
        contacts: [0.24],
        damage: 1.15,
        recovery: 0.8,
      }),
      combo: punch('좌우 연속 봉격', {
        range: 245,
        arc: 1.25,
        windup: 0.6,
        duration: 0.85,
        contacts: [0.13, 0.63],
        damage: 0.65,
        recovery: 0.6,
      }),
      slam: punch('봉끝 지면 강타', {
        shape: 'circle',
        range: 225,
        windup: 1.02,
        duration: 0.56,
        contacts: [0.28],
        damage: 1.2,
        recovery: 0.95,
        slow: 2,
      }),
      dash: punch('비틀걸음 파고들기', {
        range: 130,
        dash: 210,
        arc: 0.8,
        windup: 0.65,
        duration: 0.32,
        contacts: [0.28],
        damage: 0.8,
        recovery: 0.5,
      }),
    },
  },
};

export const BOSS_KITS: Record<string, BossKit> = {
  ...BOSS_MELEE,
  ...BOSS_WAVE3,
  ...BOSS_WAVE4,
  ...BOSS_WAVE5,
};
export const meleeKit = (e: Pick<Enemy, 'bossId'>) => (e.bossId ? BOSS_KITS[e.bossId] : undefined);
export function meleeMove(e: Enemy, move: BossMove) {
  const spec = meleeKit(e)?.moves[move];
  return spec && !spec.dash && !spec.shot && !spec.zone && spec.range < 330 &&
    ['line', 'sector'].includes(spec.shape) && (e.pressure?.advance ?? 0) > 0
    ? { ...spec, dash: e.pressure!.advance }
    : spec;
}

/** Physical weapon shapes; a long thrust is narrow even at its far end. */
export function meleeHits(
  e: Enemy,
  target: { x: number; y: number },
  spec: MeleeMove,
  angle = e.aim,
) {
  const dx = target.x - e.x,
    dy = target.y - e.y,
    d = Math.hypot(dx, dy);
  if (spec.shape === 'none') return false;
  if (spec.shape === 'circle') return d <= spec.range + 18;
  if (spec.shape === 'line') {
    const projection = dx * Math.cos(angle) + dy * Math.sin(angle);
    return (
      projection >= -18 &&
      projection <= spec.range + 18 &&
      segmentDistance(
        e,
        { x: e.x + Math.cos(angle) * spec.range, y: e.y + Math.sin(angle) * spec.range },
        target,
      ) <=
        (spec.width ?? 30) + 18
    );
  }
  return (
    d <= spec.range + 18 &&
    Math.abs(
      Math.atan2(Math.sin(Math.atan2(dy, dx) - angle), Math.cos(Math.atan2(dy, dx) - angle)),
    ) <= (spec.arc ?? 0.8)
  );
}
