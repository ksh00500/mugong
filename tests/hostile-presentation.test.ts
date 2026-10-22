import { describe, expect, it } from 'vitest';
import { emptyGame, startRun, tick } from '../src/domain/game';
import { REGION_ROSTERS, ROLE_PROFILES } from '../src/domain/region-enemies';
import { BOSS_ATTACKS } from '../src/domain/boss-attacks';
import { enemyArtSlot, enemyRepairSlot } from '../src/platform/region-art';
import {
  hazardProjectileVisual,
  hostileProjectileVisual,
  projectileVisual,
} from '../src/domain/projectile-visual';
import type { InputFrame } from '../src/domain/model';
import { BOSS_KITS } from '../src/domain/boss-melee';

const idle: InputFrame = { dx: 0, dy: 0, aim: 0, attack: false, defense: false, ultimate: false };
describe('적 무기·공격·투사체 연결', () => {
  for (const [region, roles] of Object.entries(REGION_ROSTERS))
    for (const role of new Set(roles))
      it(`${region}/${role}의 실제 공격이 역할별 그림을 사용한다`, () => {
        const state = emptyGame();
        startRun(state, '검증', 123);
        const r = state.run!;
        r.regionRoute = [region];
        r.offers = [];
        r.zones = [];
        r.encounterObjects = [];
        r.projectiles = [];
        const e = r.enemies[0];
        r.enemies = [e];
        Object.assign(e, {
          role,
          kind: ROLE_PROFILES[role].kind,
          bossId: undefined,
          x: r.fighter.x + 260,
          y: r.fighter.y,
          aim: Math.PI,
          state: 'windup',
          timer: 0,
          pattern: 0,
          skillClock: 100,
        });
        tick(r, idle, 1 / 60);
        if (ROLE_PROFILES[role].move === 'hazard') {
          expect(r.projectiles).toHaveLength(1);
          expect(r.projectiles[0].visual).toBe(hazardProjectileVisual(ROLE_PROFILES[role].zone!));
          expect(r.projectiles[0].landing?.kind).toBe(ROLE_PROFILES[role].zone);
          if (role === 'iceweaver') expect(enemyRepairSlot(e)).toBe(0);
          if (role === 'trapper') expect(enemyRepairSlot(e)).toBe(1);
          if (role === 'engineer') expect(enemyRepairSlot(e)).toBe(2);
        } else if (ROLE_PROFILES[role].move === 'fan') {
          expect(r.projectiles.length).toBeGreaterThan(0);
          expect(r.projectiles.every((p) => p.visual === hostileProjectileVisual(r, e))).toBe(true);
        }
      });
  for (let region = 0; region < 10; region++)
    for (let phase = 1; phase <= 4; phase++)
      it(`보스 ${region}-${phase}의 실제 원거리 패턴과 탄종 일치`, () => {
        const patterns = BOSS_ATTACKS[region][phase - 1].sequence;
        for (const [pattern, move] of patterns.entries()) {
          const spec = BOSS_KITS[`${region}-${phase}`]?.moves[move];
          if (!spec?.shot && !spec?.zone) continue;
          const state = emptyGame();
          startRun(state, '검증', 123);
          const r = state.run!;
          r.offers = [];
          r.zones = [];
          r.encounterObjects = [];
          const e = r.enemies[0];
          r.enemies = [e];
          r.projectiles = [];
          Object.assign(e, {
            bossId: `${region}-${phase}`,
            role: undefined,
            kind: 'chief',
            hp: 10000,
            maxHp: 10000,
            x: r.fighter.x + 300,
            y: r.fighter.y,
            aim: Math.PI,
            state: 'windup',
            timer: 0,
            pattern,
            skillClock: 100,
            targetX: r.fighter.x,
            targetY: r.fighter.y,
          });
          tick(r, idle, 1 / 60);
          expect(r.projectiles.filter((p) => p.owner === e.id)).toHaveLength(0);
          for (let n = 0; n < Math.ceil(spec.contacts[0] * 60) + 1; n++) tick(r, idle, 1 / 60);
          const shots = r.projectiles.filter((p) => p.owner === e.id);
          expect(shots.length).toBeGreaterThan(0);
          for (const p of shots)
            expect(p.visual).toBe(
              p.landing
                ? hazardProjectileVisual(p.landing.kind)
                : hostileProjectileVisual(r, e, p.returnAt !== undefined),
            );
        }
      });
  it('차크람·부채·암기 그림과 보스 마법 탄종을 구분한다', () => {
    expect(enemyArtSlot({ kind: 'archer', role: 'ringblade' }, 7)).toBe(2);
    expect(enemyArtSlot({ kind: 'archer', role: 'hexer' }, 8)).toBe(5);
    expect(enemyArtSlot({ kind: 'archer', role: 'needle' }, 5)).toBe(2);
    expect(enemyRepairSlot({ bossId: '5-2', role: 'engineer' })).toBe(3);
    expect(enemyRepairSlot({ bossId: '3-1', role: 'iceweaver' })).toBeUndefined();
    for (const [bossId, visual] of Object.entries({
      '3-2': 'ice-shard',
      '3-4': 'ice-shard',
      '6-4': 'flying-sword',
      '8-3': 'blood-orb',
      '9-4': 'wind-blade',
    }))
      expect(hostileProjectileVisual({ wave: 1 }, { kind: 'chief', bossId }, true)).toBe(visual);
  });
  it('구형 얼음 폭탄의 돌 그림도 실제 냉기 판정에 맞춰 복구한다', () => {
    expect(
      projectileVisual({
        x: 0,
        y: 0,
        vx: 1,
        vy: 0,
        life: 1,
        damage: 10,
        radius: 14,
        hits: [],
        friendly: false,
        visual: 'stone',
        landing: { x: 1, y: 0, radius: 90, kind: 'cold' },
      }),
    ).toBe('ice-bomb');
  });
});
