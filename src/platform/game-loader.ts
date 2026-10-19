import { combatBaseImages, prepareImages, type ImageProgress } from './assets';
import { regionArtIndex, runArtManifest } from './region-art';
import { gameStore } from './store';
import { characterCombatImages } from './character-art';

let moduleRequest: Promise<typeof import('../game/mount')> | undefined;
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
  // Download the engine and pictures together, instead of waiting for the engine first.
  const [module, images] = await Promise.all([
    loadModule(),
    prepareImages(
      {
        ...combatBaseImages(regionArtIndex(gameStore.state.run) >= 0),
        ...characterCombatImages(gameStore.state.run?.fighter),
        ...runArtManifest(gameStore.state.run),
      },
      onProgress,
    ),
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
