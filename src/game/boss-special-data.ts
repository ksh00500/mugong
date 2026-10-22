import remaining from './boss-remaining-frames.json' with { type: 'json' };
import special from './shaolin-special-frames.json' with { type: 'json' };
import tianjian from './tianjian-special-frames.json' with { type: 'json' };
import dokmu from './dokmu-special-frames.json' with { type: 'json' };
import qingha from './qingha-special-frames.json' with { type: 'json' };
import three from './three-special-frames.json' with { type: 'json' };
import threeComplete from './three-complete-frames.json' with { type: 'json' };

import snow from './snow-special-frames.json' with { type: 'json' };
import snowComplete from './snow-special-complete-frames.json' with { type: 'json' };
import tombBamboo from './tomb-bamboo-special-frames.json' with { type: 'json' };
import tombBambooComplete from './tomb-bamboo-complete-frames.json' with { type: 'json' };

export const SNOW_SPECIAL_ART = snow;
/** Additional Snow actions; existing Mokjin dash/slam retain their source frames. */
export const SNOW_COMPLETE_ART = snowComplete;
export const TOMB_BAMBOO_SPECIAL_ART = tombBamboo;
export const TOMB_BAMBOO_COMPLETE_ART = tombBambooComplete;
export const SHAOLIN_SPECIAL_ART = special;
export const TIANJIAN_SPECIAL_ART = tianjian;
export const DOKMU_SPECIAL_ART = dokmu;
export const QINGHA_SPECIAL_ART = qingha;
export const BOSS_REMAINING_ART = remaining;
export const THREE_SPECIAL_ART = three;
export const THREE_COMPLETE_ART = threeComplete;

export type SpecialArt =
  | (typeof special.characters)[number]
  | (typeof tianjian.characters)[number]
  | (typeof dokmu.characters)[number]
  | (typeof qingha.characters)[number]
  | (typeof snow.characters)[number]
  | (typeof three.characters)[number]
  | (typeof tombBamboo.characters)[number];
