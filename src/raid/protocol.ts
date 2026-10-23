import { parsePvpMessage } from '../pvp/protocol';
import type { RaidMessage } from './model';
import { onlineCommand } from '../online/protocol';
import { isPreset } from '../pvp/rules';
export function parseRaidMessage(v: unknown): RaidMessage | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const m = v as Record<string, unknown>;
  if (m.type === 'personal')
    return Object.keys(m).length === 4 &&
      Number.isSafeInteger(m.revision) &&
      typeof m.op === 'string' &&
      /^[a-f0-9-]{36}$/.test(m.op) &&
      onlineCommand(m.command)
      ? (m as unknown as RaidMessage)
      : null;
  if (m.type === 'recoverHeir')
    return Object.keys(m).length === 3 &&
      Number.isSafeInteger(m.revision) &&
      typeof m.id === 'string' &&
      m.id.length < 200
      ? (m as unknown as RaidMessage)
      : null;
  if ((m.type === 'create' || m.type === 'join') && 'fighterId' in m) {
    return Object.keys(m).length === (m.type === 'create' ? 3 : 4) &&
      isPreset(m.preset) &&
      typeof m.fighterId === 'string' &&
      m.fighterId.length > 0 &&
      m.fighterId.length <= 160 &&
      (m.type === 'create' || (typeof m.code === 'string' && /^[A-Z2-9]{6}$/.test(m.code)))
      ? (m as unknown as RaidMessage)
      : null;
  }
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
