import type { CombatWorld, PvpInput, PresetId } from '../pvp/model';
import type { Item, Fighter } from '../domain/model';
export type RaidStatus = 'active' | 'dead' | 'returned' | 'expired';
export type RaidPattern = 'cleave' | 'volley' | 'guard' | 'charge' | 'marks';
export const RAID_FLOORS = [
  { name: '외곽 경계', boss: '죽림 경계장', art: 3, hp: 1600, patterns: ['cleave', 'charge'] },
  { name: '훈련 마당', boss: '산채 사수장', art: 4, hp: 1800, patterns: ['volley', 'marks'] },
  {
    name: '병기고',
    boss: '철갑 호위장',
    art: 5,
    hp: 2000,
    patterns: ['guard', 'cleave', 'charge'],
  },
  { name: '내원', boss: '내원 추격자', art: 3, hp: 2200, patterns: ['charge', 'marks', 'cleave'] },
  {
    name: '산채 본당',
    boss: '흑풍채주',
    art: 6,
    hp: 2500,
    patterns: ['cleave', 'volley', 'marks', 'charge'],
  },
] as const;
export interface RaidState extends CombatWorld {
  personal?: boolean;
  rewardFloor?: number;
  heirs?: {
    id: string;
    owner: number;
    item: Item;
    carrier?: number;
    x?: number;
    y?: number;
    returned?: boolean;
    lost?: boolean;
  }[];
  id: string;
  phase: 'countdown' | 'fighting' | 'rest' | 'finished';
  tick: number;
  epoch: number;
  floor: number;
  phaseTicks: number;
  floorTicks: number;
  scaledFor: number;
  status: RaidStatus[];
  damage: number[];
  taken: number[];
  medicine: number[];
  cleared: number;
  result?: 'complete' | 'wipe' | 'time' | 'retreat' | 'abandoned';
  boss: {
    pattern: RaidPattern;
    phase: 'approach' | 'windup' | 'strike' | 'recover';
    clock: number;
    duration: number;
    target: number;
    cycle: number;
    x: number;
    y: number;
    aim: number;
    chargeLeft: number;
    nextCharge: number;
    /** Time spent outside combat distance; absent in older durable snapshots. */
    pursuitTime?: number;
  };
}
export interface RaidReceipt {
  id: string;
  runId: string;
  name: string;
  outcome: string;
  floor: number;
  damage: number;
  taken: number;
  finishedAt: number;
}
export interface RaidRoom {
  operation?: string;
  personal?: boolean;
  ownSave?: import('../online/protocol').OnlineSave;
  code: string;
  revision: number;
  host: number;
  seats: (null | {
    name: string;
    preset: PresetId;
    ready: boolean;
    connected: boolean;
    ack: number;
    status: RaidStatus;
    fighter?: Fighter;
  })[];
  match: RaidState | null;
  receipt: RaidReceipt | null;
  settling: boolean;
}
export type RaidMessage =
  | { type: 'create'; preset: PresetId; fighterId?: string }
  | { type: 'join'; preset: PresetId; code: string; fighterId?: string }
  | { type: 'personal'; revision: number; op: string; command: import('../domain/model').Command }
  | { type: 'recoverHeir'; revision: number; id: string }
  | { type: 'resume' | 'leave' }
  | { type: 'ready' | 'unready' | 'start' | 'return' | 'medicine'; revision: number }
  | { type: 'ping'; sent: number }
  | ({ type: 'input'; epoch: number; seq: number } & PvpInput);
