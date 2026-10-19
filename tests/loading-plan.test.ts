import { expect, it } from 'vitest';
import { buildRegionArtIndex } from '../src/platform/region-art-source';
import index from '../src/platform/region-art-manifests.json';
import { regionArtManifest, runArtKey, runArtManifest } from '../src/platform/region-art';
import { emptyGame, startRun, spawnWave } from '../src/domain/game';
import { REGIONS } from '../src/domain/campaign';
import { authoredEnemyArt } from '../src/game/authored-enemy';
import { BOSS_KITS } from '../src/domain/boss-melee';
import { bossSpecialFrame } from '../src/game/boss-special';
import { UI_BOOT_IMAGES, UI_IMAGES } from '../src/platform/assets';

it('the compact index is exactly derived from current authored metadata, including reused poses', () => {
  expect(index).toEqual(buildRegionArtIndex());
  for (let region = 0; region < 10; region++) {
    const entry = index.regions[region];
    expect(Object.assign({}, entry.ordinary, ...Object.values(entry.bosses))).toEqual(
      regionArtManifest(region),
    );
  }
});
for (let region = 0; region < 10; region++)
  it(`region ${region} loads all ordinary actors and each boss only when needed`, () => {
    const s = emptyGame();
    startRun(s, '로딩 검사', 123);
    const r = s.run!;
    r.regionRoute = [
      REGIONS[region].name,
      ...REGIONS.filter((_, i) => i !== region)
        .slice(0, 3)
        .map((r) => r.name),
    ];
    r.wave = 1;
    spawnWave(r);
    const normal = runArtManifest(r);
    expect(Object.keys(normal).length).toBeLessThan(
      Object.keys(regionArtManifest(region)).length / 2,
    );
    for (const e of r.enemies)
      for (const f of authoredEnemyArt(e, region)!.frames) expect(normal).toHaveProperty(f.texture);
    for (let phase = 1; phase <= 4; phase++) {
      const bossId = `${region}-${phase}`;
      // Keep this region while selecting the stage's boss.
      r.regionRoute = [
        REGIONS[region].name,
        REGIONS[region].name,
        REGIONS[region].name,
        REGIONS[region].name,
      ];
      r.wave = phase * 5;
      spawnWave(r);
      const boss = r.enemies[0],
        manifest = runArtManifest(r);
      for (const [key, url] of Object.entries(normal)) expect(manifest[key]).toBe(url);
      for (const f of authoredEnemyArt(boss, region)!.frames)
        expect(manifest).toHaveProperty(f.texture);
      for (const [move, spec] of Object.entries(BOSS_KITS[bossId].moves)) {
        if (!spec) continue;
        for (let direction = 0; direction < 8; direction++)
          for (const progress of [0, 0.2, 0.4, 0.65, 0.9, 1]) {
            const sample = bossSpecialFrame(boss, region, direction, move, 'strike', progress, {
              duration: spec.duration,
              contacts: spec.contacts,
            });
            if (sample) expect(manifest).toHaveProperty(sample.frame.texture);
          }
      }
    }
  });
it('unopened UI atlases are not gates for first lobby paint', () => {
  expect(Object.keys(UI_BOOT_IMAGES)).toHaveLength(5);
  expect(UI_BOOT_IMAGES).not.toHaveProperty('weapons');
  expect(UI_IMAGES).toHaveProperty('weapons');
  expect(runArtManifest(null)).toEqual({});
  expect(runArtKey(null)).toBe('-1:');
});
