import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import type { RaidRoom } from '../../src/raid/model';

// Real UI/HTTP/WS, separate memory DB, naturally graduated loadouts and normal boss HP.
for (const [art, login] of [
  ['jegal', 'normalfirst'],
  ['tang', 'normalthird'],
] as const)
  test(`${art}: legal switches and mouse basics carry authored metadata/effects through server snapshots`, async ({
    page,
  }) => {
    let room: RaidRoom | undefined;
    const variants = new Set<string>(),
      fields = new Set<string>(),
      errors: string[] = [];
    let poison = 0;
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('websocket', (ws) =>
      ws.on('framereceived', (event) => {
        const message = JSON.parse(event.payload.toString());
        if (message.type !== 'room') return;
        room = message.room;
        for (const at of room?.match?.attacks ?? [])
          if (at.owner === 0 && at.art === art && at.ownedTechnique)
            variants.add(at.ownedTechnique.variant);
        for (const field of room?.match?.players[0].ownedFormations ?? [])
          if (field.kind) fields.add(field.kind);
        poison = Math.max(poison, room?.match?.players[4].poison ?? 0);
      }),
    );
    await page.goto('/raid/');
    await page.getByLabel('아이디', { exact: true }).fill(login);
    await page.getByLabel('비밀번호', { exact: true }).fill('isolated-normal-balance-password');
    await page.getByRole('button', { name: '레이드 입장', exact: true }).click();
    await page.getByRole('button', { name: '개인 무인 출전', exact: true }).click();
    await page.getByRole('button', { name: '레이드 방 만들기', exact: true }).click();
    await page.getByRole('button', { name: '대전 준비', exact: true }).click();
    await page.getByRole('button', { name: '산채 출발', exact: true }).click();
    await expect(page.locator('.raid-app')).toHaveAttribute('data-phase', 'fighting');
    expect(room!.match!.players[4].maxHp).toBe(1600);
    const target = room!.match!.players[0].fighter.arts.findIndex((a) => a.id === art);
    for (let i = 0; room!.match!.players[0].fighter.active !== target && i < 8; i++) {
      await page.keyboard.press('e');
      await page.waitForTimeout(350);
    }
    expect(room!.match!.players[0].fighter.arts[room!.match!.players[0].fighter.active].id).toBe(
      art,
    );
    const canvas = (await page.locator('canvas').boundingBox())!;
    await page.mouse.down();
    for (let i = 0; i < 60; i++) {
      const boss = room!.match!.players[4].fighter;
      await page.mouse.move(
        canvas.x + (boss.x / 1280) * canvas.width,
        canvas.y + ((boss.y - 34) / 800) * canvas.height,
      );
      if (
        art === 'jegal'
          ? fields.has('earth') && fields.has('heaven')
          : poison >= 2 && variants.size === 2
      )
        break;
      await page.waitForTimeout(200);
    }
    await page.mouse.up();
    expect([...variants].sort()).toEqual(['a', 'b']);
    if (art === 'jegal') expect([...fields].sort()).toEqual(['earth', 'heaven']);
    else expect(poison).toBeGreaterThanOrEqual(2);
    expect(room!.match!.damage[0]).toBeGreaterThan(0);
    expect(errors).toEqual([]);
    expect(
      (await page.evaluate(() => indexedDB.databases())).some((d) => d.name === 'mugong-local-v1'),
    ).toBe(false);
    await mkdir('.local-preview/tj-online', { recursive: true });
    await page.screenshot({ path: `.local-preview/tj-online/${art}.png` });
    await writeFile(
      `.local-preview/tj-online/${art}.json`,
      JSON.stringify(
        {
          art,
          variants: [...variants],
          fields: [...fields],
          poison,
          damage: room!.match!.damage[0],
          bossHp: room!.match!.players[4].maxHp,
          errors,
        },
        null,
        2,
      ),
    );
  });
