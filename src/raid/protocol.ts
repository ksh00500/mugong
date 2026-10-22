import { parsePvpMessage } from '../pvp/protocol';
import type { RaidMessage } from './model';
export function parseRaidMessage(v: unknown): RaidMessage | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const m = v as Record<string, unknown>;
  if (['ready', 'unready', 'start', 'return', 'medicine'].includes(String(m.type))) {
    return Object.keys(m).length === 2 &&
      Number.isSafeInteger(m.revision) &&
      Number(m.revision) >= 0
      ? (m as unknown as RaidMessage)
      : null;
  }
  if (!['create', 'join', 'resume', 'leave', 'ping', 'input'].includes(String(m.type))) return null;
  return parsePvpMessage(m) as RaidMessage | null;
}
