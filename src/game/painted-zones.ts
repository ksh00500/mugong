import type Phaser from 'phaser';
import type { Run } from '../domain/model';
import frames from '../platform/zone-frames.json';
import { regionName } from '../domain/campaign';
import { encounterZoneArt, type ZoneArt } from './zone-art';

const textureKey = 'painted-zones';

/** Ground art has its own bounded pool, below actors, showing only active ground effects. */
export class PaintedZones {
  private pool: Phaser.GameObjects.Image[] = [];
  private used = 0;
  constructor(private scene: Phaser.Scene) {
    for (const [name, frame] of Object.entries(frames)) {
      const texture = scene.textures.get(frame.texture);
      texture.add(name, 0, frame.x, frame.y, frame.width, frame.height);
    }
  }
  private patch(
    kind: ZoneArt,
    x: number,
    y: number,
    radius: number,
    alpha: number,
    tint = 0xffffff,
  ) {
    // Field zones, 12 boss objects, four formations and queued bomb landings are bounded.
    if (this.used >= 64 || radius <= 0) return;
    const image = this.pool[this.used] ?? this.scene.add.image(0, 0, textureKey);
    this.pool[this.used++] = image;
    const frame = frames[kind];
    image
      .setTexture(frame.texture, kind)
      .setOrigin(0.5)
      .setPosition(x, y)
      .setDisplaySize((frame.width * radius) / frame.extent, (frame.height * radius) / frame.extent)
      .setDepth(-2)
      .setVisible(true)
      .setAlpha(alpha)
      .setTint(tint);
    return image;
  }
  draw(run?: Run | null) {
    this.used = 0;
    for (const image of this.pool) image.setVisible(false);
    if (!run || run.phase !== 'combat') return;
    for (const zone of run.zones ?? []) {
      if (zone.life <= 0 || zone.warning > 0) continue;
      const warm = zone.kind === 'cold' && zone.id === 0;
      this.patch(warm ? 'warm' : zone.kind, zone.x, zone.y, zone.radius, warm ? 0.68 : 0.62);
    }
    for (const object of run.encounterObjects ?? []) {
      if (
        object.mechanic === 'poison-powder' ||
        object.mechanic === 'poison-mist' ||
        object.mechanic === 'formation'
      ) {
        if (object.life > 0 && object.warning <= 0)
          this.special(
            object.mechanic === 'formation'
              ? object.stage === 0
                ? 4
                : 5
              : object.mechanic === 'poison-powder'
                ? 0
                : 1,
            object.x,
            object.y,
            object.radius,
            0.62,
          );
        continue;
      }
      const kind = encounterZoneArt(run, object);
      if (!kind || object.life <= 0 || object.warning > 0) continue;
      this.patch(
        kind,
        object.x,
        object.y,
        object.kind === 'tether' ? Math.min(60, object.radius) : object.radius,
        object.kind === 'smoke' ? 0.4 : 0.6,
      );
    }
    for (const node of run.formations ?? []) {
      if (node.life > 0)
        this.special(
          node.kind === 'earth' ? 3 : 2,
          node.x,
          node.y,
          105,
          Math.min(0.52, node.life * 0.52),
        );
    }
    const region = regionName(run);
    if (
      (region === '서역사막' && run.elapsed % 14 > 10) ||
      (region === '죽림' && run.elapsed % 14 > 11)
    ) {
      this.patch(
        region === '서역사막' ? 'sand' : 'smoke',
        960,
        535,
        750,
        0.16,
        region === '서역사막' ? 0xe9c99a : 0xbad9be,
      )?.setDisplaySize(1610, 640);
    }
  }
  destroy() {
    for (const image of this.pool) image.destroy();
    this.pool = [];
  }
  private special(frame: number, x: number, y: number, radius: number, alpha: number) {
    if (this.used >= 64) return;
    const image = this.pool[this.used] ?? this.scene.add.image(0, 0, 'boss-fields');
    this.pool[this.used++] = image;
    image
      .setTexture('boss-fields', String(frame))
      .setOrigin(0.5)
      .setPosition(x, y)
      .setDisplaySize(radius * 2, radius * 2)
      .setDepth(-2)
      .setVisible(true)
      .setAlpha(alpha)
      .clearTint();
  }
}
