import { test, expect, type Browser, type Page, type BrowserContext } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import type { RoomState, ServerMessage } from '../../src/pvp/model';
import { emptyGame } from '../../src/domain/game';
import { startNetworkFrames, stopNetworkFrames } from './support/network-frames';
const proof =
  process.env.MUGONG_PVP_PROOF ??
  `docs/verification/realtime-biwu-v1/${process.env.MUGONG_PVP_MODE ?? 'source'}`;
let unique = 0;
async function player(browser: Browser, width: number, height: number, tag: string) {
  const context = await browser.newContext({
      viewport: { width, height },
      locale: 'ko-KR',
      baseURL: process.env.MUGONG_PVP_URL ?? 'http://127.0.0.1:5227',
    }),
    page = await context.newPage();
  let latest: RoomState | null = null;
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('websocket', (ws) =>
    ws.on('framereceived', (event) => {
      try {
        const m = JSON.parse(event.payload.toString()) as ServerMessage;
        if (m.type === 'room') latest = m.room;
      } catch {
        /* Non-state transport frame. */
      }
    }),
  );
  await page.goto('/pvp/');
  await page.getByRole('button', { name: '새 온라인 계정 만들기', exact: true }).click();
  const login = `pv${Date.now().toString(36)}${unique++}`;
  await page.getByLabel('아이디', { exact: true }).fill(login);
  await page.getByLabel('표시 이름', { exact: true }).fill(`${tag} 검증`);
  await page.getByLabel('비밀번호', { exact: true }).fill('automated-test-only-password');
  await page.getByRole('button', { name: '비무장 입장', exact: true }).click();
  await expect(page.getByRole('button', { name: '친선 방 만들기', exact: true })).toBeEnabled({
    timeout: 30000,
  });
  return { page, context, errors, state: () => latest, login };
}
async function ready(a: Page, b: Page) {
  await expect(a.getByRole('button', { name: '대전 준비', exact: true })).toBeEnabled({
    timeout: 90000,
  });
  await expect(b.getByRole('button', { name: '대전 준비', exact: true })).toBeEnabled({
    timeout: 90000,
  });
  await a.getByRole('button', { name: '대전 준비', exact: true }).click();
  await b.getByRole('button', { name: '대전 준비', exact: true }).click();
  await expect(a.locator('.pvp-app')).toHaveAttribute('data-phase', 'fighting', { timeout: 10000 });
  await expect(b.locator('.pvp-app')).toHaveAttribute('data-phase', 'fighting');
}
async function surrender(page: Page) {
  await page.getByRole('button', { name: '항복', exact: true }).click();
  await page
    .getByRole('dialog', { name: '항복 확인' })
    .getByRole('button', { name: '항복하기', exact: true })
    .click();
}
async function localSave(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const q = indexedDB.open('mugong-local-v1', 1);
      q.onsuccess = () => resolve(q.result);
    });
    const value = await new Promise((resolve) => {
      const q = db.transaction('saves').objectStore('saves').get('current');
      q.onsuccess = () => resolve(q.result);
    });
    db.close();
    return value;
  });
}
for (const [width, height] of [
  [1440, 900],
  [1366, 768],
  [1093, 614],
] as const)
  test(`friendly ${width}x${height}: two players, actual HP, surrender, no local save changes`, async ({
    browser,
  }) => {
    await mkdir(proof, { recursive: true });
    const a = await player(browser, width, height, '친선일'),
      b = await player(browser, width, height, '친선이');
    try {
      const offline = emptyGame();
      offline.family.runs = 7;
      await a.page.evaluate(async (state) => {
        const db = await new Promise<IDBDatabase>((resolve) => {
          const q = indexedDB.open('mugong-local-v1', 1);
          q.onupgradeneeded = () => q.result.createObjectStore('saves');
          q.onsuccess = () => resolve(q.result);
        });
        await new Promise<void>((resolve) => {
          const tx = db.transaction('saves', 'readwrite');
          tx.objectStore('saves').put(state, 'current');
          tx.oncomplete = () => resolve();
        });
        db.close();
      }, offline);
      await b.page.getByRole('button', { name: /소림/ }).click();
      await a.page.getByRole('button', { name: '친선 방 만들기', exact: true }).click();
      const code = await a.page.getByTestId('room-code').innerText();
      await b.page.getByLabel('방 코드', { exact: true }).fill(code);
      await b.page.getByRole('button', { name: '친선 방 참가', exact: true }).click();
      await ready(a.page, b.page);
      await startNetworkFrames(b.page, 'arena', 0);
      await a.page.locator('.pvp-battle').focus();
      await a.page.keyboard.down('d');
      await a.page.waitForTimeout(1100);
      await a.page.keyboard.up('d');
      await stopNetworkFrames(b.page, `pvp-${width}`);
      await expect.poll(() => a.state()?.match?.players[0].fighter.x ?? 0).toBeGreaterThan(650);
      const opponent = a.state()!.match!.players[1].fighter,
        canvas = (await a.page.locator('.pvp-canvas canvas').boundingBox())!;
      await a.page.mouse.move(
        canvas.x + (opponent.x / 1280) * canvas.width,
        canvas.y + ((opponent.y - 34) / 800) * canvas.height,
      );
      await a.page.mouse.down();
      await expect(
        b.page.getByRole('meter', { name: '내 경기 체력', exact: true }),
      ).not.toHaveAttribute('aria-valuenow', '240', { timeout: 5000 });
      await a.page.mouse.up();
      const hp = b.state()!.match!.players[1].fighter.hp;
      expect(hp).toBeLessThan(240);
      await expect
        .poll(async () => {
          const fill = b.page.getByRole('meter', { name: '내 경기 체력', exact: true });
          return fill.evaluate((el) => {
            const track = el.getBoundingClientRect();
            return el.querySelector('.meter-fill')!.getBoundingClientRect().width / track.width;
          });
        })
        .toBeLessThan(0.99);
      const boxes = await a.page
        .locator('.pvp-match-top,.pvp-combat-controls,.pvp-battle-footer')
        .evaluateAll((els) =>
          els.map((el) => ({ className: el.className, ...el.getBoundingClientRect().toJSON() })),
        );
      for (const box of boxes) {
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.right).toBeLessThanOrEqual(width);
        expect(box.bottom).toBeLessThanOrEqual(height);
      }
      await a.page.screenshot({ path: `${proof}/combat-${width}.png` });
      await surrender(b.page);
      await expect(a.page.locator('.pvp-result h1')).toHaveText('승리');
      await expect(b.page.locator('.pvp-result h1')).toHaveText('패배');
      await expect(a.page.getByText('서버에 결과 저장 완료', { exact: true })).toBeVisible();
      expect(a.state()!.receipt!.deltas).toEqual([0, 0]);
      expect(await localSave(a.page)).toEqual(offline);
      expect(a.errors).toEqual([]);
      expect(b.errors).toEqual([]);
      await writeFile(
        `${proof}/friendly-${width}.json`,
        JSON.stringify(
          {
            width,
            height,
            hp,
            receipt: a.state()!.receipt,
            localSaveUnchanged: true,
            boxes,
            errors: [...a.errors, ...b.errors],
          },
          null,
          2,
        ),
      );
    } finally {
      await a.context.close();
      await b.context.close();
    }
  });
