"""Original MUGONG loops. No recordings, commercial samples or external assets."""
from pathlib import Path
import json, wave
import numpy as np

RATE = 24000
ROOT = Path(__file__).resolve().parents[1] / 'public' / 'audio'
ROOT.mkdir(parents=True, exist_ok=True)
rng = np.random.default_rng(290926)

def note(track, beat, midi, length, volume, pan=0, flute=False, bpm=80):
    n = int(length * RATE)
    t = np.arange(n) / RATE
    freq = 440 * 2 ** ((midi - 69) / 12)
    if flute:
        env = np.minimum(t / .12, 1) * np.minimum((length - t) / .25, 1)
        tone = np.sin(2*np.pi*freq*t + .035*np.sin(2*np.pi*4.4*t)) + .12*np.sin(2*np.pi*freq*2*t)
    else:
        env = np.minimum(t / .006, 1) * np.exp(-t * 3.4 / length)
        tone = sum(np.sin(2*np.pi*freq*k*t) * np.exp(-t*k*.7) / k**1.8 for k in range(1, 5))
    mono = tone * env * volume
    start = int(beat * 60 / bpm * RATE)
    signal = np.stack([mono*np.sqrt((1-pan)/2), mono*np.sqrt((1+pan)/2)], axis=1)
    # Wrap release tails into the start, so the file is a seamless loop.
    indexes = (np.arange(n) + start) % len(track)
    np.add.at(track, indexes, signal)

def compose(name, bpm, combat=False):
    track = np.zeros((int(32 * 60 / bpm * RATE), 2))
    melody = [72, 76, 79, 81, 79, 76, 74, 72, 69, 72, 74, 76, 74, 72, 67, 69]
    chords = [(48,55,60),(45,52,57),(53,60,65),(48,55,60)]
    for bar, chord in enumerate(chords):
        for step in range(8):
            note(track, bar*8+step, chord[step%3]+12, 1.5, .06 if combat else .07, -.3, bpm=bpm)
        note(track, bar*8, chord[0], 4, .065, .1, bpm=bpm)
    for i, pitch in enumerate(melody):
        note(track, i*2+.15, pitch, 1.2 if combat else 1.65, .055, .25, flute=True, bpm=bpm)
    if combat:
        for beat in range(32):
            start = int(beat*60/bpm*RATE)
            n = int(.11*RATE); t=np.arange(n)/RATE
            pulse = np.sin(2*np.pi*(110*t-120*t*t))*np.exp(-t*35)*.065
            # Warm wood-like click, deliberately free of metal/gong tails.
            pulse += rng.normal(0, .008, n)*np.exp(-t*65)
            track[start:start+n] += pulse[:,None]
    # Tiny room echoes with circular delays; no abrupt loop boundary.
    track += np.roll(track[:, ::-1], int(.17*RATE), axis=0)*.11
    track += np.roll(track[:, ::-1], int(.31*RATE), axis=0)*.06
    peak=float(np.max(np.abs(track)))
    track *= .58/max(peak,.001)
    with wave.open(str(ROOT / f'{name}.wav'), 'wb') as out:
        out.setnchannels(2); out.setsampwidth(2); out.setframerate(RATE)
        out.writeframes((track*32767).astype('<i2').tobytes())
    return dict(file=f'{name}.wav', bpm=bpm, seconds=len(track)/RATE,
                peak=float(np.max(np.abs(track))), rms=float(np.sqrt(np.mean(track**2))),
                clipping_samples=int(np.sum(np.abs(track)>=1)))

data=[compose('lobby-v1',80),compose('combat-v1',96,True)]
(ROOT/'manifest.json').write_text(json.dumps({'author':'MUGONG original procedural composition',
  'source':'scripts/compose-audio.py', 'license':'Original project assets; no third-party samples',
  'tracks':data},indent=2),encoding='utf8')
print(json.dumps(data))
