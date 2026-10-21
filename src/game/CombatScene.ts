import { pendingChoices } from '../domain/character';
import Phaser from 'phaser';
import { enemyPixelScale, enemyBarClearance, enemyHealthBarY } from './enemy-scale';
import { H, W } from '../domain/content';
import { STRIKE_TIMING, type CombatCue } from '../domain/combat';
import { enemyAttack } from '../domain/combat';
import type { BoundFighter, Enemy, Fighter, Run } from '../domain/model';
import { gameStore } from '../platform/store';
import { sound, unlockAudio } from '../platform/audio';
import { projectileSound } from '../platform/combat-sounds';
import { projectileVisual } from '../domain/projectile-visual';
import { PoseTransition } from './pose-transition';
import { PaintedEffects } from './effects';
import type { ImageProgress, PreparedImages } from '../platform/assets';
import { CombatFeedback } from './feedback';
import { regionName } from '../domain/campaign';
import { drawEncounters } from './encounters';
import { prepareImages } from '../platform/assets';
import {
  regionArtIndex,
  regionArtManifest,
  runArtKey,
  runArtManifest,
  enemyArtSlot,
  enemyRepairSlot,
  enemyMotionRepairSlots,
  enemyDirectionFlip,
  hostileIdentitySlot,
} from '../platform/region-art';
import { registerRegionAtlas } from './region-atlas';
import { hostileDrawingPose, hostileRecoil } from './hostile-pose';
import { isBossEnemy, enemySize, bossCombatPhase } from '../domain/boss-resilience';
import { BossReadability } from './boss-readability';
import { bossAttackTell } from './boss-tells';
import { registerEnemyMotion } from './enemy-motion';
import { ContinuousActor } from './continuous-actor';
import { MotionClock, MOTION_DIRECTIONS, sampleRig, type MotionAction } from './directional-motion';
import { heroDirection } from './hero-directions';
import { HeldWeapon } from './held-weapon';
import { heroAttackMotion, heroCutWeight } from './hero-attack-motion';
import { activeWeapon } from '../domain/inventory';
import { bladeTorsoRig } from './blade-motion';
import { heroSlashGrip } from './hero-slash';
import { heroAttackExposure, heroWeaponPose } from './hero-weapon-poses';
import { registerCavalry } from './cavalry';
import { PaintedZones } from './painted-zones';
import { hostileMotion, sampleHostileRig } from './hostile-motion';
import { registerCharacterSheet, type CharacterFrame } from './character-sheet';
import { authoredEnemyFrame, registerAuthoredEnemy, authoredEnemyArt } from './authored-enemy';
import { bossSpecialFrame, bossHealthClearance } from './boss-special';
import { bossMotionClock } from './boss-motion';
import { PLAYER_VISUAL_SCALE } from './player-visual';
import { HealthTrail } from './health-trail';
import { COMBAT_HEIGHT } from '../domain/combat-body';
import { isWalkablePreparation } from '../domain/waystation';
import { WaystationScenery } from './waystation-scenery';
import { CombatClarity, combatCrowding, COMBAT_LAYERS } from './combat-clarity';

