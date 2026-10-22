import snowSpecial from '../game/snow-special-frames.json' with { type: 'json' };
import snowComplete from '../game/snow-special-complete-frames.json' with { type: 'json' };
import tombBamboo from '../game/tomb-bamboo-special-frames.json' with { type: 'json' };
import tombBambooComplete from '../game/tomb-bamboo-complete-frames.json' with { type: 'json' };
import remaining from '../game/boss-remaining-frames.json' with { type: 'json' };
import three from '../game/three-special-frames.json' with { type: 'json' };
import threeComplete from '../game/three-complete-frames.json' with { type: 'json' };
import nativeSizeTextures from '../game/native-size-textures.json' with { type: 'json' };
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

/** Authoring/build input only. Runtime imports its compact generated index. */
export function buildRegionArtIndex() {
  const families: readonly { slot: number; frames: readonly { texture: string }[] }[][] = [
    qingha.characters,
    dokmu.characters,
    tianjian.characters,
    snow.characters,
    [...family.characters, { slot: 1, frames: staff.frames }],
    bamboo.characters,
    tomb.characters,
    desert.characters,
    hyeolma.characters,
    zhuge.characters,
  ];
  const specials: readonly { bossId: string; frames: readonly { texture: string }[] }[] = [
    ...special.characters,
    ...tianjianSpecial.characters,
    ...dokmuSpecial.characters,
    ...qinghaSpecial.characters,
    ...snowSpecial.characters,
    ...snowComplete.characters,
    ...tombBamboo.characters,
    ...tombBambooComplete.characters,
    ...remaining.characters,
    ...three.characters,
    ...threeComplete.characters,
  ];
  return {
    version: 1,
    regions: REGIONS.map((_, index) => {
      const all = regionArtManifest(index);
      const pick = (keys: Iterable<string>) =>
        Object.fromEntries(
          [...new Set(keys)].map((key) => {
            if (!all[key]) throw new Error(`Missing authored texture ${index}/${key}`);
            return [key, all[key]];
          }),
        );
      const ordinary = pick([
        `region-floor-${index}`,
        ...families[index].filter((a) => a.slot < 3).flatMap((a) => a.frames.map((f) => f.texture)),
      ]);
      const bosses = Object.fromEntries(
        [1, 2, 3, 4].map((phase) => {
          const id = `${index}-${phase}`;
          return [
            id,
            pick([
              ...families[index]
                .filter((a) => a.slot === phase + 2)
                .flatMap((a) => a.frames.map((f) => f.texture)),
              ...specials
                .filter((a) => a.bossId === id)
                .flatMap((a) => a.frames.map((f) => f.texture)),
            ]),
          ];
        }),
      );
      return { all, ordinary, bosses };
    }),
  };
}

export function regionArtManifest(index: number): Record<string, string> {
  return index < 0 || index >= REGIONS.length
    ? {}
    : {
        [`region-floor-${index}`]: `/art/regions-v1/${index}-floor.webp`,
        ...Object.fromEntries(
          threeComplete.characters
            .filter((a) => Number(a.bossId.split('-')[0]) === index)
            .map((a) => {
              const key = `three-complete-${a.id}` as keyof typeof threeComplete.textures;
              return [key, threeComplete.textures[key]];
            }),
        ),
        ...Object.fromEntries(
          tombBambooComplete.characters
            .filter((a) => Number(a.bossId.split('-')[0]) === index)
            .map((a) => {
              const key = `tb-complete-${a.id}` as keyof typeof tombBambooComplete.textures;
              return [key, tombBambooComplete.textures[key]];
            }),
        ),
        ...Object.fromEntries(
          [
            ...new Set(
              tombBamboo.characters
                .filter((a) => Number(a.bossId.split('-')[0]) === index)
                .flatMap((a) => a.frames.map((f) => f.texture)),
            ),
          ]
            .filter((key) => key.startsWith('tomb-bamboo-'))
            .map((key) => [key, tombBamboo.textures[key as keyof typeof tombBamboo.textures]]),
        ),
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
              [...new Set(zhuge.characters.flatMap((art) => art.frames.map((f) => f.texture)))].map(
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
              ...snowComplete.textures,
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
        // Calibrated source groups use versioned atlases. Override inferred
        // legacy family URLs only for this region, never load every region.
        ...Object.fromEntries(
          Object.entries(nativeSizeTextures).filter(([key]) =>
            key.startsWith(index === 3 ? 'native-size-snow-' : index === 9 ? 'native-size-zhuge-' : '__none__'),
          ),
        ),
      };
}
