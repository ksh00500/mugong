import { TRAIT_IDS, augmentOffers } from '../domain/character';
import type { GameState } from '../domain/model';
import { isGameSave } from './save-validation';
import { ITEM_DEFS } from '../domain/content';
import { itemDefinition, refinable } from '../domain/items';
import { statPrecision } from '../domain/balance';
import type { Item } from '../domain/model';

const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

/** Remove only a valid obsolete altar record. Never repair unrelated save corruption. */
export function decodeCurrentSave(raw: unknown): GameState | null {
  if (!record(raw)) return null;
  const state = structuredClone(raw);
  const run = state.run;
  if (record(run)) {
    if ('altarUsed' in run) {
      if (run.altarUsed !== undefined && typeof run.altarUsed !== 'boolean') return null;
      delete run.altarUsed;
    }
    if (Array.isArray(run.zones)) {
      if (run.zones.length > 8) return null;
      for (const zone of run.zones) {
        if (!record(zone) || zone.kind !== 'altar') continue;
        if (
          typeof zone.id !== 'number' ||
          !Number.isSafeInteger(zone.id) ||
          zone.id < 0 ||
          !['x', 'y', 'radius', 'warning', 'life', 'pulse'].every(
            (key) => typeof zone[key] === 'number' && Number.isFinite(zone[key]),
          )
        )
          return null;
      }
      run.zones = run.zones.filter((zone) => !record(zone) || zone.kind !== 'altar');
    }
  }
  // Previously earned gold, damage, deaths and progress are deliberately preserved.
  if (!isGameSave(state)) return null;
  // Correct only recognized legacy rounding. Preserve custom stats, upgrades, HP and progress.
  const items = [
    ...state.family.warehouse,
    ...state.family.roster.flatMap((f) => f.items),
    ...(state.run?.fighter.items ?? []),
  ];
  for (const item of items) migrateEquipmentPrecision(item);
  migrateCharacterProgression(state);
  return isGameSave(state) ? state : null;
}

function migrateEquipmentPrecision(item: Item) {
  if (!refinable(item) || item.statRevision === 1) return;
  const phase = item.originBoss ? Number(item.originBoss.split('-')[1]) : undefined;
  const base = phase
    ? item.kind === 'sword' ? 5 + phase * 2
      : item.kind === 'charm' ? 2 + phase : 2 + Math.floor(phase / 2)
    : itemDefinition(item.templateId)?.power ?? ITEM_DEFS[item.kind].power;
  const upgrades = item.upgrades ?? 0;
  // At the old 120 quality cap the original quality is ambiguous; keep its power unchanged.
  if (item.quality < 120 || upgrades === 0) {
    const originalQuality = Math.max(0, item.quality - upgrades * 10);
    if (item.power === Math.round(base * originalQuality / 100) + upgrades)
      item.power = statPrecision(base * originalQuality / 100 + upgrades);
  }
  item.statRevision = 1;
}

/** Preserve earned stats, items, HP and all already offered training choices. */
export function migrateCharacterProgression(state: GameState) {
  for (const f of [...state.family.roster, ...(state.run ? [state.run.fighter] : [])]) {
    if (f.progressionVersion === 2) continue;
    if (!f.growth) { f.growth = {constitution:1,strength:1,agility:1,inner:1}; f.growthStartLevel = f.level; }
    f.progressionVersion = 2;
    let hash = 0; for (const letter of f.id) hash = (Math.imul(hash, 31) + letter.charCodeAt(0)) >>> 0;
    f.innate ??= TRAIT_IDS[hash % TRAIT_IDS.length];
    f.augments ??= []; f.augmentOffers ??= []; f.traitState ??= {};
    const run = state.run?.fighter.id === f.id ? state.run : undefined;
    const pending = run?.offers ?? (state.family.training?.fighterId === f.id ? state.family.training.offers : []);
    f.trainingPoints = Math.max(0, f.level - (f.spent ?? run?.spent ?? f.level), ...pending.map(o => o.type === 'learn' ? 1 : f.arts.find(a => a.id === o.art)?.level ?? 1));
    // Samja retains ten ranks; previously offered training remains valid.
    const remaining = run?.offers ?? (state.family.training?.fighterId === f.id ? state.family.training.offers : []);
    if (!remaining.length && run?.phase !== 'dead') augmentOffers(f, () => ((hash = (Math.imul(hash,1664525)+1013904223)>>>0) / 4294967296));
    if (!run && f.augmentOffers.length && !state.family.training) state.family.training = {fighterId:f.id,offers:[],seed:hash};
  }
  const training = state.family.training;
  if (training && !training.offers.length && !state.family.roster.find(f => f.id === training.fighterId)?.augmentOffers?.length)
    state.family.training = undefined;
}
