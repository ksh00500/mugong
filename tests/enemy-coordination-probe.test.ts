import { expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { emptyGame, startRun, spawnWave, tick } from '../src/domain/game';
import { REGIONS } from '../src/domain/campaign';
import { FIELD } from '../src/domain/content';
const proof =
  process.env.MUGONG_COORDINATION_PROOF ?? 'docs/verification/enemy-coordination-v1/after';

it('observes sixty regional squads with identical stats and stationary, retreating and circling input', () => {
  const rows = [];
  for (let region = 0; region < 10; region++)
    for (const wave of [6, 16])
      for (const policy of ['hold', 'retreat', 'circle']) {
        const s = emptyGame();
        startRun(s, '地域協攻観測', 123);
        const r = s.run!,
          f = r.fighter;
        r.regionRoute = REGIONS.filter((_, n) => n !== region)
          .slice(0, 4)
          .map((x) => x.name);
        r.regionRoute[Math.floor((wave - 1) / 5)] = REGIONS[region].name;
        r.wave = wave;
        spawnWave(r);
        r.offers = [];
        r.zones = [];
        r.encounterObjects = [];
        f.x = 960;
        f.y = 530;
        f.innate = 'focus';
        f.augments = [];
        r.enemies.forEach((e, n) => {
          const a = (n / r.enemies.length) * Math.PI * 2;
          e.x = 960 + Math.cos(a) * 290;
          e.y = 530 + Math.sin(a) * 220;
          e.state = 'approach';
          e.timer = 0;
        });
        let damage = 0,
          hits = 0,
          starts = 0,
          maxActive = 0,
          overlapFrames = 0,
          minStartGap = Infinity,
          lastStart = -1000;
        const attackers = new Set<number>(),
          roles = new Set<string>(),
          seconds = 24;
        const stats = r.enemies.map((e) => ({ id: e.id, role: e.role, hp: e.maxHp, xp: e.xp }));
        const begun = performance.now();
        for (let n = 0; n < seconds * 60; n++) {
          f.hp = 120;
          r.zoneClock = 0;
          const before = new Map(r.enemies.map((e) => [e.id, e.state]));
          let dx = 0,
            dy = 0;
          if (policy === 'retreat') {
            const target = [
              { x: FIELD.right - 130, y: FIELD.top + 100 },
              { x: FIELD.right - 130, y: FIELD.bottom - 100 },
              { x: FIELD.left + 130, y: FIELD.bottom - 100 },
              { x: FIELD.left + 130, y: FIELD.top + 100 },
            ][Math.floor(n / 240) % 4];
            dx = target.x - f.x;
            dy = target.y - f.y;
          } else if (policy === 'circle') {
            const t = (n / 60) * 0.7;
            dx = 960 + Math.cos(t) * 330 - f.x;
            dy = 530 + Math.sin(t) * 170 - f.y;
          }
          tick(
            r,
            { dx, dy, aim: 0, attack: false, defense: false, ultimate: false },
            1 / 60,
            (c) => {
              if (c.kind === 'impact' && c.target === 'hero') {
                damage += c.amount;
                hits++;
              }
            },
          );
          const active = r.enemies.filter((e) => e.state === 'windup' || e.state === 'strike');
          maxActive = Math.max(maxActive, active.length);
          if (new Set(active.map((e) => e.kind)).size >= 2) overlapFrames++;
          for (const e of r.enemies)
            if (e.state === 'windup' && before.get(e.id) !== 'windup') {
              minStartGap = Math.min(minStartGap, r.elapsed - lastStart);
              lastStart = r.elapsed;
              starts++;
              attackers.add(e.id);
              roles.add(e.role ?? e.kind);
            }
        }
        expect(Number.isFinite(damage)).toBe(true);
        expect(maxActive).toBeLessThanOrEqual(r.enemies.length);
        expect(starts).toBeGreaterThan(0);
        rows.push({
          region: REGIONS[region].name,
          wave,
          policy,
          enemyCount: r.enemies.length,
          stats,
          damage: +damage.toFixed(2),
          hits,
          starts,
          distinctAttackers: attackers.size,
          attackingRoles: [...roles],
          maxActive,
          mixedCommitmentSeconds: +(overlapFrames / 60).toFixed(2),
          minStartGap: +minStartGap.toFixed(4),
          simulationMs: +(performance.now() - begun).toFixed(1),
        });
      }
  mkdirSync(proof, { recursive: true });
  writeFileSync(
    `${proof}/squads.json`,
    JSON.stringify(
      {
        methodology:
          '60 scenarios: ten regions x waves6/16 x hold/retreat/circle, 24s each, replenished player HP; no player attacks, defenses, ambient fields or consumables; not a human survival/win-rate test',
        rows,
      },
      null,
      2,
    ) + '\n',
  );
  expect(rows).toHaveLength(60);
}, 120000);
