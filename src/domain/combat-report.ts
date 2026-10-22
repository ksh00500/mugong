import type { ArtId, Enemy, Run } from './model';
import { bossById } from './campaign';

export const DAMAGE_KINDS = [
  'melee',
  'projectile',
  'field',
  'hazard',
  'status',
  'unknown',
] as const;
export type DamageSource = { kind: (typeof DAMAGE_KINDS)[number]; label: string; bossId?: string };
export type DamageRecord = {
  time: number;
  wave: number;
  amount: number;
  hpAfter: number;
  source: DamageSource;
};
export type CombatReport = {
  startedAt: number;
  startWave: number;
  activeWave: number;
  waveStartedAt: number;
  waveDamageStart: number;
  damageTaken: number;
  potionsUsed: number;
  attacks: Partial<Record<ArtId | 'basic', number>>;
  hits: DamageRecord[];
  waves: { wave: number; seconds: number; damageTaken: number }[];
  fatal?: DamageRecord;
  loadout?: { id: ArtId; level: number }[];
  remainingMedicine?: number;
};
export function combatReport(run: Run): CombatReport {
  return (run.combatReport ??= {
    startedAt: run.elapsed,
    startWave: run.wave,
    activeWave: run.wave,
    waveStartedAt: run.elapsed,
    waveDamageStart: 0,
    damageTaken: 0,
    potionsUsed: 0,
    attacks: {},
    hits: [],
    waves: [],
  });
}
export function trackCombatWave(run: Run) {
  if (run.phase !== 'combat') return;
  const report = combatReport(run);
  if (report.activeWave !== run.wave) {
    report.activeWave = run.wave;
    report.waveStartedAt = run.elapsed;
    report.waveDamageStart = report.damageTaken;
  }
}
export function finishCombatWave(run: Run) {
  const report = combatReport(run);
  if (report.waves.some((w) => w.wave === run.wave)) return;
  report.waves.push({
    wave: run.wave,
    seconds: Math.max(0, run.elapsed - report.waveStartedAt),
    damageTaken: Math.max(0, report.damageTaken - report.waveDamageStart),
  });
  report.waves = report.waves.slice(-20);
}
export function enemyDamageSource(
  enemy: Pick<Enemy, 'bossId'> | undefined,
  kind: DamageSource['kind'],
): DamageSource {
  const boss = enemy?.bossId && bossById(enemy.bossId);
  return {
    kind,
    label: boss
      ? boss.name
      : kind === 'projectile'
        ? '적의 투사체'
        : kind === 'hazard'
          ? '적의 설치 공격'
          : '적의 근접 공격',
    ...(boss ? { bossId: enemy!.bossId } : {}),
  };
}
export function recordDamage(
  run: Run,
  amount: number,
  source: DamageSource = { kind: 'unknown', label: '확인되지 않은 공격' },
) {
  if (!(amount > 0)) return;
  const report = combatReport(run);
  const entry: DamageRecord = {
    time: run.elapsed,
    wave: run.wave,
    amount,
    hpAfter: run.fighter.hp,
    source: { ...source },
  };
  report.damageTaken += amount;
  report.hits = [...report.hits, entry].slice(-12);
  if (run.fighter.hp <= 0) {
    report.fatal = entry;
    report.loadout = run.fighter.arts.map(({ id, level }) => ({ id, level }));
    report.remainingMedicine = run.fighter.items
      .filter((i) => i.kind === 'medicine' && i.place !== 'warehouse')
      .reduce((sum, i) => sum + i.count, 0);
  }
}
