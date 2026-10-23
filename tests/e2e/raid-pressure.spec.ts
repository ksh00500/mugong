import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import type { RaidRoom } from '../../src/raid/model';
const proof = '.local-preview/balance-browser';

// Separate server/memory DB seeded from unmodified natural 20-wave graduates.
// No reduced boss HP, uploaded state, or actual local-account registration.
for (const [width, height, login] of [
  [1440, 900, 'normalfirst'],
  [1366, 768, 'normalsecond'],
  [1093, 614, 'normalthird'],
] as const)
  test(`normal personal raid ${width}: pursuit, warning, real damage and complete HUD`, async ({
    browser,
  }) => {
    const context = await browser.newContext({ viewport: { width, height }, locale: 'ko-KR' });
    const page = await context.newPage(),
      errors: string[] = [];
    let room: RaidRoom | undefined;
    const warnings: { pattern: string; tick: number; aim: number }[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('websocket', (ws) =>
      ws.on('framereceived', (event) => {
        const message = JSON.parse(event.payload.toString());
        if (message.type !== 'room') return;
        room = message.room;
        const match = room?.match;
        if (match?.boss.phase === 'windup')
          warnings.push({ pattern: match.boss.pattern, tick: match.tick, aim: match.boss.aim });
      }),
    );
    try {
      await mkdir(proof, { recursive: true });
      await page.goto('/raid/');
      await page.getByLabel('아이디', { exact: true }).fill(login);
      await page.getByLabel('비밀번호', { exact: true }).fill('isolated-normal-balance-password');
      await page.getByRole('button', { name: '레이드 입장', exact: true }).click();
      await page.getByRole('button', { name: '개인 무인 출전', exact: true }).click();
      await expect(
        page.getByRole('button', { name: '레이드 방 만들기', exact: true }),
      ).toBeEnabled();
      await page.getByRole('button', { name: '레이드 방 만들기', exact: true }).click();
      await expect(page.getByRole('button', { name: '대전 준비', exact: true })).toBeEnabled({
        timeout: 90000,
      });
      await page.getByRole('button', { name: '대전 준비', exact: true }).click();
      await page.getByRole('button', { name: '산채 출발', exact: true }).click();
      await expect(page.locator('.raid-app')).toHaveAttribute('data-phase', 'fighting');
      expect(room!.match!.players[4].maxHp).toBe(1600);
      expect(room!.match!.personal).toBe(true);
      await page.keyboard.down('a');
      await expect
        .poll(() => warnings.some((w) => w.pattern === 'charge'), { timeout: 12000 })
        .toBe(true);
      await page.keyboard.up('a');
      await page.screenshot({ path: `${proof}/normal-warning-${width}.png` });
      for (const selector of [
        '.raid-boss-hud',
        '.raid-ultimate',
        '.raid-defense',
        '.raid-personal',
      ]) {
        const box = await page.locator(selector).boundingBox();
        expect(box).not.toBeNull();
        expect(box!.y).toBeGreaterThanOrEqual(0);
        expect(box!.y + box!.height).toBeLessThanOrEqual(height);
      }
      // Real mouse attacks and standing exposure must affect the normal server state.
      await expect.poll(() => room!.match!.taken[0], { timeout: 20000 }).toBeGreaterThan(0);
      const boss = room!.match!.players[4].fighter,
        canvas = (await page.locator('canvas').boundingBox())!;
      await page.mouse.move(
        canvas.x + (boss.x / 1280) * canvas.width,
        canvas.y + ((boss.y - 34) / 800) * canvas.height,
      );
      await page.mouse.down();
      await expect.poll(() => room!.match!.damage[0], { timeout: 7000 }).toBeGreaterThan(0);
      await page.mouse.up();
      await page.screenshot({ path: `${proof}/normal-contact-${width}.png` });
      expect(errors).toEqual([]);
      expect(
        (await page.evaluate(() => indexedDB.databases())).some(
          (d) => d.name === 'mugong-local-v1',
        ),
      ).toBe(false);
      await writeFile(
        `${proof}/observed-${width}.json`,
        JSON.stringify(
          {
            viewport: { width, height },
            maxBossHp: room!.match!.players[4].maxHp,
            taken: room!.match!.taken[0],
            damage: room!.match!.damage[0],
            warnings,
            errors,
          },
          null,
          2,
        ),
      );
    } finally {
      await context.close();
    }
  });
