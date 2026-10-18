import snowSpecial from '../game/snow-special-frames.json' with { type: 'json' };
import remaining from '../game/boss-remaining-frames.json' with { type: 'json' };
import three from '../game/three-special-frames.json' with { type: 'json' };
import { REGIONS, regionName, bossById } from '../domain/campaign';
import type { Enemy, Run } from '../domain/model';
import staff from '../game/shaolin-staff-frames.json' with { type: 'json' };
import family from '../game/shaolin-family-frames.json' with { type: 'json' };
import zhuge from '../game/zhuge-family-frames.json' with { type: 'json' };
import tianjian from '../game/tianjian-family-frames.json' with { type: 'json' };
import dokmu from '../game/dokmu-family-frames.json' with { type: 'json' };
import hyeolma from '../game/hyeolma-family-frames.json' with { type: 'json' };
import desert from '../game/desert-family-frames.json' with { type: 'json' };
import qingha from '../game/qingha-family-frames.json' with { type: 'json' };
import snow from '../game/snow-family-frames.json' with { type: 'json' };
import bamboo from '../game/bamboo-family-frames.json' with { type: 'json' };
import tomb from '../game/tomb-family-frames.json' with { type: 'json' };
import special from '../game/shaolin-special-frames.json' with { type: 'json' };
import tianjianSpecial from '../game/tianjian-special-frames.json' with { type: 'json' };
import dokmuSpecial from '../game/dokmu-special-frames.json' with { type: 'json' };
import qinghaSpecial from '../game/qingha-special-frames.json' with { type: 'json' };

export function regionArtIndex(run?: Pick<Run, 'wave' | 'regionRoute'> | null) {
  return run ? REGIONS.findIndex((region) => region.name === regionName(run)) : -1;
}

export function regionArtManifest(index: number) {
  return index < 0 || index >= REGIONS.length
    ? {}
    : {
        [`region-floor-${index}`]: `/art/regions-v1/${index}-floor.webp`,
        ...Object.fromEntries(
          [
            ...new Set(
              three.characters
                .filter((art) => Number(art.bossId.split('-')[0]) === index)
                .flatMap((art) => art.frames.map((frame) => frame.texture)),
            ),
          ].map((key) => [key, three.textures[key as keyof typeof three.textures]]),
        ),
        ...Object.fromEntries(
          [
            ...new Set(
              remaining.characters
                .filter((art) => Number(art.bossId.split('-')[0]) === index)
                .flatMap((art) => art.frames.map((frame) => frame.texture)),
            ),
          ]
            .filter((key) => key.startsWith('boss-remaining-'))
            .map((key) => [key, remaining.textures[key as keyof typeof remaining.textures]]),
        ),
        // Native families replace their old mesh atlases, which would otherwise
        // decode and scan without ever contributing a displayed frame.
        ...([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].includes(index)
          ? {}
          : {
              [`region-actors-${index}`]: `/art/regions-v1/${index}-actors${index === 2 ? '-v2' : ''}.webp`,
              [`region-direction-${index}`]: `/art/hostile-consistency-v3/region-${index}-directions.webp`,
              [`region-motion-${index}`]: [1, 9].includes(index)
                ? `/art/hostile-consistency-v3/region-${index}-actions.webp`
                : `/art/animation-rebuild-v2/region-${index}.webp`,
              [`region-rear-${index}`]: `/art/hostile-consistency-v3/region-${index}-rear.webp`,
            }),
        ...(index === 0
          ? Object.fromEntries(
              [
                ...new Set(
                  qinghaSpecial.characters.flatMap((art) => art.frames.map((f) => f.texture)),
                ),
              ].map((key) => [
                key,
                `/art/qingha-special-v1/${key.replace('qingha-special-', '')}.webp`,
              ]),
            )
          : {}),
        ...(index === 1
          ? Object.fromEntries(
              [
                ...new Set(
                  dokmuSpecial.characters.flatMap((art) => art.frames.map((f) => f.texture)),
                ),
              ].map((key) => [
                key,
                `/art/dokmu-special-v1/${key.replace('dokmu-special-', '')}.webp`,
              ]),
            )
          : {}),
        ...(index === 2
          ? Object.fromEntries(
              [
                ...new Set(
                  tianjianSpecial.characters.flatMap((art) => art.frames.map((f) => f.texture)),
                ),
              ].map((key) => [
                key,
                `/art/tianjian-special-v1/${key.replace('tianjian-special-', '')}.webp`,
              ]),
            )
          : {}),
        ...(index === 4
          ? Object.fromEntries(
              [
                ...new Set(special.characters.flatMap((art) => art.frames.map((f) => f.texture))),
              ].map((key) => [
                key,
                `/art/shaolin-special-v1/${key.replace('shaolin-special-', '')}.webp`,
              ]),
            )
          : {}),
        ...(index === 4
          ? Object.fromEntries(
              [
                ...new Set(
                  [...staff.frames, ...family.characters.flatMap((art) => art.frames)].map(
                    (frame) => frame.texture,
                  ),
                ),
              ].map((key) => [
                key,
                key.startsWith('shaolin-staff-')
                  ? `/art/shaolin-staff-v1/${key.replace('shaolin-staff-', '')}.webp`
                  : `/art/shaolin-family-v1/${key.replace('shaolin-family-', '')}.webp`,
              ]),
            )
          : {}),
        ...(index === 9
          ? Object.fromEntries(
              [...new Set(zhuge.characters.flatMap((art) => art.frames).map((f) => f.texture))].map(
                (key) => [key, `/art/zhuge-family-v1/${key.replace('zhuge-family-', '')}.webp`],
              ),
            )
          : {}),
        ...(index === 2
          ? Object.fromEntries(
              [
                ...new Set(tianjian.characters.flatMap((art) => art.frames).map((f) => f.texture)),
              ].map((key) => [
                key,
                `/art/tianjian-family-v1/${key.replace('tianjian-family-', '')}.webp`,
              ]),
            )
          : {}),
        ...(index === 1
          ? Object.fromEntries(
              [...new Set(dokmu.characters.flatMap((art) => art.frames).map((f) => f.texture))].map(
                (key) => [key, `/art/dokmu-family-v1/${key.replace('dokmu-family-', '')}.webp`],
              ),
            )
          : {}),
        ...(index === 8
          ? Object.fromEntries(
              [
                ...new Set(hyeolma.characters.flatMap((art) => art.frames).map((f) => f.texture)),
              ].map((key) => [
                key,
                `/art/hyeolma-family-v1/${key.replace('hyeolma-family-', '')}.webp`,
              ]),
            )
          : {}),
        ...(index === 7
          ? Object.fromEntries(
              [
                ...new Set(desert.characters.flatMap((art) => art.frames).map((f) => f.texture)),
              ].map((key) => [
                key,
                `/art/desert-family-v1/${key.replace('desert-family-', '')}.webp`,
              ]),
            )
          : {}),
        ...(index === 6
          ? Object.fromEntries(
              [...new Set(tomb.characters.flatMap((art) => art.frames.map((f) => f.texture)))].map(
                (key) => [key, `/art/tomb-family-v1/${key.replace('tomb-family-', '')}.webp`],
              ),
            )
          : {}),
        ...(index === 5
          ? Object.fromEntries(
              [
                ...new Set(bamboo.characters.flatMap((art) => art.frames.map((f) => f.texture))),
              ].map((key) => [
                key,
                `/art/bamboo-family-v1/${key.replace('bamboo-family-', '')}.webp`,
              ]),
            )
          : {}),
        ...(index === 3
          ? {
              ...Object.fromEntries(
                [
                  ...new Set(snow.characters.flatMap((art) => art.frames.map((f) => f.texture))),
                ].map((key) => [
                  key,
                  `/art/snow-family-v1/${key.replace('snow-family-', '')}.webp`,
                ]),
              ),
              ...Object.fromEntries(
                [
                  ...new Set(snowSpecial.characters.flatMap((a) => a.frames.map((f) => f.texture))),
                ].map((key) => [
                  key,
                  `/art/snow-special-v1/${key.replace('snow-special-', '')}.webp`,
                ]),
              ),
            }
          : {}),
        ...(index === 0
          ? Object.fromEntries(
              [
                ...new Set(qingha.characters.flatMap((art) => art.frames).map((f) => f.texture)),
              ].map((key) => [
                key,
                `/art/qingha-family-v1/${key.replace('qingha-family-', '')}.webp`,
              ]),
            )
          : {}),
      };
}

