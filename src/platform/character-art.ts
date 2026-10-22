import type { Fighter } from '../domain/model';
import { UI_IMAGES } from './assets';
import lobbySizes from './character-lobby-sizes.json';
export function characterPortrait(fighter: Pick<Fighter, 'portrait' | 'appearance'>) {
  if (fighter.appearance !== undefined)
    return `/art/hero-roster-v1/portrait-${fighter.appearance}.webp`;
  return fighter.portrait === undefined
    ? UI_IMAGES.portrait
    : `/art/character-polish-v1/recruit-${fighter.portrait}.webp`;
}

export function characterCombatImages(
  fighter?: Pick<Fighter, 'appearance'>,
): Record<string, string> {
  if (fighter?.appearance === undefined)
    return { 'hero-slash-0': '/art/hero-slash-v1/hero-0.webp' };
  return {
    'hero-roster-directions': `/art/hero-roster-v1/directions-${Math.floor(fighter.appearance / 5)}.webp`,
    'hero-roster-actions': `/art/hero-roster-v1/actions-${Math.floor(fighter.appearance / 5)}.webp`,
    ...(fighter.appearance === 6 ? { 'hero-guard-6': '/art/hero-weapon-v4/guard-6.webp' } : {}),
    [`hero-slash-${fighter.appearance}`]: `/art/hero-slash-v1/hero-${fighter.appearance}.webp`,
  };
}

export function characterLobbyArt(fighter?: Pick<Fighter, 'appearance'>) {
  return fighter?.appearance === undefined
    ? UI_IMAGES.portrait
    : `/art/hero-roster-v1/lobby-${fighter.appearance}.webp`;
}

/** Measured delivery dimensions; never enlarge a roster cutout to fill its column. */
export function characterLobbyFigure(fighter?: Pick<Fighter, 'appearance'>) {
  const dimensions =
    fighter?.appearance === undefined
      ? { width: 1024, height: 1536 }
      : lobbySizes[fighter.appearance];
  return { src: characterLobbyArt(fighter), ...dimensions };
}
