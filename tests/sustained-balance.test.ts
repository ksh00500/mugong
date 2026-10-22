import { it, expect } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { balanceFixture } from './support/boss-balance-probe';
import { ART_IDS, ART_WEAPONS, maximumHp } from '../src/domain/content';
import { makeLootItem } from '../src/domain/items';
import { tick, command } from '../src/domain/game';
import { isGameSave } from '../src/platform/save-validation';
import { techniqueStats } from '../src/domain/techniques';

it('observes 320 bounded actual-HP boss duels with two potions and persisted combat reports', () => {
  const rows = [];
  for (let region = 0; region < 10; region++)
    for (let stage = 1; stage <= 4; stage++)
      for (const art of ART_IDS) {
        const { s, r, e, f } = balanceFixture(`${region}-${stage}`);
        f.growth = { constitution: 1, strength: 1, agility: 1, inner: 1 };
        f.growthStartLevel = 0;
        f.innate = 'focus';
        const weapon = makeLootItem(
          `weapon-${ART_WEAPONS[art]}-${Math.min(2, Math.floor(stage / 2))}`,
          'duel-weapon',
          'weapon',
          90,
        );
        const robe = makeLootItem(
          `gear-robe-${Math.min(2, stage - 1)}`,
          'duel-robe',
          'equipped',
          90,
        );
        f.items = [
          weapon,
          robe,
          { ...makeLootItem('medicine-small', 'duel-medicine', 'general'), x: 0, y: 0, count: 2 },
        ];
        f.bindings = { [art]: weapon.id };
        f.arts = [
          {
            id: art,
            level: art === 'samja' ? [2, 4, 7, 9][stage - 1] : [2, 3, 4, 5][stage - 1],
            gauge: 0,
            combo: 0,
            defenseCd: 0,
          },
        ];
        f.hp = maximumHp(f);
        for (let frame = 0; frame < 120 * 30 && f.hp > 0 && e.hp > 0; frame++) {
          const dx = e.x - f.x,
            dy = e.y - f.y,
            dist = Math.hypot(dx, dy),
            ranged = art === 'tang' || art === 'jegal',
            desired = ranged ? 330 : 95;
          let mx = dist > desired + 30 ? dx / dist : dist < desired - 20 ? -dx / dist : 0,
            my = dist > desired + 30 ? dy / dist : dist < desired - 20 ? -dy / dist : 0;
          if (e.state === 'windup' && dist < 350) {
            mx = -dy / Math.max(1, dist);
            my = dx / Math.max(1, dist);
          }
          const medicine = f.items.find((i) => i.kind === 'medicine');
          if (f.hp < maximumHp(f) * 0.35 && medicine) command(s, { type: 'use', id: medicine.id });
          const a = f.arts[0],
            ultimate = a.level >= techniqueStats(art, a.level).ultimateLevel && a.gauge >= 100;
          tick(
            r,
            {
              dx: mx,
              dy: my,
              aim: Math.atan2(dy, dx),
              attack: true,
              defense: e.state === 'strike' && dist < 200 && a.defenseCd <= 0,
              ultimate,
            },
            1 / 30,
          );
        }
        expect(isGameSave(s)).toBe(true);
        rows.push({
          boss: `${region}-${stage}`,
          art,
          outcome: e.hp <= 0 ? 'boss-defeated' : f.hp <= 0 ? 'dead' : 'timeout',
          seconds: r.elapsed,
          hp: f.hp,
          bossHp: e.hp,
          damageTaken: r.combatReport?.damageTaken ?? 0,
          potionsUsed: r.combatReport?.potionsUsed ?? 0,
          remainingMedicine:
            f.hp > 0
              ? f.items.filter((i) => i.kind === 'medicine').reduce((n, i) => n + i.count, 0)
              : (r.combatReport?.remainingMedicine ?? 0),
          finalHit: r.combatReport?.fatal?.source,
        });
      }
  expect(rows).toHaveLength(320);
  expect(
    rows.every(
      (row) =>
        Number.isFinite(row.hp + row.bossHp + row.damageTaken) &&
        row.seconds > 0 &&
        row.seconds <= 120.1 &&
        row.potionsUsed <= 2,
    ),
  ).toBe(true);
  const root = process.env.MUGONG_COMPLETION_PROOF ?? 'docs/verification/remaining-gameplay-v1';
  mkdirSync(root, { recursive: true });
  writeFileSync(
    `${root}/actual-hp-duels.json`,
    JSON.stringify(
      {
        methodology:
          '320 actual-HP scripted boss duels, 120s cap, two small potions, fixed growth/equipment tiers, reactive circle/range policy. No HP replenishment or human win-rate claim. Environmental rules stay active.',
        virtualSeconds: rows.reduce((n, r) => n + r.seconds, 0),
        rows,
      },
      null,
      2,
    ) + '\n',
  );
}, 120000);
