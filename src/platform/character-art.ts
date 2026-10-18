import type { Fighter } from '../domain/model';
import { UI_IMAGES } from './assets';
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
  const first = Math.floor(fighter.appearance / 5) * 5;
  return {
    'hero-roster-directions': `/art/hero-roster-v1/directions-${Math.floor(fighter.appearance / 5)}.webp`,
    'hero-roster-actions': `/art/hero-roster-v1/actions-${Math.floor(fighter.appearance / 5)}.webp`,
    ...(first === 5 ? { 'hero-guard-6': '/art/hero-weapon-v4/guard-6.webp' } : {}),
    ...Object.fromEntries(
      Array.from({ length: 5 }, (_, i) => [
        `hero-slash-${first + i}`,
        `/art/hero-slash-v1/hero-${first + i}.webp`,
      ]),
    ),
  };
}

export function characterLobbyArt(fighter?: Pick<Fighter, 'appearance'>) {
  return fighter?.appearance === undefined
    ? UI_IMAGES.portrait
    : `/art/hero-roster-v1/lobby-${fighter.appearance}.webp`;
}
