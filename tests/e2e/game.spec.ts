import { test, expect, type Page } from '@playwright/test';
import { command, emptyGame, grantXp, spawnWave, startRun } from '../../src/domain/game';
import { isPrep, makeItem } from '../../src/domain/content';
import { supportStats } from '../../src/domain/support';
import type { GameState } from '../../src/domain/model';
import { mkdir, writeFile } from 'node:fs/promises';

async function expectWorkspaceFits(page: Page) {
  const overflows = await page.locator('.inventory-workspace').evaluate((dialog) => {
    const failures: string[] = [];
    for (const element of [
      dialog,
      ...dialog.querySelectorAll('.inventory-columns,.item-detail,.inventory-tray,.bag-grid'),
    ]) {
      const el = element as HTMLElement;
      if (!el.getClientRects().length) continue;
      if (el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2)
        failures.push(
          `${el.className}: ${el.clientWidth}×${el.clientHeight} / ${el.scrollWidth}×${el.scrollHeight}`,
        );
    }
    const tray = dialog.querySelector('.inventory-tray')!.getBoundingClientRect();
    for (const button of dialog.querySelectorAll('button')) {
      const box = button.getBoundingClientRect();
      if (!box.width || !box.height) continue;
      if (
        box.top < -1 ||
        box.bottom > innerHeight + 1 ||
        box.left < -1 ||
        box.right > innerWidth + 1
      )
        failures.push(`화면 밖: ${button.getAttribute('aria-label') || button.textContent}`);
      if (tray.width && button.closest('.bag-grid') && box.bottom > tray.top)
        failures.push('가방 격자와 하단 물품 영역 겹침');
    }
    return failures;
  });
  expect(
    overflows,
    await page.locator('.inventory-columns').evaluate((el) =>
      JSON.stringify(
        [...el.children]
          .filter((child) => child.getClientRects().length)
          .map((child) => ({
            name: child.className,
            height: child.getBoundingClientRect().height,
            style: getComputedStyle(child).margin,
            cell: getComputedStyle(el).getPropertyValue('--cell'),
          })),
      ),
    ),
  ).toEqual([]);
}
async function seed(page: Page, state: GameState) {
  await page.goto('/');
  await expect(page.getByRole('button', { name: '새 무인으로 출전 →' })).toBeVisible();
  await page.evaluate(async (state) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('mugong-local-v1', 1);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('saves', 'readwrite');
      tx.objectStore('saves').put(state, 'current');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, state);
  await page.reload();
}
async function saved(page: Page): Promise<GameState> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const req = indexedDB.open('mugong-local-v1', 1);
      req.onsuccess = () => resolve(req.result);
    });
    return new Promise<GameState>((resolve) => {
      const req = db.transaction('saves').objectStore('saves').get('current');
      req.onsuccess = () => {
        resolve(req.result);
        db.close();
      };
    });
  });
}

// Check real hit areas, not a copy of CSS spacing constants. Only the active workspace is inspected.
async function expectControlsSeparate(page: Page, selector: string) {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
        .map((animation) => animation.finished.catch(() => {})),
    ),
  );
  const failures = await page.locator(selector).evaluate((scope) => {
    const failures: string[] = [];
    const controls = [...scope.querySelectorAll('button,input,select')]
      .filter((el) => el.getClientRects().length)
      .map((el) => ({ el, box: el.getBoundingClientRect() }));
    for (const { el, box } of controls) {
      if (
        box.left < -1 ||
        box.top < -1 ||
        box.right > innerWidth + 1 ||
        box.bottom > innerHeight + 1
      )
        failures.push(`outside: ${el.getAttribute('aria-label') || el.textContent}`);
      const html = el as HTMLElement;
      if (html.scrollWidth > html.clientWidth + 2 || html.scrollHeight > html.clientHeight + 2)
        failures.push(`content clipped: ${el.className} ${el.textContent}`);
    }
    for (let i = 0; i < controls.length; i++) {
      for (let j = i + 1; j < controls.length; j++) {
        const a = controls[i],
          b = controls[j];
        const w = Math.min(a.box.right, b.box.right) - Math.max(a.box.left, b.box.left);
        const h = Math.min(a.box.bottom, b.box.bottom) - Math.max(a.box.top, b.box.top);
        if (w > 2 && h > 2)
          failures.push(`hit areas overlap: ${a.el.textContent}/${b.el.textContent}`);
      }
    }
    return failures;
  });
  expect(failures).toEqual([]);
}

