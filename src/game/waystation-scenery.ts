import type Phaser from 'phaser';
import type { Run } from '../domain/model';
import { W, H } from '../domain/content';
import {
  isWalkablePreparation,
  nearestWaystationStop,
  waystationStops,
  waystationTheme,
} from '../domain/waystation';
import { prepareImages } from '../platform/assets';
import { WAYSTATION_ART } from '../platform/waystation-art';
import sizes from '../platform/waystation-art-sizes.json';
import { gameStore } from '../platform/store';

export class WaystationScenery {
  private requested = false;
  private disposed = false;
  private figures = new Map<string, Phaser.GameObjects.Image>();
  private background?: Phaser.GameObjects.Image;
  private floor: Phaser.GameObjects.Graphics;
  constructor(
    private scene: Phaser.Scene,
    private combatBackdrop: Phaser.GameObjects.Image,
  ) {
    this.floor = scene.add.graphics().setDepth(-900);
  }
  private load() {
    if (this.requested) return;
    this.requested = true;
    for (const [id, url] of Object.entries(WAYSTATION_ART)) {
      const key = `waystation-${id}`;
      void prepareImages({ [key]: url })
        .then((images) => {
          if (this.disposed) return;
          if (!this.scene.textures.exists(key)) this.scene.textures.addImage(key, images[key]);
          this.scene.game.canvas.parentElement?.setAttribute(`data-rest-${id}`, 'ready');
          if (id === 'courtyard') {
            const source = this.scene.textures.get(key).source[0];
            this.background = this.scene.add
              .image(W / 2, H / 2, key)
              .setScale(Math.max(W / source.width, H / source.height))
              .setDepth(-950);
          } else {
            const source = this.scene.textures.get(key).source[0];
            this.figures.set(
              id,
              this.scene.add
                .image(0, 0, key)
                .setOrigin(0.5, sizes[id as keyof typeof sizes].originY)
                .setDisplaySize((95 * source.width) / source.height, 95)
                .setInteractive({ useHandCursor: true })
                .on('pointerdown', () =>
                  gameStore.approachWaystation(id as 'physician' | 'merchant' | 'blacksmith'),
                ),
            );
          }
        })
        .catch(() => {
          if (!this.disposed)
            this.scene.game.canvas.parentElement?.setAttribute(`data-rest-${id}`, 'fallback');
          // Scenery never turns a playable rest into a loading/error barrier.
        });
    }
  }
  draw(run: Run | null) {
    this.floor.clear();
    const active = isWalkablePreparation(run);
    this.combatBackdrop.setVisible(!active || (run?.wave ?? 4) > 4);
    this.background?.setVisible(active && run?.wave === 4);
    for (const figure of this.figures.values()) figure.setVisible(false);
    if (!active || !run) return;
    this.load();
    const g = this.floor;
    const theme = waystationTheme(run);
    if (!this.background && run.wave === 4) g.fillStyle(0xd4c6a0).fillRect(0, 0, W, H);
    if (run.wave > 4) {
      g.fillStyle(theme.color, 0.22).fillRect(0, 0, W, H);
      g.fillStyle(0xe9ddbb, 0.35).fillRoundedRect(315, 425, 1300, 470, 65);
      g.lineStyle(3, theme.color, 0.9).strokeRoundedRect(315, 425, 1300, 470, 65);
      // A walkable common area on each already loaded regional map.
      for (let n = 0; n < 6; n++)
        g.fillStyle(theme.color, 0.35).fillEllipse(440 + n * 200, 650, 135, 35);
    }
    const near = nearestWaystationStop(run.fighter, run);
    for (const stop of waystationStops(run)) {
      const color =
        stop.id === 'exit'
          ? 0xe7c67b
          : stop.id === 'physician'
            ? 0x82af8d
            : stop.id === 'merchant'
              ? 0xc9a85b
              : 0xc08b67;
      g.fillStyle(0x233629, 0.23).fillEllipse(stop.x, stop.y + 3, 65, 20);
      g.lineStyle(
        near?.id === stop.id ? 4 : 2,
        color,
        near?.id === stop.id ? 1 : 0.6,
      ).strokeEllipse(stop.x, stop.y, stop.id === 'exit' ? 105 : 88, 34);
      if (stop.id === 'fortune') {
        g.fillStyle(0x27382e, 0.8).fillRoundedRect(stop.x - 25, stop.y - 45, 50, 42, 6);
        g.lineStyle(3, 0xefcf7e, 0.95).strokeRoundedRect(stop.x - 25, stop.y - 45, 50, 42, 6);
        g.lineBetween(stop.x, stop.y - 42, stop.x, stop.y - 8);
        g.fillStyle(0xefcf7e, 1).fillCircle(stop.x, stop.y - 28, 6);
        continue;
      }
      const figure = this.figures.get(stop.id);
      if (figure) figure.setPosition(stop.x, stop.y).setDepth(stop.y).setVisible(true);
      else if (stop.id !== 'exit') {
        g.fillStyle(color, 0.9)
          .fillCircle(stop.x, stop.y - 58, 16)
          .fillRoundedRect(stop.x - 20, stop.y - 40, 40, 40, 9);
      }
      if (stop.id === 'exit') {
        g.lineStyle(4, color, 1)
          .beginPath()
          .moveTo(stop.x - 24, stop.y - 30)
          .lineTo(stop.x + 24, stop.y - 30)
          .lineTo(stop.x + 11, stop.y - 43)
          .moveTo(stop.x + 24, stop.y - 30)
          .lineTo(stop.x + 11, stop.y - 17)
          .strokePath();
      }
    }
  }
  destroy() {
    this.disposed = true;
    this.floor.destroy();
    this.background?.destroy();
    for (const figure of this.figures.values()) figure.destroy();
  }
}
