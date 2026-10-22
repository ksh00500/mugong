import { test, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { seedRegion } from './support/region';

const proof = 'docs/verification/combat-startup-v1';
for (const webgl of [false, true])
  test(`${webgl ? 'WebGL' : 'Canvas'} combat startup profile`, async ({ page }) => {
    test.setTimeout(90000);
    await page.addInitScript(() => {
      (window as any).startupProfile = { spans: [], longTasks: [], imagesComplete: 0, ready: 0 };
      new PerformanceObserver((list) => {
        (window as any).startupProfile.longTasks.push(
          ...list.getEntries().map((e) => ({ start: e.startTime, duration: e.duration })),
        );
      }).observe({ type: 'longtask', buffered: true });
    });
    if (webgl)
      await page.addInitScript(() => {
        for (const proto of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
          const get = proto.getExtension;
          proto.getExtension = function (name: string) {
            return name === 'WEBGL_debug_renderer_info' ? null : get.call(this, name);
          };
        }
      });
    for (const [path, name] of [
      ['enemy-motion', 'registerEnemyMotion'],
      ['character-sheet', 'registerCharacterSheet'],
      ['region-atlas', 'registerRegionAtlas'],
    ])
      await page.route(`**/src/game/${path}.ts*`, async (route) => {
        const response = await route.fetch();
        let body = await response.text();
        body = body.replace(`export function ${name}(`, `function profileOriginal${name}(`);
        body += `\nexport function ${name}(...args){ const start=performance.now(); try {return profileOriginal${name}(...args)} finally {window.startupProfile.spans.push({name:${JSON.stringify(name)},key:args[0].key,start,duration:performance.now()-start})} }`;
        await route.fulfill({ response, body });
      });
    await page.route('**/src/platform/assets.ts*', async (route) => {
      const response = await route.fetch();
      let body = await response.text();
      body = body.replace(
        'export async function prepareImages(',
        'async function profileOriginalPrepareImages(',
      );
      body += `\nexport async function prepareImages(manifest,onProgress){return profileOriginalPrepareImages(manifest,p=>{ if(p.completed===p.total && Object.keys(manifest).includes('enemy')) window.startupProfile.imagesComplete=performance.now(); onProgress?.(p); })}`;
      await route.fulfill({ response, body });
    });
    await page.route('**/src/game/CombatScene.ts*', async (route) => {
      const response = await route.fetch();
      let body = await response.text();
      body += `\nfor(const name of ['preload','create']){const original=CombatScene.prototype[name];CombatScene.prototype[name]=function(...args){const start=performance.now();try{return original.apply(this,args)}finally{window.startupProfile.spans.push({name,start,duration:performance.now()-start});if(name==='create'){window.startupProfile.ready=performance.now();window.startupScene=this;window.startupTextureKeys=this.textures.getTextureKeys().filter(key=>key.endsWith('-isolated'))}}}}`;
      await route.fulfill({ response, body });
    });
    await seedRegion(page, 4, false, 6);
    await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'true', {
      timeout: 60000,
    });
    const profile = await page.evaluate(async () => {
      const scene = (window as any).startupScene;
      const { gameStore } = await (window as any).regionModule('/src/platform/store.ts');
      gameStore.paused = true;
      scene.scene.pause();
      const images: any[] = [];
      // Later asynchronous region warming can register additional textures.
      // Compare exactly the textures present when initial create completed.
      for (const key of (window as any).startupTextureKeys) {
        const source = scene.textures.get(key).source[0];
        const data = (source.image as HTMLCanvasElement)
          .getContext('2d')!
          .getImageData(0, 0, source.width, source.height).data;
        const hash = await crypto.subtle.digest('SHA-256', data);
        images.push({
          key,
          width: source.width,
          height: source.height,
          hash: Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join(''),
        });
      }
      return { ...(window as any).startupProfile, images };
    });
    await mkdir(proof, { recursive: true });
    await writeFile(
      `${proof}/${process.env.MUGONG_STARTUP_PHASE ?? 'after'}-${webgl ? 'webgl' : 'canvas'}-profile.json`,
      JSON.stringify(profile, null, 2),
    );
    await page.screenshot({ path: `${proof}/${webgl ? 'webgl' : 'canvas'}-ready.png` });
    if (process.env.MUGONG_STARTUP_VERIFY_BASELINE === '1') {
      const before = JSON.parse(
        await readFile(`${proof}/before-${webgl ? 'webgl' : 'canvas'}-profile.json`, 'utf8'),
      );
      expect(profile.images).toEqual(before.images);
    }
    console.log(
      JSON.stringify({
        renderer: webgl ? 'webgl' : 'canvas',
        afterImages: profile.ready - profile.imagesComplete,
        create: profile.spans.find((span: any) => span.name === 'create')?.duration,
        isolatedImages: profile.images.length,
      }),
    );
    expect(profile.imagesComplete).toBeGreaterThan(0);
    expect(profile.ready).toBeGreaterThan(profile.imagesComplete);
  });