for (const [width, height] of [
  [1440, 900],
  [1366, 768],
  [1093, 614],
]) {
  test(`배치·간격 ${width}×${height}: 로비·생성·설정·기록·가방·HUD·성장 선택`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height });
    const proof = `docs/verification/layout-v3/${width}`;
    await mkdir(proof, { recursive: true });
    const capture = async (name: string) => {
      await page.screenshot({ path: `${proof}/${name}.png`, animations: 'disabled' });
    };
    await page.goto('/');
    await expect(page.getByRole('button', { name: '새 무인으로 출전 →' })).toBeVisible();
    await expectControlsSeparate(page, '.home-scene');
    const edges = await page.locator('.home-scene').evaluate((scene) => {
      const stage = scene.querySelector('.home-stage')!;
      const dock = scene.querySelector('.home-dock')!.getBoundingClientRect();
      const departure = scene.querySelector('.home-departure')!.getBoundingClientRect();
      return {
        aligned: Math.abs(dock.left - departure.left) < 2,
        scroll: scene.scrollHeight > scene.clientHeight + 2,
        stageOverflow: stage.scrollHeight > stage.clientHeight + 2,
      };
    });
    await capture('lobby');
    expect(
      edges,
      await page.locator('.home-scene').evaluate((scene) =>
        JSON.stringify(
          ['home-stage', 'home-departure', 'home-dock'].map((name) => {
            const el = scene.querySelector('.' + name)!;
            return {
              name,
              rect: el.getBoundingClientRect().toJSON(),
              padding: getComputedStyle(el).padding,
            };
          }),
        ),
      ),
    ).toEqual({ aligned: true, scroll: false, stageOverflow: false });
    for (const [button, name] of [
      ['새 무인으로 출전 →', 'create'],
      ['화면 설정', 'settings'],
      ['기록', 'records'],
    ]) {
      await page.getByRole('button', { name: button, exact: true }).click();
      await expectControlsSeparate(page, '.dialog');
      await capture(name);
      await page.keyboard.press('Escape');
      await expect(page.getByRole('button', { name: button, exact: true })).toBeFocused();
    }
    await page.getByRole('button', { name: '강호 입문 안내', exact: true }).click();
    await expectControlsSeparate(page, '.dialog');
    expect(
      await page.locator('.dialog').evaluate((el) => el.scrollHeight <= el.clientHeight + 2),
    ).toBe(true);
    await capture('guide');
    await page.keyboard.press('Escape');

    const returned = fresh();
    grantXp(returned.run!, 100);
    for (const art of ['huashan', 'wudang', 'tianmo', 'samja'] as const) {
      returned.run!.offers = [{ art, type: 'learn' }];
      command(returned, { type: 'choose', offer: returned.run!.offers[0] });
    }
    returned.run!.offers = [];
    returned.run!.wave = 20;
    returned.run!.phase = 'loot';
    returned.run!.fighter.items.push({ ...makeItem('robe', 'layout-robe', 'general'), x: 3, y: 2 });
    command(returned, { type: 'next' });
    returned.family.roster.push({
      ...structuredClone(returned.family.roster[0]),
      id: 'layout-second',
      name: '다른무인',
    });
    returned.family.warehouse.push(makeItem('ore', 'layout-ore', 'warehouse'));
    await seed(page, returned);
    await expect(page.getByRole('button', { name: '가방', exact: true })).toBeEnabled();
    await expectControlsSeparate(page, '.home-scene');
    await capture('roster');
    const rosterFit = await page.locator('.home-roster').evaluate((el) => {
      const roster = el.getBoundingClientRect();
      const dock = document.querySelector('.home-dock')!.getBoundingClientRect();
      return {
        fits: roster.bottom <= dock.top,
        roster: roster.toJSON(),
        dock: dock.toJSON(),
        minHeight: getComputedStyle(el).minHeight,
        stage: el.parentElement!.getBoundingClientRect().toJSON(),
        children: [...el.children].map((child) => ({
          name: child.className || child.tagName,
          rect: child.getBoundingClientRect().toJSON(),
        })),
      };
    });
    expect(rosterFit.fits, JSON.stringify(rosterFit)).toBe(true);
    await page.getByRole('button', { name: '가방', exact: true }).click();
    await page.getByRole('button', { name: '무명 도포 선택' }).click();
    await expectWorkspaceFits(page);
    await expectControlsSeparate(page, '.item-detail');
    await capture('bag');
    await expect(page.locator('.inventory-character')).toBeVisible();
    await expect(page.locator('.item-detail')).toBeVisible();
    await page.keyboard.press('Escape');

    const growing = fresh();
    grantXp(growing.run!, 20);
    await seed(page, growing);
    await expect(page.locator('.choice-card').first()).toBeEnabled();
    await expectControlsSeparate(page, '.growth');
    const aligned = await page.locator('.choice-grid').evaluate((el) => {
      const cards = [...el.querySelectorAll('.choice-card')].filter(
        (card) => card.getClientRects().length,
      );
      const actions = cards.map((card) =>
        card.querySelector('.choose-label')!.getBoundingClientRect(),
      );
      return (
        Math.max(...actions.map((box) => box.bottom)) -
          Math.min(...actions.map((box) => box.bottom)) <
        2
      );
    });
    expect(aligned).toBe(true);
    await capture('growth');
    await page.locator('.choice-card').first().click();
    await expect(page.locator('.growth')).toHaveCount(0);
    await expectControlsSeparate(page, '.hud');
    await capture('combat');
    await page.getByRole('button', { name: '일시 정지', exact: true }).click();
    await expectControlsSeparate(page, '.dialog');
    await capture('pause');
  });
}
function fresh(seed = 22) {
  const g = emptyGame();
  startRun(g, '청하연', seed);
  return g;
}

test('첫 로비는 출전 중심으로 읽히고 규칙은 요청할 때 열린다', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.home-departure h1')).toHaveText('강호에 나서세요');
  await expect(page.locator('.home-start-facts')).toContainText('Lv.0 시작');
  await expect(page.locator('.home-start-facts')).toContainText('20웨이브');
  await expect(page.locator('.home-empty-roster')).toHaveText('완주한 무인이 모입니다.');
  expect((await page.locator('.home-scene').innerText()).match(/20웨이브/g)).toHaveLength(1);
  await expect(page.locator('.home-departure p')).toHaveCount(0);
  await expect(page.locator('.home-dock-card')).toHaveCount(1);
  await expect(page.locator('.home-guide')).toHaveCount(0);
  await page.getByRole('button', { name: '강호 입문 안내' }).click();
  await expect(page.locator('.home-guide')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: '강호 입문 안내' })).toBeFocused();
  await page.getByRole('button', { name: '새 무인으로 출전 →' }).click();
  await expect(page.getByLabel('무인의 이름')).toBeFocused();
  await page.getByLabel('무인의 이름').fill('첫무인');
  await page.getByRole('button', { name: '강호에 나서기 →' }).click();
  await expect(page.locator('canvas')).toBeVisible();
});

test('귀환 명부는 핵심 상태만 보이고 무공 설명은 Shift로 연다', async ({ page }) => {
  const returned = fresh();
  grantXp(returned.run!, 100);
  returned.run!.offers = [{ art: 'huashan', type: 'learn' }];
  command(returned, { type: 'choose', offer: returned.run!.offers[0] });
  returned.run!.offers = [];
  returned.run!.wave = 20;
  returned.run!.phase = 'loot';
  command(returned, { type: 'next' });
  await seed(page, returned);
  await expect(page.locator('.home-roster')).toContainText('청하연');
  await expect(page.locator('.home-art-list [data-technique]')).toHaveCount(1);
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await page.keyboard.down('Shift');
  await expect(page.getByRole('tooltip')).toBeVisible();
  await page.keyboard.up('Shift');
  await expect(page.getByRole('tooltip')).toBeHidden();
  await page.getByRole('button', { name: '가방', exact: true }).click();
  await expect(page.locator('.inventory-workspace')).toBeVisible();
});

