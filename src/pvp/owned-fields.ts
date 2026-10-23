import type Phaser from 'phaser';
import type { CombatWorld } from './model';

/** Actual owned-fighter fields only. No aim, landing or attack-range previews. */
export class OwnedFields {
  private images: Phaser.GameObjects.Image[] = [];
  constructor(private scene: Phaser.Scene) {}
  draw(world: CombatWorld | null | undefined, reduced: boolean) {
    let used = 0;
    const show = (frame: number, x: number, y: number, diameter: number, alpha: number) => {
      if (used >= 32) return;
      const image = this.images[used] ?? this.scene.add.image(0, 0, 'owned-fields');
      this.images[used++] = image;
      image
        .setTexture('owned-fields', String(frame))
        .setPosition(x, y)
        .setDepth(-1)
        .setDisplaySize(diameter, diameter)
        .setAlpha(alpha)
        .setVisible(true);
    };
    const phase = (world as (CombatWorld & { phase?: string }) | null | undefined)?.phase;
    if (phase === undefined || phase === 'fighting') {
      for (const actor of world?.players ?? []) {
        if (!actor.personal || actor.inactive || actor.fighter.hp <= 0) continue;
        for (const node of actor.ownedFormations ?? []) {
          if (node.life <= 0) continue;
          const pulse =
            !reduced && (node.pulses ?? 0) > 0 ? Math.max(0, (node.pulse - 0.48) / 0.22) : 0;
          show(
            node.kind === 'earth' ? 3 : 2,
            node.x,
            node.y,
            210,
            Math.min(0.52 + pulse * 0.12, node.life * 0.52),
          );
        }
      }
      for (const effect of world?.effects ?? [])
        if (effect.kind === 'poison-burst')
          show(
            1,
            effect.x,
            effect.y,
            reduced ? 100 : 100 + (1 - Math.pow(effect.life / 0.42, 3)) * 30,
            Math.min(0.8, effect.life / 0.42),
          );
    }
    for (let i = used; i < this.images.length; i++) this.images[i].setVisible(false);
  }
}
