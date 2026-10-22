import type Phaser from 'phaser';
import type { BoundFighter, WeaponStyle } from '../domain/model';
import { activeWeapon } from '../domain/inventory';
import { dedicatedItemArt, ITEM_ARTWORK } from '../platform/item-art';
import { rigPoint, type RigPose } from './directional-motion';
import type { CharacterFrame } from './character-sheet';
import type { ContinuousActor } from './continuous-actor';
import { registerEnemyMotion } from './enemy-motion';
import { SINGLE_WEAPON_FRAMES, WEAPON_GRIPS, weaponAngle } from './weapon-grips';
import type { MotionAction } from './directional-motion';
import { bladeSmear } from './blade-smear';
import { bladeProjection } from './blade-motion';
import { authoredBladeRibbon, heroWeaponPose, type HeroWeaponPose } from './hero-weapon-poses';
import { PLAYER_VISUAL_SCALE } from './player-visual';

// Authored hand anchors in the unarmed sheet, normalized within each cell.
const hands: Record<number, number[][]> = {
  0: [
    [0.76, 0.68],
    [0.71, 0.66],
    [0.69, 0.69],
    [0.19, 0.64],
    [0.18, 0.64],
    [0.2, 0.68],
    [0.7, 0.68],
    [0.71, 0.68],
  ],
  3: [
    [0.51, 0.27],
    [0.39, 0.25],
    [0.38, 0.33],
    [0.46, 0.23],
    [0.54, 0.26],
    [0.49, 0.28],
    [0.65, 0.25],
    [0.53, 0.24],
  ],
  4: [
    [0.83, 0.43],
    [0.5, 0.68],
    [0.68, 0.68],
    [0.39, 0.64],
    [0.08, 0.48],
    [0.17, 0.51],
    [0.64, 0.44],
    [0.72, 0.52],
  ],
};
const lengths: Record<WeaponStyle, number> = {
  sword: 56,
  dao: 54,
  staff: 86,
  fan: 32,
  dart: 19,
  gauntlet: 18,
};

