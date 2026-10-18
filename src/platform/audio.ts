import { useSyncExternalStore } from 'react';
import { COMBAT_SOUNDS, synthesizeCombatSound, type CombatSound } from './combat-sounds';

export type AudioPreferences = {
  muted: boolean;
  master: number;
  music: number;
  effects: number;
  ambient: number;
};
type SoundKind = CombatSound
  | 'bell'
  | 'slash'
  | 'impact'
  | 'hit'
  | 'level'
  | 'death'
  | 'parry'
  | 'block'
  | 'evade'
  | 'select'
  | 'confirm'
  | 'reject'
  | 'store'
  | 'step'
  | 'warning';
type AudioScene = 'lobby' | 'combat' | 'boss' | 'pause' | 'off';
const KEY = 'mugong-audio-v1';
const defaults: AudioPreferences = {
  muted: false,
  master: 0.75,
  music: 0.35,
  effects: 0.8,
  ambient: 0.2,
};
function readPreferences(): AudioPreferences {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return {
      muted: data.muted === true,
      ...Object.fromEntries(
        (['master', 'music', 'effects', 'ambient'] as const).map((key) => [
          key,
          typeof data[key] === 'number' && Number.isFinite(data[key])
            ? Math.max(0, Math.min(1, data[key]))
            : defaults[key],
        ]),
      ),
    } as AudioPreferences;
  } catch {
    return { ...defaults };
  }
}
let preferences = readPreferences();
export let muted = preferences.muted;
type AudioStatus = 'locked' | 'ready' | 'unavailable';
let status: AudioStatus = 'locked';
let snapshot: AudioPreferences & { status: AudioStatus } = { ...preferences, status };
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const getSnapshot = () => snapshot;
function notify() {
  snapshot = { ...preferences, status };
  listeners.forEach((fn) => fn());
}
export const useAudio = () => useSyncExternalStore(subscribe, getSnapshot);
export function setAudioPreferences(next: Partial<AudioPreferences>) {
  preferences = { ...preferences, ...next };
  for (const key of ['master', 'music', 'effects', 'ambient'] as const)
    preferences[key] = Math.max(
      0,
      Math.min(1, Number.isFinite(preferences[key]) ? preferences[key] : defaults[key]),
    );
  muted = preferences.muted;
  try {
    localStorage.setItem(KEY, JSON.stringify(preferences));
  } catch {
    /* Works for this session. */
  }
  applyMix();
  notify();
  void refreshTrack();
}
export function setMuted(value: boolean) {
  setAudioPreferences({ muted: value });
}
if (typeof window !== 'undefined')
  window.addEventListener('storage', (event) => {
    if (event.key !== KEY) return;
    preferences = readPreferences();
    muted = preferences.muted;
    applyMix();
    notify();
    void refreshTrack();
  });

let context: AudioContext | undefined;
let master: GainNode, effects: GainNode, music: GainNode, ambient: GainNode;
let scene: AudioScene = 'off',
  epoch = 0;
let track: { source: AudioBufferSourceNode; gain: GainNode; name: string } | undefined;
let environment: AudioBufferSourceNode | undefined;
const buffers = new Map<string, AudioBuffer>();
const loading = new Map<string, Promise<AudioBuffer>>();
const voices: { source: AudioBufferSourceNode; priority: number }[] = [];
let lastUi = 0,
  lastWarning = -1;
