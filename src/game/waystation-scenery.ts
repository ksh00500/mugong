import type Phaser from 'phaser';
import type { Run } from '../domain/model';
import { W, H } from '../domain/content';
import {
  isWalkablePreparation,
  nearestWaystationStop,
  WAYSTATION_STOPS,
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
    this.combatBackdrop.setVisible(!active);
    this.background?.setVisible(active);
    for (const figure of this.figures.values()) figure.setVisible(false);
    if (!active || !run) return;
    this.load();
    const g = this.floor;
    if (!this.background) g.fillStyle(0xd4c6a0).fillRect(0, 0, W, H);
    const near = nearestWaystationStop(run.fighter);
    for (const stop of WAYSTATION_STOPS) {
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