/** Equipment is separate from the body, so switching/binding cannot leave a baked-in sword. */
export class HeldWeapon {
  readonly image: Phaser.GameObjects.Image;
  readonly smear: Phaser.GameObjects.Graphics;
  constructor(private scene: Phaser.Scene) {
    this.image = scene.add.image(0, 0, 'hero').setVisible(false);
    this.smear = scene.add.graphics().setVisible(false);
    for (const [key, columns] of [
      ['held-darts', 4],
      ['held-gauntlets', 5],
    ] as const)
      if (scene.textures.exists(key)) registerEnemyMotion(scene.textures.get(key), [0], columns);
    for (const [id, art] of Object.entries(ITEM_ARTWORK)) {
      const key = `held-${id}`;
      if (scene.textures.exists(key))
        scene.textures.get(key).add('held', 0, ...(art.bounds as [number, number, number, number]));
    }
  }
  draw(
    f: BoundFighter,
    body: Phaser.GameObjects.Image,
    row: number,
    direction: number,
    pose: RigPose,
    dead: boolean,
    surface?: ContinuousActor,
  ) {
    this.smear.clear().setVisible(false);
    const item = activeWeapon(f);
    const art = dedicatedItemArt(item);
    const single = art && SINGLE_WEAPON_FRAMES[art.id];
    const key = single?.texture ?? (art ? `held-${art.id}` : '');
    if (!item || !art || !this.scene.textures.exists(key) || dead) {
      this.image.setVisible(false);
      return;
    }
    const style = item.weaponStyle ?? 'sword';
    const authored = body.getData('heldWeaponPose') as HeroWeaponPose | undefined;
    const override = authored?.hand ?? (body.getData('heldHand') as [number, number] | undefined);
    const [sourceX, hy] = override ?? (hands[row] ?? hands[0])[direction];
    const hx = override && body.flipX ? 1 - sourceX : sourceX;
    const cell = override ? undefined : (body.getData('sourceCell') as CharacterFrame | undefined);
    const uvX = cell ? (cell.nominalX + hx * cell.nominalWidth - cell.left) / cell.width : hx;
    const uvY = cell ? (cell.nominalY + hy * cell.nominalHeight - cell.top) / cell.height : hy;
    const hand = surface ? undefined : rigPoint(uvX, uvY, pose, direction);
    const local = surface?.localPoint(uvX, uvY) ?? {
      x: (hand!.x - body.originX) * body.displayWidth,
      y: (hand!.y - body.originY) * body.displayHeight,
    };
    const { x, y } = local;
    const c = Math.cos(body.rotation),
      s = Math.sin(body.rotation);
    const frameName = single?.frame ?? 'held';
    const frame = this.scene.textures.get(key).get(frameName);
    const width = frame.cutWidth,
      height = frame.cutHeight;
    const length = lengths[style] * PLAYER_VISUAL_SCALE;
    const grip = single?.grip ?? WEAPON_GRIPS[art.id];
    if (!grip) {
      this.image.setVisible(false);
      return;
    }
    const action = (body.getData('motionAction') ?? 'idle') as MotionAction;
    const progress = body.getData('motionProgress') ?? 0;
    const motionProgress = body.getData('motionReduced')
      ? action === 'windup' || action === 'recover'
        ? 1
        : 0.5
      : progress;
    const angle = authored?.angle ?? weaponAngle(style, f.facing, action, motionProgress);
    const projected =
      !authored &&
      (style === 'sword' || style === 'dao') &&
      ['windup', 'strike', 'recover'].includes(action)
        ? bladeProjection(f.facing, action, motionProgress)
        : undefined;
    const bladeLengthScale = authored?.lengthScale ?? projected?.lengthScale ?? 1;
    // Fans open upwards; blades/needles and glove knuckles point down in their source.
    const rotation = angle - (style === 'fan' ? -Math.PI / 2 : Math.PI / 2) + body.rotation;
    this.image
      .setTexture(key, frameName)
      .setVisible(true)
      .setDisplaySize(
        (width / Math.max(width, height)) * length * (authored?.spread ?? 1),
        (height / Math.max(width, height)) * length * bladeLengthScale,
      )
      .setOrigin(grip[0], grip[1])
      .setPosition(body.x + x * c - y * s, body.y + x * s + y * c)
      .setRotation(rotation)
      .setDepth(body.depth + (authored?.layer ?? (direction >= 5 ? -1 : 1)) * 0.1)
      .setAlpha(body.alpha * (authored?.opacity ?? 1))
      .setTint(body.tintTopLeft)
      .setData({
        itemId: item.id,
        artId: art.id,
        style,
        direction,
        row,
        action,
        progress,
        handUV: [uvX, uvY],
        grip,
        bladeLengthScale,
        authoredPose: authored?.key,
      });
    const exposure = body.getData('attackExposure') as number;
    const reduced = !!body.getData('motionReduced');
    const radius = (height / Math.max(width, height)) * length * (1 - grip[1]);
    const ribbons = authored
      ? !reduced &&
        (f.action === 'attack' || f.action === 'ultimate') &&
        (style === 'sword' || style === 'dao') &&
        (exposure === 2 || exposure === 3)
        ? authoredBladeRibbon(
            heroWeaponPose(f.appearance ?? 0, style, direction, 'attack', exposure - 1),
            authored,
            { x: this.image.x, y: this.image.y },
            radius,
            body.rotation,
          )
        : []
      : bladeSmear(
          style,
          f.facing,
          action,
          motionProgress,
          { x: this.image.x, y: this.image.y },
          radius,
          body.rotation,
          body.getData('motionReduced'),
        );
    this.image.setData('bladeRibbons', ribbons);
    if (ribbons.length) {
      this.smear.setVisible(true).setDepth(this.image.depth - 0.02);
      for (const ribbon of ribbons) {
        this.smear.fillStyle(style === 'dao' ? 0xffe6b2 : 0xf5f6ee, ribbon.alpha * body.alpha);
        this.smear.beginPath();
        this.smear.moveTo(ribbon.points[0].x, ribbon.points[0].y);
        for (const point of ribbon.points.slice(1)) this.smear.lineTo(point.x, point.y);
        this.smear.closePath().fillPath();
      }
    }
    this.image.setData('smearSegments', ribbons.length);
  }
  destroy() {
    this.image.destroy();
    this.smear.destroy();
  }
}
