import source from './catalogue.json' with { type: 'json' };
import type { Run } from './model';
import { BOSS_ATTACKS } from './boss-attacks';

export const REGIONS = source.regions;
export const BOSSES = source.bosses;
export const ART_STAGES = source.arts;
export type RegionName = (typeof REGIONS)[number]['name'];
export type BossMove =
  | 'slash'
  | 'thrust'
  | 'dash'
  | 'fan'
  | 'ring'
  | 'pulse'
  | 'hazard'
  | 'summon'
  | 'sweep'
  | 'slam'
  | 'combo'
  | 'stance'
  | 'grab'
  | 'bell';

export function drawRegionRoute(random: () => number): string[] {
  const choices = REGIONS.map((region) => region.name);
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  return choices.slice(0, 4);
}

/** Old saves retain their original four-area route without rewriting user state. */
const legacyRoute = ['죽림 외곽', '낡은 산문', '고요한 고개', '강호의 문턱'];
export function regionName(run: Pick<Run, 'wave' | 'regionRoute'>): string {
  return (run.regionRoute ?? legacyRoute)[Math.floor((run.wave - 1) / 5)] ?? legacyRoute[0];
}

export function bossDefinition(run: Pick<Run, 'wave' | 'regionRoute'>) {
  const region = regionName(run);
  const phase = Math.ceil(run.wave / 5);
  const index = REGIONS.findIndex((entry) => entry.name === region);
  if (index < 0) return null;
  const boss = BOSSES.find((entry) => entry.region === region && entry.phase === phase);
  return boss
    ? { ...boss, id: `${index}-${phase}`, moves: BOSS_ATTACKS[index][phase - 1].sequence }
    : null;
}

export function bossById(id?: string) {
  if (!id) return null;
  const [regionIndex, phase] = id.split('-').map(Number);
  const region = REGIONS[regionIndex];
  if (
    !region ||
    !Number.isInteger(phase) ||
    phase < 1 ||
    phase > 4 ||
    id !== `${regionIndex}-${phase}`
  )
    return null;
  const boss = BOSSES.find((entry) => entry.region === region.name && entry.phase === phase);
  return boss ? { ...boss, id, moves: BOSS_ATTACKS[regionIndex][phase - 1].sequence } : null;
}
