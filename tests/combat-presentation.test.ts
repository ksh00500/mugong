import { expect, it } from 'vitest';
import { CombatPresentation } from '../src/game/combat-presentation';
import { emptyGame, startRun, tick } from '../src/domain/game';
import type { InputFrame } from '../src/domain/model';
const input: InputFrame = { dx: 1, dy: 0, aim: 0, attack: false, defense: false, ultimate: false };
function fixture() {
  const state = emptyGame();
  startRun(state, '격리 화면 검사', 777);
  for (const e of state.run!.enemies) {
    e.state = 'windup';
    e.timer = 1000;
  }
  return state.run!;
}
for (const rate of [60, 120, 144, 240])
  it(`${rate}Hz draws moving poses between 60Hz ticks without changing the simulation result`, () => {
    const run = fixture(),
      control = structuredClone(run),
      view = new CombatPresentation();
    let accumulator = 0,
      ticks = 0;
    const x: number[] = [];
    for (let n = 0; n < rate; n++) {
      accumulator += 1 / rate;
      while (accumulator >= 1 / 60) {
        view.capture(run);
        tick(run, input, 1 / 60);
        accumulator -= 1 / 60;
        ticks++;
      }
      const hash = JSON.stringify(run);
      x.push(view.sample(run, accumulator * 60)!.fighter.x);
      expect(JSON.stringify(run)).toBe(hash);
    }
    for (let n = 0; n < ticks; n++) tick(control, input, 1 / 60);
    expect(run).toEqual(control);
    // Decimal frame periods can place the last step just below the boundary.
    expect(ticks).toBeGreaterThanOrEqual(59);
    expect(ticks).toBeLessThanOrEqual(60);
    // Ignore the first two simulation ticks used to fill the presentation history.
    const warm = x.slice(Math.ceil(rate / 30));
    expect(warm.slice(1).every((v, i) => v > warm[i])).toBe(true);
    expect(Math.max(...warm.slice(1).map((v, i) => v - warm[i]))).toBeLessThanOrEqual(
      265 / rate + 1e-6,
    );
  });
it('keeps launch identity, current HP and optional-field deletion without mutating live bodies', () => {
  const run = fixture(),
    view = new CombatPresentation();
  const shot = {
    x: 300,
    y: 300,
    vx: 600,
    vy: 0,
    life: 2,
    friendly: true,
    damage: 1,
    radius: 5,
    hits: [],
  };
  run.projectiles.push(shot);
  view.capture(run);
  run.fighter.x += 4;
  run.fighter.hp -= 3;
  shot.x += 10;
  const source = JSON.stringify(run),
    first = view.sample(run, 0.25)!;
  expect(first.fighter.hp).toBe(run.fighter.hp);
  expect(first.projectiles[0].x).toBe(302.5);
  const identity = first.projectiles[0];
  expect(view.sample(run, 0.75)!.projectiles[0]).toBe(identity);
  expect(JSON.stringify(run)).toBe(source);
  run.enemies[0].guardTime = 0.5;
  view.sample(run, 0.5);
  delete run.enemies[0].guardTime;
  expect(view.sample(run, 0.5)!.enemies[0].guardTime).toBeUndefined();
});
it('phase/wave/save changes, teleports, new entities and dead bodies never draw an old position', () => {
  const run = fixture(),
    view = new CombatPresentation();
  view.capture(run);
  run.fighter.x += 145;
  expect(view.sample(run, 0.1)!.fighter.x).toBe(run.fighter.x);
  run.fighter.action = 'defense';
  view.capture(run);
  run.fighter.x += 20;
  expect(view.sample(run, 0)!.fighter.x).toBe(run.fighter.x);
  run.enemies[0].hp = 0;
  run.enemies[0].x += 10;
  expect(view.sample(run, 0)!.enemies[0].x).toBe(run.enemies[0].x);
  const loaded = structuredClone(run);
  expect(view.sample(loaded, 0.5)).toBe(loaded);
  const fresh = { ...run.enemies[0], id: 9876, hp: 10, x: 700, y: 400 };
  run.enemies.push(fresh);
  expect(view.sample(run, 0)!.enemies.at(-1)!.x).toBe(700);
  run.wave++;
  expect(view.sample(run, 0.5)).toBe(run);
  run.phase = 'loot';
  expect(view.sample(run, 0.5)).toBe(run);
  view.reset();
  expect(view.sample(run, 0.5)).toBe(run);
});
