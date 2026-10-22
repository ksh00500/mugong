import { it, expect } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { BOSS_KITS } from '../src/domain/boss-melee';
import { bossBalanceProbe, type ProbePolicy } from './support/boss-balance-probe';

it('40보스의 같은 장비·시간 근접/원거리 압박과 반격을 실제 접촉으로 기록한다', () => {
  const rows = Object.keys(BOSS_KITS).flatMap((id) =>
    (['ranged-lap', 'melee-hold', 'melee-punish'] as ProbePolicy[]).map((policy) =>
      bossBalanceProbe(id, policy),
    ),
  );
  expect(rows).toHaveLength(120);
  expect(rows.every((x) => Number.isFinite(x.incoming + x.outgoing) && x.starts > 0)).toBe(true);
  const path = process.env.MUGONG_BALANCE_PROOF ?? 'docs/verification/boss-balance-v1';
  mkdirSync(path, { recursive: true });
  writeFileSync(
    `${path}/pressure-probes.json`,
    JSON.stringify(
      { methodology: '45s replenished-HP pressure probe; not survival/TTK or human play', rows },
      null,
      2,
    ) + '\n',
  );
}, 60000);

it('소림4보스는 실제 HP 결투와 여러 초기 조건도 별도로 기록한다', () => {
  const rows = ['4-1', '4-2', '4-3', '4-4'].flatMap((id) =>
    [123, 777, 2026].flatMap((seed) =>
      (['ranged-lap', 'melee-hold', 'melee-punish'] as ProbePolicy[]).map((policy) =>
        bossBalanceProbe(id, policy, seed, 120, true),
      ),
    ),
  );
  expect(rows).toHaveLength(36);
  expect(rows.every((x) => Number.isFinite(x.incoming + x.outgoing) && x.elapsed > 1)).toBe(true);
  const path = process.env.MUGONG_BALANCE_PROOF ?? 'docs/verification/boss-balance-v1';
  mkdirSync(path, { recursive: true });
  writeFileSync(
    `${path}/shaolin-duels.json`,
    JSON.stringify(
      {
        methodology:
          'Actual HP, no restoration; 120s limit; no defense/ultimate/consumables, scripted policies, not human win rates',
        rows,
      },
      null,
      2,
    ) + '\n',
  );
}, 60000);
