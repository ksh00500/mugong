import { test, expect, type Browser, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import type { RaidRoom } from '../../src/raid/model';
import { emptyGame } from '../../src/domain/game';
const proof = `docs/verification/cooperative-raid-v1/${process.env.MUGONG_RAID_MODE ?? 'source'}`;
let seq = 0;
async function player(browser: Browser, width: number, height: number) {
  const context = await browser.newContext({
      viewport: { width, height },
      locale: 'ko-KR',
      baseURL: process.env.MUGONG_RAID_URL ?? 'http://127.0.0.1:5227',
    }),
    page = await context.newPage();
  let room: RaidRoom | undefined;
  const errors: string[] = [];
  const patterns = new Set<string>();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('websocket', (ws) =>
    ws.on('framereceived', (e) => {
      const m = JSON.parse(e.payload.toString());
      if (m.type === 'room') {
        room = m.room;
        if (room?.match) patterns.add(room.match.boss.pattern);
      }
    }),
  );
  await page.goto('/raid/');
  await page.getByRole('button', { name: '새 온라인 계정 만들기', exact: true }).click();
  const login = `raid${Date.now().toString(36)}${seq++}`;
  await page.getByLabel('아이디', { exact: true }).fill(login);
  await page.getByLabel('표시 이름', { exact: true }).fill(`동료 ${seq}`);
  await page.getByLabel('비밀번호', { exact: true }).fill('isolated-browser-test-password');
  await page.getByRole('button', { name: '레이드 입장', exact: true }).click();
  await expect(page.getByRole('button', { name: '레이드 방 만들기', exact: true })).toBeEnabled({
    timeout: 30000,
  });
  return { context, page, state: () => room!, errors, patterns };
}
async function ready(page: Page) {
  await expect(page.getByRole('button', { name: '대전 준비', exact: true })).toBeEnabled({
    timeout: 90000,
  });
  await page.getByRole('button', { name: '대전 준비', exact: true }).click();
}
async function abandon(page: Page) {
  await page.getByRole('button', { name: '출전 포기', exact: true }).click();
  await page.getByRole('button', { name: '포기하고 나가기', exact: true }).click();
  await expect(page.getByRole('button', { name: '레이드 방 만들기', exact: true })).toBeVisible();
}
for (const [width, height] of [
  [1440, 900],
  [1366, 768],
  [1093, 614],
] as const)
  test(`co-op ${width}x${height}: damage, clear, return, readiness reset and next-floor scaling`, async ({
    browser,
  }) => {
    await mkdir(proof, { recursive: true });
    const a = await player(browser, width, height),
      b = await player(browser, width, height);
    try {
      await a.page.getByRole('button', { name: /암영/ }).click();
      const offline = emptyGame();
      offline.family.runs = 11;
      await a.page.evaluate(async (state) => {
        const db = await new Promise<IDBDatabase>((r) => {
          const q = indexedDB.open('mugong-local-v1', 1);
          q.onupgradeneeded = () => q.result.createObjectStore('saves');
          q.onsuccess = () => r(q.result);
        });
        await new Promise<void>((r) => {
          const tx = db.transaction('saves', 'readwrite');
          tx.objectStore('saves').put(state, 'current');
          tx.oncomplete = () => r();
        });
        db.close();
      }, offline);
      await a.page.getByRole('button', { name: '레이드 방 만들기', exact: true }).click();
      const code = await a.page.getByTestId('raid-code').innerText();
      await b.page.getByLabel('방 코드', { exact: true }).fill(code);
      await b.page.getByRole('button', { name: '레이드 방 참가', exact: true }).click();
      await ready(a.page);
      await ready(b.page);
      await expect(a.page.getByRole('button', { name: '산채 출발', exact: true })).toBeEnabled();
      await a.page.getByRole('button', { name: '산채 출발', exact: true }).click();
      await expect(a.page.locator('.raid-app')).toHaveAttribute('data-phase', 'fighting');
      const boss = a.state().match!.players[4].fighter,
        canvas = (await a.page.locator('canvas').boundingBox())!;
      await a.page.mouse.move(
        canvas.x + (boss.x / 1280) * canvas.width,
        canvas.y + ((boss.y - 34) / 800) * canvas.height,
      );
      await a.page.mouse.down();
      await a.page.screenshot({ path: `${proof}/combat-${width}.png` });
      await expect(
        a.page.getByRole('heading', { name: '층 클리어 · 정비', exact: true }),
      ).toBeVisible({ timeout: 20000 });
      await a.page.mouse.up();
      const m = a.state().match!;
      expect(m.cleared).toBe(1);
      expect(m.scaledFor).toBe(2);
      expect(m.damage[0]).toBeGreaterThan(0);
      expect(m.damage[1]).toBe(0);
      await a.page.getByRole('button', { name: '다음 층 준비', exact: true }).click();
      await expect(a.page.getByRole('button', { name: '준비 취소', exact: true })).toBeVisible();
      await b.page.getByRole('button', { name: '지금 귀환', exact: true }).click();
      await expect(a.page.getByRole('button', { name: '다음 층 준비', exact: true })).toBeVisible();
      await expect(b.page.getByRole('heading', { name: '귀환 완료', exact: true })).toBeVisible();
      await expect(b.page.getByText('유효 피해',{exact:true})).toBeVisible();
      await b.page.screenshot({path:`${proof}/result-${width}.png`});
      await a.page.screenshot({ path: `${proof}/rest-${width}.png` });
      await a.page.getByRole('button', { name: '다음 층 준비', exact: true }).click();
      await expect.poll(() => a.state().match?.floor).toBe(2);
      expect(a.state().match!.scaledFor).toBe(1);
      if (width === 1093) {
        await a.page.getByRole('button', { name: '준비 취소', exact: true }).click();
        await expect(
          a.page.getByRole('heading', { name: '층 클리어 · 정비', exact: true }),
        ).toBeVisible();
        expect(a.state().match!.floor).toBe(1);
        await a.page.getByRole('button', { name: '다음 층 준비', exact: true }).click();
        await expect.poll(() => a.state().match?.floor).toBe(2);
      }
      await b.page.getByRole('button', { name: '대기실로', exact: true }).click();
      await expect(b.page.locator('.pvp-history')).toContainText('귀환 완료');
      const old = await a.page.evaluate(async () => {
        const db = await new Promise<IDBDatabase>((r) => {
          const q = indexedDB.open('mugong-local-v1', 1);
          q.onsuccess = () => r(q.result);
        });
        const s = await new Promise((r) => {
          const q = db.transaction('saves').objectStore('saves').get('current');
          q.onsuccess = () => r(q.result);
        });
        db.close();
        return s;
      });
      expect(old).toEqual(offline);
      await expect(a.page.locator('.raid-app')).toHaveAttribute('data-phase', 'fighting');
      await abandon(a.page);
      expect(a.errors).toEqual([]);
      expect(b.errors).toEqual([]);
      await writeFile(
        `${proof}/flow-${width}.json`,
        JSON.stringify(
          {
            width,
            height,
            cleared: 1,
            initialParty: 2,
            nextParty: 1,
            damage: m.damage,
            localSaveUnchanged: true,
            fixture:
              'First floor boss HP40; movement/damage/auth and later floor scaling use real server rules',
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
test('four browsers share a party and boss; late joins cancel readiness, reload resumes and rules never pause', async ({
  browser,
}) => {
  await mkdir(proof, { recursive: true });
  const ps = [];
  for (let i = 0; i < 4; i++) ps.push(await player(browser, 1093, 614));
  try {
    const a = ps[0];
    await a.page.getByRole('button', { name: '레이드 방 만들기', exact: true }).click();
    const code = await a.page.getByTestId('raid-code').innerText();
    await ready(a.page);
    for (const p of ps.slice(1)) {
      await p.page.getByLabel('방 코드', { exact: true }).fill(code);
      await p.page.getByRole('button', { name: '레이드 방 참가', exact: true }).click();
    }
    await expect(a.page.getByRole('button', { name: '대전 준비', exact: true })).toBeVisible();
    for (const p of ps) await ready(p.page);
    await a.page.getByRole('button', { name: '산채 출발', exact: true }).click();
    await expect(a.page.locator('.raid-app')).toHaveAttribute('data-phase', 'fighting');
    expect(a.state().match!.scaledFor).toBe(4);
    const id = a.state().match!.id;
    await ps[3].page.reload();
    await expect(ps[3].page.locator('.raid-app')).toHaveAttribute('data-phase', 'fighting', {
      timeout: 90000,
    });
    expect(ps[3].state().match!.id).toBe(id);
    const tick = a.state().match!.tick;
    await a.page.getByRole('button', { name: '레이드 규칙', exact: true }).first().click();
    await expect.poll(() => a.state().match!.tick).toBeGreaterThan(tick + 20);
    await a.page.keyboard.press('Escape');
    await a.page.screenshot({ path: `${proof}/four-players.png` });
    const boxes = await a.page
      .locator('.raid-top,.raid-controls,.pvp-battle-footer')
      .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON()));
    for (const box of boxes) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(1093);
      expect(box.bottom).toBeLessThanOrEqual(614);
    }
    for (const p of ps) expect(p.errors).toEqual([]);
    await writeFile(
      `${proof}/four.json`,
      JSON.stringify({ id, party: 4, boxes, errors: ps.flatMap((p) => p.errors) }, null, 2),
    );
  } finally {
    for (const p of ps) await p.context.close();
  }
});
test('failed raid artwork blocks readiness; retry restores the same solo room', async ({
  browser,
}) => {
  const a = await player(browser, 1093, 614);
  try {
    await a.page.route('**/art/hero-roster-v1/directions-0.webp', (r) => r.abort());
    await a.page.getByRole('button', { name: '레이드 방 만들기', exact: true }).click();
    const code = await a.page.getByTestId('raid-code').innerText();
    await expect(a.page.getByRole('button', { name: '다시 준비', exact: true })).toBeVisible({
      timeout: 60000,
    });
    await expect(a.page.getByRole('button', { name: '대전 준비', exact: true })).toBeDisabled();
    await a.page.unroute('**/art/hero-roster-v1/directions-0.webp');
    await a.page.getByRole('button', { name: '다시 준비', exact: true }).click();
    await ready(a.page);
    expect(await a.page.getByTestId('raid-code').innerText()).toBe(code);
    await a.page.getByRole('button', { name: '산채 출발', exact: true }).click();
    await expect(a.page.locator('.raid-app')).toHaveAttribute('data-phase', 'fighting');
    expect(a.state().match!.scaledFor).toBe(1);
    await abandon(a.page);
    expect(a.errors).toEqual([]);
  } finally {
    await a.context.close();
  }
});
test('normal HP server: two players damage the boss and observe distinct telegraphed attacks', async ({
  browser,
}) => {
  test.skip(
    process.env.MUGONG_RAID_MODE !== 'normal',
    'Runs only against the unmodified isolated rules server',
  );
  await mkdir(proof, { recursive: true });
  const a = await player(browser, 1093, 614),
    b = await player(browser, 1093, 614);
  try {
    await a.page.getByRole('button', { name: /암영/ }).click();
    await a.page.getByRole('button', { name: '레이드 방 만들기', exact: true }).click();
    const code = await a.page.getByTestId('raid-code').innerText();
    await b.page.getByLabel('방 코드', { exact: true }).fill(code);
    await b.page.getByRole('button', { name: '레이드 방 참가', exact: true }).click();
    await ready(a.page);
    await ready(b.page);
    await a.page.getByRole('button', { name: '산채 출발', exact: true }).click();
    await expect(a.page.locator('.raid-app')).toHaveAttribute('data-phase', 'fighting');
    expect(a.state().match!.players[4].maxHp).toBe(2640);
    const boss = a.state().match!.players[4].fighter,
      canvas = (await a.page.locator('canvas').boundingBox())!;
    await a.page.mouse.move(
      canvas.x + (boss.x / 1280) * canvas.width,
      canvas.y + ((boss.y - 34) / 800) * canvas.height,
    );
    await a.page.mouse.down();
    await expect.poll(() => a.state().match!.players[4].fighter.hp).toBeLessThan(2640);
    await a.page.mouse.up();
    await expect.poll(() => a.patterns.has('charge'), { timeout: 15000 }).toBe(true);
    await expect.poll(() => a.state().match!.boss.phase, { timeout: 15000 }).toBe('windup');
    await a.page.screenshot({ path: `${proof}/telegraph.png` });
    expect(a.state().match!.phase).toBe('fighting');
    expect(a.errors).toEqual([]);
    expect(b.errors).toEqual([]);
    await writeFile(
      `${proof}/normal-rules.json`,
      JSON.stringify(
        {
          bossMax: 2640,
          bossHP: a.state().match!.players[4].fighter.hp,
          patterns: [...a.patterns],
          party: 2,
          noRulesOverrides: true,
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
