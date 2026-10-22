import Phaser from 'phaser';
import { CombatScene } from './CombatScene';
import { H, W } from '../domain/content';
import type { ImageProgress, PreparedImages } from '../platform/assets';
import { gameStore } from '../platform/store';
import { prepareBossSpecial } from './boss-special';
import { prepareNativeFamily } from './authored-enemy';
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
  const probe = document.createElement('canvas');
  const gl = probe.getContext('webgl2');
  const extension = gl?.getExtension('WEBGL_debug_renderer_info');
  const renderer = extension ? String(gl?.getParameter(extension.UNMASKED_RENDERER_WEBGL)) : '';
  const software = !gl || /SwiftShader|llvmpipe|software/i.test(renderer);
  parent.dataset.graphics = renderer || 'WebGL unavailable';
  parent.dataset.renderer = software ? 'Canvas' : 'WebGL / AUTO';
  gl?.getExtension('WEBGL_lose_context')?.loseContext();
  const width = software
    ? 960
    : Math.round(Math.min(W, Math.max(960, parent.clientWidth)) / 16) * 16;
  const game = new Phaser.Game({
    type: software ? Phaser.CANVAS : Phaser.AUTO,
    parent,
    width,
    height: (width / W) * H,
    transparent: !software,
    backgroundColor: '#354b3d',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [new CombatScene(images, onReady, () => lost('images'), onRegionProgress)],
    audio: { noAudio: true },
    render: { antialias: true, pixelArt: false },
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
