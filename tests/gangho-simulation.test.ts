import { expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { ARTS } from '../src/domain/content';
import { command, emptyGame, startRun, tick } from '../src/domain/game';
import { compatibleWeapon, firstSpace } from '../src/domain/inventory';
import { isGameSave } from '../src/platform/save-validation';
import type { ArtId, BoundFighter, InputFrame } from '../src/domain/model';

const proof = 'docs/verification/gangho-completion-v1';
const idle: InputFrame = { dx: 0, dy: 0, aim: 0, attack: false, ultimate: false, defense: false };
const order: ArtId[] = [
  'tianmo',
  'huashan',
  'wudang',
  'samja',
  'tang',
  'shaolin',
  'gaebang',
  'jegal',
];
for (const seed of [123, 222, 777])
  it(`seed ${seed}: 실제 전투와 합법적인 정비·장비·소비·성장으로 여정을 종결한다`, () => {
    const state = emptyGame();
    startRun(state, '시뮬레이션', seed);
    const route = [...state.run!.regionRoute!],
      waves: object[] = [];
    let frames = 0,
      upgrades = 0;
    const choose = () => {
      while (state.run?.offers.length) {
        const offer = [...state.run.offers].sort(
          (a, b) => order.indexOf(a.art) - order.indexOf(b.art),
        )[0];
        expect(command(state, { type: 'choose', offer })).toBe(true);
      }
    };
    while (state.run && frames++ < 150000) {
      const r = state.run,
        f = r.fighter as BoundFighter;
      choose();
      if (r.phase === 'dead') {
        command(state, { type: 'claim' });
        break;
      }
      if (r.phase === 'loot' || r.phase === 'prep') {
        for (const item of [...f.items]) {
          if (item.kind === 'manual' || (item.kind === 'medicine' && f.hp < 95)) {
            expect(command(state, { type: 'use', id: item.id })).toBe(true);
            choose();
          } else if (['robe', 'boots', 'charm'].includes(item.kind) && item.place === 'ground') {
            const equipped = f.items.find(
              (old) => old.kind === item.kind && old.place === 'equipped',
            );
            if (!equipped || item.power > equipped.power)
              command(state, { type: 'moveItem', id: item.id, place: 'equipped' });
          } else if (item.kind === 'sword' && item.place === 'ground') {
            const matching = f.arts.filter((art) => compatibleWeapon(item, art.id));
            if (!matching.length) continue;
            const space = firstSpace(f.items, item, 'weapon');
            if (
              space &&
              command(state, { type: 'moveItem', id: item.id, place: 'weapon', ...space })
            )
              for (const art of matching) {
                const old = f.items.find((old) => old.id === f.bindings?.[art.id]);
                if (!old || item.power > old.power)
                  command(state, { type: 'bind', art: art.id, item: item.id });
              }
          } else if (item.kind === 'ore' && item.place === 'ground') {
            // Carry materials to the next rest rather than silently discarding them.
            while (item.place === 'ground') {
              const space = firstSpace(f.items, item, 'general');
              if (
                !space ||
                !command(state, { type: 'moveItem', id: item.id, place: 'general', ...space })
              )
                break;
            }
          }
        }
        if (r.phase === 'prep') {
          if (f.hp < 95) command(state, { type: 'heal' });
          const bound = f.bindings?.[f.arts[f.active]?.id];
          if (bound && command(state, { type: 'refine', id: bound })) upgrades++;
          for (const material of [...f.items].filter(
            (item) => item.kind === 'ore' && ['ground', 'general'].includes(item.place),
          ))
            command(state, { type: 'sellMaterial', id: material.id });
        }
  
        waves.push({
          wave: r.wave,
          phase: r.phase,
          level: f.level,
          hp: Math.round(f.hp),
          gold: r.gold,
        });
        expect(isGameSave(state)).toBe(true);
        expect(command(state, { type: 'next' }, 1800000000000)).toBe(true);
        continue;
      }
      const target = r.enemies
        .filter((enemy) => enemy.hp > 0)
        .sort((a, b) => Math.hypot(a.x - f.x, a.y - f.y) - Math.hypot(b.x - f.x, b.y - f.y))[0];
      if (!target) {
        tick(r, idle, 1 / 60);
        continue;
      }
      const distance = Math.hypot(target.x - f.x, target.y - f.y),
        aim = Math.atan2(target.y - f.y, target.x - f.x);
      const move = distance > 100 ? aim : aim + Math.PI / 2 + (distance < 70 ? 0.45 : 0);
      const art = f.arts[f.active];
      tick(
        r,
        {
          dx: Math.cos(move),
          dy: Math.sin(move),
          aim,
          attack: distance < 140,
          ultimate: !!art && art.gauge >= 100 && art.level >= (art.id === 'gaebang' ? 1 : 5),
          defense:
            !!art &&
            art.defenseCd <= 0 &&
            target.state === 'windup' &&
            target.timer < 0.25 &&
            distance < 230,
        },
        1 / 60,
      );
    }
    expect(state.run, '이동·성장·정비 입력으로 여정이 막히지 않아야 한다').toBeNull();
    expect(isGameSave(state)).toBe(true);
    expect(state.family.journeys).toHaveLength(1);
    // This is a legal-action bot, not a human win-rate or difficulty measurement.
    const survivor = state.family.roster[0];
    if (survivor) {
      expect(survivor.level).toBeGreaterThanOrEqual(13);
      expect(survivor.level).toBeLessThanOrEqual(16);
      expect(
        survivor.arts.filter((art) => art.level === ARTS[art.id].max).length,
      ).toBeLessThanOrEqual(3);
    }
    mkdirSync(proof, { recursive: true });
    writeFileSync(
      `${proof}/simulation-${seed}.json`,
      JSON.stringify(
        { seed, route, frames, upgrades, waves, result: state.family.journeys![0] },
        null,
        2,
      ),
    );
  });
