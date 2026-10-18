import type Phaser from 'phaser';
import { ARTS } from '../domain/content';
import type { Effect, Fighter, Projectile } from '../domain/model';
import {
  projectileVisual,
  HOSTILE_PROJECTILE_FRAMES,
  type ProjectileVisual,
} from '../domain/projectile-visual';
import projectileFrames from '../platform/projectile-frames.json';
import hostileFrames from '../platform/hostile-projectile-frames.json';

const projectileWidths: Record<ProjectileVisual, number> = {
  'bronze-dart': 30,
  'steel-needle': 34,
  'jade-needle': 34,
  'wind-blade': 44,
  'sword-wave': 44,
  'flying-sword': 54,
  arrow: 42,
  'returning-blade': 36,
  stone: 22,
  'poison-bomb': 27,
  'palm-wave': 64,
  'ice-bomb': 29,
  'fire-bomb': 29,
  'blood-orb': 29,
  'seal-bolt': 38,
  'spike-bomb': 29,
  'brew-pot': 29,
  'ice-shard': 38,
};

/** Reuses painted sprites; timing affects presentation only, not attack rules. */
export class PaintedEffects {
  private pool: Phaser.GameObjects.Image[] = [];
  private projectileInk: Phaser.GameObjects.Graphics;
  constructor(
    private scene: Phaser.Scene,
    public reducedMotion = false,
  ) {
    this.projectileInk = scene.add.graphics().setDepth(5002);
    for (const [key, cols] of [['painted-effects', 2]] as const) {
      const texture = scene.textures.get(key),
        source = texture.source[0];
      for (let row = 0; row < cols; row++)
        for (let col = 0; col < cols; col++) {
          const x = Math.round((col * source.width) / cols),
            y = Math.round((row * source.height) / cols);
          texture.add(
            `${row}-${col}`,
            0,
            x,
            y,
            Math.round(((col + 1) * source.width) / cols) - x,
            Math.round(((row + 1) * source.height) / cols) - y,
          );
        }
    }
    const hostile = scene.textures.get('hostile-projectiles');
    for (const [name, [x, y, w, h]] of Object.entries(hostileFrames))
      hostile.add(name, 0, x, y, w, h);
    const projectiles = scene.textures.get('painted-projectiles');
    for (const [name, [x, y, width, height]] of Object.entries(projectileFrames))
      projectiles.add(name, 0, x, y, width, height);
  }
  draw(effects: Effect[], projectiles: Projectile[], fighter?: Fighter) {
    this.projectileInk.clear();
    let used = 0;
    const sprite = (texture: string, frame: string) => {
      const image = this.pool[used] ?? this.scene.add.image(0, 0, texture, frame).setDepth(5001);
      this.pool[used++] = image;
      return image
        .setTexture(texture, frame)
        .setVisible(true)
        .setOrigin(0.5)
        .setFlipX(false)
        .setTint(0xffffff)
        .setDepth(5001);
    };
    for (const e of effects) {
      const duration = Math.min(
        e.duration,
        e.kind === 'hit' ? 0.16 : e.kind === 'guard' ? 0.42 : e.kind === 'burst' ? 0.38 : 0.27,
      );
      const age = e.duration - e.life;
      if (age >= duration) continue;
      const p = Math.max(0, Math.min(1, age / duration));
      const hostile = e.color === 0xd6513e;
      const alpha = Math.min(1, (1 - p) * 1.5) * (e.kind === 'guard' ? 0.7 : 0.95);
      if (e.kind === 'chain') {
        // Only a released physical chain, never a pre-attack aiming line or collision outline.
        const reach = e.radius * (1 - (this.reducedMotion ? 0 : p * 0.65));
        const links = Math.ceil(reach / 13);
        for (let n = 1; n < links; n++) {
          const d = n * 13;
          const sway = Math.sin((n / links) * Math.PI) * 8 * p;
          const x = e.x + Math.cos(e.angle) * d - Math.sin(e.angle) * sway;
          const y = e.y + Math.sin(e.angle) * d + Math.cos(e.angle) * sway;
          this.projectileInk.lineStyle(3, 0x292724, alpha * 0.9).strokeEllipse(x, y, 10, 7);
          this.projectileInk.lineStyle(1, 0xbeb8a9, alpha).strokeEllipse(x, y, 8, 5);
        }
        sprite('painted-stone', '__BASE')
          .setPosition(e.x + Math.cos(e.angle) * reach, e.y + Math.sin(e.angle) * reach)
          .setDisplaySize(22, 20)
          .setTint(0x8d969d)
          .setRotation(e.angle)
          .setAlpha(alpha);
        continue;
      }
      if (
        (e.weapon === 'gauntlet' || (!hostile && e.color === ARTS.shaolin.color)) &&
        (e.kind === 'thrust' || e.kind === 'slash')
      ) {
        // A compact fist contact flash; no long shaft or blade-shaped thrust for fist arts.
        const reach = 30 + Math.min(1, p * 4) * 26;
        sprite('painted-effects', '0-1')
          .setPosition(e.x + Math.cos(e.angle) * reach, e.y + Math.sin(e.angle) * reach - 25)
          .setDisplaySize(38, 32)
          .setAlpha(alpha)
          .setTint(0xe7c58e)
          .setRotation(e.angle);
        continue;
      }
      if (e.kind === 'thrust' && [ARTS.tang.color, ARTS.jegal.color].includes(e.color)) {
        // Keep the release flash short so the needle/wind blade remains the attack's silhouette.
        const dx = Math.cos(e.angle),
          dy = Math.sin(e.angle);
        this.projectileInk
          .lineStyle(2, e.color, alpha)
          .lineBetween(e.x + dx * 18, e.y + dy * 18, e.x + dx * 34, e.y + dy * 34);
        continue;
      }
      const wudang = e.color === ARTS.wudang.color;
      const frame =
        e.kind === 'hit'
          ? '0-1'
          : e.kind === 'guard'
            ? '1-0'
            : e.kind === 'burst'
              ? '1-1'
              : wudang
                ? '1-0'
                : '0-0';
      const tint = hostile
        ? 0xff9b76
        : e.kind === 'hit'
          ? 0xffffff
          : [16, 8, 0].reduce(
              (value, shift) =>
                value | (Math.round((((e.color >> shift) & 0xff) + 255) / 2) << shift),
              0,
            );
      const image = sprite('painted-effects', frame)
        .setPosition(e.x, e.y)
        .setAlpha(alpha)
        .setTint(tint);
      if (e.kind === 'slash') {
        const size = e.radius * 1.65;
        const sweep = this.reducedMotion ? 0 : 0.42 * (1 - Math.pow(1 - p, 3));
        const x = e.x + Math.cos(e.angle) * e.radius * 0.34;
        const y = e.y + Math.sin(e.angle) * e.radius * 0.34;
        image
          .setPosition(x, y)
          .setDisplaySize(size, size * 0.82)
          .setRotation(e.angle - 0.21 + sweep);
        if (!hostile && e.color !== ARTS.samja.color) {
          const ink = this.projectileInk;
          const radius = e.radius * 0.58;
          ink.lineStyle(4, e.color, alpha * 0.84);
          ink
            .beginPath()
            .arc(x, y, radius, e.angle - 0.72 + sweep, e.angle + 0.72 + sweep, false)
            .strokePath();
          if (e.color === ARTS.huashan.color) {
            ink.fillStyle(e.color, alpha * 0.9);
            for (let n = -1; n <= 1; n++) {
              const a = e.angle + 0.58 + n * 0.18 + sweep;
              ink.fillEllipse(x + Math.cos(a) * radius, y + Math.sin(a) * radius, 8, 5);
            }
          }
        }
      } else if (e.kind === 'hit') {
        const size = Math.max(24, Math.min(36, e.radius * 1.2));
        image.setDisplaySize(size, size).setRotation(e.angle);
      } else if (e.kind === 'thrust' || e.kind === 'arrow') {
        const size = Math.max(115, e.radius * 1.08);
        image
          .setPosition(e.x + Math.cos(e.angle) * size * 0.38, e.y + Math.sin(e.angle) * size * 0.38)
          .setDisplaySize(size * 1.25, size * 0.75)
          .setRotation(e.angle);
        if (e.kind === 'thrust' && !hostile) {
          const dx = Math.cos(e.angle),
            dy = Math.sin(e.angle),
            start = 24,
            end = e.radius * 0.94;
          this.projectileInk
            .lineStyle(8, 0x24332e, alpha * 0.7)
            .lineBetween(e.x + dx * start, e.y + dy * start, e.x + dx * end, e.y + dy * end);
          this.projectileInk
            .lineStyle(4, e.color, alpha)
            .lineBetween(e.x + dx * start, e.y + dy * start, e.x + dx * end, e.y + dy * end);
        }
      } else {
        const size = e.radius * (e.kind === 'guard' ? 1.4 : 1.45);
        image.setDisplaySize(size, size * (e.kind === 'guard' ? 0.9 : 0.62)).setRotation(0);
        if (e.kind === 'guard') image.setY(e.y - 22);
      }
    }
    for (const p of projectiles) {
      if ((p.delay ?? 0) > 0) continue;
      const visual = projectileVisual(p);
      const angle = Math.atan2(p.vy, p.vx);
      const width = projectileWidths[visual] * (p.visualScale ?? 1);
      const stone = this.scene.textures.get('painted-stone').source[0];
      const special = visual in HOSTILE_PROJECTILE_FRAMES;
      const bomb = this.scene.textures.get('hostile-projectiles').get(visual);
      const frame =
        visual === 'stone'
          ? [0, 0, stone.width, stone.height]
          : special
            ? [0, 0, bomb.width, bomb.height]
            : visual === 'palm-wave'
              ? [0, 0, 1, 1]
              : projectileFrames[visual as keyof typeof projectileFrames];
      // Short warm trails distinguish hostile shots without covering the battlefield.
      const dx = Math.cos(angle),
        dy = Math.sin(angle);
      this.projectileInk
        .lineStyle(p.friendly ? 2 : 3, p.friendly ? 0xe6e8d5 : 0xf28a63, 0.8)
        .lineBetween(
          p.x - dx * width * 0.65,
          p.y - dy * width * 0.65,
          p.x - dx * width * 0.2,
          p.y - dy * width * 0.2,
        );
      sprite(
        visual === 'stone'
          ? 'painted-stone'
          : special
            ? 'hostile-projectiles'
            : visual === 'palm-wave'
              ? 'boss-mechanics'
              : 'painted-projectiles',
        visual === 'palm-wave' ? '11' : visual === 'stone' ? '__BASE' : visual,
      )
        .setPosition(
          p.x,
          p.y -
            (p.landing && !this.reducedMotion
              ? Math.sin(Math.PI * Math.min(1, p.life / 0.65)) * 55
              : 0),
        )
        .setDisplaySize(width, (width * frame[3]) / frame[2])
        .setRotation(
          visual === 'returning-blade' && !this.reducedMotion
            ? this.scene.time.now / 95
            : visual === 'seal-bolt'
              ? angle - (Math.PI * 3) / 4
              : visual === 'ice-shard'
                ? angle + Math.PI / 4
                : special
                  ? 0
                  : angle,
        )
        .setAlpha(1)
        .setTint(
          p.landing?.kind === 'cold'
            ? 0xb8e9ff
            : visual === 'poison-bomb'
              ? 0xaac783
              : p.friendly
                ? 0xffffff
                : 0xffe5c8,
        )
        .setDepth(p.friendly ? 5001 : 5003);
    }
    if (fighter?.arts[fighter.active]?.id === 'samja' && fighter.arts[fighter.active].level >= 10) {
      for (let n = 0; n < 3; n++) {
        const angle = (this.reducedMotion ? 0 : this.scene.time.now / 850) + (n * Math.PI * 2) / 3;
        sprite('painted-projectiles', 'flying-sword')
          .setPosition(fighter.x + Math.cos(angle) * 55, fighter.y - 28 + Math.sin(angle) * 25)
          .setDisplaySize(
            35,
            (35 * projectileFrames['flying-sword'][3]) / projectileFrames['flying-sword'][2],
          )
          .setRotation(angle + Math.PI / 2)
          .setAlpha(0.75);
      }
    }
    for (let i = used; i < this.pool.length; i++) this.pool[i].setVisible(false);
  }
}
