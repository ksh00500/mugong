import { test, expect } from '@playwright/test';
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { emptyGame, startRun, spawnWave } from '../../src/domain/game';
import { REGIONS } from '../../src/domain/campaign';
import { xpThreshold } from '../../src/domain/content';

const phase = process.env.MUGONG_LOADING_PHASE ?? 'after';
const proof = 'docs/verification/loading-v2';
for (const [region, wave, webgl] of [
  [3, 1, false],
  [9, 20, true],
] as const)
  test(`컴파일 cold/warm 로딩 ${region}/${wave}/${webgl ? 'WebGL' : 'Canvas'}`, async ({
    page,
    context,
  }) => {
    test.setTimeout(120000);
    await mkdir(proof, { recursive: true });
    await page.addInitScript(() => {
      const w = window as any;
      w.loadingReport = { longTasks: [], decodes: [], ready: 0, interface: 0 };
      new PerformanceObserver((list) =>
        w.loadingReport.longTasks.push(
          ...list.getEntries().map((e) => ({ start: e.startTime, duration: e.duration })),
        ),
      ).observe({ type: 'longtask', buffered: true });
      const decode = HTMLImageElement.prototype.decode;
      HTMLImageElement.prototype.decode = async function () {
        const start = performance.now();
        try {
          return await decode.call(this);
        } finally {
          w.loadingReport.decodes.push({
            url: this.src,
            start,
            end: performance.now(),
            width: this.naturalWidth,
            height: this.naturalHeight,
          });
        }
      };
      new MutationObserver(() => {
        if (!w.loadingReport.interface && document.querySelector('.app-shell'))
          w.loadingReport.interface = performance.now();
        if (!w.loadingReport.ready && document.querySelector('.game-canvas[data-ready="true"]'))
          w.loadingReport.ready = performance.now();
      }).observe(document, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['data-ready'],
      });
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
    const state = emptyGame();
    startRun(state, '로딩 검증', 123);
    const r = state.run!,
      f = r.fighter;
    r.regionRoute = [
      ...REGIONS.filter((_, i) => i !== region)
        .slice(0, 3)
        .map((r) => r.name),
    ];
    r.regionRoute.splice(Math.floor((wave - 1) / 5), 0, REGIONS[region].name);
    r.wave = wave;
    spawnWave(r);
    r.offers = [];
    f.level = f.spent = r.spent = 16;
    f.xp = xpThreshold(16);
    f.augments = ['swift'];
    f.augmentOffers = [];
    if (!webgl) f.appearance = 6;
    r.enemies.forEach((e) => {
      e.hp = e.maxHp = 100000;
      e.timer = 1000;
      e.state = 'windup';
    });
    await page.goto('/');
    await expect(page.locator('.home-scene')).toBeVisible({ timeout: 30000 });
    await page.evaluate(async (value) => {
      const db = await new Promise<IDBDatabase>((resolve) => {
        const q = indexedDB.open('mugong-local-v1', 1);
        q.onsuccess = () => resolve(q.result);
      });
      await new Promise<void>((resolve) => {
        const tx = db.transaction('saves', 'readwrite');
        tx.objectStore('saves').put(value, 'current');
        tx.oncomplete = () => resolve();
      });
      db.close();
    }, state);
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.clearBrowserCache');
    const requested = new Set<string>();
    page.on('request', (q) => {
      const path = new URL(q.url()).pathname;
      if (path.startsWith('/art/')) requested.add(path);
    });
    const reports = [];
    for (const cache of ['cold', 'warm']) {
      requested.clear();
      await page.reload({ waitUntil: 'commit' });
      await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'true', {
        timeout: 60000,
      });
      await expect(page.locator('.game-canvas')).toHaveAttribute('data-art-region', String(region));
      const metrics = await page.evaluate(() => {
        const w = window as any,
          data = w.loadingReport;
        const resources = performance.getEntriesByType('resource').map((e) => {
          const r = e.toJSON();
          return {
            name: r.name,
            startTime: r.startTime,
            duration: r.duration,
            transferSize: r.transferSize,
            encodedBodySize: r.encodedBodySize,
            decodedBodySize: r.decodedBodySize,
            initiatorType: r.initiatorType,
          };
        });
        return {
          ...data,
          resources,
          renderer: document.querySelector('.game-canvas')?.getAttribute('data-renderer'),
        };
      });
      let requestedBytes = 0;
      for (const url of requested) requestedBytes += (await stat('public' + url)).size;
      const urls = [...requested];
      const report = {
        cache,
        region,
        wave,
        phase,
        ...metrics,
        requestedBytes,
        urls,
        maxLongTask: Math.max(0, ...metrics.longTasks.map((x: any) => x.duration)),
      };
      reports.push(report);
      if (phase === 'after') {
        expect(urls.some((p) => /three-complete-(asar|naya|balta|arkan)\.webp/.test(p))).toBe(
          false,
        );
        if (region === 3) expect(urls.some((p) => p.includes('/snow-special'))).toBe(false);
        expect(urls.filter((p) => /hero-slash-v1/.test(p)).length).toBe(1);
      }
      expect(metrics.ready).toBeGreaterThan(0);
      console.log(
        JSON.stringify({
          phase,
          cache,
          region,
          ready: metrics.ready,
          interface: metrics.interface,
          artMB: requestedBytes / 1024 / 1024,
          images: urls.length,
          maxLongTask: report.maxLongTask,
        }),
      );
      await page.screenshot({ path: `${proof}/${phase}-${region}-${cache}.png` });
    }
    await writeFile(`${proof}/${phase}-${region}.json`, JSON.stringify(reports, null, 2));
  });
