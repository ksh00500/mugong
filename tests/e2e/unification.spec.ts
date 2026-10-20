import { test, expect, type Page } from '@playwright/test';
import { emptyGame, startRun, grantXp } from '../../src/domain/game';
import type { GameState } from '../../src/domain/model';
import { mkdir, writeFile } from 'node:fs/promises';
const proof = 'docs/verification/unification-v2';
async function fixture(page: Page, state: GameState) {
  await page.goto('/');
  await expect(page.locator('.home-scene')).toBeVisible();
  await page.evaluate(async (state) => {
    const request = indexedDB.open('mugong-local-v1', 1);
    const db = await new Promise<IDBDatabase>((resolve) => {
      request.onsuccess = () => resolve(request.result);
    });
    await new Promise<void>((resolve) => {
      const tx = db.transaction('saves', 'readwrite');
      tx.objectStore('saves').put(state, 'current');
      tx.oncomplete = () => resolve();
    });
    db.close();
  }, state);
  await page.reload();
}
async function capture(page: Page, name: string) {
  await mkdir(proof, { recursive: true });
  await page.screenshot({ path: `${proof}/${name}.png`, animations: 'disabled' });
}
async function audio(page: Page) {
  return page.evaluate(async () =>
    (
      await import(
        performance
          .getEntriesByType('resource')
          .map((entry) => entry.name)
          .find((url) => new URL(url).pathname === '/src/platform/audio.ts') ??
          '/src/platform/audio.ts'
      )
    ).audioDiagnostics(),
  );
}

test('키보드 첫 입력으로 소리를 시작하고 음소거·네 음량을 재실행까지 유지한다', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('.home-scene')).toBeVisible();
  expect((await audio(page)).context).toBe('none');
  await page.keyboard.press('Tab');
  await expect.poll(async () => (await audio(page)).context).toBe('running');
  await expect.poll(async () => (await audio(page)).track).toBe('lobby-v1');
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
  await expect.poll(async () => (await audio(page)).master).toBeLessThan(0.001);
  await page.setViewportSize({ width: 1093, height: 614 });
  const issues = await page.locator('.settings-dialog').evaluate((root) =>
    [root, ...root.querySelectorAll<HTMLElement>('input,button,label,small')]
      .filter((el) => el.getClientRects().length && !el.closest('[hidden]'))
      .filter((el) => {
        const b = el.getBoundingClientRect();
        return b.bottom > innerHeight + 1 || b.top < 0 || el.scrollHeight > el.clientHeight + 2;
      })
      .map((el) => el.className),
  );
  expect(issues).toEqual([]);
  await capture(page, 'sound-settings-1093');
  await page.reload();
  await expect(page.getByRole('button', { name: '소리 켜기', exact: true })).toBeVisible();
  expect((await audio(page)).preferences).toEqual({
    muted: true,
    master: 0.55,
    music: 0.2,
    effects: 0.65,
    ambient: 0.1,
  });
  await page.keyboard.press('Tab');
  await page.getByRole('button', { name: '소리 켜기', exact: true }).click();
  await expect.poll(async () => (await audio(page)).track).toBe('lobby-v1');
  await page.evaluate(async () => {
    const a = await import(
      performance
        .getEntriesByType('resource')
        .map((entry) => entry.name)
        .find((url) => new URL(url).pathname === '/src/platform/audio.ts') ??
        '/src/platform/audio.ts'
    );
    for (let n = 0; n < 40; n++) a.sound('slash');
    a.sound('hit');
  });
  expect((await audio(page)).voices).toBeLessThanOrEqual(12);
});

test('음악 파일 실패가 게임 진입을 막지 않고 다음 입력에서 재시도한다', async ({ page }) => {
  await page.route('**/audio/**', (route) => route.abort());
  await page.goto('/');
  await expect(page.locator('.home-scene')).toBeVisible();
  await page.keyboard.press('Tab');
  await expect.poll(async () => (await audio(page)).context).toBe('running');
  expect((await audio(page)).track).toBe('');
  await page.unroute('**/audio/**');
  await page.keyboard.press('Tab');
  await expect.poll(async () => (await audio(page)).track).toBe('lobby-v1');
  await expect(page.getByRole('button', { name: '새 무인으로 출전 →' })).toBeEnabled();
});