const lastCombat = new Map<CombatSound, number>();
const recentSounds: string[] = [];
function ramp(gain: GainNode, value: number, seconds = 0.06) {
  if (!context) return;
  gain.gain.cancelScheduledValues(context.currentTime);
  gain.gain.setTargetAtTime(value, context.currentTime, seconds);
}
function applyMix() {
  if (!context) return;
  ramp(master, muted || document.hidden ? 0 : preferences.master, 0.015);
  ramp(effects, preferences.effects);
  ramp(music, preferences.music * (scene === 'pause' ? 0.35 : scene === 'boss' ? 0.8 : 1));
  ramp(
    ambient,
    preferences.ambient *
      (scene === 'lobby' ? 0.1 : scene === 'combat' || scene === 'boss' ? 0.2 : 0),
  );
}
export function unlockAudio() {
  if (context?.state === 'running') {
    if (!track && !muted) void refreshTrack();
    return;
  }
  try {
    if (!context) {
      context = new AudioContext();
      master = context.createGain();
      effects = context.createGain();
      music = context.createGain();
      ambient = context.createGain();
      const limiter = context.createDynamicsCompressor();
      limiter.threshold.value = -12;
      limiter.knee.value = 10;
      limiter.ratio.value = 6;
      effects.connect(master);
      music.connect(master);
      ambient.connect(master);
      master.connect(limiter);
      limiter.connect(context.destination);
      master.gain.value = muted ? 0 : preferences.master;
      effects.gain.value = preferences.effects;
      music.gain.value = preferences.music;
      ambient.gain.value = 0;
      document.addEventListener('visibilitychange', () => {
        applyMix();
        if (document.hidden) void context?.suspend().catch(() => {});
        // Resume requires a fresh user gesture on browsers that enforce autoplay.
      });
    }
    void context.resume().then(
      () => {
        status = 'ready';
        applyMix();
        notify();
        void refreshTrack();
      },
      () => {
        status = 'unavailable';
        notify();
      },
    );
  } catch {
    status = 'unavailable';
    notify();
  }
}
export function setAudioScene(value: AudioScene) {
  if (scene === value) return;
  scene = value;
  epoch++;
  applyMix();
  void refreshTrack();
}
async function loadTrack(name: string) {
  if (buffers.has(name)) return buffers.get(name)!;
  if (!loading.has(name))
    loading.set(
      name,
      (async () => {
        let result: AudioBuffer;
        try {
          const response = await fetch(`/audio/${name}.webm`, {
            signal: AbortSignal.timeout(12000),
          });
          if (!response.ok) throw new Error('audio');
          result = await context!.decodeAudioData(await response.arrayBuffer());
        } catch {
          const response = await fetch(`/audio/${name}.wav`, {
            signal: AbortSignal.timeout(12000),
          });
          if (!response.ok) throw new Error('audio');
          result = await context!.decodeAudioData(await response.arrayBuffer());
        }
        buffers.set(name, result);
        return result;
      })().finally(() => loading.delete(name)),
    );
  return loading.get(name)!;
}
function stopTrack() {
  if (!track || !context) return;
  const previous = track;
  track = undefined;
  ramp(previous.gain, 0, 0.1);
  previous.source.stop(context.currentTime + 0.5);
}
async function refreshTrack() {
  if (!context || context.state !== 'running' || muted) return;
  const name = scene === 'lobby' ? 'lobby-v1' : scene === 'off' ? '' : 'combat-v1';
  if (!name) {
    stopTrack();
    return;
  }
  if (track?.name === name) return;
  const requestedEpoch = epoch;
  try {
    const buffer = await loadTrack(name);
    if (epoch !== requestedEpoch || context.state !== 'running' || track?.name === name) return;
    stopTrack();
    const source = context.createBufferSource(),
      gain = context.createGain();
    source.buffer = buffer;
    source.loop = true;
    gain.gain.value = 0;
    source.connect(gain);
    gain.connect(music);
    source.start();
    ramp(gain, 0.45, 0.3);
    track = { source, gain, name };
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
    };
    if (!environment) {
      environment = context.createBufferSource();
      const air = context.createBuffer(1, context.sampleRate * 4, context.sampleRate);
      const data = air.getChannelData(0);
      let previous = 0;
      for (let i = 0; i < data.length; i++) {
        previous = 0.985 * previous + 0.015 * (Math.random() * 2 - 1);
        data[i] = previous * 0.18;
      }
      environment.buffer = air;
      environment.loop = true;
      environment.connect(ambient);
      environment.start();
    }
  } catch {
    /* Music failure never blocks combat or changes saves. Retry on the next gesture. */
  }
}

