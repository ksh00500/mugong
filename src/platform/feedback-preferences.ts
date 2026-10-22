import { useSyncExternalStore } from 'react';
export type ShakePreference = 'off' | 'subtle' | 'standard';
const KEY = 'mugong-feedback-v1';
const valid = (value: unknown): value is ShakePreference =>
  ['off', 'subtle', 'standard'].includes(String(value));
function read(): ShakePreference {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? '{}').shake;
    return valid(value) ? value : 'subtle';
  } catch {
    return 'subtle';
  }
}
let preference = read();
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const useShakePreference = () => useSyncExternalStore(subscribe, () => preference);
export const shakeStrength = () => ({ off: 0, subtle: 0.55, standard: 1 })[preference];
export function setShakePreference(value: ShakePreference) {
  if (!valid(value)) return;
  preference = value;
  try {
    localStorage.setItem(KEY, JSON.stringify({ shake: value }));
  } catch {
    /* Applies for this session even when storage is unavailable. */
  }
  listeners.forEach((listener) => listener());
}
if (typeof window !== 'undefined')
  window.addEventListener('storage', (event) => {
    if (event.key === KEY || event.key === null) {
      preference = read();
      listeners.forEach((listener) => listener());
    }
  });