test('ranked: cancel, match two accounts, reconnect, settle Elo once and show persistent ranking/history', async ({
  browser,
}) => {
  await mkdir(proof, { recursive: true });
  const a = await player(browser, 1093, 614, '순위일'),
    b = await player(browser, 1093, 614, '순위이');
  try {
    await a.page.getByRole('button', { name: /암영/ }).click();
    await b.page.getByRole('button', { name: /기문/ }).click();
    await a.page.getByRole('button', { name: '순위전 찾기', exact: true }).click();
    await expect(a.page.getByText('순위전 상대를 찾고 있습니다', { exact: true })).toBeVisible();
    await a.page.getByRole('button', { name: '매칭 취소', exact: true }).click();
    await expect(a.page.getByRole('button', { name: '순위전 찾기', exact: true })).toBeVisible();
    await a.page.getByRole('button', { name: '순위전 찾기', exact: true }).click();
    await b.page.getByRole('button', { name: '순위전 찾기', exact: true }).click();
    await ready(a.page, b.page);
    const matchId = a.state()!.match!.id;
    await a.page.reload();
    await expect(a.page.locator('.pvp-app')).toHaveAttribute('data-phase', 'fighting', {
      timeout: 90000,
    });
    expect(a.state()!.match!.id).toBe(matchId);
    await a.page.getByRole('button', { name: '다음 무공', exact: true }).click();
    await b.page.getByRole('button', { name: '다음 무공', exact: true }).click();
    await expect.poll(() => a.state()!.match!.players[0].fighter.active).toBe(1);
    await a.page.screenshot({ path: `${proof}/ranked-reconnected.png` });
    await surrender(b.page);
    await expect(a.page.getByTestId('rating-delta')).toHaveText('(+12)');
    await expect(b.page.getByTestId('rating-delta')).toHaveText('(-12)');
    const receipt = a.state()!.receipt!;
    await a.page.reload();
    await expect(a.page.getByTestId('rating-delta')).toHaveText('(+12)', { timeout: 90000 });
    expect(a.state()!.receipt!.id).toBe(receipt.id);
    const me = await (await a.page.request.get('/api/pvp/me')).json();
    expect(me.account.rating).toBe(1012);
    expect(me.account.matches).toBe(1);
    expect(me.history.filter((h: { id: string }) => h.id === receipt.id)).toHaveLength(1);
    await a.page.getByRole('button', { name: '대기실로', exact: true }).click();
    await expect(a.page.locator('.pvp-records [data-self=true]')).toContainText('1012');
    await a.page.screenshot({ path: `${proof}/rankings.png` });
    expect(a.errors).toEqual([]);
    expect(b.errors).toEqual([]);
    await writeFile(
      `${proof}/ranked.json`,
      JSON.stringify(
        {
          receipt,
          matchCount: me.account.matches,
          ranking: me.account.rating,
          reconnectPreservedId: true,
          errors: [...a.errors, ...b.errors],
        },
        null,
        2,
      ),
    );
  } finally {
    await a.context.close();
    await b.context.close();
  }
});
test('failed artwork cannot ready; retry resumes the same friendly room', async ({ browser }) => {
  const a = await player(browser, 1093, 614, '자료일'),
    b = await player(browser, 1093, 614, '자료이');
  try {
    await a.page.route('**/art/hero-roster-v1/directions-0.webp', (route) => route.abort());
    await a.page.getByRole('button', { name: '친선 방 만들기', exact: true }).click();
    const code = await a.page.getByTestId('room-code').innerText();
    await b.page.getByLabel('방 코드', { exact: true }).fill(code);
    await b.page.getByRole('button', { name: '친선 방 참가', exact: true }).click();
    await expect(
      a.page.getByText('그림을 준비하지 못했습니다. 다시 준비를 눌러 주세요.', { exact: true }),
    ).toBeVisible({ timeout: 30000 });
    await expect(a.page.getByRole('button', { name: '대전 준비', exact: true })).toBeDisabled();
    await a.page.unroute('**/art/hero-roster-v1/directions-0.webp');
    await a.page.getByRole('button', { name: '다시 준비', exact: true }).click();
    await ready(a.page, b.page);
    expect(a.state()!.code).toBe(code);
    await surrender(a.page);
    expect(a.errors).toEqual([]);
  } finally {
    await a.context.close();
    await b.context.close();
  }
});

