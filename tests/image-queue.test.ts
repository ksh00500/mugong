import { afterEach, beforeEach, expect, it, vi } from 'vitest';
let instances: FakeImage[] = [];
class FakeImage {
  src = '';
  decoding = '';
  fetchPriority = 'auto';
  onload: null | (() => void) = null;
  onerror: null | (() => void) = null;
  constructor() {
    instances.push(this);
  }
  decode() {
    return Promise.resolve();
  }
  load() {
    this.onload?.();
  }
}
beforeEach(() => {
  vi.resetModules();
  instances = [];
  vi.stubGlobal('Image', FakeImage);
  vi.stubGlobal('window', { setTimeout, clearTimeout });
});
afterEach(() => vi.unstubAllGlobals());
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
it('bounds simultaneous decoding and reports actual completed keys in source order', async () => {
  const { prepareImages } = await import('../src/platform/assets');
  const progress: unknown[] = [];
  const request = prepareImages({ a: '/a', b: '/b', c: '/c', d: '/d' }, (p) => progress.push(p), {
    concurrency: 2,
  });
  expect(instances.map((i) => i.src)).toEqual(['/a', '/b']);
  instances[1].load();
  await flush();
  expect(instances[2].src).toBe('/c');
  instances[0].load();
  await flush();
  expect(instances[3].src).toBe('/d');
  instances[2].load();
  instances[3].load();
  expect(Object.keys(await request)).toEqual(['a', 'b', 'c', 'd']);
  expect(progress).toEqual([0, 1, 2, 3, 4].map((completed) => ({ completed, total: 4 })));
});
it('shares in-flight warming and promotes its network priority for a required image', async () => {
  const { prepareImages } = await import('../src/platform/assets');
  const warm = prepareImages({ warm: '/shared' }, undefined, { priority: 'low' });
  expect(instances[0].fetchPriority).toBe('low');
  const required = prepareImages({ required: '/shared' });
  expect(instances).toHaveLength(1);
  expect(instances[0].fetchPriority).toBe('high');
  instances[0].load();
  expect((await warm).warm).toBe((await required).required);
});
it('failed requests leave no poisoned cache and can be retried', async () => {
  const { prepareImages } = await import('../src/platform/assets');
  const failed = prepareImages({ a: '/retry' });
  const failure = expect(failed).rejects.toThrow('Image unavailable');
  instances[0].onerror?.();
  await failure;
  const retry = prepareImages({ a: '/retry' });
  expect(instances).toHaveLength(2);
  instances[1].load();
  expect((await retry).a).toBe(instances[1]);
});
it('an empty scope resolves without starting work', async () => {
  const { prepareImages } = await import('../src/platform/assets');
  expect(await prepareImages({})).toEqual({});
  expect(instances).toHaveLength(0);
});
