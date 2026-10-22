import { expect, it } from 'vitest';
import { command, emptyGame, startRun, tick } from '../src/domain/game';
import type { ArtId } from '../src/domain/model';
import { ARTS } from '../src/domain/content';

it('합법적인 이동·공격·방어·회복·성장 선택으로 여정이 승리 또는 사망 정산까지 끝난다', () => {
  const state = emptyGame();
  startRun(state, '실전검증', 123);
  let frames = 0;
  const order: ArtId[] = ['tianmo', 'huashan', 'wudang', 'samja', 'tang', 'shaolin', 'gaebang', 'jegal'];
  const choices = () => {
    while (state.run?.offers.length) {
      const offer = [...state.run.offers].sort(
        (a, b) => order.indexOf(a.art) - order.indexOf(b.art),
      )[0];
      command(state, { type: 'choose', offer });
    }
  };
  while (state.run && frames++ < 150000) {
    const r = state.run,
      f = r.fighter;
    choices();
    if (r.phase === 'dead') {
      expect(f.hp).toBe(0);
      expect(command(state, { type: 'claim' })).toBe(true);
      break;
    }
    if (r.phase === 'loot' || r.phase === 'prep') {
      for (const item of [...f.items].filter((i) => ['medicine', 'manual'].includes(i.kind))) {
        if (item.kind === 'medicine' && f.hp >= 100) continue;
        if (item.place === 'ground')
          command(state, { type: 'moveItem', id: item.id, place: 'ground' });
        command(state, { type: 'use', id: item.id });
        choices();
      }
      if (r.phase === 'prep' && f.hp < 95) command(state, { type: 'heal' });
      // Any unused staging supply is explicitly discarded before leaving.

      expect(command(state, { type: 'next' })).toBe(true);
      continue;
    }
    const target = [...r.enemies]
      .filter((e) => e.hp > 0)
      .sort((a, b) => Math.hypot(a.x - f.x, a.y - f.y) - Math.hypot(b.x - f.x, b.y - f.y))[0];
    if (!target) {
      tick(r, { dx: 0, dy: 0, aim: 0, attack: false, ultimate: false, defense: false }, 1 / 60);
      continue;
    }
    const dist = Math.hypot(target.x - f.x, target.y - f.y),
      aim = Math.atan2(target.y - f.y, target.x - f.x);
    const move = dist > 100 ? aim : aim + Math.PI / 2 + (dist < 70 ? 0.45 : 0);
    const a = f.arts[f.active];
    tick(
      r,
      {
        dx: Math.cos(move),
        dy: Math.sin(move),
        aim,
        attack: dist < 140,
        ultimate: !!a && a.gauge >= 100 && a.level >= (a.id === 'gaebang' ? 1 : 5),
        defense:
          !!a && a.defenseCd <= 0 && target.state === 'windup' && target.timer < 0.25 && dist < 230,
      },
      1 / 60,
    );
  }
  expect(state.run).toBeNull();
  expect(state.family.journeys).toHaveLength(1);
  const survivor = state.family.roster[0];
  if (!survivor) {
    expect(state.family.victories).toBe(0);
    return; // A fixed-action bot is not guaranteed a win by the harder balance.
  }
  expect(state.family.victories).toBe(1);
  expect(survivor.level).toBeGreaterThanOrEqual(13);
  expect(survivor.level).toBeLessThanOrEqual(16);
  expect(survivor.arts.filter((a) => a.level === ARTS[a.id].max).length).toBeLessThanOrEqual(3);
  console.info(
    `실전 완주: ${Math.round(frames / 60)}초, Lv.${survivor.level}, HP ${Math.round(survivor.hp)}, ${survivor.arts.map((a) => `${a.id}:${a.level}`).join(', ')}`,
  );
});
