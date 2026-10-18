import type { EncounterObject, Run } from '../domain/model';
import { encounterEffect } from '../domain/boss-encounters';
import frames from '../platform/zone-frames.json';

export type ZoneArt = keyof typeof frames;
export function encounterZoneArt(run: Run, object: EncounterObject): ZoneArt | undefined {
  if (object.mechanic === 'plate')
    return object.stage === 0
      ? object.kind === 'mine'
        ? (encounterEffect(run, object) as ZoneArt)
        : 'trap'
      : undefined;
  if (object.mechanic && object.mechanic !== 'formation') return undefined;
  switch (object.kind) {
    case 'mine':
    case 'smoke':
      return encounterEffect(run, object) as ZoneArt;
    case 'tether':
      return 'chain';
    case 'blood':
      return 'blood';
    case 'seal':
      return 'gate';
    case 'flag':
      return undefined;
    case 'safe':
      return 'safe';
    case 'volley':
      return 'trap';
    default:
      return undefined;
  }
}

export const ZONE_COLORS: Record<ZoneArt, number> = {
  poison: 0x93ba68,
  cold: 0x85c7d4,
  trap: 0xe69a67,
  gate: 0xc49ddb,
  warm: 0xddab5f,
  blood: 0xe4867b,
  smoke: 0xbac9ba,
  safe: 0x8ecf9c,
  fire: 0xefb16e,
  sand: 0xdfc395,
  chain: 0xe69a67,
  brew: 0xddab5f,
};
