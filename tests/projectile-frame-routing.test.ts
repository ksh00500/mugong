import { expect, it } from 'vitest';
import { PaintedEffects } from '../src/game/effects';
import { PROJECTILE_VISUALS } from '../src/domain/projectile-visual';
import type Phaser from 'phaser';

it('every painted projectile uses only its own atlas frames, without per-frame missing-frame fallback warnings', () => {
  const frames = new Map<string, Set<string>>(),
    lookups: string[] = [];
  const textures = {
    get(key: string) {
      let set = frames.get(key);
      if (!set) {
        set = new Set(['__BASE', '11']);
        frames.set(key, set);
      }
      return {
        source: [{ width: 2048, height: 1024 }],
        add: (name: string) => set!.add(name),
        get: (name: string) => {
          lookups.push(`${key}/${name}`);
          if (!set!.has(name)) throw Error(`Missing frame ${key}/${name}`);
          return { width: 100, height: 100 };
        },
      };
    },
  };
  const object = () =>
    new Proxy({} as any, {
      get: (_target, key) => {
        if (key === 'setTexture')
          return (texture: string, name: string) => {
            textures.get(texture).get(name);
            return chain;
          };
        return () => chain;
      },
    });
  const chain = object();
  const scene = {
    textures,
    time: { now: 0 },
    add: {
      graphics: () => chain,
      image: (_x: number, _y: number, texture: string, frame: string) => {
        textures.get(texture).get(frame);
        return chain;
      },
    },
  };
  const effects = new PaintedEffects(scene as unknown as Phaser.Scene);
  for (const visual of PROJECTILE_VISUALS)
    effects.draw(
      [],
      [
        {
          x: 500,
          y: 400,
          vx: 600,
          vy: 0,
          life: 1,
          friendly: false,
          damage: 10,
          radius: 8,
          hits: [],
          visual,
        },
      ],
    );
  expect(lookups).toContain('painted-projectiles/arrow');
  expect(lookups).toContain('hostile-projectiles/ice-bomb');
  expect(lookups).not.toContain('hostile-projectiles/arrow');
  expect(lookups).not.toContain('hostile-projectiles/steel-needle');
});