test('지연된 자동 저장 중 실제 E 전환·이동을 받아들이고 마지막 상태를 저장한다', async ({
  page,
}) => {
  const state = emptyGame();
  startRun(state, '지연 저장', 123);
  state.run!.fighter.arts = ['huashan', 'wudang'].map((id) => ({
    id: id as 'huashan' | 'wudang',
    level: 1,
    gauge: 0,
    defenseCd: 0,
    combo: 0,
  }));
  state.run!.enemies.forEach((e) => {
    e.timer = 100;
    e.hp = e.maxHp = 100000;
  });
  await fixture(page, state);
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'true');
  await page.evaluate(async () => {
    const { gameStore } = await import(
      performance
        .getEntriesByType('resource')
        .map((entry) => entry.name)
        .find((url) => new URL(url).pathname === '/src/platform/store.ts') ??
        '/src/platform/store.ts'
    );
    const native = Object.getOwnPropertyDescriptor(IDBTransaction.prototype, 'oncomplete')!;
    Object.defineProperty(IDBTransaction.prototype, 'oncomplete', {
      configurable: true,
      get: native.get,
      set(fn) {
        native.set!.call(
          this,
          fn
            ? function (this: IDBTransaction, event: Event) {
                setTimeout(() => fn.call(this, event), 300);
              }
            : fn,
        );
      },
    });
    void gameStore.persist(false);
  });
  await page.keyboard.press('e');
  await expect
    .poll(() =>
      page.evaluate(
        async () =>
          (
            await import(
              performance
                .getEntriesByType('resource')
                .map((entry) => entry.name)
                .find((url) => new URL(url).pathname === '/src/platform/store.ts') ??
                '/src/platform/store.ts'
            )
          ).gameStore.state.run!.fighter.active,
      ),
    )
    .toBe(1);
  const before = await page.evaluate(
    async () =>
      (
        await import(
          performance
            .getEntriesByType('resource')
            .map((entry) => entry.name)
            .find((url) => new URL(url).pathname === '/src/platform/store.ts') ??
            '/src/platform/store.ts'
        )
      ).gameStore.state.run!.fighter.x,
  );
  await page.keyboard.down('d');
  await page.waitForTimeout(150);
  await page.keyboard.up('d');
  expect(
    await page.evaluate(
      async () =>
        (
          await import(
            performance
              .getEntriesByType('resource')
              .map((entry) => entry.name)
              .find((url) => new URL(url).pathname === '/src/platform/store.ts') ??
              '/src/platform/store.ts'
          )
        ).gameStore.state.run!.fighter.x,
    ),
  ).toBeGreaterThan(before);
  await page.evaluate(async () => {
    const { gameStore } = await import(
      performance
        .getEntriesByType('resource')
        .map((entry) => entry.name)
        .find((url) => new URL(url).pathname === '/src/platform/store.ts') ??
        '/src/platform/store.ts'
    );
    gameStore.pause(true);
    await gameStore.persist();
  });
  const result = await page.evaluate(async () => {
    const s = await import(
      performance
        .getEntriesByType('resource')
        .map((entry) => entry.name)
        .find((url) => new URL(url).pathname === '/src/platform/storage.ts') ??
        '/src/platform/storage.ts'
    );
    return s.readSave();
  });
  expect(result!.run!.fighter.active).toBe(1);
  expect(result!.run!.fighter.x).toBeGreaterThan(before);
});