export function enemyMotionRepairSlots(index: number) {
  return index === 2 ? [2] : index === 4 ? [2, 3] : index === 9 ? [3] : [];
}

/** The generated rear diagonal is left-facing in most plates. Calibrated from
 * the actual artwork, independently of the requested column label. */
export function enemyDirectionFlip(index: number, slot: number, view: number, flipped: boolean) {
  // v3 contact plate: R0/R2 look right; the last three R6 rows look left.
  // Do not reuse the previous atlas orientation table after replacing artwork.
  const rearLeft = index === 6 ? slot >= 4 : index !== 0 && index !== 2;
  return view === 3 && rearLeft ? !flipped : flipped;
}

/** Slots 0–2 are the three gameplay roles; slots 3–6 are source boss phases. */
export function enemyArtSlot(enemy: Pick<Enemy, 'kind' | 'bossId' | 'role'>, region = -1) {
  if (enemy.bossId) {
    const boss = bossById(enemy.bossId);
    if (boss) return boss.phase + 2;
  }
  if (enemy.role === 'needle') return region === 5 ? 2 : 0;
  if (region === 7 && !enemy.bossId) {
    if (enemy.role === 'rider') return 0;
    if (enemy.role === 'assassin') return 1;
    if (enemy.role === 'ringblade') return 2;
  }
  if (enemy.role === 'hexer' && region === 8) return 5;
  return enemy.kind === 'archer' || enemy.kind === 'captain' ? 2 : enemy.kind === 'spear' ? 1 : 0;
}

/** Dedicated tools remain visible in all five views; bosses take precedence over inherited role. */
export function enemyRepairSlot(enemy: Pick<Enemy, 'bossId' | 'role'>) {
  if (enemy.bossId) return enemy.bossId === '5-2' ? 3 : undefined;
  return enemy.role === 'iceweaver'
    ? 0
    : enemy.role === 'trapper'
      ? 1
      : enemy.role === 'engineer'
        ? 2
        : undefined;
}

/** One replacement identity owns its directions and every action together. */
export function hostileIdentitySlot(
  enemy: Pick<Enemy, 'bossId' | 'kind' | 'role'>,
  region: number,
) {
  if (enemy.bossId === '2-1') return 0;
  if (enemy.bossId === '4-4') return 2;
  if (
    !enemy.bossId &&
    region === 4 &&
    enemyArtSlot(enemy, region) === 2 &&
    enemyRepairSlot(enemy) === undefined
  )
    return 1;
  return undefined;
}
