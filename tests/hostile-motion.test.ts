import { describe, expect, it } from 'vitest';
import { emptyGame, startRun } from '../src/domain/game';
import { ENEMY_ROLES, ROLE_PROFILES } from '../src/domain/region-enemies';
import { BOSS_ATTACKS } from '../src/domain/boss-attacks';
import { hostileMotion, sampleHostileRig } from '../src/game/hostile-motion';
import { enemyAttack } from '../src/domain/combat';
import { rigPoint, cavalryRigPoint } from '../src/game/directional-motion';
import type { Enemy } from '../src/domain/model';

function base(): Enemy {
  const s = emptyGame();
  startRun(s, '검증', 123);
  return s.run!.enemies[0];
}
const enemies: Enemy[] = ENEMY_ROLES.map((role) => ({
  ...base(),
  role,
  kind: ROLE_PROFILES[role].kind,
  bossId: undefined,
}));
for (let region = 0; region < 10; region++)
  for (let phase = 1; phase <= 4; phase++)
    for (const move of new Set(BOSS_ATTACKS[region][phase - 1].sequence))
      enemies.push({ ...base(), bossId: `${region}-${phase}`, kind: 'chief', move });
describe('적 공격과 피격 동작', () => {
  for (const e of enemies)
    it(`${e.bossId ?? e.role}/${e.move ?? '기본'}: 준비·타격·회복 연결 및 팔방 피격`, () => {
      const original = structuredClone(e);
      const sample = (action: Parameters<typeof sampleHostileRig>[1], p: number) =>
        sampleHostileRig(e, action, p, 0, 0);
      const windup = enemyAttack(e).windup;
      const locked = 1 - Math.min(0.4, windup * 0.45) / windup;
      expect(sample('windup', locked)).toEqual(sample('windup', 1));
      expect(sample('windup', 1)).not.toEqual(sample('recover', 1));
      expect(sample('windup', 1)).toEqual(sample('strike', 0));
      expect(sample('strike', 1)).toEqual(sample('recover', 0));
      const neutral = sample('recover', 1);
      for (const v of Object.values(neutral)) expect(v).toBe(0);
      const hurt = sample('hurt', 0.5);
      for (let direction = 0; direction < 8; direction++) {
        const point = e.role === 'rider' ? cavalryRigPoint : rigPoint;
        expect(point(0.85, 0.4, hurt, direction)).not.toEqual(point(0.85, 0.4, neutral, direction));
        for (const action of ['windup', 'strike', 'recover', 'hurt', 'death'] as const)
          for (const value of Object.values(sampleHostileRig(e, action, 0.5, 0.5, 10)))
            expect(Number.isFinite(value)).toBe(true);
      }
      expect(e).toEqual(original);
      const fixed = sampleHostileRig(e, 'windup', 0.1, 0, 0, true);
      expect(fixed).toEqual(sampleHostileRig(e, 'windup', 0.9, 0.7, 100, true));
      expect(fixed).not.toEqual(sampleHostileRig(e, 'strike', 0.5, 0, 0, true));
      expect(sampleHostileRig(e, 'hurt', 0.5, 0, 0, true).crouch).toBeGreaterThan(0);
    });
  it('활·투척·시전과 창/검 공격을 구분한다', () => {
    const role = (r: Enemy['role']) =>
      hostileMotion({ ...base(), role: r, kind: ROLE_PROFILES[r!].kind, bossId: undefined });
    expect(role('bowman')).toBe('shoot');
    expect(role('iceweaver')).toBe('throw');
    expect(role('needle')).toBe('throw');
    expect(role('swordcaster')).toBe('cast');
    expect(role('guard')).toBe('thrust');
    expect(role('raider')).toBe('slash');
  });
});