test('최신 검증 사본은 사망 결과를 유지하고 손상된 원본을 별도로 보존한다', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.home-scene')).toBeVisible();
  const original = await page.evaluate(async () => {
    const { emptyGame, startRun } = await import(
        performance
          .getEntriesByType('resource')
          .map((entry) => entry.name)
          .find((url) => new URL(url).pathname === '/src/domain/game.ts') ?? '/src/domain/game.ts'
      ),
      { writeSave } = await import(
        performance
          .getEntriesByType('resource')
          .map((entry) => entry.name)
          .find((url) => new URL(url).pathname === '/src/platform/storage.ts') ??
          '/src/platform/storage.ts'
      );
    const state = emptyGame();
    startRun(state, '복구 검객', 123);
    await writeSave(state);
    state.run!.phase = 'dead';
    state.run!.fighter.hp = 0;
    state.run!.fighter.items = [];
    await writeSave(state);
    const bad = { version: 1, broken: 'preserved' };
    const request = indexedDB.open('mugong-local-v1', 1);
    const db = await new Promise<IDBDatabase>((r) => {
      request.onsuccess = () => r(request.result);
    });
    await new Promise<void>((r) => {
      const tx = db.transaction('saves', 'readwrite');
      tx.objectStore('saves').put(bad, 'current');
      tx.oncomplete = () => r();
    });
    db.close();
    return bad;
  });
  await page.reload();
  await expect(page.getByRole('button', { name: '최신 검증 사본으로 복구' })).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '저장 원본 내보내기' }).click();
  const download = await downloadPromise;
  await mkdir(proof, { recursive: true });
  await download.saveAs(`${proof}/original-export.json`);
  await page.getByRole('button', { name: '최신 검증 사본으로 복구' }).click();
  await expect(page.locator('.death-result')).toBeVisible();
  const restored = await page.evaluate(async () => {
    const { readSave } = await import(
      performance
        .getEntriesByType('resource')
        .map((entry) => entry.name)
        .find((url) => new URL(url).pathname === '/src/platform/storage.ts') ??
        '/src/platform/storage.ts'
    );
    const request = indexedDB.open('mugong-local-v1', 1);
    const db = await new Promise<IDBDatabase>((r) => {
      request.onsuccess = () => r(request.result);
    });
    const kept = await new Promise<any>((r) => {
      const get = db.transaction('saves').objectStore('saves').get('unreadable-original');
      get.onsuccess = () => r(get.result);
    });
    db.close();
    return { save: await readSave(), kept: kept.state };
  });
  expect(restored.kept).toEqual(original);
  expect(restored.save!.run!.phase).toBe('dead');
  expect(restored.save!.run!.fighter.hp).toBe(0);
});

test('최신 사본이 손상되면 더 오래된 정상 기록으로 돌아가지 않는다', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.home-scene')).toBeVisible();
  await page.evaluate(async () => {
    const { emptyGame } = await import(
        performance
          .getEntriesByType('resource')
          .map((entry) => entry.name)
          .find((url) => new URL(url).pathname === '/src/domain/game.ts') ?? '/src/domain/game.ts'
      ),
      { writeSave } = await import(
        performance
          .getEntriesByType('resource')
          .map((entry) => entry.name)
          .find((url) => new URL(url).pathname === '/src/platform/storage.ts') ??
          '/src/platform/storage.ts'
      );
    await writeSave(emptyGame());
    await writeSave(emptyGame());
    const request = indexedDB.open('mugong-local-v1', 1);
    const db = await new Promise<IDBDatabase>((r) => {
      request.onsuccess = () => r(request.result);
    });
    await new Promise<void>((resolve) => {
      const tx = db.transaction('saves', 'readwrite'),
        s = tx.objectStore('saves'),
        meta = s.get('save-meta');
      meta.onsuccess = () => {
        s.put({ broken: true }, 'current');
        s.put(
          { revision: meta.result.revision, state: { broken: true } },
          `verified-${meta.result.revision % 3}`,
        );
      };
      tx.oncomplete = () => resolve();
    });
    db.close();
  });
  await page.reload();
  await expect(page.getByRole('button', { name: '저장 원본 내보내기' })).toBeVisible();
  await expect(page.getByRole('button', { name: '최신 검증 사본으로 복구' })).toHaveCount(0);
});

test('예상하지 못한 React 예외에서도 빈 화면 대신 원본 보관·새로고침을 제공한다', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('.home-scene')).toBeVisible();
  const before = await page.evaluate(async () =>
    JSON.stringify(
      await (
        await import(
          performance
            .getEntriesByType('resource')
            .map((entry) => entry.name)
            .find((url) => new URL(url).pathname === '/src/platform/storage.ts') ??
            '/src/platform/storage.ts'
        )
      ).readRawSave(),
    ),
  );
  await page.evaluate(async () => {
    const { gameStore } = await import(
      performance
        .getEntriesByType('resource')
        .map((entry) => entry.name)
        .find((url) => new URL(url).pathname === '/src/platform/store.ts') ??
        '/src/platform/store.ts'
    );
    gameStore.state.family.roster = null as never;
    gameStore.notify();
  });
  await expect(page.locator('.runtime-recovery')).toBeVisible();
  await capture(page, 'runtime-recovery');
  const after = await page.evaluate(async () =>
    JSON.stringify(
      await (
        await import(
          performance
            .getEntriesByType('resource')
            .map((entry) => entry.name)
            .find((url) => new URL(url).pathname === '/src/platform/storage.ts') ??
            '/src/platform/storage.ts'
        )
      ).readRawSave(),
    ),
  );
  expect(after).toBe(before);
  await expect(page.getByRole('button', { name: '새로고침', exact: true })).toBeVisible();
});

