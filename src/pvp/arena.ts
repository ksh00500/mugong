import Phaser from 'phaser';
import type { CombatWorld } from './model';
export interface ArenaClient {
  getSnapshot(): {
    seat: number;
    connected: boolean;
    room: {
      seats: readonly (null | { name: string; preset: PresetId; ack: number })[];
      match: (CombatWorld & { id: string; tick: number; phase: string }) | null;
    } | null;
  };
}
export interface RaidArtwork {
  preload(scene: Phaser.Scene): void;
  create(scene: Phaser.Scene): void;
  draw(
    scene: Phaser.Scene,
    image: Phaser.GameObjects.Image,
    label: Phaser.GameObjects.Text,
    g: Phaser.GameObjects.Graphics,
    world: CombatWorld,
    reduced: boolean,
  ): void;
}
import type { PvpControls } from './controls';
import { PVP_RULES as R, PVP_PRESETS, pvpFighter } from './rules';
import { registerEnemyMotion, type MotionFrame } from '../game/enemy-motion';
import { HeldWeapon } from '../game/held-weapon';
import { heroDirection } from '../game/hero-directions';
import { heroWeaponPose, heroAttackExposure } from '../game/hero-weapon-poses';
import { heroSlashGrip } from '../game/hero-slash';
import { directionIndex, sampleRig } from '../game/directional-motion';
import { activeWeapon } from '../domain/inventory';
import { ITEM_ARTWORK } from '../platform/item-art';
import type { PresetId, Seat } from './model';
import type { BoundFighter } from '../domain/model';
class Arena extends Phaser.Scene {
  private frames = new Map<string, Map<string, MotionFrame>>();
  private actors: Phaser.GameObjects.Image[] = [];
  private weapons: HeldWeapon[] = [];
  private labels: Phaser.GameObjects.Text[] = [];
  private g!: Phaser.GameObjects.Graphics;
  private numbers = new Map<number, Phaser.GameObjects.Text>();
  private reduced = false;
  private loadFailed = false;
  constructor(
    private client: ArenaClient,
    private controls: PvpControls,
    private ready: () => void,
    private fail: () => void,
    private progress: (v: number) => void,
    private raidArt?: RaidArtwork,
  ) {
    super('biwu');
  }
  preload() {
    this.raidArt?.preload(this);
    this.load.image('arena', '/art/regions-v1/1-floor.webp');
    for (const sheet of [0, 1]) {
      this.load.image(`directions-${sheet}`, `/art/hero-roster-v1/directions-${sheet}.webp`);
      this.load.image(`actions-${sheet}`, `/art/hero-roster-v1/actions-${sheet}.webp`);
    }
    for (let appearance = 0; appearance < 10; appearance++)
      this.load.image(`slash-${appearance}`, `/art/hero-slash-v1/hero-${appearance}.webp`);
    const items = Object.keys(PVP_PRESETS).flatMap(
      (p) => pvpFighter(p as PresetId, 0, '비무').items,
    );
    const personalItems =
      this.client
        .getSnapshot()
        .room?.seats.flatMap((p) => (p as { fighter?: BoundFighter })?.fighter?.items ?? []) ?? [];
    for (const id of new Set(
      [...items, ...personalItems].map((i) => i.templateId!).filter((id) => !!ITEM_ARTWORK[id]),
    ))
      this.load.image(`held-${id}`, ITEM_ARTWORK[id].src);
    this.load.image('held-darts', '/art/held-darts-v1.webp');
    this.load.image('held-gauntlets', '/art/held-gauntlets-v1.webp');
    this.load.on('progress', this.progress);
    this.load.on('loaderror', () => {
      this.loadFailed = true;
      this.fail();
    });
  }
  create() {
    if (this.loadFailed) return;
    const placeholder = this.add.graphics().fillStyle(0xffffff).fillRect(0, 0, 2, 2);
    placeholder.generateTexture('hero', 2, 2);
    placeholder.destroy();
    for (const sheet of [0, 1]) {
      this.frames.set(
        `directions-${sheet}`,
        registerEnemyMotion(this.textures.get(`directions-${sheet}`), [0, 1, 2, 3, 4], 8, false),
      );
      this.frames.set(
        `actions-${sheet}`,
        registerEnemyMotion(this.textures.get(`actions-${sheet}`), [0, 1, 2, 3, 4], 6),
      );
    }
    for (let appearance = 0; appearance < 10; appearance++)
      this.frames.set(
        `slash-${appearance}`,
        registerEnemyMotion(this.textures.get(`slash-${appearance}`), [0, 1, 2], 5, false),
      );
    this.add
      .image(R.width / 2, R.height / 2, 'arena')
      .setDisplaySize(R.width, R.height)
      .setAlpha(0.9);
    this.raidArt?.create(this);
    this.g = this.add.graphics().setDepth(1000);
    for (let seat = 0; seat < (this.raidArt ? 5 : 2); seat++) {
      this.actors.push(this.add.image(0, 0, 'hero'));
      this.weapons.push(new HeldWeapon(this));
      this.labels.push(
        this.add
          .text(0, 0, '', {
            fontFamily: 'sans-serif',
            fontSize: '15px',
            color: seat === 0 ? '#d5fbff' : '#ffe3c7',
            backgroundColor: '#16271dd9',
            padding: { x: 5, y: 2 },
          })
          .setOrigin(0.5, 1)
          .setDepth(1001),
      );
    }
    this.input.mouse?.disableContextMenu();
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const v = this.client.getSnapshot(),
        f = v.room?.match?.players[v.seat].fighter;
      if (!f) return;
      const w = this.cameras.main.getWorldPoint(p.x, p.y);
      this.controls.input.aim = Math.atan2(w.y - (f.y - 34), w.x - f.x);
    });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const v = this.client.getSnapshot(),
        f = v.room?.match?.players[v.seat].fighter;
      if (!f) return;
      const w = this.cameras.main.getWorldPoint(p.x, p.y);
      this.controls.input.aim = Math.atan2(w.y - (f.y - 34), w.x - f.x);
      if (p.rightButtonDown()) this.controls.action('ultimate');
      if (p.leftButtonDown()) {
        this.controls.input.attack = true;
        this.controls.flush();
      }
    });
    const up = () => {
      this.controls.input.attack = false;
      this.controls.flush();
    };
    window.addEventListener('pointerup', up);
    const media = window.matchMedia('(prefers-reduced-motion: reduce)'),
      motion = () => {
        this.reduced = media.matches;
      };
    motion();
    media.addEventListener('change', motion);
    this.events.once('shutdown', () => {
      window.removeEventListener('pointerup', up);
      media.removeEventListener('change', motion);
    });
    this.ready();
  }
  private actor(f: BoundFighter, seat: number, x: number, y: number) {
    const appearance = f.appearance ?? 0,
      sheet = Math.floor(appearance / 5),
      slot = appearance % 5,
      dir = directionIndex(f.facing),
      style = activeWeapon(f)?.weaponStyle ?? 'sword';
    const dirs = this.frames.get(`directions-${sheet}`)!,
      actions = this.frames.get(`actions-${sheet}`)!,
      base = dirs.get(`${slot}-2`)!;
    const moving = f.action === 'walk',
      striking = f.action === 'attack' || f.action === 'ultimate';
    let placement = heroWeaponPose(appearance, style, dir, 'direction'),
      source = dirs.get(`${slot}-${heroDirection(appearance, dir).view}`)!,
      flip = heroDirection(appearance, dir).flip;
    let exposure = 0;
    if (striking) {
      const age =
        f.action === 'ultimate' ? ((0.6 - f.actionTime) * 0.28) / 0.6 : 0.28 - f.actionTime;
      exposure = heroAttackExposure(age);
      placement = heroWeaponPose(appearance, style, dir, 'attack', exposure);
      if (placement.row >= 0) {
        source = this.frames.get(`slash-${appearance}`)!.get(`${placement.row}-${placement.view}`)!;
        flip = placement.flip;
      }
    } else if (f.action === 'defense' && dir < 5) {
      placement = heroWeaponPose(appearance, style, dir, 'actions', 2);
      source = actions.get(`${slot}-2`)!;
      flip = dir === 3 || dir === 4;
    }
    if (f.hp <= 0) {
      placement = heroWeaponPose(appearance, style, dir, 'actions', 5);
      source = actions.get(`${slot}-5`)!;
      flip = dir === 3 || dir === 4 || dir === 5;
    }
    const scale = ((110 * base.bodyUnit) / base.height / source.bodyUnit) * 0.7,
      body = this.actors[seat];
    body
      .setVisible(true)
      .setTexture(
        source.texture,
        f.hp <= 0
          ? `${slot}-5`
          : striking && placement.row >= 0
            ? `${placement.row}-${placement.view}`
            : f.action === 'defense' && dir < 5
              ? `${slot}-2`
              : `${slot}-${heroDirection(appearance, dir).view}`,
      )
      .setFlipX(flip)
      .setDisplaySize(source.width * scale, source.height * scale)
      .setOrigin(flip ? 1 - source.footX : source.footX, source.originY)
      .setPosition(x, y + (moving && !this.reduced ? Math.sin(this.time.now * 0.015) * 1.5 : 0))
      .setDepth(y)
      .setAlpha(f.invulnerable > 0 ? 0.7 : 1)
      .setData('heldWeaponPose', placement)
      .setData('attackExposure', exposure)
      .setData('motionReduced', this.reduced);
    if (striking && placement.row >= 0)
      body.setData('heldHand', heroSlashGrip(appearance, placement.row, placement.view));
    this.weapons[seat].draw(f, body, 0, dir, sampleRig('idle', 0, 0, 0, true), f.hp <= 0);
    this.labels[seat]
      .setText(f.name)
      .setPosition(x, y - 83)
      .setVisible(true);
    this.g
      .lineStyle(
        2,
        seat === this.client.getSnapshot().seat ? 0x86eeec : this.raidArt ? 0xb6e4b6 : 0xffb799,
        0.9,
      )
      .strokeEllipse(x, y + 4, 42, 13);
  }
  update(_time: number, delta: number) {
    if (!this.g) return;
    const v = this.client.getSnapshot(),
      room = v.room,
      m = room?.match;
    this.g.clear();
    for (let seat = 0; seat < (this.raidArt ? 5 : 2); seat++) {
      const p =
        seat === 4 && m
          ? { name: m.players[4].fighter.name, preset: 'monk' as PresetId, ack: -1 }
          : room?.seats[seat];
      if (!p || m?.players[seat].inactive) {
        this.actors[seat].setVisible(false);
        this.weapons[seat].image.setVisible(false);
        this.labels[seat].setVisible(false);
        continue;
      }
      if (seat === 4 && m && this.raidArt) {
        this.raidArt.draw(this, this.actors[4], this.labels[4], this.g, m, this.reduced);
        continue;
      }
      const f =
        m?.players[seat].fighter ??
        (p as { fighter?: BoundFighter }).fighter ??
        pvpFighter(p.preset, seat === 1 ? 1 : 0, p.name);
      const position =
        seat === v.seat && m?.phase === 'fighting' && v.connected
          ? this.controls.position(f, m.tick, p.ack)
          : { x: f.x, y: f.y };
      this.actor(f, seat, position.x, position.y);
      if (m && m.players[seat].hurt > 0) this.actors[seat].setTint(0xffb2a0);
      else this.actors[seat].clearTint();
    }
    this.g
      .lineStyle(2, 0xe6d29b, 0.32)
      .strokeRect(R.left, R.top, R.right - R.left, R.bottom - R.top);
    for (const at of m?.attacks ?? []) {
      const color = at.owner === v.seat || (this.raidArt && at.owner < 4) ? 0x8ce7ed : 0xff8e6a;
      if (at.shape === 'shot' && at.delay > 0) {
        if (this.raidArt && at.owner === 4)
          this.g
            .lineStyle(3, color, 0.6)
            .lineBetween(
              at.x,
              at.y,
              at.x + Math.cos(at.angle) * 650,
              at.y + Math.sin(at.angle) * 650,
            );
        continue;
      }
      if (at.shape === 'shot' && at.delay <= 0) {
        this.g.fillStyle(color, 0.95).fillCircle(at.x, at.y, at.radius);
        this.g
          .lineStyle(3, color, 0.45)
          .lineBetween(at.x - Math.cos(at.angle) * 30, at.y - Math.sin(at.angle) * 30, at.x, at.y);
      } else if (at.shape === 'burst') {
        this.g.lineStyle(at.delay > 0 ? 2 : 5, color, 0.65).strokeCircle(at.x, at.y, at.range);
      } else {
        const f = m!.players[at.owner].fighter;
        this.g.lineStyle(at.delay > 0 ? 2 : 5, color, 0.85);
        this.g.beginPath();
        this.g.arc(at.x, at.y, at.range, at.angle - at.arc, at.angle + at.arc);
        this.g.strokePath();
      }
    }
    const present = new Set<number>();
    for (const e of m?.effects ?? []) {
      if (e.kind !== 'hit') {
        this.g
          .lineStyle(3, e.kind === 'guard' ? 0xffe2a2 : 0x9ee8eb, e.life / 0.42)
          .strokeCircle(e.x, e.y, e.kind === 'ultimate' ? 70 : 30);
        continue;
      }
      present.add(e.id);
      let text = this.numbers.get(e.id);
      if (!text) {
        text = this.add
          .text(e.x, e.y - 20, `−${e.amount}`, {
            fontFamily: 'sans-serif',
            fontSize: '22px',
            fontStyle: 'bold',
            color: '#fff3dc',
            stroke: '#4f261b',
            strokeThickness: 2,
          })
          .setOrigin(0.5)
          .setDepth(1200);
        this.numbers.set(e.id, text);
      }
      text
        .setAlpha(e.life / 0.42)
        .setPosition(e.x, e.y - 20 - (this.reduced ? 0 : (0.42 - e.life) * 55));
    }
    for (const [id, text] of this.numbers)
      if (!present.has(id)) {
        text.destroy();
        this.numbers.delete(id);
      }
  }
}
export function mountPvpArena(
  parent: HTMLElement,
  client: ArenaClient,
  controls: PvpControls,
  onReady: () => void,
  onError: () => void,
  onProgress: (v: number) => void,
  raidArt?: RaidArtwork,
) {
  const game = new Phaser.Game({
    type: Phaser.CANVAS,
    parent,
    width: R.width,
    height: R.height,
    backgroundColor: '#213427',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [new Arena(client, controls, onReady, onError, onProgress, raidArt)],
    audio: { noAudio: true },
    banner: false,
    render: { antialias: true },
  });
  return () => game.destroy(true);
}
