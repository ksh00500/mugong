import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { seedRegion, observeScene } from './support/region';

for (let region = 0; region < 10; region++)
  test(`지역 ${region} 실제 배율 전 동작 크기`, async ({ page }) => {
    test.setTimeout(120000);
    await seedRegion(page, region, false);
    await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'true', {
      timeout: 45000,
    });
    await observeScene(page);
    const sheets = await page.evaluate((region) => {
      const scene = (window as any).regionScene;
      const results: { name: string; image: string; ratios: number[] }[] = [];
      const render = (
        name: string,
        frames: Map<string, any>,
        cols: number,
        hero = false,
        reaction = false,
      ) => {
        const entries = [...frames.entries()];
        const canvas = document.createElement('canvas');
        canvas.width = cols * 200;
        canvas.height = Math.ceil(entries.length / cols) * 175;
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
        ctx.fillStyle = '#637267';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const masses: number[] = [];
        for (const [i, [key, f]] of entries.entries()) {
          const texture = scene.textures.get(hero ? 'hero-isolated' : f.texture);
          const frame = texture.get(key);
          const idle = reaction ? scene.heroFrames.get(`0-${i % cols}`) : undefined;
          const sx = reaction
            ? (idle.bodyUnit * Math.sqrt(105 * 115) * idle.scaleCorrection) /
              Math.sqrt(idle.nominalWidth * idle.nominalHeight) /
              f.bodyUnit
            : hero
              ? (105 * f.scaleCorrection) / f.nominalWidth
              : 80 / f.referenceHeight;
          const sy = hero ? (115 * f.scaleCorrection) / f.nominalHeight : sx;
          const x = (i % cols) * 200 + 100,
            y = Math.floor(i / cols) * 175 + 145;
          ctx.strokeStyle = '#9eaaa0';
          ctx.beginPath();
          ctx.moveTo(x - 90, y);
          ctx.lineTo(x + 90, y);
          ctx.stroke();
          ctx.drawImage(
            texture.source[0].image,
            frame.cutX,
            frame.cutY,
            frame.cutWidth,
            frame.cutHeight,
            x - (f.width * sx) / 2,
            y - f.height * sy * (hero ? f.footY : f.originY),
            f.width * sx,
            f.height * sy,
          );
          ctx.fillStyle = '#fff';
          ctx.font = '13px sans-serif';
          ctx.fillText(key, x - 85, y + 20);
          masses.push(f.bodyUnit * f.bodyUnit * sx * sy);
        }
        const ratios = masses.map(
          (m, i) => m / masses[hero || reaction ? i % cols : Math.floor(i / cols) * cols],
        );
        results.push({ name, image: canvas.toDataURL('image/png'), ratios });
      };
      render(`region-${region}-actions`, scene.motionFrames.get(`region-motion-${region}`), 6);
      render(
        `region-${region}-directions`,
        scene.directionFrames.get(`region-direction-${region}`),
        5,
      );
      if (region === 0) {
        render('hero-all-actions', scene.heroFrames, 8, true);
        render('hero-reactions', scene.motionFrames.get('hero-reactions'), 8, false, true);
        render('drone-wingbeat', scene.motionFrames.get('repair-drone-motion'), 4);
        render('role-actions', scene.motionFrames.get('enemy-role-actions'), 6);
        render('identity-repaired-actions', scene.motionFrames.get('hostile-identity-actions'), 6);
      }
      if (region === 7) render('cavalry-actions', scene.motionFrames.get('cavalry-actions'), 6);
      return results;
    }, region);
    const dir = 'docs/verification/animation-rebuild-v2';
    await mkdir(dir, { recursive: true });
    for (const sheet of sheets) {
      await writeFile(`${dir}/${sheet.name}.png`, Buffer.from(sheet.image.split(',')[1], 'base64'));
      expect(sheet.ratios, sheet.name).toEqual(expect.arrayContaining([1]));
      expect(
        sheet.ratios.every((r) => Number.isFinite(r) && Math.abs(r - 1) < 0.001),
        `${sheet.name}: ${sheet.ratios.join(',')}`,
      ).toBe(true);
    }
  });