export class CombatScene extends Phaser.Scene {
  private heroFrames = new Map<string, CharacterFrame>();
  private keys = new Set<string>();
  private actors = new Map<string, Phaser.GameObjects.Image>();
  private graphics!: Phaser.GameObjects.Graphics;
  private ground!: Phaser.GameObjects.Graphics;
  private paintedEffects!: PaintedEffects;
  private paintedZones!: PaintedZones;
  private clarity!: CombatClarity;
  private feedback!: CombatFeedback;
  private healthTrails = new Map<number, HealthTrail>();
  private bossReadability!: BossReadability;
  private cues: CombatCue[] = [];
  private aim = -Math.PI / 2;
  private left = false;
  private right = false;
  private attackPressed = false;
  private ultimatePressed = false;
  private defense = false;
  private accumulator = 0;
  private animationTime = 0;
  private lastLevel = 0;
  private wasDead = false;
  private feet = new Map<string, number>();
  private tops = new Map<string, number>();
  private footX = new Map<string, number>();
  private reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private activeRun = '';
  private stride = 0;
  private warned = new Set<number>();
  private backdrop!: Phaser.GameObjects.Image;
  private regionFrames = new Map<string, ReturnType<typeof registerRegionAtlas>>();
  private motionFrames = new Map<string, ReturnType<typeof registerEnemyMotion>>();
  private directionFrames = new Map<string, ReturnType<typeof registerEnemyMotion>>();
  private continuousActors = new Map<string, ContinuousActor>();
  private enemyClearances = new Map<string, number>();
  private motionClock = new MotionClock();
  private poseTransition = new PoseTransition();
  private heardProjectiles = new WeakSet<object>();
  private heroDeathAt = -1;
  private heldWeapon!: HeldWeapon;
  private cavalryFrames = new Map<
    number,
    {
      width: number;
      height: number;
      footX: number;
      originY: number;
      referenceHeight: number;
      bodyUnit: number;
    }
  >();
  private regionRequests = new Map<string, Promise<void>>();
  private artScope = '';
  private warmedArt = '';
  private cancelWarm?: () => void;
  private artRegion = -2;
  private artLoading = false;
  private requestedArt = '';
  private disposed = false;
  private seenAlive = new Map<number, Enemy>();
  private deaths = new Map<number, { enemy: Enemy; at: number }>();
  private renderWave = 0;
  private waystation!: WaystationScenery;
  constructor(
    private preparedImages: PreparedImages,
    private onReady: () => void,
    private onArtError: () => void,
    private onRegionProgress?: (progress: ImageProgress | null) => void,
  ) {
    super('combat');
  }
  preload() {
    for (const [key, image] of Object.entries(this.preparedImages)) {
      // The HUD atlas is prepared with the scene but painted by DOM, not WebGL.
      if (key !== 'hud-artwork') this.textures.addImage(key, image);
    }
  }
  create() {
    this.cameras.main.setZoom(this.scale.width / W).centerOn(W / 2, H / 2);
    this.backdrop = this.add
      .image(W / 2, H / 2, 'forest')
      .setDisplaySize(W, H)
      .setDepth(-1000);
    this.waystation = new WaystationScenery(this, this.backdrop);
    for (const key of Object.keys(this.preparedImages)) {
      // Registration matches exact texture keys from the authored frame data.
      // A region-name allowlist misses new action families and draws whole sheets.
      registerAuthoredEnemy(this.textures.get(key));
      if (key === 'cavalry-actions')
        this.motionFrames.set(key, registerEnemyMotion(this.textures.get(key), [0]));
      if (key === 'cavalry-rear')
        this.motionFrames.set(key, registerEnemyMotion(this.textures.get(key), [0], 4, false));
      if (key.startsWith('region-rear-'))
        this.motionFrames.set(
          key,
          registerEnemyMotion(this.textures.get(key), undefined, 4, false),
        );
      if (key === 'desert-cavalry') this.cavalryFrames = registerCavalry(this.textures.get(key));
      if (key.startsWith('region-actors-'))
        this.regionFrames.set(key, registerRegionAtlas(this.textures.get(key)));
      if (key.startsWith('region-motion-')) this.registerMotion(key);
      if (key.startsWith('region-direction-'))
        this.directionFrames.set(key, registerEnemyMotion(this.textures.get(key), undefined, 5));
    }
    if (this.textures.exists('enemy-role-directions'))
      this.directionFrames.set(
        'enemy-role-directions',
        registerEnemyMotion(this.textures.get('enemy-role-directions'), [0, 1, 2, 3], 5),
      );
    if (this.textures.exists('hostile-identity-directions'))
      this.directionFrames.set(
        'hostile-identity-directions',
        registerEnemyMotion(this.textures.get('hostile-identity-directions'), [0, 1, 2], 5),
      );
    if (this.textures.exists('hostile-identity-rear'))
      this.motionFrames.set(
        'hostile-identity-rear',
        registerEnemyMotion(this.textures.get('hostile-identity-rear'), [0, 1, 2], 4, false),
      );
    if (this.textures.exists('enemy-role-rear'))
      this.motionFrames.set(
        'enemy-role-rear',
        registerEnemyMotion(this.textures.get('enemy-role-rear'), [0, 1, 2, 3], 4, false),
      );
    this.syncRegion(gameStore.state.run);
    this.graphics = this.add.graphics().setDepth(COMBAT_LAYERS.status);
    this.ground = this.add.graphics().setDepth(0);
    this.paintedEffects = new PaintedEffects(this, this.reducedMotion);
    this.paintedZones = new PaintedZones(this);
    this.clarity = new CombatClarity(this);
    this.feedback = new CombatFeedback(this);
    this.bossReadability = new BossReadability(this, (id) =>
      this.actors.get(String(id))?.getData('healthBar'),
    );
    this.heldWeapon = new HeldWeapon(this);
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onMotion = () => {
      this.reducedMotion = motion.matches;
      this.paintedEffects.reducedMotion = motion.matches;
      if (motion.matches) this.feedback.resetCamera();
    };
    motion.addEventListener('change', onMotion);
    const props = this.textures.get('encounter-props'),
      propSource = props.source[0];
    for (let n = 0; n < 6; n++) {
      const w = propSource.width / 3,
        h = propSource.height / 2;
      props.add(String(n), 0, (n % 3) * w + 8, Math.floor(n / 3) * h + 8, w - 16, h - 16);
    }
    if (this.textures.exists('hostile-identity-actions'))
      this.motionFrames.set(
        'hostile-identity-actions',
        registerEnemyMotion(this.textures.get('hostile-identity-actions'), [0, 1, 2]),
      );
    if (this.textures.exists('enemy-role-actions'))
      this.motionFrames.set(
        'enemy-role-actions',
        registerEnemyMotion(this.textures.get('enemy-role-actions'), [0, 1, 2, 3]),
      );
    const mechanicTexture = this.textures.get('boss-mechanics');
    const mechanicSource = mechanicTexture.source[0];
    for (let n = 0; n < 12; n++) {
      const w = mechanicSource.width / 4,
        h = mechanicSource.height / 3;
      mechanicTexture.add(String(n), 0, (n % 4) * w, Math.floor(n / 4) * h, w, h);
    }
    const fields = this.textures.get('boss-fields'),
      fieldSource = fields.source[0];
    for (let n = 0; n < 8; n++) {
      const w = fieldSource.width / 4,
        h = fieldSource.height / 2;
      fields.add(String(n), 0, (n % 4) * w, Math.floor(n / 4) * h, w, h);
    }
    for (const [key, cols, rows] of [['enemy', 3, 4]] as const) {
      if (!this.textures.exists(key)) continue;
      const texture = this.textures.get(key),
        source = texture.source[0];
      const inspection = document.createElement('canvas');
      inspection.width = source.width;
      inspection.height = source.height;
      const context = inspection.getContext('2d', { willReadFrequently: true })!;
      context.drawImage(source.image as HTMLImageElement, 0, 0);
      const pixels = context.getImageData(0, 0, source.width, source.height).data;
      for (let row = 0; row < rows; row++)
        for (let col = 0; col < cols; col++) {
          const x = Math.round((col * source.width) / cols),
            y = Math.round((row * source.height) / rows);
          const w = Math.round(((col + 1) * source.width) / cols) - x,
            h = Math.round(((row + 1) * source.height) / rows) - y;
          texture.add(`${row}-${col}`, 0, x, y, w, h);
          let foot = h - 1;
          for (let py = h - 1; py >= 0; py--) {
            let opaque = 0;
            for (let px = 0; px < w; px++)
              if (pixels[((y + py) * source.width + x + px) * 4 + 3] > 128) opaque++;
            if (opaque >= 3) {
              foot = py;
              break;
            }
          }
          this.feet.set(`${key}/${row}-${col}`, (foot + 1) / h);
          let top = 0;
          for (let py = 0; py <= foot; py++) {
            let opaque = 0;
            for (let px = 0; px < w; px++)
              if (pixels[((y + py) * source.width + x + px) * 4 + 3] > 128) opaque++;
            if (opaque >= 3) {
              top = py;
              break;
            }
          }
          this.tops.set(`${key}/${row}-${col}`, top / h);
          let sum = 0,
            count = 0;
          for (let py = Math.max(top, foot - Math.round(h * 0.02)); py <= foot; py++)
            for (let px = 0; px < w; px++)
              if (pixels[((y + py) * source.width + x + px) * 4 + 3] > 128) {
                sum += px;
                count++;
              }
          this.footX.set(`${key}/${row}-${col}`, count ? sum / count / w : 0.5);
        }
    }
    this.heroFrames = registerCharacterSheet(this.textures.get('hero'), 5, 8).frames;
    this.motionFrames.set(
      'repair-drone-motion',
      registerEnemyMotion(this.textures.get('repair-drone-motion'), [0], 4),
    );
    this.motionFrames.set(
      'hero-reactions',
      registerEnemyMotion(this.textures.get('hero-reactions'), [0, 1], 8),
    );
    for (const [key, columns] of [
      ['hero-roster-directions', 8],
      ['hero-roster-actions', 6],
    ] as const)
      if (this.textures.exists(key))
        this.motionFrames.set(
          key,
          registerEnemyMotion(
            this.textures.get(key),
            [0, 1, 2, 3, 4],
            columns,
            columns === 6,
            gameStore.state.run?.fighter.appearance === undefined
              ? undefined
              : [gameStore.state.run.fighter.appearance % 5],
          ),
        );
    for (let i = 0; i < 10; i++) {
      const key = `hero-slash-${i}`;
      if (this.textures.exists(key))
        this.motionFrames.set(
          key,
          registerEnemyMotion(this.textures.get(key), [0, 1, 2], 5, false),
        );
    }
    if (this.textures.exists('hero-guard-6'))
      this.motionFrames.set(
        'hero-guard-6',
        registerEnemyMotion(this.textures.get('hero-guard-6'), [0], 5, false),
      );
    const onKey = (event: KeyboardEvent) => {
      if (!gameStore.rendererReady) return;
      if ((event.target as HTMLElement)?.closest('input,select,textarea,[role="dialog"]')) return;
      const key = event.key.toLowerCase();
      const resting = isWalkablePreparation(gameStore.state.run);
      // Native Tab reaches NPC markers; I and the HUD bag button remain available.
      if (resting && key === 'tab') return;
      if (['w', 'a', 's', 'd', 'q', 'e', ' ', 'tab', 'escape'].includes(key))
        event.preventDefault();
      if (gameStore.screen !== 'field') return;
      this.keys.add(key);
      if (event.repeat) return;
      if (resting && key === 'e') {
        gameStore.interactWaystation();
        this.clearMouse();
        return;
      }
      if (key === 'q' || key === 'e') {
        if (resting) return;
        if (gameStore.paused || gameStore.bagOpen || pendingChoices(gameStore.state.run)) return;
        void gameStore.dispatch({ type: 'switch', delta: key === 'q' ? -1 : 1 });
        this.clearMouse();
      } else if (key === ' ') this.defense = true;
      else if (key === 'tab' || key === 'i') gameStore.openBag(!gameStore.bagOpen);
      else if (key === 'escape') {
        if (gameStore.bagOpen) gameStore.openBag(false);
        else gameStore.pause(!gameStore.paused);
      }
    };
    const onUp = (event: KeyboardEvent) => this.keys.delete(event.key.toLowerCase());
    const blur = () => {
      this.keys.clear();
      this.clearMouse();
      if (gameStore.screen === 'field') gameStore.pause(true);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', blur);
    this.input.mouse?.disableContextMenu();
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const f = gameStore.state.run?.fighter,
        world = this.cameras.main.getWorldPoint(p.x, p.y);
      if (f)
        this.aim = Math.atan2(
          world.y - this.feedback.cameraOffset.y - (f.y - COMBAT_HEIGHT),
          world.x - this.feedback.cameraOffset.x - f.x,
        );
    });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!gameStore.rendererReady) return;
      unlockAudio();
      const f = gameStore.state.run?.fighter;
      const world = this.cameras.main.getWorldPoint(p.x, p.y);
      if (f)
        this.aim = Math.atan2(
          world.y - this.feedback.cameraOffset.y - (f.y - COMBAT_HEIGHT),
          world.x - this.feedback.cameraOffset.x - f.x,
        );
      this.left = p.leftButtonDown();
      this.right = p.rightButtonDown();
      this.attackPressed ||= this.left;
      this.ultimatePressed ||= this.right;
    });
    // Preserve a quick click until a simulation frame can consume it.
    const pointerUp = () => {
      this.left = false;
      this.right = false;
    };
    window.addEventListener('pointerup', pointerUp);
    let disposed = false;
    const dispose = () => {
      this.disposed = true;
      if (disposed) return;
      disposed = true;
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', blur);
      window.removeEventListener('pointerup', pointerUp);
      motion.removeEventListener('change', onMotion);
      this.feedback.reset();
      this.healthTrails.clear();
      this.motionClock.reset();
      this.poseTransition.reset();
      this.heldWeapon.destroy();
      this.paintedZones.destroy();
      this.clarity.destroy();
      this.bossReadability.destroy();
      this.cancelWarm?.();
      this.waystation.destroy();
      for (const actor of this.continuousActors.values()) actor.destroy();
      this.continuousActors.clear();
    };
    // Destroying a whole Phaser.Game can skip scene shutdown.
    this.events.once('shutdown', dispose);
    this.events.once('destroy', dispose);
    this.onReady();
  }
  private clearMouse() {
    this.left = false;
    this.right = false;
    this.attackPressed = false;
    this.ultimatePressed = false;
    this.defense = false;
  }
  update(time: number, delta: number) {
    const run = gameStore.state.run;
    this.syncRegion(run);
    if (this.artLoading) {
      this.accumulator = 0;
      this.keys.clear();
      this.clearMouse();
      this.feedback.resetCamera();
      return;
    }
    const beforeX = run?.fighter.x ?? 0,
      beforeY = run?.fighter.y ?? 0;
    if (run && this.activeRun !== run.id) {
      this.activeRun = run.id;
      this.feedback.reset();
      this.healthTrails.clear();
      this.cues = [];
      this.lastLevel = run.fighter.level;
      this.wasDead = run.phase === 'dead';
      this.stride = 0;
      this.warned.clear();
      this.seenAlive.clear();
      this.deaths.clear();
      this.motionClock.reset();
      this.poseTransition.reset();
      this.heardProjectiles = new WeakSet<object>();
      this.heroDeathAt = -1;
    }
    if (
      !gameStore.paused &&
      !gameStore.bagOpen &&
      !this.artLoading &&
      !pendingChoices(gameStore.state.run) &&
      gameStore.screen === 'field'
    )
      this.animationTime += Math.min(delta, 50) / 1000;
    this.accumulator += Math.min(delta, 50) / 1000;
    if (
      gameStore.bagOpen ||
      gameStore.waystationDialogue ||
      this.artLoading ||
      gameStore.paused ||
      pendingChoices(gameStore.state.run) ||
      gameStore.screen !== 'field'
    ) {
      this.clearMouse();
      this.keys.clear();
      this.accumulator = 0;
    }
    while (this.accumulator >= 1 / 60) {
      const before = gameStore.state.run?.elapsed;
      gameStore.advance(
        {
          dx: Number(this.keys.has('d')) - Number(this.keys.has('a')),
          dy: Number(this.keys.has('s')) - Number(this.keys.has('w')),
          aim: this.aim,
          attack: this.left || this.attackPressed,
          ultimate: this.right || this.ultimatePressed,
          defense: this.defense,
        },
        1 / 60,
        time,
        (cue) => this.cues.push(cue),
      );
      if (gameStore.state.run?.elapsed !== before) {
        this.defense = false;
        this.attackPressed = false;
        this.ultimatePressed = false;
      }
      this.accumulator -= 1 / 60;
    }
    this.feedback.receive(this.cues, this.animationTime, this.reducedMotion);
    this.cues = [];
    if (run && (run.phase === 'combat' || isWalkablePreparation(run))) {
      this.stride += Math.hypot(run.fighter.x - beforeX, run.fighter.y - beforeY);
      if (this.stride > 80) {
        this.stride %= 80;
        sound('step');
      }
    }
    this.draw(gameStore.state.run);
    this.feedback.updateCamera(
      this.animationTime,
      this.reducedMotion ||
        gameStore.paused ||
        gameStore.bagOpen ||
        this.artLoading ||
        pendingChoices(gameStore.state.run) ||
        gameStore.state.run?.phase !== 'combat',
    );
  }
  private actor(id: string, texture: string) {
    let actor = this.actors.get(id);
    if (!actor) {
      // The requested pose is applied before rendering. A repair sheet may start at slot 2 or 3.
      actor = this.add.image(0, 0, texture);
      this.actors.set(id, actor);
    }
    if (actor.texture.key !== texture) actor.setTexture(texture);
    actor.setVisible(true);
    return actor;
  }
  private loadRegion(index: number, manifest = regionArtManifest(index)) {
    if (index < 0 || Object.keys(manifest).every((key) => this.textures.exists(key)))
      return Promise.resolve();
    const requestKey = `${index}/${Object.keys(manifest).join(',')}`;
    const existing = this.regionRequests.get(requestKey);
    if (existing) return existing;
    const request = prepareImages(manifest, (progress) => {
      if (!this.disposed && this.artLoading && regionArtIndex(gameStore.state.run) === index)
        this.onRegionProgress?.(progress);
    }).then((images) => {
      if (this.disposed) return;
      for (const [key, image] of Object.entries(images)) {
        if (!this.textures.exists(key)) this.textures.addImage(key, image);
        registerAuthoredEnemy(this.textures.get(key));
        if (key === 'cavalry-actions')
          this.motionFrames.set(key, registerEnemyMotion(this.textures.get(key), [0]));
        if (key === 'cavalry-rear')
          this.motionFrames.set(key, registerEnemyMotion(this.textures.get(key), [0], 4, false));
        if (key.startsWith('region-rear-'))
          this.motionFrames.set(
            key,
            registerEnemyMotion(this.textures.get(key), undefined, 4, false),
          );
        if (key === 'desert-cavalry' && !this.cavalryFrames.size)
          this.cavalryFrames = registerCavalry(this.textures.get(key));
        if (key.startsWith('region-actors-'))
          this.regionFrames.set(key, registerRegionAtlas(this.textures.get(key)));
        if (key.startsWith('region-motion-')) this.registerMotion(key);
        if (key.startsWith('region-direction-'))
          this.directionFrames.set(key, registerEnemyMotion(this.textures.get(key), undefined, 5));
      }
    });
    this.regionRequests.set(requestKey, request);
    void request.catch(() => this.regionRequests.delete(requestKey));
    return request;
  }
  private registerMotion(key: string) {
    const repair = key.startsWith('region-motion-repair-');
    const index = Number(key.split('-').at(-1));
    const frames = registerEnemyMotion(
      this.textures.get(key),
      repair ? enemyMotionRepairSlots(index) : undefined,
    );
    const primary = `region-motion-${index}`;
    if (!repair) this.motionFrames.set(primary, frames);
    else {
      const combined = this.motionFrames.get(primary)!;
      for (const [name, frame] of frames) combined.set(name, frame);
    }
  }
  private syncRegion(run: Run | null) {
    const index = regionArtIndex(run);
    const scope = runArtKey(run);
    if (scope === this.artScope) {
      this.warmNextArt(run);
      return;
    }
    const manifest = runArtManifest(run);
    if (index >= 0 && !Object.keys(manifest).every((key) => this.textures.exists(key))) {
      this.artLoading = true;
      if (this.requestedArt !== scope) {
        this.requestedArt = scope;
        this.onRegionProgress?.({
          completed: 0,
          total: Object.keys(manifest).length,
        });
        void this.loadRegion(index, manifest).catch(() => {
          if (!this.disposed && index === regionArtIndex(gameStore.state.run)) this.onArtError();
        });
      }
      return;
    }
    this.artRegion = index;
    this.artScope = scope;
    if (this.artLoading) this.onRegionProgress?.(null);
    this.artLoading = false;
    this.backdrop.setTexture(index >= 0 ? `region-floor-${index}` : 'forest').setDisplaySize(W, H);
    const root = this.game.canvas.parentElement;
    if (root) root.dataset.artRegion = String(index);
    this.warmNextArt(run);
  }
  private warmNextArt(run: Run | null) {
    // Rest warms the upcoming boss; a defeated boss warms the following region.
    // Initial combat never competes with another region's full download/upload.
    if (
      !run ||
      run.wave >= 20 ||
      !(run.phase === 'prep' || (run.phase === 'loot' && run.wave % 5 === 0))
    )
      return;
    const connection = (
      navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }
    ).connection;
    if (connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType ?? '')) return;
    const next = { ...run, wave: run.wave + 1, enemies: [] };
    const key = runArtKey(next);
    if (key === this.warmedArt) return;
    this.warmedArt = key;
    this.cancelWarm?.();
    const warm = () => {
      this.cancelWarm = undefined;
      if (this.disposed || gameStore.state.run?.id !== run.id) return;
      void prepareImages(runArtManifest(next), undefined, {
        priority: 'low',
        concurrency: 2,
      }).catch(() => {});
    };
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(warm, { timeout: 2000 });
      this.cancelWarm = () => window.cancelIdleCallback(id);
    } else {
      const id = window.setTimeout(warm, 250);
      this.cancelWarm = () => window.clearTimeout(id);
    }
  }
  private drawHero(f: Fighter, dead: boolean) {
    const walking = f.action === 'walk';
    const cycle = this.motionClock.sample('hero', f.x, f.y, f.facing, this.animationTime, walking);
    const dir = cycle.direction;
    const striking =
      f.action === 'attack' ||
      f.action === 'ultimate' ||
      (f.action === 'defense' && f.arts[f.active]?.id === 'tianmo');
    let row = striking
      ? f.actionTime >
        (f.action === 'ultimate' ? 0.42 : STRIKE_TIMING.duration - STRIKE_TIMING.contact)
        ? 3
        : f.actionTime > 0.055
          ? 4
          : 0
      : f.action === 'defense' && f.arts[f.active]?.id !== 'huashan'
        ? 3
        : walking && !this.reducedMotion
          ? Math.floor(cycle.gait * 2) % 2 === 0
            ? 1
            : 2
          : 0;
    const hurt = this.feedback.pose('hero', this.animationTime);
    // A visual impact must not interrupt an attack/ultimate/defense that the
    // simulation continues. Keep the contact drawing and overlay its feedback.
    const reactionRow = dead
      ? 1
      : !striking && f.action !== 'defense' && hurt && hurt.age < 0.13
        ? 0
        : undefined;
    const reaction =
      reactionRow === undefined
        ? undefined
        : this.motionFrames.get('hero-reactions')?.get(`${reactionRow}-${dir}`);
    const key = reaction?.texture ?? 'hero-isolated',
      frame = reaction ? `${reactionRow}-${dir}` : `${row}-${dir}`;
    const calibrated = this.heroFrames.get(`${row}-${dir}`)!;
    const actor = this.actor('hero', key).setTexture(key, frame);
    const style = activeWeapon(f as BoundFighter)?.weaponStyle;
    actor.setData('weaponStyle', style ?? 'sword');
    actor
      .setFlipX(false)
      .setData('heldHand', undefined)
      .setData('heldSlash', undefined)
      .setData('heldWeaponPose', undefined)
      .setData('bladeCut', f.action === 'attack' && (style === 'sword' || style === 'dao'));
    actor.setData('sourceCell', calibrated);
    actor.setData('nativePose', !!reaction || row >= 3);
    const height = 115;
    const strikeAge = STRIKE_TIMING.duration - f.actionTime;
    // Ultimates use the same authored weapon-specific drawings on their own
    // 0.6s clock. A rear-view ultimate must not freeze at the idle guard.
    const weaponAge =
      f.action === 'ultimate' ? ((0.6 - f.actionTime) * STRIKE_TIMING.duration) / 0.6 : strikeAge;
    actor.setData('attackExposure', heroAttackExposure(weaponAge));
    const cutWeight = heroCutWeight(strikeAge);
    const drive = (
      { sword: 1, dao: 1.1, staff: 0.8, fan: 0.55, dart: 0.25, gauntlet: 0.9 } as const
    )[style ?? 'sword'];
    const contactAge = Math.max(0, this.animationTime - this.feedback.contact);
    const lunge =
      striking && !reaction && !this.reducedMotion
        ? f.action === 'attack'
          ? cutWeight.lunge * drive
          : 8 * Math.pow(1 - Math.min(1, Math.max(0, contactAge - 0.025) / 0.16), 2)
        : 0;
    actor
      .setDisplaySize(
        (105 * calibrated.width * calibrated.scaleCorrection) / calibrated.nominalWidth,
        (height * calibrated.height * calibrated.scaleCorrection) / calibrated.nominalHeight,
      )
      .setOrigin(
        (calibrated.nominalX + calibrated.nominalWidth / 2 - calibrated.left) / calibrated.width,
        calibrated.footY,
      )
      .setPosition(
        f.x + Math.cos(f.facing) * lunge * PLAYER_VISUAL_SCALE,
        f.y + Math.sin(f.facing) * lunge * PLAYER_VISUAL_SCALE,
      )
      .setDepth(f.y);
    if (reaction) {
      const idle = this.heroFrames.get(`0-${dir}`)!;
      const pixelScale =
        (idle.bodyUnit * Math.sqrt(105 * 115) * idle.scaleCorrection) /
        Math.sqrt(idle.nominalWidth * idle.nominalHeight) /
        reaction.bodyUnit;
      actor
        .setDisplaySize(reaction.width * pixelScale, reaction.height * pixelScale)
        .setOrigin(dead ? 0.5 : reaction.footX, dead ? 0.7 : reaction.originY);
    }
    actor
      .setAlpha(f.invulnerable > 0 ? 0.85 : 1)
      .setTint(hurt && hurt.age < 0.13 ? 0xff987f : 0xffffff)
      .setRotation(
        striking && !reaction && !this.reducedMotion
          ? Math.cos(f.facing) * (f.action === 'attack' ? cutWeight.turn : 0.04 - lunge * 0.009)
          : 0,
      );
    if (dead && this.heroDeathAt < 0) this.heroDeathAt = this.animationTime;
    const attackMotion = heroAttackMotion(strikeAge);
    let action: MotionAction = dead
      ? 'death'
      : reactionRow === 0
        ? 'hurt'
        : f.action === 'ultimate'
          ? 'ultimate'
          : f.action === 'defense'
            ? 'defense'
            : striking
              ? attackMotion.action
              : walking
                ? 'walk'
                : 'idle';
    const progress =
      action === 'death'
        ? (this.animationTime - this.heroDeathAt) / 0.38
        : action === 'hurt'
          ? (hurt?.age ?? 0) / 0.13
          : ['windup', 'strike', 'recover'].includes(action)
            ? attackMotion.progress
            : action === 'ultimate' || action === 'defense'
              ? 1 - f.actionTime / (action === 'ultimate' ? 0.6 : 0.3)
              : 0;
    this.applyRosterPose(f, actor, dir, row, !!reaction, dead);
    if (!dead && !reaction && (f.action === 'attack' || f.action === 'ultimate'))
      this.applySlashPose(f, actor, dir, action, progress);
    // Apply once after selecting any legacy, roster, reaction or attack source.
    // Keep its foot origin and aspect ratio; never shrink to weapon bounds.
    actor.setDisplaySize(
      actor.displayWidth * PLAYER_VISUAL_SCALE,
      actor.displayHeight * PLAYER_VISUAL_SCALE,
    );
    this.drawContinuous('hero', actor, action, progress, cycle);
    this.heldWeapon.draw(
      f as BoundFighter,
      actor,
      row,
      dir,
      actor.getData('renderRig'),
      dead || (!!reaction && f.appearance === undefined),
      this.continuousActors.get('hero'),
    );
    const g = this.graphics;
    g.fillStyle(0x132b20, 0.24).fillEllipse(
      f.x,
      f.y + 2 * PLAYER_VISUAL_SCALE,
      46 * PLAYER_VISUAL_SCALE,
      14 * PLAYER_VISUAL_SCALE,
    );
  }
  private applyRosterPose(
    f: Fighter,
    actor: Phaser.GameObjects.Image,
    dir: number,
    row: number,
    reaction: boolean,
    dead: boolean,
  ) {
    if (f.appearance === undefined) return;
    const slot = f.appearance % 5;
    const directions = this.motionFrames.get('hero-roster-directions');
    const actions = this.motionFrames.get('hero-roster-actions');
    const { view, flip: directionFlip } = heroDirection(f.appearance, dir);
    const base = directions?.get(`${slot}-2`);
    const direction = directions?.get(`${slot}-${view}`);
    if (!base || !direction || !actions) return;
    const pose = dead ? 5 : reaction ? 4 : dir < 5 && row >= 3 ? row - 1 : undefined;
    // Walk on the reviewed direction plate. The old A0/A1 drawings can face
    // opposite sides, so alternating them reversed diagonal walking every step.
    const name = `${slot}-${pose ?? view}`;
    const placement = heroWeaponPose(
      f.appearance,
      activeWeapon(f as BoundFighter)?.weaponStyle ?? 'sword',
      dir,
      pose === undefined ? 'direction' : 'actions',
      pose ?? 0,
    );
    const repair =
      pose === undefined && f.appearance === 6 && dir !== 6
        ? this.motionFrames.get('hero-guard-6')?.get(`0-${placement.view}`)
        : undefined;
    const source = repair ?? (pose === undefined ? direction : actions.get(name)!);
    const flip = repair
      ? placement.flip
      : pose === undefined
        ? directionFlip
        : dir === 3 || dir === 4 || dir === 5;
    const pixelScale = (110 * base.bodyUnit) / base.height / source.bodyUnit;
    actor
      .setTexture(source.texture, repair ? `0-${placement.view}` : name)
      .setFlipX(flip)
      .setDisplaySize(source.width * pixelScale, source.height * pixelScale)
      .setOrigin(dead ? 0.5 : flip ? 1 - source.footX : source.footX, dead ? 0.7 : source.originY)
      .setData('nativePose', pose !== undefined)
      .setData('appearance', f.appearance)
      .setData('sourceFrame', source)
      .setData('heldHand', placement.hand)
      .setData('heldPose', pose)
      .setData('heldView', view)
      .setData('heldWeaponPose', placement);
  }
  private applySlashPose(
    f: Fighter,
    actor: Phaser.GameObjects.Image,
    dir: number,
    action: MotionAction,
    progress: number,
  ) {
    const appearance = f.appearance ?? 0;
    const poses = this.motionFrames.get(`hero-slash-${appearance}`);
    const placement = heroWeaponPose(
      appearance,
      activeWeapon(f as BoundFighter)?.weaponStyle ?? 'sword',
      dir,
      'attack',
      actor.getData('attackExposure'),
    );
    if (placement.row < 0) {
      // Pre-roster saves still use the legacy body sheet and its own wrists.
      if (f.appearance === undefined) return;
      this.applyRosterPose({ ...f, appearance }, actor, dir, 0, false, false);
      actor.setData('heldWeaponPose', placement);
      return;
    }
    const view = placement.view,
      row = placement.row;
    const source = poses?.get(`${row}-${view}`);
    if (!source) return;
    const legacy = f.appearance === undefined ? this.heroFrames.get(`0-${dir}`) : undefined;
    const base = this.motionFrames.get('hero-roster-directions')?.get(`${appearance % 5}-2`);
    const skull = legacy
      ? (legacy.bodyUnit * Math.sqrt(105 * 115) * legacy.scaleCorrection) /
        Math.sqrt(legacy.nominalWidth * legacy.nominalHeight)
      : base
        ? (110 * base.bodyUnit) / base.height
        : 0;
    if (!skull) return;
    const scale = skull / source.bodyUnit;
    const flip = placement.flip;
    actor
      .setTexture(source.texture, `${row}-${view}`)
      .setFlipX(flip)
      .setDisplaySize(source.width * scale, source.height * scale)
      .setOrigin(flip ? 1 - source.footX : source.footX, source.originY)
      .setData('nativePose', true)
      .setData('sourceFrame', source)
      .setData('heldHand', heroSlashGrip(appearance, row, view))
      .setData('heldSlash', [appearance, row, view])
      .setData('heldWeaponPose', placement);
  }
  private drawEnemy(e: Enemy, deathAge?: number) {
    const boss = isBossEnemy(e),
      col = e.kind === 'archer' || e.kind === 'captain' ? 2 : e.kind === 'spear' ? 1 : 0;
    const row =
      e.state === 'strike' || e.state === 'windup'
        ? 3
        : e.state === 'approach'
          ? 1 + (Math.floor(this.animationTime * 6) % 2)
          : 0;
    const regionalKey = `region-actors-${this.artRegion}`;
    const slot = enemyArtSlot(e, this.artRegion);
    const regional = this.regionFrames.get(regionalKey)?.get(slot);
    const hit = this.feedback.pose(e.id, this.animationTime),
      hitAge = hit?.age ?? 100;
    const dead = deathAge !== undefined;
    const staggered =
      !boss && !dead && (e.staggerTime ?? 0) > 0 && e.state !== 'strike' && hitAge < 0.2;
    const moving = e.moving ?? false;
    const charging = e.state === 'strike' && !!e.strike && enemyAttack(e).dash > 0;
    const cycle = this.motionClock.sample(
      String(e.id),
      e.x,
      e.y,
      e.state === 'windup' || e.state === 'strike' ? e.aim : e.facing,
      this.animationTime,
      e.state === 'approach' || moving || charging,
    );
    const direction = MOTION_DIRECTIONS[cycle.direction];
    if (!dead) {
      if (e.state !== 'windup') this.warned.delete(e.id);
      else if (!this.warned.has(e.id) && e.timer <= enemyAttack(e).windup * 0.3) {
        this.warned.add(e.id);
        const fighter = gameStore.state.run?.fighter;
        if (boss && fighter && Math.hypot(e.x - fighter.x, e.y - fighter.y) < 600) sound('warning');
      }
    }
    if (authoredEnemyArt(e, this.artRegion)) {
      this.drawAuthoredEnemy(e, cycle, hitAge, hit?.angle ?? 0, deathAge);
      return;
    }
    const directionKey = `region-direction-${this.artRegion}`;
    const mounted = e.role === 'rider' && this.cavalryFrames.has(direction.view);
    const cavalry = mounted ? this.cavalryFrames.get(direction.view) : undefined;
    const repairSlot = enemyRepairSlot(e);
    const identitySlot = hostileIdentitySlot(e, this.artRegion);
    const directionFrameName = `${identitySlot ?? repairSlot ?? slot}-${direction.view}`;
    const directionFrame = this.directionFrames
      .get(
        identitySlot !== undefined
          ? 'hostile-identity-directions'
          : repairSlot === undefined
            ? directionKey
            : 'enemy-role-directions',
      )
      ?.get(directionFrameName);
    const recoveryStep = !dead && (boss || hitAge >= 0.2) && e.state === 'recover' && moving;
    const drawingPose = hostileDrawingPose(e, cycle.direction, hitAge, dead, this.artRegion, {
      gait: cycle.gait,
      moving: moving && !this.reducedMotion,
    });
    const rear = cycle.direction >= 5 && (drawingPose === 2 || drawingPose === 3);
    const rearKey =
      identitySlot !== undefined
        ? 'hostile-identity-rear'
        : mounted
          ? 'cavalry-rear'
          : repairSlot !== undefined
            ? 'enemy-role-rear'
            : `region-rear-${this.artRegion}`;
    const specialMotion = rear
      ? this.motionFrames.get(rearKey)
      : identitySlot !== undefined
        ? this.motionFrames.get('hostile-identity-actions')
        : mounted
          ? this.motionFrames.get('cavalry-actions')
          : repairSlot !== undefined
            ? this.motionFrames.get('enemy-role-actions')
            : undefined;
    const motionKey = `region-motion-${this.artRegion}`;
    const motionColumn = rear
      ? (cycle.direction === 6 ? 2 : 0) + (drawingPose === 3 ? 1 : 0)
      : drawingPose;
    const motionFrameName = `${identitySlot ?? (mounted ? 0 : (repairSlot ?? slot))}-${motionColumn}`;
    const motion =
      drawingPose === null
        ? undefined
        : (
            specialMotion ??
            (repairSlot === undefined ? this.motionFrames.get(motionKey) : undefined)
          )?.get(motionFrameName);
    const useDrawing = !!motion;
    const key = useDrawing
      ? motion!.texture
      : mounted
        ? 'desert-cavalry'
        : directionFrame
          ? directionFrame.texture
          : regional
            ? regionalKey
            : 'enemy';
    const actor = this.actor(String(e.id), key).setTexture(
        key,
        useDrawing
          ? motionFrameName
          : mounted
            ? String(direction.view)
            : directionFrame
              ? directionFrameName
              : regional
                ? String(slot)
                : `${row}-${col}`,
      ),
      scale = (boss ? 1.4 : mounted ? 1.55 : 1) * enemySize(e);
    actor.setData({
      authoredFrame: null,
      nativePose: useDrawing,
      rearPose: rear && useDrawing,
      drawingPose,
      sourceFrame: actor.frame.name,
      stepping: moving && !dead,
    });
    const recoil = hostileRecoil(e, hitAge, this.reducedMotion, dead);
    const away = hit?.angle ?? 0;
    const collapse = dead ? Math.min(1, deathAge / 0.38) : 0;
    const windup = e.state === 'windup' ? Math.max(0, 1 - e.timer / enemyAttack(e).windup) : 0;
    const lunge =
      !dead && !this.reducedMotion && regional
        ? e.state === 'strike'
          ? charging
            ? 0
            : 5 * Math.sin(Math.min(1, e.timer / (e.strike?.duration ?? 0.18)) * Math.PI)
          : enemyAttack(e).ranged || enemyAttack(e).move === 'hazard'
            ? 0
            : -4 * windup
        : 0;
    const bob =
      !directionFrame &&
      !motion &&
      !dead &&
      !this.reducedMotion &&
      regional &&
      e.state === 'approach' &&
      moving
        ? Math.sin(this.animationTime * 14 + e.id) * 1.5
        : 0;
    const height = mounted ? 125 * enemySize(e) : (regional ? 80 : 108) * scale;
    const flipped = useDrawing
      ? rear
        ? cycle.direction === 5
        : direction.flip
      : mounted
        ? direction.flip
        : directionFrame
          ? identitySlot !== undefined || repairSlot !== undefined
            ? direction.view === 3 && identitySlot !== 0
              ? !direction.flip
              : direction.flip
            : repairSlot === undefined
              ? enemyDirectionFlip(this.artRegion, slot, direction.view, direction.flip)
              : direction.view === 3
                ? !direction.flip
                : direction.flip
          : Math.cos(e.facing) < 0;
    const familySlot = identitySlot ?? (mounted ? 0 : (repairSlot ?? slot));
    const directionFamily = this.directionFrames.get(
      identitySlot !== undefined
        ? 'hostile-identity-directions'
        : repairSlot === undefined
          ? directionKey
          : 'enemy-role-directions',
    );
    // Front view is the character's permanent reference. Using the current
    // view here silently changes the target size when the character turns.
    const reference = mounted ? this.cavalryFrames.get(0) : directionFamily?.get(`${familySlot}-0`);
    const dimensions = useDrawing && motion ? motion : (cavalry ?? directionFrame);
    const sizing =
      dimensions && reference ? enemyPixelScale(dimensions, reference, height) : undefined;
    const pixelScale = sizing?.pixelScale ?? (dimensions ? height / dimensions.referenceHeight : 1);
    actor
      .setPosition(
        e.x + Math.cos(away) * recoil + Math.cos(e.aim) * lunge,
        e.y + Math.sin(away) * recoil + Math.sin(e.aim) * lunge + bob,
      )
      .setDisplaySize(
        dimensions
          ? dimensions.width * pixelScale
          : regional
            ? (height * regional.width) / regional.height
            : 100 * scale,
        dimensions
          ? dimensions.height * pixelScale
          : height * (dead && !this.reducedMotion ? 1 - collapse * 0.55 : 1),
      )
      .setOrigin(
        dimensions
          ? flipped
            ? 1 - dimensions.footX
            : dimensions.footX
          : regional
            ? flipped
              ? 1 - regional.footX
              : regional.footX
            : 0.5,
        dimensions
          ? dimensions.originY
          : regional
            ? 1
            : (this.feet.get(`enemy/${row}-${col}`) ?? 0.9),
      )
      .setFlipX(flipped)
      .setDepth(e.y)
      .setTint(
        hitAge < (boss ? 0.04 : 0.065)
          ? 0xffeed0
          : (e.rageTime ?? 0) > 0
            ? 0xffc5b5
            : (e.guardTime ?? 0) > 0 || (e.armourTime ?? 0) > 0
              ? 0xffe7b5
              : regional
                ? 0xffffff
                : boss
                  ? e.elite
                    ? 0xd5a0b0
                    : 0xe9b877
                  : 0xffffff,
      );
    actor.setData({
      skullDisplayUnit: sizing ? sizing.unit * pixelScale : null,
      scaleBasis: sizing?.basis,
      scaleTarget: sizing?.targetUnit,
    });
    actor
      .setAlpha(dead ? 1 - collapse : 1 - 0.62 * Math.min(1, (e.veilTime ?? 0) / 0.15))
      .setRotation(
        this.reducedMotion || dimensions
          ? 0
          : dead
            ? Math.cos(e.facing) * collapse * 0.65
            : e.state === 'strike'
              ? Math.cos(e.aim) * (regional ? 0.13 : 0.06)
              : e.state === 'windup'
                ? -Math.cos(e.aim) * 0.025 * Math.max(0, 1 - e.timer / enemyAttack(e).windup)
                : 0,
      );
    const action: MotionAction = dead
      ? 'death'
      : staggered
        ? 'hurt'
        : e.state === 'approach' || recoveryStep
          ? moving
            ? 'walk'
            : 'idle'
          : e.state;
    const profile = enemyAttack(e);
    const progress = dead
      ? deathAge / 0.38
      : action === 'hurt'
        ? hitAge / 0.2
        : action === 'windup'
          ? 1 - e.timer / profile.windup
          : action === 'strike'
            ? 1 - e.timer / (e.strike?.duration ?? 0.18)
            : action === 'recover'
              ? 1 - e.timer / profile.recovery
              : 0;
    actor.setData({ role: e.role ?? 'legacy', view: direction.view, mounted });
    if (mounted) {
      actor.setAlpha(dead ? Math.max(0, 1 - collapse) : (e.veilTime ?? 0) > 0 ? 0.65 : 1);
    }
    this.drawContinuous(String(e.id), actor, action, progress, cycle, mounted, charging, e);
    const g = this.graphics;
    if (dead) {
      actor.setData('healthBar', null);
      return;
    }
    const familyKey = `${this.artRegion}/${identitySlot}/${repairSlot}/${slot}/${mounted}/${height}`;
    let clearance = this.enemyClearances.get(familyKey);
    if (clearance === undefined) {
      const actions =
        identitySlot !== undefined
          ? this.motionFrames.get('hostile-identity-actions')
          : mounted
            ? this.motionFrames.get('cavalry-actions')
            : repairSlot !== undefined
              ? this.motionFrames.get('enemy-role-actions')
              : this.motionFrames.get(motionKey);
      const family = [
        ...(mounted
          ? [...this.cavalryFrames.values()]
          : [...(directionFamily?.entries() ?? [])]
              .filter(([name]) => name.startsWith(`${familySlot}-`))
              .map(([, frame]) => frame)),
        ...[...(actions?.entries() ?? [])]
          .filter(([name]) => name.startsWith(`${familySlot}-`) && !name.endsWith('-5'))
          .map(([, frame]) => frame),
        ...[...(this.motionFrames.get(rearKey)?.entries() ?? [])]
          .filter(([name]) => name.startsWith(`${familySlot}-`))
          .map(([, frame]) => frame),
      ];
      clearance = reference ? enemyBarClearance(family, reference, height) : height + 12;
      this.enemyClearances.set(familyKey, clearance);
    }
    const mesh = this.continuousActors.get(String(e.id))!.mesh;
    let renderedTop = Infinity;
    const cos = Math.cos(mesh.rotation),
      sin = Math.sin(mesh.rotation);
    for (let at = 0; at < mesh.vertices.length; at += 4)
      renderedTop = Math.min(
        renderedTop,
        mesh.y + mesh.vertices[at] * sin + mesh.vertices[at + 1] * cos,
      );
    const barY = enemyHealthBarY(e.y, clearance, renderedTop);
    actor.setData('healthBar', {
      x: e.x - 26 * scale,
      y: barY,
      width: 52 * scale,
      height: 5,
      renderedTop,
      clearance,
    });
    g.fillStyle(0x152b20, 0.22).fillEllipse(e.x, e.y + 3, 40 * scale, 13 * scale);
    this.drawHealthBar(e, e.x - 26 * scale, barY, 52 * scale);
    // Rank markers work in Canvas too, where sprite tint is not a reliable distinction.
    if (boss || e.elite) {
      const markY = barY - 10;
      g.fillStyle(e.elite ? 0xe8bdd0 : 0xf2d287, 1).fillTriangle(
        e.x,
        markY - 4,
        e.x - 3,
        markY + 3,
        e.x + 3,
        markY + 3,
      );
    }
  }
  private drawAuthoredEnemy(
    e: Enemy,
    cycle: { direction: number; gait: number },
    hitAge: number,
    hitAngle: number,
    deathAge?: number,
  ) {
    const dead = deathAge !== undefined;
    const profile = enemyAttack(e);
    const art = authoredEnemyArt(e, this.artRegion)!;
    const instant =
      !profile.melee && (profile.ranged || profile.move === 'pulse' || profile.move === 'hazard');
    const strikeDuration =
      e.strike?.duration ?? profile.melee?.duration ?? (instant ? 0.18 : STRIKE_TIMING.duration);
    // Strike owns the drawing even during a damage flash. Recovery also completes
    // before locomotion resumes, so movement cannot cancel the staff withdrawal.
    const hurt =
      !isBossEnemy(e) && !dead && e.state !== 'strike' && (e.staggerTime ?? 0) > 0 && hitAge < 0.2;
    const action: MotionAction = dead
      ? 'death'
      : hurt
        ? 'hurt'
        : e.state === 'approach'
          ? e.moving
            ? 'walk'
            : 'idle'
          : e.state;
    const progress = dead
      ? deathAge / 0.38
      : hurt
        ? hitAge / 0.2
        : action === 'windup'
          ? 1 - e.timer / profile.windup
          : action === 'strike'
            ? 1 - e.timer / strikeDuration
            : action === 'recover'
              ? 1 - e.timer / profile.recovery
              : 0;
    const timing = profile.melee ?? { duration: strikeDuration, contacts: [0] };
    const special = bossSpecialFrame(
      e,
      this.artRegion,
      cycle.direction,
      profile.move ?? '',
      action,
      progress,
      timing,
      gameStore.state.run?.encounterObjects,
    );
    const selected =
      special ??
      authoredEnemyFrame(
        art,
        cycle.direction,
        action,
        progress,
        cycle.gait,
        this.reducedMotion,
        profile.melee ?? (instant ? { duration: strikeDuration, contacts: [0] } : undefined),
      );
    const { frame, flip, view } = selected;
    const recoil = hostileRecoil(e, hitAge, this.reducedMotion, dead);
    const size = enemySize(e);
    const pixelScale = art.pixelScale * size;
    const actor = this.actor(String(e.id), frame.texture).setTexture(frame.texture, frame.name);
    this.continuousActors.get(String(e.id))?.hide();
    actor
      .setPosition(e.x + Math.cos(hitAngle) * recoil, e.y + Math.sin(hitAngle) * recoil)
      .setScale(pixelScale)
      .setOrigin(
        flip ? 1 - frame.footX / frame.width : frame.footX / frame.width,
        frame.footY / frame.height,
      )
      .setFlipX(flip)
      .setRotation(0)
      .setDepth(e.y)
      .setTint(
        hitAge < 0.065
          ? 0xffeed0
          : (e.rageTime ?? 0) > 0
            ? 0xffc5b5
            : (e.guardTime ?? 0) > 0 || (e.armourTime ?? 0) > 0
              ? 0xffe7b5
              : 0xffffff,
      )
      .setAlpha(
        dead ? Math.max(0, 1 - deathAge / 0.38) : 1 - 0.62 * Math.min(1, (e.veilTime ?? 0) / 0.15),
      );
    const renderedTop = actor.y + (frame.bounds.top - frame.footY) * pixelScale;
    actor.setData({
      authoredFrame: frame,
      nativePose: true,
      authoredIdentity: art.id,
      rearPose: view >= 3,
      drawingPose: frame.pose,
      sourceFrame: frame.name,
      stepping: action === 'walk',
      role: e.role ?? 'legacy',
      view,
      mounted: this.artRegion === 7 && art.id === 'rider',
      motionAction: action,
      motionProgress: progress,
      motionDirection: cycle.direction,
      bossMotion:
        special?.motion ??
        (e.bossId ? bossMotionClock(profile.move ?? '', action, progress, timing) : null),
      specialPose: !!special,
      scaleBasis: 'source-pixels',
      scaleTarget: pixelScale,
      skullDisplayUnit: null,
    });
    if (dead) {
      actor.setData('healthBar', null);
      return;
    }
    // Preserve the original absolute 12px breathing room above the whole family.
    const clearance =
      (bossHealthClearance(e, this.artRegion, art.healthClearance) - 12) * size + 12;
    const barY = enemyHealthBarY(e.y, clearance, renderedTop);
    actor.setData('healthBar', {
      x: e.x - 26 * size,
      y: barY,
      width: 52 * size,
      height: 5,
      renderedTop,
      clearance,
    });
    this.graphics
      .fillStyle(0x152b20, 0.22)
      .fillEllipse(
        e.x,
        e.y + 3,
        (art.id === 'rider' ? 70 : 40) * size,
        (art.id === 'rider' ? 19 : 13) * size,
      );
    this.drawHealthBar(e, e.x - 26 * size, barY, 52 * size);
    if (isBossEnemy(e) || e.elite)
      this.graphics
        .fillStyle(e.elite ? 0xe8bdd0 : 0xf2d287, 1)
        .fillTriangle(e.x, barY - 14, e.x - 3, barY - 7, e.x + 3, barY - 7);
  }
  private drawHealthBar(enemy: Enemy, x: number, y: number, width: number) {
    let health = this.healthTrails.get(enemy.id);
    if (!health) {
      health = new HealthTrail();
      this.healthTrails.set(enemy.id, health);
    }
    health.update(enemy.hp, enemy.maxHp, this.animationTime, enemy.bossId ?? enemy.kind);
    const sample = health.sample(this.animationTime, this.reducedMotion),
      g = this.graphics;
    const inner = width - 2;
    // Keep the existing five-pixel envelope and fixed ground clearance. Every
    // renderer, including Canvas, gets real white damage pixels and a bright fill.
    g.fillStyle(isBossEnemy(enemy) ? 0x997442 : 0x45606a, 0.95).fillRoundedRect(x, y, width, 5, 2);
    g.fillStyle(0x10212b, 1).fillRect(x + 1, y + 1, inner, 3);
    if (sample.trail > sample.ratio)
      g.fillStyle(sample.phase === 'hit' ? 0xffffff : 0xffe6b7, 1).fillRect(
        x + 1,
        y + 1,
        inner * sample.trail,
        3,
      );
    if (sample.ratio > 0) {
      g.fillStyle(
        sample.phase === 'heal' ? 0x3bd1a0 : sample.level === 'critical' ? 0xff4956 : 0xf46a50,
        1,
      ).fillRect(x + 1, y + 1, inner * sample.ratio, 3);
      g.fillStyle(0xffc293, 0.9).fillRect(x + 1, y + 1, inner * sample.ratio, 1);
    }
    this.actors.get(String(enemy.id))?.setData('healthTrail', sample);
  }

  private drawContinuous(
    id: string,
    image: Phaser.GameObjects.Image,
    action: MotionAction,
    progress: number,
    cycle: { direction: number; gait: number },
    mounted = false,
    charging = false,
    enemy?: Enemy,
  ) {
    let actor = this.continuousActors.get(id);
    if (!actor) {
      actor = new ContinuousActor(this, image.texture.key);
      this.continuousActors.set(id, actor);
    }
    // Preparation remains a distinct, fixed stance when decorative motion is disabled.
    const fixedCombatPose = this.reducedMotion && ['windup', 'strike', 'recover'].includes(action);
    const rig = enemy
      ? sampleHostileRig(
          enemy,
          action,
          progress,
          cycle.gait,
          this.animationTime,
          this.reducedMotion,
        )
      : fixedCombatPose
        ? sampleRig(action, 1, 0, 0)
        : sampleRig(action, progress, cycle.gait, this.animationTime, this.reducedMotion);
    if (charging && !this.reducedMotion) {
      const gait = sampleRig('walk', 0, cycle.gait, this.animationTime);
      rig.stride = gait.stride * (mounted ? 1.35 : 1);
      rig.lift = gait.lift;
    }
    if ((enemy && image.getData('nativePose')) || (!enemy && image.getData('nativePose'))) {
      // The drawing already contains the bent arm and crouch. Deforming it again
      // rubberizes the weapon and doubles the crouch; only small settling remains.
      for (const property of [
        'lean',
        'arm',
        'twist',
        'reach',
        'handLift',
        'crouch',
        'stride',
        'lift',
      ] as const)
        rig[property] *= 0.12;
      if (action === 'death') rig.collapse = 0;
    }
    if (
      enemy &&
      image.getData('stepping') &&
      image.getData('nativePose') &&
      !this.reducedMotion &&
      action === 'windup'
    ) {
      const step = sampleRig('walk', 0, cycle.gait, this.animationTime);
      rig.stride = step.stride * 0.35;
      rig.lift = step.lift * 0.3;
    }
    if (!enemy && image.getData('bladeCut') && !this.reducedMotion)
      Object.assign(rig, bladeTorsoRig(action, progress));
    const renderedRig = this.poseTransition.sample(
      id,
      action,
      rig,
      this.animationTime,
      this.reducedMotion,
    );
    image.setData('renderRig', renderedRig);
    image
      .setData('motionAction', action)
      .setData('motionProgress', progress)
      .setData('motionReduced', this.reducedMotion);
    actor.draw(image, renderedRig, cycle.direction, action, mounted);
    if (enemy)
      actor.mesh.setData({
        motionStyle: hostileMotion(enemy),
        nativePose: image.getData('nativePose'),
        sourceFrame: image.getData('sourceFrame'),
        progress,
        hitReaction: action === 'hurt',
      });
  }
  private draw(r: Run | null) {
    for (const actor of this.continuousActors.values()) actor.hide();
    this.graphics.clear();
    this.ground.clear();
    this.paintedZones.draw(r);
    this.clarity.draw(r);
    this.waystation.draw(r);
    for (const actor of this.actors.values()) actor.setVisible(false);
    if (!r) {
      this.bossReadability.draw(null, this.animationTime, this.reducedMotion);
      this.heldWeapon.image.setVisible(false);
      this.heldWeapon.smear.clear().setVisible(false);
      this.paintedEffects.draw([], []);
      return;
    }
    if (this.renderWave !== r.wave) {
      this.renderWave = r.wave;
      this.healthTrails.clear();
      this.seenAlive.clear();
      this.deaths.clear();
    }
    drawEncounters(this.ground, this.graphics, r);
    for (const object of r.encounterObjects ?? []) {
      const mechanicFrame = {
        bamboo: 0,
        'falling-bamboo': object.stage ? 1 : 0,
        door: 2,
        'rotating-door': 2,
        'stone-door': 3,
        sandwall: 4,
        drone: 5,
        blade: 6,
        oasis: 7,
        plate: 8,
        bell: 9,
        cleansing: 10,
      }[object.mechanic as 'bamboo'];
      const frame =
        mechanicFrame ??
        { wall: 0, flag: 1, herb: 2, turret: 3, chest: 4, ice: 5 }[object.kind as 'wall'];
      if (frame === undefined || object.life <= 0 || r.phase !== 'combat') continue;
      const wall = object.kind === 'wall';
      const open =
        (object.mechanic === 'door' && object.stage !== 0) ||
        (object.mechanic === 'rotating-door' && object.stage === 1);
      const size =
        object.mechanic === 'oasis' || object.mechanic === 'cleansing'
          ? object.radius * 2
          : object.mechanic === 'drone'
            ? 65
            : 100;
      const droneFrame =
        object.mechanic === 'drone'
          ? `0-${this.reducedMotion ? 1 : Math.floor((object.age ?? 0) * 8) % 4}`
          : undefined;
      const dronePose = droneFrame
        ? this.motionFrames.get('repair-drone-motion')?.get(droneFrame)
        : undefined;
      const objectActor = this.actor(
        `object-${object.id}`,
        dronePose?.texture ?? (mechanicFrame !== undefined ? 'boss-mechanics' : 'encounter-props'),
      )
        .setTexture(
          dronePose?.texture ??
            (mechanicFrame !== undefined ? 'boss-mechanics' : 'encounter-props'),
          dronePose ? droneFrame : String(frame),
        )
        .setVisible(true)
        .setPosition(
          object.x,
          object.y +
            (object.mechanic === 'drone' && !this.reducedMotion
              ? Math.sin((object.age ?? 0) * 3) * 2
              : 0),
        )
        .setOrigin(0.5, 0.75)
        .setDepth(object.y)
        .setDisplaySize(
          mechanicFrame !== undefined
            ? ((size * this.textures.get('boss-mechanics').get(String(frame)).cutWidth) /
                this.textures.get('boss-mechanics').get(String(frame)).cutHeight) *
                (object.mechanic === 'door' && object.stage === 1 ? 0.45 : 1)
            : wall
              ? object.radius * 2.2
              : object.kind === 'ice'
                ? 100
                : 85,
          mechanicFrame !== undefined ? size : wall ? 100 : object.kind === 'flag' ? 120 : 95,
        )
        .setRotation(
          !this.reducedMotion
            ? object.mechanic === 'falling-bamboo' && !object.stage
              ? Math.max(0, Math.min(1, ((object.age ?? 0) - 1.4) / 0.6)) * 0.7
              : 0
            : 0,
        )
        .setTint(open ? 0xa2d2b0 : 0xffffff)
        .setAlpha(
          open
            ? 0.25
            : object.warning > 0
              ? 0.5
              : object.mechanic === 'sandwall'
                ? Math.min(1, object.life / 0.65)
                : 1,
        );
      if (dronePose)
        objectActor
          .setDisplaySize(dronePose.width * 0.42, dronePose.height * 0.42)
          .setOrigin(0.5, 0.65);
    }
    this.drawHero(r.fighter, r.phase === 'dead');
    const heroStatus = new Set<string>();
    for (const [key, frame, visible] of [
      ['cold-status', '6', (r.fighter.coldStacks ?? 0) > 0 || (r.fighter.freezeTime ?? 0) > 0],
      ['bleed-status', '7', (r.fighter.bleedTime ?? 0) > 0],
    ] as const) {
      if (visible && r.phase === 'combat') {
        heroStatus.add(key);
        this.actor(key, 'boss-fields')
          .setFrame(frame)
          .setVisible(true)
          .setPosition(r.fighter.x, r.fighter.y - 32)
          .setOrigin(0.5)
          .setDisplaySize(85, 85)
          .setDepth(r.fighter.y + 1)
          .setAlpha(0.7)
          .setRotation(0)
          .clearTint();
      }
    }
    for (const enemy of r.enemies) {
      if (enemy.hp > 0 && r.phase === 'combat') {
        this.drawEnemy(enemy);
        this.actors.get(String(enemy.id))?.setData({
          bossSize: enemySize(enemy),
          attackTell: bossAttackTell(enemy) ?? null,
          combatPhase: bossCombatPhase(enemy),
        });
        this.seenAlive.set(enemy.id, { ...enemy });
      } else if (enemy.hp <= 0 && this.seenAlive.has(enemy.id)) {
        this.deaths.set(enemy.id, { enemy: this.seenAlive.get(enemy.id)!, at: this.animationTime });
        this.seenAlive.delete(enemy.id);
      }
    }
    for (const [id, death] of this.deaths) {
      const age = this.animationTime - death.at;
      if (age >= 0.38) this.deaths.delete(id);
      else this.drawEnemy(death.enemy, age);
    }
    for (const id of this.actors.keys())
      if (
        id !== 'hero' &&
        !heroStatus.has(id) &&
        !this.deaths.has(Number(id)) &&
        !r.enemies.some((e) => String(e.id) === id && e.hp > 0) &&
        !r.encounterObjects?.some((o) => `object-${o.id}` === id && o.life > 0)
      ) {
        this.actors.get(id)?.destroy();
        this.actors.delete(id);
        this.healthTrails.delete(Number(id));
        this.continuousActors.get(id)?.destroy();
        this.continuousActors.delete(id);
        this.motionClock.delete(id);
        this.poseTransition.delete(id);
      }
    this.bossReadability.draw(r, this.animationTime, this.reducedMotion);
    const launches = new Set<ReturnType<typeof projectileSound>>();
    for (const projectile of r.projectiles) {
      if (!this.heardProjectiles.has(projectile)) {
        this.heardProjectiles.add(projectile);
        if (!projectile.friendly && (projectile.delay ?? 0) <= 0)
          launches.add(projectileSound(projectileVisual(projectile)));
        else if (!projectile.friendly) this.heardProjectiles.delete(projectile);
      }
    }
    for (const launch of launches) sound(launch, 0.65);
    this.paintedEffects.draw(r.effects, r.projectiles, r.fighter, combatCrowding(r));
    for (const e of r.enemies)
      if (e.hp > 0) {
        if (e.poisonStacks) {
          this.graphics.fillStyle(0x9ecb73, 1);
          for (let n = 0; n < e.poisonStacks; n++)
            this.graphics.fillCircle(e.x - 16 + n * 8, e.y - 66, 3);
        }
        if (e.blossom) {
          this.graphics.fillStyle(0xeeb0bd, 1);
          for (let n = 0; n < e.blossom; n++)
            this.graphics.fillEllipse(e.x - 8 + n * 8, e.y - 60, 6, 4);
        }
        if ((e.confused ?? 0) > 0) {
          this.graphics.fillStyle(0xc4a378, 0.9);
          for (const offset of [-8, 8])
            this.graphics.fillTriangle(
              e.x + offset,
              e.y - 69,
              e.x + offset - 2,
              e.y - 64,
              e.x + offset + 2,
              e.y - 64,
            );
        }
      }
    this.feedback.draw(this.graphics, this.animationTime, this.reducedMotion);
    if (r.fighter.level > this.lastLevel) sound('level');
    this.lastLevel = r.fighter.level;
    if (r.phase === 'dead' && !this.wasDead) sound('death');
    this.wasDead = r.phase === 'dead';
  }
}
