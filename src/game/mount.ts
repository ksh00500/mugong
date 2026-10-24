import Phaser from 'phaser';
import { CombatScene } from './CombatScene';
import { H, W } from '../domain/content';
import type { ImageProgress, PreparedImages } from '../platform/assets';
import { gameStore } from '../platform/store';
import { prepareBossSpecial } from './boss-special';
import { prepareNativeFamily } from './authored-enemy';
import { combatRenderer } from './renderer';
export async function prepareCombatMetadata(region: number) {
  await Promise.all([prepareBossSpecial(region), prepareNativeFamily(region)]);
}
export function mountGame(
  parent: HTMLElement,
  images: PreparedImages,
  onReady: () => void,
  onLost?: (reason: 'images' | 'graphics') => void,
  onRegionProgress?: (progress: ImageProgress | null) => void,
) {
  const renderer = combatRenderer(parent),
    software = renderer.software;
  const width = software
    ? 960
    : Math.round(Math.min(W, Math.max(960, parent.clientWidth)) / 16) * 16;
  const game = new Phaser.Game({
    type: renderer.type,
    parent,
    width,
    height: (width / W) * H,
    // The battlefield background covers the whole canvas. An alpha backbuffer
    // and multisampling only add compositor/GPU work; texture filtering stays on.
    transparent: false,
    backgroundColor: '#354b3d',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [new CombatScene(images, onReady, () => lost('images'), onRegionProgress)],
    audio: { noAudio: true },
    render: renderer.render,
    banner: false,
  });
  const lost = (reason: 'images' | 'graphics' = 'graphics') => {
    gameStore.rendererReady = false;
    gameStore.paused = true;
    // Do not checkpoint potentially stale state in a graphics failure handler.
    gameStore.notify();
    onLost?.(reason);
  };
  const contextLost = () => lost('graphics');
  game.renderer.on(Phaser.Renderer.Events.LOSE_WEBGL, contextLost);
  return () => {
    game.renderer.off(Phaser.Renderer.Events.LOSE_WEBGL, contextLost);
    game.destroy(true);
  };
}
