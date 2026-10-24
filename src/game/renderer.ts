import Phaser from 'phaser';

/** Same conservative GPU choice for Gangho, PvP and raids. Software GL keeps Canvas. */
export function combatRenderer(parent: HTMLElement) {
  const probe = document.createElement('canvas');
  const gl = probe.getContext('webgl2', { powerPreference: 'high-performance' });
  const extension = gl?.getExtension('WEBGL_debug_renderer_info');
  const renderer = extension ? String(gl?.getParameter(extension.UNMASKED_RENDERER_WEBGL)) : '';
  const software = !gl || /SwiftShader|llvmpipe|software/i.test(renderer);
  parent.dataset.graphics = renderer || 'WebGL unavailable';
  parent.dataset.renderer = software ? 'Canvas' : 'WebGL / AUTO';
  gl?.getExtension('WEBGL_lose_context')?.loseContext();
  return {
    software,
    type: software ? Phaser.CANVAS : Phaser.AUTO,
    render: {
      antialias: true,
      antialiasGL: false,
      pixelArt: false,
      powerPreference: 'high-performance' as const,
    },
  };
}
