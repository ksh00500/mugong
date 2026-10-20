import { test, expect } from '@playwright/test';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const releaseName = process.env.MUGONG_RELEASE_NAME || 'unification-v2';
const proof = `docs/verification/${releaseName}/public`;
test.beforeEach(async () => {
  test.skip(!process.env.MUGONG_DAYTONA_URL, '공개 배포 전용 검사');
  await mkdir(proof, { recursive: true });
});

test('배포 파일 해시와 이전 모듈·음악의 HTTP 제공을 확인한다', async ({ request }) => {
  const release = JSON.parse(
    await readFile(`docs/verification/${releaseName}/release.json`, 'utf8'),
  );
  const result: object[] = [];
  const index = await request.get('/');
  expect(index.status()).toBe(200);
  expect(await index.text()).toContain(
    release.assets.find((name: string) => /^index-.*\.js$/.test(name)),
  );
  expect(index.headers()['cache-control']).toContain('no-cache');
  for (const name of release.assets) {
    const response = await request.get(`/assets/${name}`);
    expect(response.status()).toBe(200);
    const local = await readFile(
      `${release.localDir || `.cache/release-${releaseName}`}/assets/${name}`,
    );
    const actual = createHash('sha256')
      .update(await response.body())
      .digest('hex');
    expect(actual).toBe(createHash('sha256').update(local).digest('hex'));
    expect(response.headers()['cache-control']).toContain('immutable');
    result.push({ file: name, status: 200, sha256: actual });
  }
  for (const name of ['mount-CbowN5Tw.js', 'mount-B08_lvCo.js', 'index-CUH4lm2N.js']) {
    const response = await request.get(`/assets/${name}`);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('javascript');
    result.push({ previous: name, status: 200 });
  }
  for (const name of ['lobby-v1.webm', 'combat-v1.webm', 'lobby-v1.wav', 'combat-v1.wav']) {
    const response = await request.get(`/audio/${name}`);
    expect(response.status()).toBe(200);
    expect((await response.body()).length).toBeGreaterThan(10000);
    result.push({ audio: name, status: 200, contentType: response.headers()['content-type'] });
  }
  await writeFile(`${proof}/assets.json`, JSON.stringify(result, null, 2));
});

test('공개 음악은 키보드로 시작하고 소리 설정을 저장하며 작은 창에 모두 표시한다', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const root = window as typeof window & {
      releaseContexts: AudioContext[];
      releaseMusicStarts: number;
    };
    root.releaseContexts = [];
    root.releaseMusicStarts = 0;
    const Native = window.AudioContext;
    window.AudioContext = class extends Native {
      constructor(...args: ConstructorParameters<typeof AudioContext>) {
        super(...args);
        root.releaseContexts.push(this);
      }
      createBufferSource() {
        const source = super.createBufferSource(),
          start = source.start.bind(source);
        source.start = (...args) => {
          if (source.loop && source.buffer && source.buffer.duration > 10)
            root.releaseMusicStarts++;
          start(...args);
        };
        return source;
      }
    };
  });
  await page.goto('/');
  await expect(page.locator('.home-scene')).toBeVisible();
  await page.keyboard.press('Tab');
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { releaseMusicStarts: number }).releaseMusicStarts),
    )
    .toBeGreaterThan(0);
  await page.getByRole('button', { name: '설정', exact: true }).click();
  await page.getByRole('tab', { name: '소리', exact: true }).click();
  for (const [key, value] of [
    ['master', 55],
    ['music', 20],
    ['effects', 65],
    ['ambient', 10],
  ] as const)
    await page.locator(`#audio-${key}`).fill(String(value));
  await page.getByRole('switch', { name: '음소거' }).click();
  const outside = await page.locator('.audio-settings').evaluate((root) =>
    [...root.querySelectorAll('input,button,small')]
      .filter((el) => {
        const b = el.getBoundingClientRect();
        return b.bottom > innerHeight + 1 || b.top < 0 || b.right > innerWidth;
      })
      .map((el) => el.textContent),
  );
  expect(outside).toEqual([]);
  await page.screenshot({ path: `${proof}/sound-settings.png`, animations: 'disabled' });
  await page.reload();
  await expect(page.getByRole('button', { name: '소리 켜기', exact: true })).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('mugong-audio-v1')!));
  expect(saved).toEqual({ muted: true, master: 0.55, music: 0.2, effects: 0.65, ambient: 0.1 });
  expect(errors).toEqual([]);
  const protocols = await page.evaluate(() => [
    ...new Set(
      performance
        .getEntriesByType('resource')
        .map((entry) => (entry as PerformanceResourceTiming).nextHopProtocol),
    ),
  ]);
  await writeFile(
    `${proof}/audio.json`,
    JSON.stringify(
      { saved, errors, protocols, browser: 'default Chromium; no disable-http2', isolated: true },
      null,
      2,
    ),
  );
});

test('이전 로비 HTML을 남긴 탭에서도 지연 전투 모듈을 받아 출전한다', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const previousIndex = await readFile(
    'docs/verification/unification-v2/public-current-index.html',
    'utf8',
  );
  expect(previousIndex).toContain('index-CUH4lm2N.js');
  await page.route(`${process.env.MUGONG_DAYTONA_URL}/`, (route) =>
    route.fulfill({ contentType: 'text/html', body: previousIndex }),
  );
  await page.goto('/');
  await expect(page.getByRole('button', { name: '새 무인으로 출전 →' })).toBeVisible();
  await page.getByRole('button', { name: '새 무인으로 출전 →' }).click();
  await page.getByLabel('무인의 이름').fill('이전 탭 검증');
  await page.getByRole('button', { name: '강호에 나서기 →' }).click();
  await expect(page.locator('.game-canvas[data-ready="true"]')).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(1);
  await page.screenshot({ path: `${proof}/previous-tab-combat.png` });
  expect(errors).toEqual([]);
  await writeFile(
    `${proof}/previous-tab.json`,
    JSON.stringify(
      { previousIndex: 'index-CUH4lm2N.js', errors, combatReady: true, isolated: true },
      null,
      2,
    ),
  );
});
