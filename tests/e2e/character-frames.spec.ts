import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { seedRegion, observeScene } from './support/region';

for (let region = 0; region < 10; region++)
  test(`지역 ${region} 독립 프레임 전체 검토판`, async ({ page }) => {
    test.setTimeout(90000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await seedRegion(page, region);
    await observeScene(page);
    const sheets = await page.evaluate((region) => {
      const manager = (window as any).regionScene.textures;
      return manager
        .getTextureKeys()
        .filter(
          (key: string) =>
            (key.includes(`region-direction-${region}`) && key.endsWith('-isolated')) ||
            (key.includes(`region-motion-${region}`) && key.endsWith('-isolated')) ||
            (region === 0 &&
              [
                'hero-isolated',
                'enemy-role-directions-isolated',
                'enemy-role-actions-isolated',
              ].includes(key)) ||
            (region === 7 && key === 'cavalry-actions-isolated'),
        )
        .map((key: string) => {
          const texture = manager.get(key),
            names = texture.getFrameNames();
          for (const [i, name] of names.entries()) {
            const a = texture.get(name);
            for (const other of names.slice(i + 1)) {
              const b = texture.get(other);
              if (
                a.cutX < b.cutX + b.cutWidth &&
                b.cutX < a.cutX + a.cutWidth &&
                a.cutY < b.cutY + b.cutHeight &&
                b.cutY < a.cutY + a.cutHeight
              )
                throw new Error(`Overlapping packed frames: ${key}/${name}/${other}`);
            }
          }
          const cols = key === 'hero-isolated' ? 8 : key.includes('direction') ? 5 : 6;
          const canvas = document.createElement('canvas');
          canvas.width = cols * 170;
          canvas.height = Math.ceil(names.length / cols) * 220;
          const ctx = canvas.getContext('2d')!;
          ctx.fillStyle = '#697b73';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          names.forEach((name: string, i: number) => {
            const frame = texture.get(name),
              scale = Math.min(150 / frame.cutWidth, 190 / frame.cutHeight);
            const x = (i % cols) * 170,
              y = Math.floor(i / cols) * 220;
            ctx.drawImage(
              frame.source.image,
              frame.cutX,
              frame.cutY,
              frame.cutWidth,
              frame.cutHeight,
              x + (170 - frame.cutWidth * scale) / 2,
              y + 10,
              frame.cutWidth * scale,
              frame.cutHeight * scale,
            );
            ctx.fillStyle = '#fff';
            ctx.font = '14px sans-serif';
            ctx.fillText(name, x + 8, y + 212);
          });
          return { key, count: names.length, data: canvas.toDataURL('image/png').split(',')[1] };
        });
    }, region);
    expect(sheets.length).toBeGreaterThanOrEqual(2);
    expect(errors).toEqual([]);
    await mkdir('docs/verification/character-frames-v4', { recursive: true });
    for (const sheet of sheets)
      await writeFile(
        `docs/verification/character-frames-v4/${sheet.key}.png`,
        Buffer.from(sheet.data, 'base64'),
      );
  });
