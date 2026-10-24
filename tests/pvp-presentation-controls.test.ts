import { expect, it, vi } from 'vitest';
import { PvpControls } from '../src/pvp/controls';
import { createPvpMatch } from '../src/pvp/engine';
it('renderer loss sends neutral input and masks queued actions until an actual new renderer is ready', () => {
  const match = createPvpMatch('render-controls', 'friendly', [
    { name: 'a', preset: 'sword' },
    { name: 'b', preset: 'monk' },
  ]);
  match.phase = 'fighting';
  const sent: unknown[] = [];
  const controls = new PvpControls(
    {
      getSnapshot: () => ({ seat: 0, connected: true, room: { match } }),
      send: (message) => {
        sent.push(message);
        return true;
      },
    },
    () => false,
  );
  controls.flush();
  controls.input.dx = 1;
  controls.input.attack = true;
  controls.flush();
  controls.setRendering(false);
  controls.action('ultimate');
  controls.flush();
  expect(sent.at(-1)).toMatchObject({
    dx: 0,
    dy: 0,
    attack: false,
    defense: false,
    ultimate: false,
    switch: 0,
  });
  controls.setRendering(true);
  controls.action('defense');
  expect(sent.at(-1)).toMatchObject({ defense: true });
});
it('local movement prediction continues each display frame while server HP and body coordinates remain authoritative', () => {
  const clock = vi.spyOn(performance, 'now');
  try {
    const match = createPvpMatch('predict-controls', 'friendly', [
      { name: 'a', preset: 'sword' },
      { name: 'b', preset: 'monk' },
    ]);
    match.phase = 'fighting';
    const controls = new PvpControls(
      { getSnapshot: () => ({ seat: 0, connected: true, room: { match } }), send: () => true },
      () => false,
    );
    clock.mockReturnValue(0);
    controls.flush();
    controls.input.dx = 1;
    controls.flush();
    const f = match.players[0].fighter,
      hash = JSON.stringify(f),
      positions: number[] = [];
    for (const now of [10, 20, 30, 40]) {
      clock.mockReturnValue(now);
      positions.push(controls.position(f, 0, -1).x);
    }
    expect(positions.slice(1).every((v, i) => v > positions[i])).toBe(true);
    expect(JSON.stringify(f)).toBe(hash);
  } finally {
    clock.mockRestore();
  }
});
