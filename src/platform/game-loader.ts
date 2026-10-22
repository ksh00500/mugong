import { combatBaseImages, prepareImages, type ImageProgress } from './assets';
import { regionArtIndex, runArtManifest } from './region-art';
import { gameStore } from './store';
import { characterCombatImages } from './character-art';

let moduleRequest: Promise<typeof import('../game/mount')> | undefined;
export class CombatPreparationError extends Error {
  constructor(
    readonly stage: 'engine' | 'images',
    cause: unknown,
  ) {
    super('Combat preparation failed', { cause });
    this.name = 'CombatPreparationError';
  }
}
function loadModule() {
  if (!moduleRequest) {
    const request = import('../game/mount');
    moduleRequest = request;
    void request.catch(() => {
      if (moduleRequest === request) moduleRequest = undefined;
    });
  }
  return moduleRequest;
}

export async function prepareCombat(onProgress?: (progress: ImageProgress) => void) {
  let engineReady = false;
  // Download the engine and pictures together, instead of waiting for the engine first.
  const [module, images] = await Promise.all([
    loadModule().then(
      async (module) => {
        try {
          await module.prepareCombatMetadata(regionArtIndex(gameStore.state.run));
        } catch (error) {
          throw new CombatPreparationError('engine', error);
        }
        engineReady = true;
        return module;
      },
      (error) => {
        throw new CombatPreparationError('engine', error);
      },
    ),
    prepareImages(
      {
        ...combatBaseImages(regionArtIndex(gameStore.state.run) >= 0),
        ...characterCombatImages(gameStore.state.run?.fighter),
        ...runArtManifest(gameStore.state.run),
      },
      (progress) =>
        onProgress?.({
          ...progress,
          stage: progress.completed === progress.total && !engineReady ? 'engine' : 'images',
        }),
    ).catch((error) => {
      throw new CombatPreparationError('images', error);
    }),
  ]);
  return { mountGame: module.mountGame, images };
}

export function warmCombat() {
  // Intent-based warming does not create a renderer or advance the game.
  void (
    gameStore.state.run
      ? prepareCombat()
      : Promise.all([
          loadModule(),
          prepareImages(combatBaseImages(true), undefined, { priority: 'low', concurrency: 2 }),
        ])
  ).catch(() => {});
}