test('저장 잠금이 없는 브라우저에서 사용자 저장을 덮어쓰지 않는다', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'locks', { value: undefined }));
  await page.goto('/');
  await expect(page.getByRole('dialog', { name: '저장 확인이 필요합니다' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('안전한 저장 잠금');
});

test('다섯 언어·세 해상도에서 성장 세 후보와 큰 HUD의 실제 글씨를 확인한다', async ({ page }) => {
  const state = emptyGame();
  startRun(state, '청하연', 123);
  grantXp(state.run!, 20);
  await fixture(page, state);
  await expect(page.locator('.choice-card').first()).toBeEnabled();
  const measurements = [];
  for (const locale of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW']) {
    await page.evaluate(
      async (locale) =>
        (
          await import(
            performance
              .getEntriesByType('resource')
              .map((entry) => entry.name)
              .find((url) => new URL(url).pathname === '/src/platform/i18n.ts') ??
              '/src/platform/i18n.ts'
          )
        ).setLanguage(locale as any),
      locale,
    );
    for (const [width, height] of [
      [1440, 900],
      [1366, 768],
      [1093, 614],
    ]) {
      await page.setViewportSize({ width, height });
      await expect(page.locator('.choice-card:visible')).toHaveCount(3);
      const issues = await page.locator('.growth').evaluate((root) => {
        const controls = [
          root,
          ...root.querySelectorAll<HTMLElement>('.choice-card,.growth-note,button'),
        ];
        return controls
          .filter((el) => el.getClientRects().length)
          .filter((el) => {
            const b = el.getBoundingClientRect();
            return (
              b.top < 0 ||
              b.bottom > innerHeight + 1 ||
              b.left < 0 ||
              b.right > innerWidth + 1 ||
              el.scrollHeight > el.clientHeight + 2 ||
              el.scrollWidth > el.clientWidth + 2
            );
          })
          .map((el) => el.className);
      });
      expect(issues).toEqual([]);
      measurements.push({ locale, width, height, issues });
      if (width === 1093) await capture(page, `growth-${locale}-1093`);
    }
  }
  await page.locator('.choice-card').first().click();
  const normal = await page
    .locator('.health-line > span')
    .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  await page.evaluate(() => {
    const node = document.querySelector('.app-shell')!;
    node.setAttribute('data-large-hud', 'true');
  });
  const large = await page
    .locator('.health-line > span')
    .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(large).toBeGreaterThan(normal);
  await capture(page, 'large-hud-1093');
  await writeFile(`${proof}/growth-locales.json`, JSON.stringify(measurements, null, 2));
});

test('음량 설정은 다섯 언어와 작은 창에서도 네 채널과 닫기를 모두 보여준다', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.home-scene')).toBeVisible();
  await page.getByRole('button', { name: '설정', exact: true }).click();
  await page.getByRole('tab', { name: '소리', exact: true }).click();
  for (const locale of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW']) {
    await page.evaluate(
      async (locale) =>
        (
          await import(
            performance
              .getEntriesByType('resource')
              .map((entry) => entry.name)
              .find((url) => new URL(url).pathname === '/src/platform/i18n.ts') ??
              '/src/platform/i18n.ts'
          )
        ).setLanguage(locale as any),
      locale,
    );
    for (const [width, height] of [
      [1440, 900],
      [1366, 768],
      [1093, 614],
      [640, 480],
      [390, 600],
    ]) {
      await page.setViewportSize({ width, height });
      const issues = await page.locator('.settings-dialog').evaluate((root) => {
        const nodes = [root, ...root.querySelectorAll<HTMLElement>('input,button,label,small')];
        return nodes
          .filter((el) => el.getClientRects().length && !el.closest('[hidden]'))
          .filter((el) => {
            const b = el.getBoundingClientRect();
            return (
              b.left < 0 ||
              b.top < 0 ||
              b.bottom > innerHeight + 1 ||
              b.right > innerWidth + 1 ||
              el.scrollHeight > el.clientHeight + 2 ||
              el.scrollWidth > el.clientWidth + 2
            );
          })
          .map((el) => ({
            class: el.className,
            rect: el.getBoundingClientRect().toJSON(),
            client: [el.clientWidth, el.clientHeight],
            scroll: [el.scrollWidth, el.scrollHeight],
          }));
      });
      expect(issues, `${locale} ${width}×${height}`).toEqual([]);
      if (width === 1093) await capture(page, `sound-settings-${locale}-1093`);
    }
  }
});

