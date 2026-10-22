import { it, expect } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { balanceFixture } from './support/boss-balance-probe';
import { ART_IDS, ART_WEAPONS, maximumHp } from '../src/domain/content';
import { makeLootItem } from '../src/domain/items';
import { command, tick } from '../src/domain/game';
import { enemyAttack } from '../src/domain/combat';
import type { ArtId } from '../src/domain/model';
import { techniqueStats } from '../src/domain/techniques';
const proof =
  process.env.MUGONG_GLOBAL_BALANCE_PROOF ?? 'docs/verification/global-balance-v1/after';
function equipped(id: string, art: ArtId) {
  const result = balanceFixture(id),
    { r, f } = result,
    stage = Number(id.split('-')[1]);
  f.growth = { constitution: 0.6, strength: 0.6, agility: 0.6, inner: 0.6 };
  f.growthStartLevel = 0;
  f.innate = 'focus';
  f.augments = [];
  const weapon = makeLootItem(
    `weapon-${ART_WEAPONS[art]}-${Math.min(2, Math.floor(stage / 2))}`,
    'probe-weapon',
    'weapon',
    90,
  );
  const robe = makeLootItem(`gear-robe-${Math.min(2, stage - 1)}`, 'probe-robe', 'equipped', 90);
  f.items = [weapon, robe];
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
  r.zoneClock = 0;
  return result;
}
function save(name: string, data: unknown) {
  mkdirSync(proof, { recursive: true });
  writeFileSync(`${proof}/${name}.json`, JSON.stringify(data, null, 2) + '\n');
}
it('records eight techniques across four equipment/growth tiers on a stationary target', () => {
  const rows = [];
  for (let stage = 1; stage <= 4; stage++)
    for (const art of ART_IDS)
      for (const ultimates of [false, true]) {
        const { r, e, f } = equipped(`4-${stage}`, art);
        e.x = 900;
        e.y = 530;
        e.hp = e.maxHp = 100000;
        f.x = art === 'tang' || art === 'jegal' ? 550 : 815;
        f.y = 530;
        let outgoing = 0,
          casts = 0;
        const hp = maximumHp(f);
        for (let n = 0; n < 20 * 60; n++) {
          f.hp = hp;
          e.hp = e.maxHp;
          e.state = 'recover';
          e.timer = 999;
          e.x = 900;
          e.y = 530;
          tick(
            r,
            {
              dx: 0,
              dy: 0,
              aim: Math.atan2(e.y - f.y, e.x - f.x),
              attack: true,
              defense: false,
              ultimate:
                ultimates &&
                f.arts[0].level >= techniqueStats(art, f.arts[0].level).ultimateLevel &&
                f.arts[0].gauge >= 100,
            },
            1 / 60,
            (c) => {
              if (c.kind === 'impact' && c.target === e.id) outgoing += c.amount;
              if (c.kind === 'ultimate') casts++;
            },
          );
        }
        rows.push({
          stage,
          art,
          level: f.arts[0].level,
          ultimates,
          outgoing,
          dps: outgoing / 20,
          attacks: f.attackSeq,
          casts,
          hp,
        });
      }
  expect(rows).toHaveLength(64);
  expect(rows.every((x) => Number.isFinite(x.dps) && x.dps > 0)).toBe(true);
  save('techniques', {
    methodology:
      '20s replenished HP; fixed target; actual hits, poison, formations and optional ultimates; not human win rate',
    rows,
  });
}, 60000);
it('records all forty bosses against every technique with the same reactive movement policy', () => {
  const rows = [];
  for (let region = 0; region < 10; region++)
    for (let stage = 1; stage <= 4; stage++)
      for (const art of ART_IDS) {
        const { r, e, f } = equipped(`${region}-${stage}`, art);
        const hp = maximumHp(f),
          bhp = e.maxHp;
        let incoming = 0,
          outgoing = 0,
          hits = 0,
          casts = 0;
        const seconds = 18;
        for (let n = 0; n < seconds * 60; n++) {
          f.hp = hp;
          e.hp = bhp;
          r.zoneClock = 0;
          const d = Math.hypot(e.x - f.x, e.y - f.y),
            a = Math.atan2(e.y - f.y, e.x - f.x),
            ranged = art === 'tang' || art === 'jegal';
          const p = enemyAttack(e),
            danger = (e.state === 'windup' && e.timer < 0.25) || e.state === 'strike';
          const move = ranged
            ? d < 330
              ? a + Math.PI
              : d > 480
                ? a
                : a + Math.PI / 2
            : danger
              ? a + (p.dash || p.melee?.shape === 'line' ? Math.PI / 2 : Math.PI)
              : d > 95
                ? a
                : a + Math.PI / 2;
          tick(
            r,
            {
              dx: Math.cos(move),
              dy: Math.sin(move),
              aim: a,
              attack: ranged || (!danger && d < 155),
              ultimate:
                f.arts[0].level >= techniqueStats(art, f.arts[0].level).ultimateLevel &&
                f.arts[0].gauge >= 100,
              defense: danger && f.arts[0].defenseCd <= 0,
            },
            1 / 60,
            (c) => {
              if (c.kind === 'impact') {
                if (c.target === 'hero') {
                  incoming += c.amount;
                  hits++;
                } else if (c.target === e.id) outgoing += c.amount;
              }
              if (c.kind === 'ultimate') casts++;
            },
          );
        }
        rows.push({
          boss: e.bossId,
          stage,
          art,
          hp,
          bossHp: bhp,
          incoming,
          outgoing,
          hits,
          casts,
          dps: outgoing / seconds,
        });
      }
  expect(rows).toHaveLength(320);
  expect(rows.every((x) => Number.isFinite(x.incoming + x.outgoing))).toBe(true);
  save('bosses', {
    methodology:
      '18s replenished HP; eight arts x forty bosses; scripted range/reactive defense, no consumables or ambient reinforcements; not survival or human win rate',
    rows,
  });
}, 90000);
it('records finite consumable and rest economics without modifying a saved item or encounter', () => {
  const rows = [];
  for (let stage = 1; stage <= 4; stage++) {
    const { s, r, f } = equipped(`4-${stage}`, 'huashan');
    r.wave = stage * 5 - 1;
    r.phase = 'prep';
    r.gold = 100;
    f.hp = 1;
    let heals = 0;
    while (command(s, { type: 'heal' })) heals++;
    expect(r.gold).toBeGreaterThanOrEqual(0);
    expect(f.hp).toBeLessThanOrEqual(maximumHp(f));
    rows.push({ stage, heals, hp: f.hp, maxHp: maximumHp(f), spent: 100 - r.gold });
  }
  save('economy', { rows });
});
