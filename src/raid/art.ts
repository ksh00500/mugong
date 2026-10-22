import {
  prepareNativeFamily,
  authoredEnemyArt,
  authoredEnemyFrame,
  registerAuthoredEnemy,
} from '../game/authored-enemy';
import { regionArtManifest } from '../platform/region-art';
import { directionIndex } from '../game/directional-motion';
import type { RaidArtwork } from '../pvp/arena';
import { RAID_FLOORS, type RaidState } from './model';
export async function prepareRaidArtwork(): Promise<RaidArtwork> {
  await prepareNativeFamily(5);
  const arts = [1, 2, 3, 4].map((phase) =>
    authoredEnemyArt({ kind: 'chief', bossId: `5-${phase}` }, 5)!,
  );
  const manifest = regionArtManifest(5),
    keys = new Set(arts.flatMap((art) => art.frames.map((f) => f.texture)));
  return {
    preload(scene) {
      for (const key of keys) scene.load.image(key, manifest[key]);
    },
    create(scene) {
      for (const key of keys) registerAuthoredEnemy(scene.textures.get(key));
    },
    draw(scene, image, label, g, world, reduced) {
      const m = world as RaidState,
        a = m.players[4],
        f = a.fighter,
        b = m.boss,
        art = arts[RAID_FLOORS[m.floor - 1].art - 3];
      const action =
        f.hp <= 0
          ? 'death'
          : b.phase === 'approach'
            ? f.action === 'walk'
              ? 'walk'
              : 'idle'
            : b.phase;
      const p = Math.max(0, Math.min(1, 1 - b.clock / b.duration));
      const { frame, flip } = authoredEnemyFrame(
        art,
        directionIndex(f.facing),
        action,
        p,
        m.tick / 60,
        reduced,
      );
      const scale = art.pixelScale * 1.2;
      image
        .setVisible(true)
        .setTexture(frame.texture, frame.name)
        .setScale(scale)
        .setOrigin(
          flip ? 1 - frame.footX / frame.width : frame.footX / frame.width,
          frame.footY / frame.height,
        )
        .setFlipX(flip)
        .setPosition(f.x, f.y)
        .setDepth(f.y)
        .setRotation(0)
        .setAlpha(1)
        .setTint(a.hurt > 0 ? 0xffe3c4 : 0xffffff);
      label
        .setText(f.name)
        .setVisible(true)
        .setPosition(f.x, f.y - art.healthClearance * 1.2 - 14);
      g.lineStyle(2, 0xffa77b, 0.8).strokeEllipse(f.x, f.y + 5, 62, 20);
      if (b.phase === 'windup' && b.pattern === 'charge') {
        g.lineStyle(106, 0xf47959, 0.18).lineBetween(
          b.x,
          b.y - 34,
          b.x + Math.cos(b.aim) * 300,
          b.y - 34 + Math.sin(b.aim) * 300,
        );
        g.lineStyle(3, 0xffb492, 0.9).lineBetween(
          b.x,
          b.y - 34,
          b.x + Math.cos(b.aim) * 300,
          b.y - 34 + Math.sin(b.aim) * 300,
        );
      }
    },
  };
}