async function swing(page: Page, x = 1035, y = 615) {
  const rect = await page.locator('canvas').boundingBox();
  expect(rect).not.toBeNull();
  await page.mouse.move(rect!.x + (x / 1920) * rect!.width, rect!.y + (y / 1080) * rect!.height);
  await page.mouse.down();
  await page.waitForTimeout(220);
  await page.mouse.up();
}

test('생성·이동·전투 중 가방 제한·저장 복원', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: '새 무인으로 출전 →' }).click();
  await page.getByLabel('무인의 이름').fill('검증무인');
  await page.getByRole('button', { name: '강호에 나서기 →' }).click();
  await expect(page.locator('canvas')).toBeVisible();
  await page.keyboard.down('d');
  await page.waitForTimeout(400);
  await page.keyboard.up('d');
  await page.getByRole('button', { name: '가방 Tab' }).click();
  await expect(page.getByRole('dialog', { name: '가방 · 정보 확인' })).toBeVisible();
  await page.getByRole('button', { name: '금창약 선택' }).click();
  await expect(page.getByRole('button', { name: '사용', exact: true })).toBeDisabled();
  const checkpoint = await saved(page);
  expect(checkpoint.run!.fighter.x).toBeGreaterThan(1000);
  expect(checkpoint.run!.fighter.level).toBe(0);
  await page.reload();
  await expect(page.locator('canvas')).toBeVisible();
  expect((await saved(page)).run!.id).toBe(checkpoint.run!.id);
  expect(errors).toEqual([]);
});
test('실제 공격으로 첫 레벨·증강 선택·전리품·다음 웨이브', async ({ page }) => {
  const g = fresh(),
    r = g.run!;
  r.enemies = r.enemies.slice(0, 1);
  Object.assign(r.enemies[0], { x: 1035, y: 650, hp: 1, xp: 20, timer: 100 });
  await seed(page, g);
  await expect(page.locator('canvas')).toBeVisible();
  await swing(page);
  const choices = page.getByRole('dialog', { name: '무공 성장 선택' });
  await expect(choices).toBeVisible();
  await expect(choices.locator('.choice-card')).toHaveCount(3);
  await expect(choices.locator('.choice-card').first()).toBeDisabled();
  await expect(choices.getByRole('status')).toContainText('초 후 선택 가능');
  await expect(choices).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(choices).toBeFocused();
  await choices
    .locator('.choice-card')
    .first()
    .evaluate((button: HTMLButtonElement) => button.click());
  await expect(choices).toBeVisible();
  await page.screenshot({ path: '.cache/growth-locked.png' });
  await expect(choices.locator('.choice-card').first()).toBeEnabled({ timeout: 3500 });
  await page.keyboard.press('Space');
  await expect(choices).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(choices.locator('.choice-card').first()).toBeFocused();
  await page.screenshot({ path: '.cache/growth-latest.png' });
  const labels = await choices.locator('.choice-card h3').allTextContents();
  await page.addInitScript(() => {
    const observer = new MutationObserver(() => {
      const card = document.querySelector<HTMLButtonElement>('.growth .choice-card');
      if (!card) return;
      (window as Window & { growthInitiallyDisabled?: boolean }).growthInitiallyDisabled =
        card.disabled;
      observer.disconnect();
    });
    observer.observe(document, { childList: true, subtree: true });
  });
  await page.reload();
  await expect(choices).toBeVisible();
  expect(await choices.locator('.choice-card h3').allTextContents()).toEqual(labels);
  expect(
    await page.evaluate(
      () => (window as Window & { growthInitiallyDisabled?: boolean }).growthInitiallyDisabled,
    ),
  ).toBe(true);
  await expect(choices.locator('.choice-card').first()).toBeEnabled({ timeout: 3500 });
  await expect(choices.getByRole('status')).toContainText('선택할 무공을 눌러');
  await choices.locator('.choice-card').first().click();
  await expect(choices).toBeHidden();
  await expect(page.locator('.inventory-workspace')).toBeVisible();
  await expect(page.locator('.inventory-workspace')).toBeVisible();
  await page.getByRole('button', { name: '금창약 선택' }).last().click();
  await page.getByRole('button', { name: '수납', exact: true }).click();
  await page.getByRole('button', { name: '다음 2웨이브 →' }).click();
  await page.getByRole('button', { name: '남은 물품 두고 진행' }).click();
  await expect(page.locator('.progress-panel')).toContainText('2');
  expect((await saved(page)).run!.fighter.arts).toHaveLength(1);
});
test('정리판 폐기 취소·확인과 수납 회전', async ({ page }) => {
  const g = fresh(),
    r = g.run!;
  r.phase = 'loot';
  r.enemies = [];
  r.fighter.items.push(makeItem('sword', 'extra-sword', 'ground'));
  await seed(page, g);
  await expect(page.locator('.inventory-workspace')).toBeVisible();
  await page.getByRole('button', { name: '강철검 선택' }).last().click();
  await page.getByRole('button', { name: '폐기', exact: true }).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await page.getByRole('button', { name: '계속 정리' }).click();
  await page.getByRole('button', { name: '회전', exact: true }).click();
  await page.getByRole('button', { name: '일반 가방으로', exact: true }).click();
  expect((await saved(page)).run!.fighter.items.find((i) => i.id === 'extra-sword')).toMatchObject({
    rotated: true,
    place: 'general',
    x: 1,
    y: 0,
  });
  await page.getByRole('button', { name: '꺼내기' }).click();
  await page.getByRole('button', { name: '폐기', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: '폐기', exact: true }).click();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await page.getByRole('button', { name: '무인의 가방 닫기' }).click();
  await expect(page.getByRole('dialog', { name: '무인의 가방' })).toBeHidden();
  expect((await saved(page)).run!.fighter.items.some((i) => i.id === 'extra-sword')).toBe(false);
});
test('화면의 적 몸통을 클릭하면 좁은 찌르기도 적을 맞힌다', async ({ page }) => {
  const g = fresh();
  const r = g.run!;
  grantXp(r, 20);
  // Set a valid growth offer to prepare a Wudang fighter, without exposing runtime cheats.
  r.offers = [{ art: 'wudang', type: 'learn' }];
  command(g, { type: 'choose', offer: r.offers[0] });
  r.enemies = r.enemies.slice(0, 1);
  Object.assign(r.enemies[0], { x: 1035, y: 650, hp: 1, timer: 100 });
  await seed(page, g);
  await expect(page.locator('canvas')).toBeVisible();
  await swing(page);
  await expect(page.locator('.inventory-workspace')).toBeVisible();
});
test('최종 보스를 실제로 처치하고 명부·창고·수명에 반영', async ({ page }) => {
  const g = fresh(),
    r = g.run!;
  for (let wave = 1; wave < 20; wave++) {
    if (!isPrep(wave)) {
      grantXp(r, r.xpBudget[wave - 1]);
      while (r.offers.length)
        command(g, {
          type: 'choose',
          offer: r.offers.find((o) => o.type === 'upgrade') ?? r.offers[0],
        });
      r.phase = 'loot';
    }
    command(g, { type: 'next' });
  }
  Object.assign(r.enemies[0], { x: 1035, y: 650, hp: 1, timer: 100 });
  r.fighter.hp = 73;
  const expectedHp = 73 + supportStats(r.fighter).killHealing;
  await seed(page, g);
  await expect(page.locator('canvas')).toBeVisible();
  await swing(page);
  for (let n = 0; n < 3; n++) {
    const choices = page.getByRole('dialog', { name: '무공 성장 선택' });
    if (await choices.isVisible()) {
      await choices.locator('.choice-card').first().click();
      await page.waitForTimeout(100);
    }
  }
  await page.getByRole('button', { name: '귀환', exact: true }).click();
  await page.getByRole('button', { name: '남은 물품 두고 진행' }).click();
  await expect(page.locator('.journey-summary')).toBeVisible();
  await page.getByRole('button', { name: '강호 완주 닫기' }).click();
  await expect(page.locator('.roster-list')).toContainText('청하연');
  const state = await saved(page);
  expect(state.run).toBeNull();
  expect(state.family.roster).toHaveLength(1);
  expect(state.family.roster[0].hp).toBe(expectedHp);
  expect(state.family.roster[0].expiresAt! - state.family.roster[0].bornAt!).toBe(7 * 86400000);
  await page.screenshot({ path: '.cache/home-registered.png', animations: 'disabled' });
  await page.getByRole('button', { name: '가방', exact: true }).click();
  await page.getByRole('button', { name: '수련검 선택' }).click();
  await page.getByRole('button', { name: '창고로', exact: true }).click();
  await page.getByRole('button', { name: '무인의 가방 닫기' }).click();
  await page.getByRole('button', { name: '창고', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '세가 창고' })).toContainText('수련검');
  await page.getByRole('button', { name: '수련검 선택' }).click();
  await page.getByRole('button', { name: '수납', exact: true }).click();
  const returned = await saved(page);
  expect(returned.family.warehouse).toHaveLength(0);
  expect(
    returned.family.roster[0].items.some((i) => i.kind === 'sword' && i.place === 'weapon'),
  ).toBe(true);
  await page.getByRole('button', { name: '창고로', exact: true }).click();
  await page.getByRole('dialog', { name: '세가 창고' }).evaluate((el) => (el.scrollTop = 0));
  await page.screenshot({ path: '.cache/storage-polish.png' });
  await page.reload();
  await page.getByRole('button', { name: '가방', exact: true }).click();
  await expect(page.getByRole('region', { name: '세가 창고', exact: true })).toContainText(
    '수련검',
  );
});
test('사망 결과를 새로고침해도 유지하고 명부에 등록하지 않는다', async ({ page }) => {
  const g = fresh(),
    r = g.run!;
  r.fighter.hp = 1;
  const e = r.enemies[0];
  Object.assign(e, { x: 920, y: 650, state: 'windup', timer: 0.05, aim: 0 });
  await seed(page, g);
  await expect(page.getByRole('dialog', { name: '강호에 남긴 이름' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('dialog', { name: '강호에 남긴 이름' })).toBeVisible();
  await page.getByRole('button', { name: '세가로 돌아가기' }).click();
  const state = await saved(page);
  expect(state.run).toBeNull();
  expect(state.family.roster).toHaveLength(0);
  expect(state.family.deaths).toBe(1);
});
test('여러 탭의 동시 저장을 막는다', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: '새 무인으로 출전 →' })).toBeVisible();
  const other = await context.newPage();
  await other.goto('/');
  await expect(other.getByRole('alert')).toContainText('다른 탭');
  await page.close();
  await other.getByRole('button', { name: '저장 다시 시도' }).click();
  await expect(other.getByRole('button', { name: '새 무인으로 출전 →' })).toBeVisible();
});
test('베기·타격 숫자·HUD를 실제 공격 화면에서 검증한다', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const g = fresh(),
    r = g.run!;
  grantXp(r, 150);
  while (r.offers.length) {
    r.offers = [{ art: 'huashan', type: r.fighter.arts.length ? 'upgrade' : 'learn' }];
    command(g, { type: 'choose', offer: r.offers[0] });
  }
  r.enemies = r.enemies.slice(0, 1);
  Object.assign(r.enemies[0], { x: 1035, y: 650, hp: 500, maxHp: 500, timer: 100 });
  await seed(page, g);
  await expect(page.locator('canvas')).toBeVisible();
  const rect = (await page.locator('canvas').boundingBox())!;
  await page.mouse.move(rect.x + (1035 / 1920) * rect.width, rect.y + (615 / 1080) * rect.height);
  await page.mouse.down();
  await page.waitForTimeout(130);
  await page.screenshot({ path: '.cache/impact-polish.png' });
  const activeTiming = await page.evaluate(async () => {
    const times: number[] = [];
    let before = performance.now();
    await new Promise<void>((resolve) => {
      const frame = (now: number) => {
        times.push(now - before);
        before = now;
        if (times.length >= 120) resolve();
        else requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
    const mean = times.slice(1).reduce((a, b) => a + b, 0) / 119;
    return {
      meanFrameMs: mean,
      meanFps: 1000 / mean,
      samples: 119,
      scenario: 'Huashan repeated slashes, sparks, damage labels and hit stop',
    };
  });
  await writeFile('.cache/active-effect-timing.json', JSON.stringify(activeTiming, null, 2));
  await page.waitForTimeout(300);
  await page.mouse.up();
  await page.getByRole('button', { name: '가방 Tab' }).click();
  expect((await saved(page)).run!.enemies[0].hp).toBeLessThan(500);
  expect(errors).toEqual([]);
});
test('데스크톱·작은 화면에서 가로 스크롤 없이 표시한다', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  expect(
    await page.evaluate(
      () =>
        document.fonts.check("14px 'Gowun Dodum'") &&
        document.fonts.check("700 48px 'Gowun Batang'"),
    ),
  ).toBe(true);
  for (const [width, height] of [
    [1440, 900],
    [1366, 768],
    [1093, 614],
    [1024, 768],
    [390, 844],
    [602, 546],
  ]) {
    await page.setViewportSize({ width, height });
    await page.screenshot({
      path: width === 1440 ? '.cache/lobby-latest.png' : `.cache/home-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    });
    await expect(page.getByRole('button', { name: '새 무인으로 출전 →' })).toBeVisible();
    if (width <= 760) {
      const layout = await page.evaluate(() => {
        const launch = document.querySelector('.home-launch')!.getBoundingClientRect();
        const roster = document.querySelector('.home-roster')!;
        const dock = document.querySelector('.home-dock')!.getBoundingClientRect();
        return {
          separated:
            !!roster.getClientRects().length &&
            launch.bottom <= roster.getBoundingClientRect().top &&
            roster.getBoundingClientRect().bottom <= dock.top,
          fits: dock.bottom <= innerHeight,
        };
      });
      expect(layout, `${width}×${height} 로비 겹침`).toEqual({ separated: true, fits: true });
    }
    if (width >= 1024) {
      expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(
        true,
      );
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  expect(errors).toEqual([]);
});
test('메인 로비에서 입문 안내·기록·음소거와 이름 입력을 조작한다', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('button', { name: '새 무인으로 출전 →' })).toBeVisible();
  await expect(page.getByRole('button', { name: '가방', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '강호 입문 안내', exact: true }).click();
  const help = page.getByRole('dialog', { name: '강호 입문 안내' });
  await expect(help).toContainText('전투 중에는 정보만 확인');
  await page.keyboard.press('Escape');
  await expect(help).toBeHidden();
  await page.getByRole('button', { name: '기록', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '세가의 기록' })).toContainText('첫 출전부터');
  await page.screenshot({ path: '.cache/home-records.png' });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '소리 끄기', exact: true }).click();
  await expect(page.getByRole('button', { name: '소리 켜기', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await page.getByRole('button', { name: '소리 켜기', exact: true }).click();
  await page.getByRole('button', { name: '새 무인으로 출전 →' }).click();
  await expect(page.getByLabel('무인의 이름')).toBeFocused();
  await page.getByLabel('무인의 이름').fill('   ');
  await expect(page.getByRole('button', { name: '강호에 나서기 →' })).toBeDisabled();
  await page.getByLabel('무인의 이름').fill('소운');
  await page.screenshot({ path: '.cache/home-create.png', animations: 'disabled' });
  await page.getByRole('button', { name: '돌아가기', exact: true }).click();
  await expect(page.getByRole('button', { name: '새 무인으로 출전 →' })).toBeFocused();
  expect(errors).toEqual([]);
});
test('화면 가독성 설정을 저장하고 일시 정지 메뉴에서도 연다', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '화면 설정' }).click();
  const settings = page.getByRole('dialog', { name: '화면 설정' });
  await expect(settings).toBeVisible();
  await settings.getByRole('switch', { name: /전투 HUD 큰 글씨/ }).click();
  await settings.getByRole('switch', { name: /높은 대비/ }).click();
  await expect(page.locator('.app-shell')).toHaveAttribute('data-large-hud', 'true');
  await expect(page.locator('.app-shell')).toHaveAttribute('data-high-contrast', 'true');
  await page.reload();
  await page.getByRole('button', { name: '화면 설정' }).click();
  await expect(settings.getByRole('switch', { name: /전투 HUD 큰 글씨/ })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(settings.getByRole('switch', { name: /높은 대비/ })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.getByRole('button', { name: '화면 설정 닫기' }).click();
  await page.getByRole('button', { name: '새 무인으로 출전 →' }).click();
  await page.getByRole('button', { name: '강호에 나서기 →' }).click();
  await expect(page.locator('canvas')).toBeVisible();
  await page.screenshot({ path: '.cache/combat-high-contrast.png', animations: 'disabled' });
  await page.getByRole('button', { name: '일시 정지' }).click();
  await page.getByRole('button', { name: '화면 설정' }).click();
  await expect(settings).toBeVisible();
  await page.getByRole('button', { name: '화면 설정 닫기' }).click();
  await expect(page.getByRole('dialog', { name: '여정을 잠시 멈추다' })).toBeVisible();
});

test('일시 종료한 강호의 웨이브와 체력을 로비에서 보고 이어간다', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '새 무인으로 출전 →' }).click();
  await page.getByLabel('무인의 이름').fill('여정검객');
  await page.getByRole('button', { name: '강호에 나서기 →' }).click();
  await expect(page.locator('canvas')).toBeVisible();
  await page.getByRole('button', { name: '일시 정지' }).click();
  await page.getByRole('button', { name: '저장하고 일시 종료' }).click();
  await expect(page.locator('.home-run-card')).toContainText('여정검객');
  await expect(page.locator('.home-run-progress')).toContainText('1');
  await page.screenshot({ path: '.cache/home-resume.png', animations: 'disabled' });
  await page.getByRole('button', { name: '강호 이어하기 1 / 20 →' }).click();
  await expect(page.locator('canvas')).toBeVisible();
  expect((await saved(page)).run!.fighter.name).toBe('여정검객');
});
test('전투 화면·가방·성장 선택 캡처와 프레임 시간 기록', async ({ page }, testInfo) => {
  const measure = () =>
    page.evaluate(async () => {
      const deltas: number[] = [];
      let before = performance.now();
      await new Promise<void>((resolve) => {
        const frame = (time: number) => {
          deltas.push(time - before);
          before = time;
          if (deltas.length >= 120) resolve();
          else requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      });
      const values = deltas.slice(1).sort((a, b) => a - b),
        mean = values.reduce((a, b) => a + b, 0) / values.length;
      return {
        meanFrameMs: mean,
        meanFps: 1000 / mean,
        p95FrameMs: values[Math.floor(values.length * 0.95)],
        userAgent: navigator.userAgent,
        viewport: [innerWidth, innerHeight],
        renderer: document.querySelector<HTMLElement>('.game-canvas')?.dataset.renderer,
        graphics: document.querySelector<HTMLElement>('.game-canvas')?.dataset.graphics,
      };
    });
  await page.goto('about:blank');
  const baseline = await measure();
  const g = fresh(),
    r = g.run!;
  r.wave = 18;
  spawnWave(r);
  for (const e of r.enemies) e.timer = 100;
  await seed(page, g);
  await expect(page.locator('canvas')).toBeVisible();
  await page.waitForTimeout(600);
  const combat = await measure(),
    timing = { baseline, combat };
  await testInfo.attach('frame-timing', {
    body: JSON.stringify(timing, null, 2),
    contentType: 'application/json',
  });
  await writeFile('.cache/frame-timing.json', JSON.stringify(timing, null, 2));
  await page.screenshot({ path: '.cache/combat-latest.png' });
  await page.getByRole('button', { name: '가방 Tab' }).click();
  await expect(page.getByRole('dialog', { name: '가방 · 정보 확인' })).toBeVisible();
  await page.screenshot({ path: '.cache/inventory-latest.png' });
  expect(combat.meanFps).toBeGreaterThan(30);
});

test('전체 화면 가방은 노트북·125% 배율·좁은 화면에서 핵심 행동이 잘리지 않는다', async ({
  page,
}) => {
  const g = fresh();
  g.run!.phase = 'loot';
  g.run!.enemies = [];
  for (let n = 0; n < 25; n++) g.run!.fighter.items.push(makeItem('ore', `loot-${n}`, 'ground'));
  await seed(page, g);
  await expect(page.locator('.inventory-workspace')).toBeVisible();
  for (const [width, height] of [
    [1920, 1080],
    [1440, 900],
    [1366, 768],
    [1093, 614],
    [1024, 768],
    [390, 844],
    [602, 546],
  ]) {
    await page.setViewportSize({ width, height });
    await page.getByRole('button', { name: '금창약 선택' }).first().click();
    await expect(page.getByRole('button', { name: '사용', exact: true })).toBeVisible();
    await expectWorkspaceFits(page);
    await page.screenshot({ path: `.cache/viewport-bag-${width}.png`, animations: 'disabled' });
    await expectWorkspaceFits(page);
  }
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.getByRole('button', { name: '전리품 다음 페이지' }).click();
  await expect(page.getByRole('button', { name: '철광석 선택' }).first()).toBeVisible();
  await page.getByRole('button', { name: '전리품 이전 페이지' }).click();
  await page.getByRole('button', { name: '철광석 선택' }).first().click();
  await page.getByRole('button', { name: '수납', exact: true }).click();
  await expectWorkspaceFits(page);
  expect((await saved(page)).run!.fighter.items.find((i) => i.id === 'loot-0')?.place).toBe(
    'general',
  );
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: '무인의 가방' })).toBeHidden();
  await expect(page.getByRole('button', { name: '가방 Tab', exact: true })).toBeFocused();
});

test('성장 선택과 전투는 노트북·125% 배율에서 전체 화면을 채우고 잘리지 않는다', async ({
  page,
}) => {
  const g = fresh();
  grantXp(g.run!, 20);
  await seed(page, g);
  for (const [width, height] of [
    [1440, 900],
    [1366, 768],
    [1093, 614],
    [390, 844],
    [602, 546],
  ]) {
    await page.setViewportSize({ width, height });
    // Viewport media-query notifications reach React on the next browser frame.
    // Observe the settled layout rather than reading the previous card layout.
    await expect
      .poll(
        () =>
          page.locator('.growth').evaluate((el) => {
            const rect = el.getBoundingClientRect();
            return {
              fits:
                rect.top >= 0 &&
                rect.bottom <= innerHeight &&
                el.scrollHeight <= el.clientHeight + 2,
              cards: [...el.querySelectorAll('.choice-card')].every(
                (card) => card.scrollHeight <= card.clientHeight + 2,
              ),
            };
          }),
        { message: `화면 ${width}×${height}의 성장 후보가 스크롤 없이 표시됨` },
      )
      .toEqual({ fits: true, cards: true });
    await page.screenshot({ path: `.cache/viewport-growth-${width}.png`, animations: 'disabled' });
  }
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.locator('.choice-card').first().click();
  const box = await page.locator('.game-frame').boundingBox();
  expect(box).toEqual({ x: 0, y: 0, width: 1366, height: 768 });
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(
    true,
  );
});

test('무공 설명을 바로 읽고 닫아도 성장 선택이 유지된다', async ({ page }) => {
  const g = fresh();
  grantXp(g.run!, 20);
  await seed(page, g);
  const details = page.getByRole('button', { name: '설명 Shift', exact: true });
  await expect(details).toBeEnabled();
  const before = await saved(page);
  await details.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('tooltip');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('선택 후 효과');
  await expect(page.locator('.growth')).not.toHaveAttribute('inert', '');
  await mkdir('docs/verification/text-loading-v3', { recursive: true });
  await page.screenshot({
    path: 'docs/verification/text-loading-v3/technique-details.png',
    animations: 'disabled',
  });
  await page.keyboard.press('Escape');
  await expect(details).toBeFocused();
  expect((await saved(page)).run!.offers).toEqual(before.run!.offers);
  expect((await saved(page)).run!.fighter.spent).toBe(before.run!.fighter.spent);
  await page.locator('.choice-card').first().click();
  await expect(page.locator('.growth')).toHaveCount(0);
});

test('많은 창고 물품과 네 무공을 스크롤 없이 관리하고 이동 결과를 저장한다', async ({ page }) => {
  const g = fresh();
  const r = g.run!;
  grantXp(r, 100);
  for (const art of ['huashan', 'wudang', 'tianmo', 'samja'] as const) {
    r.offers = [{ art, type: 'learn' }];
    command(g, { type: 'choose', offer: r.offers[0] });
  }
  r.offers = [];
  r.wave = 20;
  r.phase = 'loot';
  command(g, { type: 'next' });
  for (let n = 0; n < 32; n++)
    g.family.warehouse.push(makeItem('ore', `storage-${n}`, 'warehouse'));
  g.family.warehouse.push(makeItem('sword', 'storage-sword', 'warehouse'));
  await seed(page, g);
  await page.setViewportSize({ width: 1093, height: 614 });
  await page.getByRole('button', { name: '창고', exact: true }).click();
  await page.setViewportSize({ width: 1093, height: 614 });
  await expect(page.locator('.warehouse-workspace')).toBeVisible();
  await expect(page.locator('.bag-grid,.binding-list')).toHaveCount(0);
  for (let n = 0; n < 8 && !(await page.locator('[data-item-id="storage-sword"]').count()); n++)
    await page.getByRole('button', { name: '창고 물품 다음 페이지' }).click();
  await page.locator('[data-item-id="storage-sword"]').click();
  await page.screenshot({ path: '.cache/viewport-storage-1093.png', animations: 'disabled' });
  await page.getByRole('button', { name: '가방으로 F', exact: true }).click();
  expect((await saved(page)).family.warehouse.some((item) => item.id === 'storage-sword')).toBe(
    false,
  );
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: '세가 창고' })).toBeHidden();
  await expect(
    page.getByRole('button', { name: '창고', exact: true }),
    await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 500)),
  ).toBeFocused();
});

test('화면 설정에서 네이티브 전체 화면으로 전환하고 나올 수 있다', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '화면 설정', exact: true }).click();
  const supported = await page.evaluate(() => document.fullscreenEnabled);
  test.skip(!supported, '이 브라우저는 네이티브 전체 화면을 지원하지 않음');
  await page.getByRole('button', { name: /^전체 화면으로 전환/ }).click();
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true);
  await page.getByRole('button', { name: /^전체 화면 나가기/ }).click();
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(false);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: '화면 설정', exact: true })).toBeFocused();
});

test('그림 에셋을 실제로 로드하고 일곱 물품과 네 무공을 가방에 표시한다', async ({ page }) => {
  const proof = 'docs/verification/graphic-ui-v1';
  await mkdir(proof, { recursive: true });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('button', { name: '새 무인으로 출전 →' })).toBeVisible();
  const images = await page.evaluate(async () => {
    return Promise.all(
      ['symbols-v1', 'navigation-v1', 'materials-v2', 'lobby-v2', 'effects-v2'].map(
        async (name) => {
          const image = new Image();
          image.src = `/art/ui/${name}.png`;
          await image.decode();
          const canvas = document.createElement('canvas');
          canvas.width = image.naturalWidth;
          canvas.height = image.naturalHeight;
          const context = canvas.getContext('2d')!;
          context.drawImage(image, 0, 0);
          const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
          let clear = 0,
            opaque = 0;
          for (let n = 3; n < pixels.length; n += 64) {
            if (pixels[n] === 0) clear++;
            if (pixels[n] > 200) opaque++;
          }
          return { name, width: image.naturalWidth, height: image.naturalHeight, clear, opaque };
        },
      ),
    );
  });
  for (const image of images) {
    expect(image.width).toBeGreaterThan(1000);
    expect(image.opaque).toBeGreaterThan(100);
    if (/symbols|navigation|effects/.test(image.name)) expect(image.clear).toBeGreaterThan(100);
  }
  await page.screenshot({ path: `${proof}/lobby.png`, animations: 'disabled' });
  const g = fresh();
  const r = g.run!;
  grantXp(r, 100);
  for (const art of ['huashan', 'wudang', 'tianmo', 'samja'] as const) {
    r.offers = [{ art, type: 'learn' }];
    command(g, { type: 'choose', offer: r.offers[0] });
  }
  r.offers = [];
  r.wave = 20;
  r.phase = 'loot';
  r.fighter.items = [
    { ...makeItem('sword', 'art-sword', 'weapon'), x: 0, y: 0 },
    { ...makeItem('sword', 'art-sword-2', 'weapon'), x: 2, y: 2 },
    { ...makeItem('robe', 'art-robe', 'general'), x: 0, y: 0 },
    { ...makeItem('boots', 'art-boots', 'general'), x: 3, y: 0 },
    { ...makeItem('manual', 'art-manual', 'general'), x: 6, y: 0 },
    { ...makeItem('medicine', 'art-medicine', 'general'), x: 8, y: 0 },
    { ...makeItem('charm', 'art-charm', 'general'), x: 9, y: 0 },
    { ...makeItem('ore', 'art-ore', 'general'), x: 8, y: 2 },
  ];
  command(g, { type: 'next' });
  for (const kind of ['sword', 'robe', 'boots', 'manual', 'medicine', 'charm', 'ore'] as const)
    g.family.warehouse.push(makeItem(kind, `art-storage-${kind}`, 'warehouse'));
  await seed(page, g);
  await page.getByRole('button', { name: '가방', exact: true }).click();
  await page.locator('.bag-grid.general').getByRole('button', { name: '무명 도포 선택' }).click();
  await expect(page.locator('.binding-list .art-glyph image')).toHaveCount(4);
  for (const width of [1440, 1366, 1093]) {
    await page.setViewportSize({
      width,
      height: width === 1093 ? 614 : width === 1366 ? 768 : 900,
    });
    await expectWorkspaceFits(page);
    await page.screenshot({ path: `${proof}/bag-${width}.png`, animations: 'disabled' });
  }
  expect(await page.locator('.item-art path, .ui-icon path, .art-glyph path').count()).toBe(0);
  expect(errors).toEqual([]);
  await writeFile(`${proof}/asset-loads.json`, JSON.stringify(images, null, 2));
});

test('150% UI에서 잡은 칸 기준 드래그·충돌·회전·키보드 수납과 착용·사용·창고를 검증한다', async ({
  page,
}) => {
  const proof = 'docs/verification/readability-bag-v2';
  await mkdir(proof, { recursive: true });
  const g = fresh(),
    r = g.run!;
  r.wave = 20;
  r.phase = 'loot';
  r.enemies = [];
  r.fighter.hp = 50;
  r.fighter.items = [
    { ...makeItem('robe', 'drag-robe', 'general'), x: 0, y: 0 },
    { ...makeItem('medicine', 'drag-medicine', 'general'), x: 4, y: 0, count: 3 },
    { ...makeItem('ore', 'drag-ore', 'general'), x: 7, y: 0 },
    { ...makeItem('charm', 'drag-charm', 'general'), x: 8, y: 0 },
    { ...makeItem('boots', 'drag-boots', 'general'), x: 0, y: 4 },
    makeItem('sword', 'drag-sword', 'weapon'),
  ];
  command(g, { type: 'next' });
  await seed(page, g);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1093, height: 614 });
  await page.screenshot({ path: `${proof}/lobby-1093.png`, animations: 'disabled' });
  await page.getByRole('button', { name: '가방', exact: true }).click();
  await expect(page.locator('.bag-usage[data-place="general"]')).toContainText('67칸 여유');
  await expect(page.getByRole('meter', { name: '가방 사용 칸' }).last()).toHaveAttribute(
    'aria-valuenow',
    '13',
  );
  const grid = page.locator('.bag-grid.general');
  const robe = grid.locator('[data-item-id="drag-robe"]');
  async function dragRobe(x: number, y: number) {
    const source = (await robe.boundingBox())!,
      target = (await grid.locator(`[data-cell="${y * 10 + x}"]`).boundingBox())!;
    await page.mouse.move(source.x + source.width * 0.75, source.y + source.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(source.x + source.width * 0.75 + 8, source.y + source.height * 0.5 + 8, {
      steps: 3,
    });
    await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 12 });
    await page.mouse.move(target.x + target.width / 2 + 1, target.y + target.height / 2 + 1);
  }
  await dragRobe(6, 4);
  await expect(grid.locator('.placement-preview.fits')).toBeVisible();
  await page.screenshot({ path: `${proof}/drag-preview-1093.png`, animations: 'disabled' });
  await page.mouse.up();
  await expect
    .poll(async () => (await saved(page)).family.roster[0].items.find((i) => i.id === 'drag-robe'))
    .toMatchObject({ x: 5, y: 3 });
  await dragRobe(7, 1);
  await expect(grid.locator('.placement-preview.blocked')).toBeVisible();
  await page.mouse.up();
  expect(
    (await saved(page)).family.roster[0].items.find((i) => i.id === 'drag-robe'),
  ).toMatchObject({ x: 5, y: 3 });
  await robe.click();
  await page.keyboard.press('r');
  await expect
    .poll(async () => (await saved(page)).family.roster[0].items.find((i) => i.id === 'drag-robe'))
    .toMatchObject({ x: 5, y: 3, rotated: true });
  await page.getByRole('button', { name: '꺼내기', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: '수납', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '수납', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect
    .poll(async () => (await saved(page)).family.roster[0].items.find((i) => i.id === 'drag-robe'))
    .toMatchObject({ place: 'general', x: 0, y: 0, rotated: true });
  for (const [width, height] of [
    [1093, 614],
    [1366, 768],
    [1440, 900],
  ]) {
    await page.setViewportSize({ width, height });
    await expectWorkspaceFits(page);
    await page.screenshot({ path: `${proof}/bag-${width}.png`, animations: 'disabled' });
  }
  await page.getByRole('button', { name: '착용', exact: true }).click();
  await expect
    .poll(
      async () =>
        (await saved(page)).family.roster[0].items.find((i) => i.id === 'drag-robe')?.place,
    )
    .toBe('equipped');
  await expect(page.locator('.bag-usage[data-place="general"]')).toContainText('73칸 여유');
  await grid.locator('[data-item-id="drag-medicine"]').click();
  await page.getByRole('button', { name: '사용', exact: true }).click();
  await expect.poll(async () => (await saved(page)).family.roster[0].hp).toBe(85);
  await grid.locator('[data-item-id="drag-ore"]').click();
  await page.getByRole('button', { name: '창고로', exact: true }).click();
  await expect(page.locator('.warehouse-section')).toContainText('철광석');
  await page.screenshot({ path: `${proof}/warehouse-1440.png`, animations: 'disabled' });
  const source = (await page.getByRole('button', { name: '철광석 선택' }).boundingBox())!;
  const tab = (await grid.boundingBox())!;
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(source.x + source.width / 2 + 8, source.y + source.height / 2 + 8, {
    steps: 3,
  });
  await page.mouse.move(tab.x + tab.width / 2, tab.y + tab.height / 2, { steps: 12 });
  await expect(grid).toBeVisible();
  const target = (await grid.locator('[data-cell="7"]').boundingBox())!;
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 12 });
  await page.mouse.move(target.x + target.width / 2 + 1, target.y + target.height / 2 + 1);
  await page.mouse.up();
  await expect.poll(async () => (await saved(page)).family.warehouse.length).toBe(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: '무인의 가방' })).toBeHidden();
  await expect(
    page.getByRole('button', { name: '가방', exact: true }),
    await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 500)),
  ).toBeFocused();
  expect(errors).toEqual([]);
});
