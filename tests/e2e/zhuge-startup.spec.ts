import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { seedRegion } from './support/region';
for (const webgl of [false, true])
  test(`${webgl ? 'WebGL' : 'Canvas'} Zhuge startup records post-image preparation`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    await page.addInitScript(() => {
      (window as any).zhugeStartup = { spans: [], imagesComplete: 0, ready: 0, longTasks: [] };
      new PerformanceObserver((list) =>
        (window as any).zhugeStartup.longTasks.push(
          ...list.getEntries().map((e) => ({ start: e.startTime, duration: e.duration })),
        ),
      ).observe({ type: 'longtask', buffered: true });
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
    await page.route('**/src/platform/assets.ts*', async (route) => {
      const response = await route.fetch();
      let body = await response.text();
      body = body.replace(
        'export async function prepareImages(',
        'async function profileOriginalPrepareImages(',
      );
      body +=
        '\nexport async function prepareImages(manifest,onProgress){return profileOriginalPrepareImages(manifest,p=>{if(p.completed===p.total&&Object.keys(manifest).includes("enemy"))window.zhugeStartup.imagesComplete=performance.now();onProgress?.(p);})}';
      await route.fulfill({ response, body });
    });
    await page.route('**/src/game/CombatScene.ts*', async (route) => {
      const response = await route.fetch();
      let body = await response.text();
      body +=
        '\nfor(const name of ["preload","create"]){const original=CombatScene.prototype[name];CombatScene.prototype[name]=function(...args){const start=performance.now();try{return original.apply(this,args)}finally{window.zhugeStartup.spans.push({name,duration:performance.now()-start});if(name==="create"){window.zhugeStartup.ready=performance.now();window.zhugeStartup.textureKeys=this.textures.getTextureKeys();}}}}';
      await route.fulfill({ response, body });
    });
    await seedRegion(page, 9, true, undefined, ['engineer', 'gatekeeper', 'crossbow']);
    const result = await page.evaluate(() => (window as any).zhugeStartup);
    expect(result.imagesComplete).toBeGreaterThan(0);
    expect(result.ready).toBeGreaterThan(result.imagesComplete);
    expect(
      result.textureKeys.filter((key: string) => key.startsWith('zhuge-family-')),
    ).toHaveLength(35);
    expect(result.textureKeys).not.toContain('region-motion-9');
    const summary = {
      ...result,
      afterImages: result.ready - result.imagesComplete,
      renderer: webgl ? 'webgl' : 'canvas',
    };
    await mkdir('docs/verification/zhuge-family-v1/startup', { recursive: true });
    await writeFile(
      `docs/verification/zhuge-family-v1/startup/${summary.renderer}.json`,
      JSON.stringify(summary, null, 2),
    );
    console.log(
      JSON.stringify({
        renderer: summary.renderer,
        afterImages: summary.afterImages,
        spans: summary.spans,
      }),
    );
  });