function effectBuffer(kind: SoundKind) {
  const key = `sfx-${kind}`;
  if (buffers.has(key)) return buffers.get(key)!;
  if (kind in COMBAT_SOUNDS) {
    const samples = synthesizeCombatSound(kind as CombatSound, context!.sampleRate);
    const buffer = context!.createBuffer(1, samples.length, context!.sampleRate);
    buffer.copyToChannel(samples, 0);
    buffers.set(key, buffer);
    return buffer;
  }
  const ctx = context!,
    duration = kind === 'level' ? 0.45 : kind === 'death' ? 0.5 : kind === 'confirm' ? 0.22 : 0.15;
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  const pitches: Record<Exclude<SoundKind, CombatSound>, number> = {
    slash: 680,
    impact: 340,
    hit: 210,
    level: 620,
    death: 330,
    parry: 880,
    bell: 1120,
    block: 440,
    evade: 740,
    select: 600,
    confirm: 740,
    reject: 280,
    store: 560,
    step: 150,
    warning: 780,
  };
  let phase = 0,
    noise = 0;
  for (let i = 0; i < data.length; i++) {
    const time = i / ctx.sampleRate,
      progress = time / duration;
    let frequency =
      pitches[kind as Exclude<SoundKind, CombatSound>] *
      (kind === 'level' || kind === 'confirm' || kind === 'store'
        ? 1 + (0.6 * Math.floor(progress * 3)) / 2
        : 1 - 0.55 * progress);
    phase += (2 * Math.PI * frequency) / ctx.sampleRate;
    noise = 0.5 * noise + 0.5 * (Math.random() * 2 - 1);
    const soft =
      Math.sin(phase) +
      (kind === 'bell' ? 0.28 * Math.sin(phase * 2.7) : 0.16 * Math.sin(phase * 2));
    const whoosh = kind === 'slash' || kind === 'evade';
    const mix = whoosh
      ? noise * 0.65 + soft * 0.08
      : soft * 0.65 + noise * (kind === 'impact' || kind === 'block' ? 0.18 : 0.025);
    const envelope =
      Math.min(1, time / 0.004) * Math.pow(1 - progress, kind === 'level' ? 1.1 : 2.5);
    data[i] =
      mix * envelope * (kind === 'step' ? 0.028 : whoosh ? 0.22 : kind === 'hit' ? 0.22 : 0.15);
  }
  buffers.set(key, buffer);
  return buffer;
}
export function sound(kind: SoundKind, weight = 1) {
  if (muted || !context || context.state !== 'running' || document.hidden || !preferences.effects)
    return;
  if (kind === 'select' && context.currentTime - lastUi < 0.055) return;
  if (kind === 'select') lastUi = context.currentTime;
  if (kind === 'warning' && context.currentTime - lastWarning < 0.22) return;
  if (kind === 'warning') lastWarning = context.currentTime;
  if (kind in COMBAT_SOUNDS) {
    const key = kind as CombatSound;
    if (context.currentTime - (lastCombat.get(key) ?? -10) < .08) return;
    lastCombat.set(key, context.currentTime);
  }
  const priority =
    kind === 'warning'
      ? 4
      : kind === 'hit' || kind === 'parry' || kind === 'death' || kind === 'level'
        ? 3
        : kind === 'impact' || kind === 'block' || kind in COMBAT_SOUNDS
          ? 2
          : 1;
  if (voices.length >= 12) {
    const victim = voices.find((voice) => voice.priority < priority);
    if (!victim) return;
    victim.source.stop();
    voices.splice(voices.indexOf(victim), 1);
  }
  const source = context.createBufferSource(),
    gain = context.createGain();
  source.buffer = effectBuffer(kind);
  source.playbackRate.value = kind === 'level' || kind === 'death' ? 1 : 0.95 + Math.random() * 0.1;
  gain.gain.value = Math.max(0.3, Math.min(1.2, weight));
  source.connect(gain);
  gain.connect(effects);
  const voice = { source, priority };
  voices.push(voice);
  source.onended = () => {
    const index = voices.indexOf(voice);
    if (index >= 0) voices.splice(index, 1);
    source.disconnect();
    gain.disconnect();
  };
  source.start();
  recentSounds.push(kind);
  if (recentSounds.length > 32) recentSounds.shift();
  if (priority >= 3 && track) {
    ramp(track.gain, 0.2, 0.02);
    track.gain.gain.setTargetAtTime(0.45, context.currentTime + 0.25, 0.15);
  }
}
export function audioDiagnostics() {
  return {
    status,
    context: context?.state ?? 'none',
    scene,
    track: track?.name ?? '',
    voices: voices.length,
    buffers: buffers.size,
    recentSounds: [...recentSounds],
    master: master?.gain.value ?? 0,
    preferences: { ...preferences },
  };
}
