import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import type { RaidRoom } from '../../src/raid/model';
const proof = `docs/verification/online-personal-v1/${process.env.MUGONG_ONLINE_MODE ?? 'source'}`;
async function login(page: Page, name: string, raid = false) {
  await page.goto(raid ? '/raid/' : '/online/');
  await page.getByLabel('아이디', { exact: true }).fill(name);
  await page.getByLabel('비밀번호', { exact: true }).fill('isolated-personal-browser-password');
  await page
    .getByRole('button', { name: raid ? '레이드 입장' : '온라인 세가 입장', exact: true })
    .click();
}
for (const [width, height, account] of [
  [1440, 900, 'ownedtest'],
  [1366, 768, 'ownedsecond'],
  [1093, 614, 'ownedthird'],
] as const)
  test(`owned fighter ${width}: roster gear → raid clear → stored growth → return`, async ({
    browser,
  }) => {
    const context = await browser.newContext({ viewport: { width, height }, locale: 'ko-KR' }),
      page = await context.newPage(),
      errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    let room: RaidRoom | undefined;
    page.on('websocket', (ws) =>
      ws.on('framereceived', (e) => {
        const m = JSON.parse(e.payload.toString());
        if (m.type === 'room') room = m.room;
      }),
    );
    try {
      await mkdir(proof, { recursive: true });
      await login(page, account);
      await expect(page.getByRole('button', { name: '가방', exact: true })).toBeEnabled({
        timeout: 40000,
      });
      await page.getByRole('button', { name: '가방', exact: true }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.screenshot({ path: `${proof}/online-bag-${width}.png` });
      await page.keyboard.press('Escape');
      await page.getByRole('link', { name: '개인 레이드', exact: true }).click();
      await page.getByRole('button', { name: '개인 무인 출전', exact: true }).click();
      await expect(
        page.getByRole('button', { name: '레이드 방 만들기', exact: true }),
      ).toBeEnabled();
      await page.getByRole('button', { name: '레이드 방 만들기', exact: true }).click();
      await expect(page.getByRole('button', { name: '대전 준비', exact: true })).toBeEnabled({
        timeout: 90000,
      });
      await page.getByRole('button', { name: '대전 준비', exact: true }).click();
      await expect(page.getByRole('button', { name: '산채 출발', exact: true })).toBeEnabled();
      await page.getByRole('button', { name: '산채 출발', exact: true }).click();
      await expect(page.locator('.raid-app')).toHaveAttribute('data-phase', 'fighting');
      expect(room!.personal).toBe(true);
      expect(room!.match!.players[0].maxHp).toBeGreaterThan(240);
      const boss = room!.match!.players[4].fighter,
        canvas = (await page.locator('canvas').boundingBox())!;
      await page.mouse.move(
        canvas.x + (boss.x / 1280) * canvas.width,
        canvas.y + ((boss.y - 34) / 800) * canvas.height,
      );
      await page.mouse.down();
      await expect(
        page.getByRole('heading', { name: '층 클리어 · 정비', exact: true }),
      ).toBeVisible({ timeout: 25000 });
      await page.mouse.up();
      // Growth remains a server-persisted choice; defer it without rerolling candidates.
      const defer = page.getByRole('button', { name: '수련 기회 보관', exact: true });
      await expect(defer).toBeEnabled();
      await defer.click();
      await expect(page.locator('.growth-scrim')).toHaveCount(0);
      expect(room!.ownSave!.state.family.training).toBeUndefined();
      await page.screenshot({ path: `${proof}/personal-rest-${width}.png` });
      await page.getByRole('button', { name: '가방 · 장비 · 전리품', exact: true }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.screenshot({ path: `${proof}/raid-bag-${width}.png` });
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: '지금 귀환', exact: true }).click();
      await expect(page.getByRole('heading', { name: '귀환 완료', exact: true })).toBeVisible();
      await page.getByRole('link', { name: '온라인 세가 · 성장 · 장비 확인', exact: true }).click();
      await expect(page.getByRole('button', { name: '가방', exact: true })).toBeEnabled({
        timeout: 30000,
      });
      const saved = await (await page.request.get('/api/pvp/online')).json();
      expect(saved.locked).toBeNull();
      expect(saved.state.family.silver).toBeGreaterThanOrEqual(20);
      expect(saved.state.family.roster[0].xp).toBeGreaterThan(920);
      await page.getByRole('button', { name: '가방', exact: true }).click();
      const item = saved.state.family.roster[0].items.find((i: any) => i.kind === 'sword');
      await page.locator(`[data-item-id="${item.id}"]`).first().click();
      await page.getByRole('button', { name: '창고로', exact: true }).click();
      await expect
        .poll(async () => {
          const s = await (await page.request.get('/api/pvp/online')).json();
          return s.state.family.warehouse.some((i: any) => i.id === item.id);
        })
        .toBe(true);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
test('fresh account uses server recruitment, growth and combat; reload retains progress and leaves local saves untouched', async ({
  browser,
}) => {
  const context = await browser.newContext({
      viewport: { width: 1093, height: 614 },
      locale: 'ko-KR',
    }),
    page = await context.newPage(),
    errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await mkdir(proof, { recursive: true });
    await page.goto('/online/');
    await page.getByRole('button', { name: '새 온라인 계정 만들기', exact: true }).click();
    await page.getByLabel('아이디', { exact: true }).fill(`online${Date.now().toString(36)}`);
    await page.getByLabel('표시 이름', { exact: true }).fill('독립 검증');
    await page.getByLabel('비밀번호', { exact: true }).fill('isolated-personal-browser-password');
    await page.getByRole('button', { name: '온라인 세가 입장', exact: true }).click();
    await expect(page.getByRole('button', { name: '새 무인으로 출전 →', exact: true })).toBeEnabled(
      { timeout: 40000 },
    );
    const dbsBefore = await page.evaluate(async () => indexedDB.databases());
    expect(dbsBefore.some((d) => d.name === 'mugong-local-v1')).toBe(false);
    await page.getByRole('button', { name: '새 무인으로 출전 →', exact: true }).click();
    await page.getByRole('button', { name: '모집권 1장 사용', exact: true }).click();
    await page.locator('.recruitment-select').first().click();
    await page.getByLabel('무인의 이름', { exact: true }).fill('서버 검증');
    await page.getByRole('button', { name: '강호에 나서기 →', exact: true }).click();
    await expect(page.locator('.choice-card:not(:disabled)').first()).toBeEnabled({
      timeout: 90000,
    });
    await page.locator('.choice-card:not(:disabled)').first().click();
    await expect(page.locator('canvas')).toBeVisible({ timeout: 90000 });
    await page.waitForTimeout(1000);
    for (const selector of ['.wuxia-hud .ultimate-panel', '.wuxia-hud .defense-panel']) {
      const box = await page.locator(selector).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.y + box!.height).toBeLessThanOrEqual(614);
    }
    const first = await (await page.request.get('/api/pvp/online')).json();
    await page.keyboard.down('d');
    await page.waitForTimeout(400);
    await page.keyboard.up('d');
    await page.waitForTimeout(300);
    const moved = await (await page.request.get('/api/pvp/online')).json();
    expect(moved.state.run.fighter.x).toBeGreaterThan(first.state.run.fighter.x);
    await page.screenshot({ path: `${proof}/online-combat-1093.png` });
    await page.reload();
    await expect(page.locator('canvas')).toBeVisible({ timeout: 90000 });
    const resumed = await (await page.request.get('/api/pvp/online')).json();
    expect(resumed.state.run.id).toBe(first.state.run.id);
    expect(resumed.state.run.fighter.arts.length).toBe(1);
    expect(
      (await page.evaluate(async () => indexedDB.databases())).some(
        (d) => d.name === 'mugong-local-v1',
      ),
    ).toBe(false);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
