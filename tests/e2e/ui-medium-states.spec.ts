import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { seedRegion, observeScene } from './support/region';
const proof = process.env.MUGONG_MEDIUM_AUDIT_PROOF ?? 'docs/verification/ui-medium-v1/states';
for (const [width, height] of [
  [1440, 900],
  [1366, 768],
  [1093, 614],
])
  test(`전체 화면 검토 ${width}`, async ({ page }) => {
    test.setTimeout(240000);
    await mkdir(`${proof}/${width}`, { recursive: true });
    await page.setViewportSize({ width, height });
    const rows: any[] = [];
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    async function capture(name: string) {
      await page.waitForTimeout(180);
      const scan = await page.evaluate(() => {
        const visible = (e: Element) => {
          const r = e.getBoundingClientRect(),
            s = getComputedStyle(e);
          return (
            r.width > 0 &&
            r.height > 0 &&
            s.visibility !== 'hidden' &&
            s.display !== 'none' &&
            !e.closest('[hidden],[inert]')
          );
        };
        const controls = Array.from(
          document.querySelectorAll<HTMLElement>('button,input,select,[role="tab"]'),
        )
          .filter(visible)
          .map((e) => {
            const r = e.getBoundingClientRect(),
              s = getComputedStyle(e);
            return {
              text: (
                e.getAttribute('aria-label') ||
                e.innerText ||
                e.getAttribute('placeholder') ||
                ''
              )
                .trim()
                .slice(0, 100),
              class: e.className,
              disabled: e.matches(':disabled'),
              title: e.title,
              x: r.x,
              y: r.y,
              width: r.width,
              height: r.height,
              right: r.right,
              bottom: r.bottom,
              font: s.fontSize,
              clipped: e.scrollWidth > e.clientWidth + 2,
            };
          });
        const numbers = Array.from(
          document.querySelectorAll<HTMLElement>(
            '.health-line>span,.boss-health small,.xp-line,.ultimate-panel,.defense-ribbon',
          ),
        )
          .filter(visible)
          .map((e) => ({
            class: e.className,
            text: e.innerText,
            font: getComputedStyle(e).fontSize,
            background: getComputedStyle(e).backgroundColor,
            shadow: getComputedStyle(e).textShadow,
          }));
        return {
          controls,
          numbers,
          viewport: { width: innerWidth, height: innerHeight },
          body: {
            width: document.documentElement.scrollWidth,
            height: document.documentElement.scrollHeight,
          },
        };
      });
      rows.push({ screen: name, ...scan });
      expect(scan.body.width, `${name}: horizontal page overflow`).toBeLessThanOrEqual(width + 1);
      for (const control of scan.controls.filter(
        (c) => c.class.split(' ').includes('primary') && !c.disabled,
      )) {
        expect(control.x, `${name}: ${control.text}`).toBeGreaterThanOrEqual(-1);
        expect(control.y, `${name}: ${control.text}`).toBeGreaterThanOrEqual(-1);
        expect(control.right, `${name}: ${control.text}`).toBeLessThanOrEqual(width + 1);
        expect(control.bottom, `${name}: ${control.text}`).toBeLessThanOrEqual(height + 1);
        expect(control.clipped, `${name}: ${control.text}`).toBe(false);
      }
      await writeFile(
        `${proof}/${width}/scan.json`,
        JSON.stringify({ width, height, errors, rows }, null, 2),
      );
      await page.screenshot({ path: `${proof}/${width}/${name}.png` });
    }
    await page.goto('/');
    await expect(page.locator('.home-scene')).toBeVisible({ timeout: 30000 });
    await capture('01-lobby-empty');
    await page.getByRole('button', { name: '설정', exact: true }).click();
    await capture('02-settings-display');
    await page.getByRole('tab', { name: '소리', exact: true }).click();
    await capture('03-settings-audio');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: '새 무인으로 출전 →', exact: true }).click();
    await page.getByRole('button', { name: '모집권 1장 사용', exact: true }).click();
    await expect(page.locator('.recruitment-candidate')).toHaveCount(3);
    await capture('04-recruitment');
    await page.keyboard.press('Escape');
    await seedRegion(page, 4);
    await observeScene(page);
    await page.evaluate(async () => {
      const w = window as any;
      w.auditStore = (await w.regionModule('/src/platform/store.ts')).gameStore;
      const s = w.auditStore;
      w.regionScene.scene.pause();
      s.paused = false;
      const { makeLootItem } = await w.regionModule('/src/domain/items.ts');
      const r = s.state.run,
        f = r.fighter;
      r.enemies = r.enemies.filter((e: any) => e.bossId === '4-1');
      r.enemies[0].hp = 622;
      r.enemies[0].maxHp = 1000;
      r.enemies[0].x = 900;
      r.enemies[0].y = 500;
      r.enemies[0].timer = 1000;
      f.hp = 84;
      f.x = 1100;
      f.y = 600;
      f.appearance = 6;
      f.arts = ['huashan', 'tang', 'shaolin', 'jegal'].map((id, n) => ({
        id,
        level: n === 0 ? 5 : 3,
        gauge: n === 0 ? 70 : 0,
        combo: 0,
        defenseCd: n === 0 ? 2.4 : 0,
      }));
      f.active = 0;
      f.items = [
        makeLootItem('weapon-sword-1', 'audit-sword', 'weapon', 80),
        makeLootItem('medicine-small', 'audit-med', 'general', 80),
        makeLootItem('gear-robe-1', 'audit-robe', 'ground', 80),
        makeLootItem('material-0', 'audit-ore', 'general', 80),
      ];
      f.items[0].x = 0;
      f.items[0].y = 0;
      f.items[1].x = 0;
      f.items[1].y = 0;
      f.items[3].x = 1;
      f.items[3].y = 0;
      f.items[3].count = 5;
      f.bindings = { huashan: 'audit-sword' };
      w.auditRun = r;
      s.notify();
      w.regionScene.draw(r);
    });
    await capture('05-combat');
    await page.evaluate(() => {
      const w = window as any;
      w.auditRun.fighter.hp = 22;
      w.auditStore.notify();
      w.regionScene.draw(w.auditRun);
    });
    await capture('06-combat-low-health');
    await page.keyboard.press('Escape');
    await expect(page.locator('.pause-menu')).toBeVisible();
    await capture('07-pause');
    await page.getByRole('button', { name: '계속하기', exact: true }).click();
    await page.evaluate(() => {
      const w = window as any;
      w.auditStore.openBag(true);
    });
    await expect(page.locator('.inventory-workspace')).toBeVisible();
    await capture('08-bag-combat');
    await page.keyboard.press('Escape');
    await page.evaluate(() => {
      const w = window as any;
      w.auditRun.phase = 'loot';
      w.auditRun.offers = [];
      w.auditStore.openBag(true);
      w.auditStore.notify();
    });
    await page.locator('[data-item-id="audit-robe"]').first().click();
    await capture('09-bag-loot-selection');
    await page.keyboard.press('Escape');
    await page.evaluate(() => {
      const w = window as any,
        r = w.auditRun;
      r.fighter.trainingPoints = 10;
      r.fighter.level = 7;
      r.fighter.spent = r.spent = 5;
      r.fighter.arts[0].level = 3;
      r.offers = r.fighter.arts.slice(0, 3).map((a: any) => ({ art: a.id, type: 'upgrade' }));
      w.auditStore.bagOpen = false;
      w.auditStore.notify();
    });
    await expect(page.locator('.growth')).toBeVisible();
    await page.waitForTimeout(1100);
    await capture('10-growth');
    await page.locator('.growth-detail-link').click();
    await capture('11-growth-detail');
    await page.keyboard.press('Escape');
    await page.evaluate(async () => {
      const w = window as any;
      const { spawnWave } = await w.regionModule('/src/domain/game.ts');
      const r = w.auditRun;
      r.fighter.spent = r.spent = r.fighter.level;
      r.offers = [];
      r.wave = 4;
      spawnWave(r);
      r.gold = 8;
      r.fighter.hp = 22;
      w.auditStore.bagOpen = false;
      w.auditStore.paused = false;
      w.auditStore.notify();
    });
    await expect(page.locator('.prep-stop')).toBeVisible();
    await capture('12-prep-low-funds');
    await page.getByRole('button', { name: '정비 상인', exact: true }).click();
    await capture('13-market-low-funds');
    await page.keyboard.press('Escape');
    await page.evaluate(() => {
      const w = window as any;
      w.auditRun.phase = 'dead';
      w.auditRun.fighter.hp = 0;
      w.auditStore.notify();
    });
    await expect(page.locator('.death-result')).toBeVisible();
    await capture('14-death');
    await page.evaluate(() => {
      const w = window as any;
      w.auditRun.phase = 'combat';
      w.auditRun.fighter.hp = 84;
      w.auditStore.error = '저장 공간에 접근할 수 없습니다.';
      w.auditStore.notify();
    });
    await capture('15-save-error');
    await page.evaluate(() => {
      const w = window as any,
        s = w.auditStore,
        r = w.auditRun,
        f = structuredClone(r.fighter);
      s.error = '';
      s.state.run = null;
      s.state.family.roster = [f];
      f.expiresAt = Date.now() + 7 * 86400000;
      s.state.selectedId = f.id;
      s.screen = 'lobby';
      s.bagOpen = false;
      s.paused = false;
      s.state.family.warehouse = [
        ...f.items.map((i: any, n: number) => ({ ...i, id: 'warehouse-' + n, place: 'warehouse' })),
      ];
      s.notify();
    });
    await expect(page.locator('.home-scene')).toBeVisible();
    await capture('16-lobby-roster');
    await page.getByRole('button', { name: '창고', exact: true }).click();
    await expect(page.locator('.warehouse-workspace')).toBeVisible();
    await capture('17-warehouse');
    await page.locator('.warehouse-workspace [data-item-id]').first().click();
    await capture('18-warehouse-selected');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: '기록', exact: true }).click();
    await capture('19-records');
    await page.keyboard.press('Escape');
    await page.evaluate(async () => {
      const w = window as any;
      const React = await w.regionModule('/node_modules/.vite/deps/react.js');
      const rd = await w.regionModule('/node_modules/.vite/deps/react-dom_client.js');
      const createRoot = (rd.default ?? rd).createRoot;
      const { LoadingScreen } = await w.regionModule('/src/ui/LoadingScreen.tsx');
      const el = document.createElement('div');
      el.className = 'app-shell';
      el.style.cssText = 'position:fixed;inset:0;z-index:99999';
      document.body.appendChild(el);
      w.auditLoadingRoot = createRoot(el);
      w.auditLoadingComponent = LoadingScreen;
      w.auditReact = React.default ?? React;
      w.auditLoadingRoot.render(
        w.auditReact.createElement(LoadingScreen, {
          kind: 'combat',
          progress: { completed: 63, total: 63, stage: 'scene' },
        }),
      );
    });
    await capture('20-loading-scene');
    await page.evaluate(() => {
      const w = window as any;
      w.auditLoadingRoot.render(
        w.auditReact.createElement(w.auditLoadingComponent, {
          kind: 'combat',
          progress: { completed: 0, total: 63 },
          error: true,
          onRetry: () => {},
        }),
      );
    });
    await capture('21-loading-error');
    await writeFile(
      `${proof}/${width}/scan.json`,
      JSON.stringify({ width, height, errors, rows }, null, 2),
    );
    expect(rows).toHaveLength(21);
    expect(errors).toEqual([]);
  });
