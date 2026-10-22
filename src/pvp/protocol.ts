import { isPreset } from './rules';
import type { ClientMessage } from './model';
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const finite = (v: unknown, min: number, max: number) =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
/** A strict allowlist: clients send intent, never positions, stats, HP or victories. */
export function parsePvpMessage(value: unknown): ClientMessage | null {
  if (!object(value) || typeof value.type !== 'string') return null;
  let keys: string[] = [];
  if (['cancel', 'resume', 'ready', 'leave', 'surrender'].includes(value.type)) keys = ['type'];
  else if (['create', 'queue', 'join'].includes(value.type)) {
    if (!isPreset(value.preset)) return null;
    keys = value.type === 'join' ? ['type', 'preset', 'code'] : ['type', 'preset'];
    if (
      value.type === 'join' &&
      (typeof value.code !== 'string' || !/^[A-Z2-9]{6}$/.test(value.code))
    )
      return null;
  } else if (value.type === 'ping') {
    if (!finite(value.sent, 0, Number.MAX_SAFE_INTEGER)) return null;
    keys = ['type', 'sent'];
  } else if (value.type === 'input') {
    keys = ['type', 'epoch', 'seq', 'dx', 'dy', 'aim', 'attack', 'defense', 'ultimate', 'switch'];
    if (
      !Number.isSafeInteger(value.epoch) ||
      !Number.isSafeInteger(value.seq) ||
      !finite(value.epoch, 0, Number.MAX_SAFE_INTEGER) ||
      !finite(value.seq, 0, Number.MAX_SAFE_INTEGER) ||
      !finite(value.dx, -1, 1) ||
      !finite(value.dy, -1, 1) ||
      !finite(value.aim, -Math.PI, Math.PI) ||
      ![-1, 0, 1].includes(Number(value.switch)) ||
      typeof value.switch !== 'number' ||
      !['attack', 'defense', 'ultimate'].every((k) => typeof value[k] === 'boolean')
    )
      return null;
  } else return null;
  if (Object.keys(value).length !== keys.length || !keys.every((k) => Object.hasOwn(value, k)))
    return null;
  return value as unknown as ClientMessage;
}