test('손상된 Opus 파일도 WAV로 복구해 음악을 재생한다', async ({ page }) => {
  await page.route('**/audio/*.webm', (route) =>
    route.fulfill({ status: 200, body: 'invalid-audio' }),
  );
  await page.goto('/');
  await expect(page.locator('.home-scene')).toBeVisible();
  await page.keyboard.press('Tab');
  await expect.poll(async () => (await audio(page)).track).toBe('lobby-v1');
});

test('WebGL 컨텍스트 손실은 정지·재시도로 복구하고 무인과 저장을 유지한다', async ({ page }) => {
  // Exercise the actual WebGL path with software rendering; this is not a hardware GPU claim.
  await page.addInitScript(() => {
    for (const Class of [WebGLRenderingContext, WebGL2RenderingContext]) {
      const original = Class.prototype.getParameter;
      Class.prototype.getParameter = function (parameter: number) {
        return parameter === 0x9246 ? 'Independent GL test' : original.call(this, parameter);
      };
    }
  });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('.home-scene')).toBeVisible();
  const id = await page.evaluate(async () => {
    const { gameStore } = await import(
      performance
        .getEntriesByType('resource')
        .map((entry) => entry.name)
        .find((url) => new URL(url).pathname === '/src/platform/store.ts') ??
        '/src/platform/store.ts'
    );
    await gameStore.dispatch({ type: 'start', name: 'GPU 복구 검객', seed: 123 });
    return gameStore.state.run!.id;
  });
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-renderer', 'WebGL / AUTO');
  await capture(page, 'webgl-before-loss');
  await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('.game-canvas canvas')!;
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    if (!gl) throw new Error('Expected the actual game canvas to have a WebGL context');
    gl.getExtension('WEBGL_lose_context')!.loseContext();
  });
  await expect(page.locator('.asset-loading[data-error="true"]')).toBeVisible();
  await expect(page.locator('.wuxia-hud')).toHaveCount(0);
  await expect(page.locator('.pause-menu')).toHaveCount(0);
  expect(
    await page.evaluate(
      async () =>
        (
          await import(
            performance
              .getEntriesByType('resource')
              .map((entry) => entry.name)
              .find((url) => new URL(url).pathname === '/src/platform/store.ts') ??
              '/src/platform/store.ts'
          )
        ).gameStore.state.run!.id,
    ),
  ).toBe(id);
  await page.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: '계속하기', exact: true }).click();
  await expect(page.locator('.pause-menu')).toHaveCount(0);
  await capture(page, 'webgl-recovered');
  expect(errors).toEqual([]);
});

test('전투 화면을 여러 번 재진입해도 캔버스와 무공 전환 입력이 중복되지 않는다', async ({
  page,
}) => {
  const state = emptyGame();
  startRun(state, '반복 진입', 123);
  state.run!.fighter.arts = ['huashan', 'wudang', 'tianmo', 'samja'].map((id) => ({
    id: id as any,
    level: 1,
    gauge: 0,
    combo: 0,
    defenseCd: 0,
  }));
  state.run!.enemies.forEach((e) => (e.timer = 100));
  await fixture(page, state);
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'true');
  for (let n = 0; n < 8; n++) {
    await page.getByRole('button', { name: '일시 정지', exact: true }).click();
    await page.getByRole('button', { name: '저장하고 일시 종료', exact: true }).click();
    await expect(page.locator('.home-scene')).toBeVisible();
    await expect(page.locator('canvas')).toHaveCount(0);
    await page.locator('.home-launch').click();
    await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'true');
    const previous = await page.evaluate(
      async () =>
        (
          await import(
            performance
              .getEntriesByType('resource')
              .map((entry) => entry.name)
              .find((url) => new URL(url).pathname === '/src/platform/store.ts') ??
              '/src/platform/store.ts'
          )
        ).gameStore.state.run!.fighter.active,
    );
    await page.keyboard.press('e');
    await expect
      .poll(() =>
        page.evaluate(
          async () =>
            (
              await import(
                performance
                  .getEntriesByType('resource')
                  .map((entry) => entry.name)
                  .find((url) => new URL(url).pathname === '/src/platform/store.ts') ??
                  '/src/platform/store.ts'
              )
            ).gameStore.state.run!.fighter.active,
        ),
      )
      .toBe((previous + 1) % 4);
    await expect(page.locator('canvas')).toHaveCount(1);
  }
});
