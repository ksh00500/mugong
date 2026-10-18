import type { GameState } from './model';

/** Old saves are validated first. Preserve every ID/count when merging the removed tray. */
export function migratePendingItems(state: GameState) {
  const fighters = [...state.family.roster, ...(state.run ? [state.run.fighter] : [])];
  for (const fighter of fighters)
    for (const item of fighter.items) if (String(item.place) === 'board') item.place = 'ground';
}
