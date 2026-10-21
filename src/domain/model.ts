export type ArtId =
  'huashan' | 'wudang' | 'tianmo' | 'samja' | 'tang' | 'shaolin' | 'gaebang' | 'jegal';
export type Phase = 'combat' | 'loot' | 'prep' | 'dead' | 'victory';
export type Place = 'weapon' | 'general' | 'ground' | 'warehouse' | 'equipped';
export type ItemKind = 'sword' | 'robe' | 'boots' | 'charm' | 'medicine' | 'manual' | 'ore';
export type WeaponStyle = 'sword' | 'dao' | 'dart' | 'gauntlet' | 'staff' | 'fan';
export interface Item {
  statRevision?: 1;
  id: string;
  templateId?: string;
  rarity?: 'common' | 'refined' | 'rare' | 'heroic';
  upgrades?: number;
  kind: ItemKind;
  weaponStyle?: WeaponStyle;
  originBoss?: string;
  name: string;
  w: number;
  h: number;
  place: Place;
  x: number;
  y: number;
  rotated: boolean;
  count: number;
  quality: number;
  power: number;
}
export interface LearnedArt {
  id: ArtId;
  level: number;
  gauge: number;
  combo: number;
  defenseCd: number;
  queuedBoosts?: number;
  chainTime?: number;
  chain?: number;
  lastHit?: 'a' | 'b' | 'c';
  bonus?: number;
  buffTime?: number;
  rally?: number;
  rallyTime?: number;
  ultimateHealing?: number;
}
export interface Fighter {
  appearance?: import('./appearances').AppearanceId;
  portrait?: 0 | 1 | 2;
  progressionVersion?: 2;
  growthStartLevel?: number;
  innate?: import('./character').TraitId;
  augments?: import('./character').AugmentId[];
  augmentOffers?: import('./character').AugmentId[];
  trainingPoints?: number;
  deferredTrainingPoints?: number;
  traitState?: {
    survived?: boolean;
    untouched?: number;
    switchCd?: number;
    attackBoost?: number;
    staggerBoost?: number;
    momentum?: number;
    target?: number;
    hits?: number;
    sequence?: number;
  };
  growth?: GrowthRates;
  id: string;
  name: string;
  level: number;
  xp: number;
  hp: number;
  arts: LearnedArt[];
  active: number;
  items: Item[];
  spent?: number;
  bornAt?: number;
  expiresAt?: number;
  x: number;
  y: number;
  facing: number;
  action: string;
  actionTime: number;
  cooldown: number;
  invulnerable: number;
  guard: number;
  shield: number;
  attackSeq: number;
  fortify?: number;
  slowTime?: number;
  healSuppression?: number;
  poisonTime?: number;
  burnTime?: number;
  fieldTick?: number;
  bleedTime?: number;
  coldStacks?: number;
  coldTime?: number;
  freezeTime?: number;
  capturedTime?: number;
}
export interface Offer {
  art: ArtId;
  type: 'learn' | 'upgrade';
}
export interface Enemy {
  pressure?: {
    farTime: number;
    warning: number;
    burst: number;
    cooldown: number;
    lastDistance: number;
    advance?: number;
  };
  moving?: boolean;
  steerX?: number;
  steerY?: number;
  role?: import('./region-enemies').EnemyRole;
  id: number;
  kind: 'sword' | 'spear' | 'archer' | 'chief' | 'captain';
  bossId?: string;
  move?: import('./campaign').BossMove;
  targetX?: number;
  targetY?: number;
  strike?: {
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    duration: number;
    damage: number;
    hit: boolean;
    contactsDone?: number;
    target?: number;
  };
  summoned?: boolean;
  windDeflection?: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  facing: number;
  state: 'approach' | 'windup' | 'strike' | 'recover';
  timer: number;
  aim: number;
  pattern: number;
  xp: number;
  elite: boolean;
  hitSeq: number;
  poisonStacks?: number;
  poisonTime?: number;
  poisonTick?: number;
  poisonDamage?: number;
  poisonLevel?: number;
  poisonSeq?: number;
  poisonVolley?: number;
  blossom?: number;
  blossomTime?: number;
  confused?: number;
  skillClock?: number;
  guardTime?: number;
  rageTime?: number;
  veilTime?: number;
  staggerTime?: number;
  armourTime?: number;
  reactionTime?: number;
  observedAttack?: number;
}
export interface Projectile {
  delay?: number;
  landing?: { x: number; y: number; radius: number; kind: FieldZone['kind'] };
  visual?: import('./projectile-visual').ProjectileVisual;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  friendly: boolean;
  damage: number;
  radius: number;
  hits: number[];
  art?: ArtId;
  seq?: number;
  variant?: 'a' | 'b' | 'c';
  level?: number;
  owner?: number;
  hostileToEnemies?: boolean;
  returnAt?: number;
  returned?: boolean;
  bounces?: number;
  bounceObject?: number;
  bounceCooldown?: number;
  visualScale?: number;
  status?: 'poison' | 'cold' | 'bleed';
}
export interface Formation {
  x: number;
  y: number;
  life: number;
  pulse: number;
  damage: number;
  kind?: 'heaven' | 'earth' | 'ultimate';
  pulses?: number;
}
export interface Effect {
  weapon?: WeaponStyle;
  x: number;
  y: number;
  angle: number;
  kind: 'slash' | 'thrust' | 'burst' | 'hit' | 'guard' | 'arrow' | 'chain';
  life: number;
  duration: number;
  radius: number;
  color: number;
}
export interface PendingAttack {
  timer: number;
  angle: number;
  damage: number;
  range: number;
  arc: number;
  thrust: boolean;
  art?: ArtId;
  heal: boolean;
  variant?: 'a' | 'b' | 'c';
  boosted?: boolean;
  seq?: number;
}
export interface Run {
  restEvents?: import('./rest-event').RestEventRecord[];
  id: string;
  seed: number;
  wave: number;
  regionRoute?: string[];
  phase: Phase;
  fighter: Fighter;
  enemies: Enemy[];
  projectiles: Projectile[];
  effects: Effect[];
  attacks: PendingAttack[];
  formations?: Formation[];
  zones?: FieldZone[];
  zoneClock?: number;
  zoneSeq?: number;
  encounterObjects?: EncounterObject[];
  encounterSeq?: number;
  exchangeSeq?: number;
  petalStrikes?: { target: number; timer: number; damage: number }[];
  offers: Offer[];
  spent: number;
  xpBudget: number[];
  gold: number;
  kills: number;
  elapsed: number;
  message: string;
  merchantStock: number;
  supplies?: { templateId: string; stock: number; price: number }[];
}
export interface FieldZone {
  owner?: number;
  impactDamage?: number;
  id: number;
  x: number;
  y: number;
  radius: number;
  warning: number;
  life: number;
  pulse: number;
  kind: 'poison' | 'cold' | 'trap' | 'gate' | 'blood' | 'brew' | 'fire';
}
export const ENCOUNTER_KINDS = [
  'wall',
  'ice',
  'flag',
  'herb',
  'turret',
  'chest',
  'mine',
  'tether',
  'safe',
  'blood',
  'smoke',
  'seal',
  'volley',
] as const;
export interface EncounterObject {
  mechanic?:
    | 'bamboo'
    | 'falling-bamboo'
    | 'door'
    | 'rotating-door'
    | 'stone-door'
    | 'sandwall'
    | 'drone'
    | 'blade'
    | 'oasis'
    | 'plate'
    | 'exchange'
    | 'grab'
    | 'bell'
    | 'cleansing'
    | 'formation'
    | 'poison-powder'
    | 'poison-mist';
  age?: number;
  stage?: number;
  anchorX?: number;
  anchorY?: number;
  target?: number;
  id: number;
  owner: number;
  kind: (typeof ENCOUNTER_KINDS)[number];
  x: number;
  y: number;
  radius: number;
  warning: number;
  life: number;
  hp: number;
  maxHp: number;
  pulse: number;
  aim: number;
}
export interface GrowthRates {
  constitution: number;
  strength: number;
  agility: number;
  inner: number;
}
export interface Recruitment {
  tickets: number;
  anchor: number;
  observedAt: number;
  sequence: number;
  candidates: {
    id: string;
    seed: number;
    appearance?: import('./appearances').AppearanceId;
    portrait?: 0 | 1 | 2;
    growth: GrowthRates;
    innate?: import('./character').TraitId;
  }[];
}
export interface Family {
  recruitment?: Recruitment;
  silver?: number;
  journeys?: JourneyResult[];
  roster: Fighter[];
  warehouse: Item[];
  runs: number;
  victories: number;
  deaths: number;
  retired: number;
  itemSequence?: number;
  training?: { fighterId: string; offers: Offer[]; seed: number };
}
export interface JourneyResult {
  id: string;
  name: string;
  outcome: 'victory' | 'dead';
  wave: number;
  level: number;
  kills: number;
  elapsed: number;
  gold: number;
  items: number;
  route: string[];
  endedAt: number;
}
export interface GameState {
  version: 1;
  family: Family;
  run: Run | null;
  selectedId: string | null;
}
export interface InputFrame {
  dx: number;
  dy: number;
  aim: number;
  attack: boolean;
  ultimate: boolean;
  defense: boolean;
}
export type Command =
  | { type: 'restEvent'; choice: 'accept' | 'leave' }
  | { type: 'deferTraining' }
  | { type: 'openTraining' }
  | { type: 'chooseAugment'; id: import('./character').AugmentId }
  | { type: 'start'; name: string; seed?: number }
  | { type: 'recruit' }
  | { type: 'buyRecruitTicket' }
  | { type: 'startRecruit'; id: string; name: string }
  | { type: 'startBasic'; name: string }
  | { type: 'choose'; offer: Offer }
  | { type: 'next' }
  | { type: 'claim' }
  | { type: 'switch'; delta: number }
  | { type: 'moveItem'; id: string; place: Place; x?: number; y?: number; rotated?: boolean }
  | { type: 'bind'; art: ArtId; item: string }
  | { type: 'arrangeItems' }
  | { type: 'use'; id: string }
  | { type: 'buy'; kind: 'medicine' | 'manual' }
  | { type: 'buySupply'; templateId: string }
  | { type: 'sellMaterial'; id: string }
  | { type: 'refine'; id: string }
  | { type: 'heal' }
  | { type: 'discardItem'; id: string }
  | { type: 'select'; id: string };
// A weapon can serve several arts. Bindings remain explicit and survive saving.
export type BoundFighter = Fighter & { bindings?: Partial<Record<ArtId, string>> };
