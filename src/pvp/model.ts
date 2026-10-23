import type { ArtId, BoundFighter, Formation } from '../domain/model';
export type Seat = 0 | 1;
export type PvpMode = 'friendly' | 'ranked';
export type PresetId = 'sword' | 'monk' | 'shadow' | 'mystic';
export type PvpPhase = 'waiting' | 'countdown' | 'fighting' | 'interval' | 'finished';
export type EndReason =
  'knockout' | 'time' | 'surrender' | 'disconnect' | 'round-limit' | 'server-restart' | 'abandoned';
export interface PvpInput {
  dx: number;
  dy: number;
  aim: number;
  attack: boolean;
  defense: boolean;
  ultimate: boolean;
  switch: -1 | 0 | 1;
}
export const neutralInput = (): PvpInput => ({
  dx: 0,
  dy: 0,
  aim: 0,
  attack: false,
  defense: false,
  ultimate: false,
  switch: 0,
});
export interface CombatActor {
  personal?: boolean;
  seat: number;
  team?: number;
  passive?: boolean;
  inactive?: boolean;
  damageDealt?: number;
  damageTaken?: number;
  preset: PresetId;
  fighter: BoundFighter;
  maxHp: number;
  poison: number;
  poisonClock: number;
  poisonSource?: number;
  /** Personal-raid poison follows the owned technique's 0.5s pulse and 3/5-stack cap. */
  ownedPoison?: { damage: number; level: number; pulse: number };
  /** Bounded, expiring per-caster volley history survives interleaved darts/reconnects. */
  ownedPoisonVolleys?: { source: number; sequence: number; hits: number; life: number }[];
  ownedFormations?: Formation[];
  buff: number;
  hurt: number;
}
export interface PvpActor extends CombatActor {
  seat: Seat;
}
export interface PvpAttack {
  id: number;
  owner: number;
  art: ArtId;
  shape: 'sector' | 'shot' | 'burst';
  x: number;
  y: number;
  angle: number;
  range: number;
  arc: number;
  damage: number;
  delay: number;
  life: number;
  speed: number;
  radius: number;
  heal: number;
  poison: boolean;
  /** Owned-fighter basic sequence; absent in old durable attacks and standard PvP. */
  basicSequence?: number;
  ownedTechnique?: { variant: 'a' | 'b'; level: number };
  /** Release from the current hand origin after preparation, keeping the accepted aim. */
  releaseFromOwner?: boolean;
}
export interface PvpEffect {
  id: number;
  kind: 'hit' | 'guard' | 'evade' | 'ultimate' | 'poison-burst';
  seat: number;
  x: number;
  y: number;
  amount: number;
  life: number;
}
export interface PvpMatch {
  id: string;
  mode: PvpMode;
  phase: PvpPhase;
  tick: number;
  epoch: number;
  round: number;
  phaseTicks: number;
  roundTicks: number;
  totalTicks: number;
  wins: [number, number];
  players: [PvpActor, PvpActor];
  attacks: PvpAttack[];
  effects: PvpEffect[];
  sequence: number;
  roundWinner: Seat | null;
  winner: Seat | null;
  reason?: EndReason;
}
export interface CombatWorld {
  players: CombatActor[];
  attacks: PvpAttack[];
  effects: PvpEffect[];
  sequence: number;
}
export interface OnlineAccount {
  id: string;
  name: string;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
  matches: number;
}
export interface MatchReceipt {
  id: string;
  mode: PvpMode;
  winner: Seat | null;
  reason: EndReason;
  names: [string, string];
  scores: [number, number];
  ratings: [number, number];
  deltas: [number, number];
  finishedAt: number;
}
export interface RoomState {
  code: string;
  mode: PvpMode;
  seats: [
    null | {
      name: string;
      preset: PresetId;
      ready: boolean;
      connected: boolean;
      rating: number;
      ack: number;
    },
    null | {
      name: string;
      preset: PresetId;
      ready: boolean;
      connected: boolean;
      rating: number;
      ack: number;
    },
  ];
  match: PvpMatch | null;
  receipt: MatchReceipt | null;
  settling: boolean;
}
export type ClientMessage =
  | { type: 'create'; preset: PresetId }
  | { type: 'join'; code: string; preset: PresetId }
  | { type: 'queue'; preset: PresetId }
  | { type: 'cancel' | 'resume' | 'ready' | 'leave' | 'surrender' }
  | { type: 'ping'; sent: number }
  | ({ type: 'input'; epoch: number; seq: number } & PvpInput);
export type ServerMessage =
  | { type: 'room'; seat: Seat; room: RoomState }
  | { type: 'queue'; since: number }
  | { type: 'idle' }
  | { type: 'error'; message: string }
  | { type: 'pong'; sent: number };
