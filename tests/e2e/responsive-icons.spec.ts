import { test, expect, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { emptyGame, startRun } from '../../src/domain/game';
import { makeItem, makeWeapon, xpThreshold } from '../../src/domain/content';
import type { BoundFighter, GameState } from '../../src/domain/model';
import { isGameSave } from '../../src/platform/save-validation';
const mode = process.env.MUGONG_ICON_MODE ?? 'after';
const proof = `docs/verification/responsive-icons-v1/${mode}`;
function fixture() {
  const state = emptyGame(); startRun(state, '아이콘 검토', 123);
  const run = state.run!, f = run.fighter as BoundFighter;
  f.level = f.spent = run.spent = 16; f.xp = xpThreshold(16);
  f.augments = ['swift']; f.augmentOffers = [];
  f.arts = (['samja', 'wudang', 'huashan', 'tianmo'] as const).map(id => ({ id, level: 1, gauge: 0, combo: 0, defenseCd: 0 }));
  f.items = [makeWeapon('sword', 'blade', 'weapon'), makeItem('medicine', 'potion', 'general'), makeItem('robe', 'robe', 'equipped'), makeItem('boots', 'boots', 'equipped'), makeItem('charm', 'charm', 'equipped')];
  f.bindings = { samja: 'blade', wudang: 'blade', huashan: 'blade', tianmo: 'blade' };
  f.invulnerable = 1000; run.offers = [];
  return state;
}
async function seed(page: Page, state: GameState) {
  expect(isGameSave(state)).toBe(true);
  await page.evaluate(async state => {
    const db = await new Promise<IDBDatabase>(resolve => { const q = indexedDB.open('mugong-local-v1', 1); q.onsuccess = () => resolve(q.result); });
    await new Promise<void>(resolve => { const tx = db.transaction('saves', 'readwrite'); tx.objectStore('saves').put(state, 'current'); tx.oncomplete = () => resolve(); }); db.close();
  }, state);
  await page.reload();
}
async function icons(page: Page, selector: string) {
  return page.locator(selector).evaluateAll(elements => elements.map(el => {
    const r = el.getBoundingClientRect(), style = getComputedStyle(el);
    const owner = el.closest('button,.detail-heading,.binding-list > div') ?? el.parentElement!;
    const b = owner.getBoundingClientRect();
    const uncovered = [0.25,0.5,0.75].every(y=>{const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height*y); return !!hit && owner.contains(hit);});
    return { className: el.getAttribute('class'), owner: owner.textContent?.trim(), display: style.display, width: r.width, height: r.height, visible: r.width > 0 && r.height > 0 && style.visibility !== 'hidden', ownerVisible: b.width > 0 && b.height > 0, hitTestable: getComputedStyle(owner).pointerEvents !== 'none', uncovered, fits: r.x >= -1 && r.y >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1 };
  }));
}
for (const [width, height] of [[1440,900],[1366,768],[1093,614],[1000,650],[900,650],[800,650],[700,650],[600,650],[1093,560],[800,560]] as const) {
  test(`icons persist when resizing ${width}x${height}`, async ({ page }) => {
    await mkdir(proof, { recursive: true }); await page.setViewportSize({width,height});
    const errors: string[] = []; page.on('pageerror', e=>errors.push(e.message));
    await page.goto('/'); await expect(page.locator('.home-scene')).toBeVisible();
    const lobby = await icons(page, '.home-nav .ui-icon,.home-header-end .ui-icon,.home-launch .ui-icon');
    await page.screenshot({path:`${proof}/lobby-${width}-${height}.png`});
    await seed(page, fixture());
    await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready','true',{timeout:45000});
    const combat = await icons(page, '.hud-actions .ui-icon,.fan-leaf .art-glyph,.cooldown-dial .art-glyph');
    await page.screenshot({path:`${proof}/combat-${width}-${height}.png`});
    await page.getByRole('button',{name:'가방',exact:false}).first().click();
    await expect(page.locator('.inventory-workspace')).toBeVisible();
    await page.locator('.bag-grid .item-tile').first().click();
    const bag = await icons(page, '.binding-list .art-glyph,.detail-heading .item-art,.item-actions .ui-icon');
    const detailBottom = await page.locator('.item-detail').evaluate(el => Math.max(...[...el.children].filter(e=>e.getClientRects().length).map(e=>e.getBoundingClientRect().bottom)));
    const trayTop = (await page.locator('.inventory-trays').boundingBox())!.y;
    const detailAreas = await page.locator('.item-detail').evaluate(el => [...el.children].filter(e=>e.getClientRects().length).map(e=>{const b=e.getBoundingClientRect(); return {tag:e.tagName,className:e.className,x:b.x,y:b.y,right:b.right,bottom:b.bottom};}));
    await page.screenshot({path:`${proof}/bag-${width}-${height}.png`});
    const result = {width,height,lobby,combat,bag,detailBottom,trayTop,detailAreas,errors};
    await writeFile(`${proof}/icons-${width}-${height}.json`,JSON.stringify(result,null,2));
    if(mode !== 'before') {
      for (const [screen, entries] of Object.entries({lobby,combat,bag})) {
        expect(entries.length, screen).toBeGreaterThan(0);
        expect(entries.filter(e=>e.ownerVisible && (!e.visible || !e.fits)),screen).toEqual([]);
        expect(entries.filter(e=>e.ownerVisible&&e.hitTestable&&!e.uncovered),`${screen} icons covered by other controls`).toEqual([]);
      }
      expect(errors).toEqual([]);
      await expect(page.locator('.item-detail dl dt').filter({hasText:'효과'})).toBeVisible();
      expect(detailBottom, 'selected item information must not be covered by loot').toBeLessThanOrEqual(trayTop + 1);
      for(let i=0;i<detailAreas.length;i++)for(let j=i+1;j<detailAreas.length;j++) {
        const a=detailAreas[i],b=detailAreas[j];
        expect(Math.min(a.right,b.right)-Math.max(a.x,b.x)>1 && Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>1,`${a.className||a.tag} overlaps ${b.className||b.tag}`).toBe(false);
      }
    }
  });
}
if (mode !== 'before') {
  test('the same lobby keeps named, usable icons across breakpoints', async ({page}) => {
    await page.goto('/'); await expect(page.locator('.home-scene')).toBeVisible();
    for(const width of [1440,1000,800,600,1093]) {
      await page.setViewportSize({width,height:650});
      const rows=await icons(page,'.home-nav .ui-icon');
      expect(rows).toHaveLength(4); expect(rows.every(r=>r.visible&&r.fits)).toBe(true);
      for(const [button,title] of [['창고','세가 창고'],['기록','세가의 기록'],['설정','설정']]) {
        const opener=page.getByRole('button',{name:button,exact:true});
        await opener.click(); await expect(page.getByRole('dialog',{name:title,exact:true})).toBeVisible();
        await page.getByRole('button',{name:`${title} 닫기`,exact:true}).click();
        await expect(opener).toBeFocused();
      }
    }
  });
  test('narrow combat keeps bag and pause icons', async ({page}) => {
    await page.setViewportSize({width:480,height:650});
    await page.goto('/'); await expect(page.locator('.home-scene')).toBeVisible(); await seed(page,fixture());
    await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready','true',{timeout:45000});
    const rows=await icons(page,'.hud-actions .ui-icon');
    expect(rows).toHaveLength(2); expect(rows.every(r=>r.visible&&r.fits)).toBe(true);
    await page.getByRole('button',{name:'일시 정지',exact:true}).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.screenshot({path:`${proof}/pause-480.png`});
  });
}
