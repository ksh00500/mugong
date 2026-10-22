import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { emptyGame, startRun, spawnWave } from '../../src/domain/game';
import { REGIONS } from '../../src/domain/campaign';
import { isGameSave } from '../../src/platform/save-validation';

// New contexts per sample; identical Nginx, art, fixtures, viewport, and host.
// Alternate order to reduce warm disk / thermal bias. This is local, not WAN latency.
for (let sample = 0; sample < 3; sample++) {
  for (const variant of (sample % 2 ? ['after', 'before'] : ['before', 'after'])) {
    test(`cold browser ${variant} ${sample}`, async ({ page }) => {
      const url = variant === 'before' ? 'http://127.0.0.1:5228' : 'http://127.0.0.1:5229';
      const state = emptyGame();
      startRun(state, '로딩 관측', 456);
      const run = state.run!;
      run.regionRoute = [REGIONS[3].name, REGIONS[0].name, REGIONS[1].name, REGIONS[2].name];
      run.wave = 5;
      spawnWave(run);
      run.offers = [];
      run.fighter.invulnerable = 100;
      expect(isGameSave(state)).toBe(true);
      // Create the same schema without requesting any application resources first.
      await page.route(`${url}/__benchmark_seed`, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Isolated benchmark fixture</title>' }));
      await page.goto(`${url}/__benchmark_seed`);
      await page.evaluate(async state => {
        const db = await new Promise<IDBDatabase>(resolve => {
          const q = indexedDB.open('mugong-local-v1', 1);
          q.onupgradeneeded = () => q.result.createObjectStore('saves');
          q.onsuccess = () => resolve(q.result);
        });
        await new Promise<void>(resolve => {
          const tx = db.transaction('saves', 'readwrite');
          tx.objectStore('saves').put(state, 'current');
          tx.oncomplete = () => resolve();
        });
        db.close();
      }, state);
      await page.goto(url);
      await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'true', { timeout: 60000 });
      const measurement = await page.evaluate(() => {
        const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
        const js = entries.filter(e => new URL(e.name).pathname.endsWith('.js'));
        return {
          readyMs: performance.now(),
          decodedJsBytes: js.reduce((n, e) => n + e.decodedBodySize, 0),
          encodedJsBytes: js.reduce((n, e) => n + e.encodedBodySize, 0),
          js: js.map(e => ({ path: new URL(e.name).pathname, decoded: e.decodedBodySize, encoded: e.encodedBodySize })),
        };
      });
      expect(measurement.decodedJsBytes).toBeGreaterThan(1000000);
      const proof = 'docs/verification/remaining-gameplay-v1/loading';
      await mkdir(proof, { recursive: true });
      await writeFile(`${proof}/${variant}-${sample}.json`, JSON.stringify({ variant, sample, region: 3, ...measurement }, null, 2));
    });
  }
}
