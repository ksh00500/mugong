# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: local-preview-boss-pressure.spec.ts >> production pursuit and save 1366x768
- Location: tests\e2e\local-preview-boss-pressure.spec.ts:7:3

# Error details

```
Error: expect(received).toBeGreaterThan(expected)

Expected: > 0
Received:   0
```

# Page snapshot

```yaml
- generic [ref=f2e3]:
  - main [ref=f2e4]:
    - generic [ref=f2e5]:
      - generic:
        - generic:
          - region "무인 상태":
            - generic:
              - generic:
                - generic "지역 검증"
                - generic: Lv.16
              - generic:
                - generic:
                  - generic: 체력
                  - generic: 120 / 120
                - meter
              - generic:
                - generic:
                  - generic: 경험치
                  - generic: 0 / 100
                - meter
          - generic:
            - generic:
              - generic: 파계승 공허
              - generic:
                - meter
                - generic: 100000 / 100000
          - region "강호 진행":
            - generic:
              - generic: 강호
              - generic: 5 / 20 웨이브
            - generic:
              - button "가방 Tab" [ref=f2e8] [cursor=pointer]:
                - text: 가방
                - generic [ref=f2e9]: Tab
              - button "일시 정지" [ref=f2e10] [cursor=pointer]
        - generic:
          - region "무공 전환":
            - generic:
              - button "이전 무공" [disabled] [ref=f2e11]: Q ‹
              - generic "미숙한 기본 공격"
              - button "다음 무공" [disabled] [ref=f2e12]: › E
            - button "미숙한 기본 공격" [disabled] [ref=f2e13]:
              - generic [ref=f2e15]: —
              - generic [ref=f2e16]: Lv.0
          - generic:
            - generic:
              - generic: 궁극
              - generic: 미개방
            - meter
            - generic: 무공 Lv.5 개방
          - region "방어 행동":
            - generic:
              - generic: 방어 행동
              - generic: Space
            - generic: 첫 레벨에서 무공을 선택합니다
  - dialog "여정을 잠시 멈추다" [ref=f2e18]:
    - banner [ref=f2e19]:
      - heading "여정을 잠시 멈추다" [level=2] [ref=f2e20]
    - generic [ref=f2e21]:
      - button "계속하기" [ref=f2e22] [cursor=pointer]
      - button "저장하고 일시 종료" [ref=f2e23] [cursor=pointer]
      - button "화면 설정" [active] [ref=f2e24] [cursor=pointer]
      - button "소리 끄기" [ref=f2e25] [cursor=pointer]
      - paragraph [ref=f2e26]: 강호에서 귀환하는 것이 아닙니다.이 무인의 여정을 다음에 이어갑니다.
```

# Test source

```ts
  1  | import { expect, test } from '@playwright/test';
  2  | import { mkdir, writeFile } from 'node:fs/promises';
  3  | import { seedRegion } from './support/region';
  4  | test.skip(process.env.MUGONG_PRODUCTION_VERIFY !== '1', 'Explicit local production verification only.');
  5  | const proof = 'docs/verification/boss-pressure-v1/production';
  6  | for (const [width, height] of [[1440, 900], [1366, 768], [1093, 614]])
  7  |   test(`production pursuit and save ${width}x${height}`, async ({ page }) => {
  8  |     test.setTimeout(120000);
  9  |     await page.setViewportSize({ width, height });
  10 |     const errors: string[] = [];
  11 |     page.on('pageerror', (e) => errors.push(e.message));
  12 |     await seedRegion(page, 4);
  13 |     await page.evaluate(async () => {
  14 |       const db = await new Promise<IDBDatabase>((resolve) => { const q = indexedDB.open('mugong-local-v1', 1); q.onsuccess = () => resolve(q.result); });
  15 |       const state: any = await new Promise((resolve) => { const q = db.transaction('saves').objectStore('saves').get('current'); q.onsuccess = () => resolve(q.result); });
  16 |       const e = state.run.enemies[3];
  17 |       Object.assign(e, { state: 'approach', timer: 0, x: 700, y: 520, pressure: undefined, move: undefined, strike: undefined, pattern: 0 });
  18 |       state.run.enemies = [e]; state.run.zoneClock = 0;
  19 |       await new Promise<void>((resolve) => { const tx = db.transaction('saves', 'readwrite'); tx.objectStore('saves').put(state, 'current'); tx.oncomplete = () => resolve(); });
  20 |       db.close();
  21 |     });
  22 |     await page.reload();
  23 |     await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'true', { timeout: 30000 });
  24 |     await expect(page.locator('script[src^="/assets/main-"]')).toHaveCount(1);
  25 |     await page.mouse.move(width * 0.35, height * 0.5);
  26 |     await page.mouse.down(); await page.keyboard.down('d');
  27 |     await page.waitForTimeout(1800);
  28 |     await page.keyboard.up('d'); await page.mouse.up();
  29 |     await mkdir(proof, { recursive: true });
  30 |     await page.screenshot({ path: `${proof}/combat-${width}.png` });
  31 |     await page.keyboard.press('Escape');
  32 |     await expect(page.getByRole('heading', { name: '여정을 잠시 멈추다' })).toBeVisible();
  33 |     await page.waitForTimeout(350);
  34 |     const result = await page.evaluate(async () => {
  35 |       const db = await new Promise<IDBDatabase>((resolve) => { const q = indexedDB.open('mugong-local-v1', 1); q.onsuccess = () => resolve(q.result); });
  36 |       const state: any = await new Promise((resolve) => { const q = db.transaction('saves').objectStore('saves').get('current'); q.onsuccess = () => resolve(q.result); });
  37 |       db.close();
  38 |       return { pressure: state.run.enemies[0].pressure, hp: state.run.fighter.hp, x: state.run.fighter.x, overflow: document.documentElement.scrollWidth > innerWidth };
  39 |     });
> 40 |     expect(result.pressure?.cooldown).toBeGreaterThan(0);
     |                                       ^ Error: expect(received).toBeGreaterThan(expected)
  41 |     expect(result.pressure?.cooldown).toBeLessThanOrEqual(5);
  42 |     expect(result.x).toBeGreaterThan(960);
  43 |     expect(result.overflow).toBe(false);
  44 |     await page.reload();
  45 |     await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'true', { timeout: 30000 });
  46 |     expect(errors).toEqual([]);
  47 |     await writeFile(`${proof}/${width}.json`, JSON.stringify({ width, height, ...result, errors }, null, 2));
  48 |   });
  49 | 
```