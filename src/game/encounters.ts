import type Phaser from 'phaser';
import type { Run } from '../domain/model';

/** Physical restraints and destructible health remain; no collision rings or aim previews. */
export function drawEncounters(
  ground: Phaser.GameObjects.Graphics,
  markers: Phaser.GameObjects.Graphics,
  run: Run,
) {
  if (run.phase !== 'combat') return;
  for (const object of run.encounterObjects ?? []) {
    if (object.life <= 0) continue;
    const warning = object.warning > 0;
    if (
      (object.kind === 'tether' || object.mechanic === 'exchange') &&
      !warning &&
      object.mechanic !== 'grab'
    ) {
      // The live chain is an actual restraint, not the path of an upcoming shot.
      ground
        .lineStyle(6, 0x302a26, 0.65)
        .lineBetween(object.x, object.y, run.fighter.x, run.fighter.y);
      ground
        .lineStyle(2, 0x9d9485, 0.85)
        .lineBetween(object.x, object.y, run.fighter.x, run.fighter.y);
    }
    if (object.maxHp > 0 && object.hp > 0 && !warning) {
      markers.fillStyle(0x29271e, 0.9).fillRoundedRect(object.x - 22, object.y - 67, 44, 5, 2);
      markers
        .fillStyle(0xdac484, 1)
        .fillRoundedRect(object.x - 22, object.y - 67, (44 * object.hp) / object.maxHp, 5, 2);
    }
  }
}