test('online login rejects a wrong password, accepts the same account and signs out', async ({
  browser,
}) => {
  const a = await player(browser, 1093, 614, '인증');
  try {
    const original = await (await a.page.request.get('/api/pvp/me')).json();
    await a.page.getByRole('button', { name: '로그아웃', exact: true }).click();
    await expect(a.page.getByRole('heading', { name: '온라인 로그인', exact: true })).toBeVisible();
    await a.page.getByLabel('아이디', { exact: true }).fill(a.login);
    await a.page.getByLabel('비밀번호', { exact: true }).fill('wrong-password');
    await a.page.getByRole('button', { name: '비무장 입장', exact: true }).click();
    await expect(a.page.getByRole('alert')).toContainText('아이디 또는 비밀번호를 확인하세요');
    await a.page.getByLabel('비밀번호', { exact: true }).fill('automated-test-only-password');
    await a.page.getByRole('button', { name: '비무장 입장', exact: true }).click();
    await expect(a.page.getByRole('button', { name: '친선 방 만들기', exact: true })).toBeEnabled();
    const restored = await (await a.page.request.get('/api/pvp/me')).json();
    expect(restored.account.id).toBe(original.account.id);
    expect(restored.account.rating).toBe(1000);
    expect(a.errors).toEqual([]);
    await a.page.getByRole('button', { name: '로그아웃', exact: true }).click();
    await expect(a.page.getByRole('heading', { name: '온라인 로그인', exact: true })).toBeVisible();
    expect((await (await a.page.request.get('/api/pvp/me')).json()).account).toBeNull();
  } finally {
    await a.context.close();
  }
});
