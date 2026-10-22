import { COMBAT_IMAGES } from '../platform/assets';

const crops = {
  player: [10, 10, 815, 420],
  ribbon: [842, 152, 823, 175],
  fan: [12, 439, 813, 500],
  gauge: [842, 610, 823, 218],
  medallion: [892, 645, 155, 155],
  ink: [1080, 653, 574, 126],
  boss: [1080, 680, 574, 105],
} as const;

/** Crops only the raster art. Text, meters and hit areas are independent DOM elements. */
export function HudArtwork({ shape }: { shape: keyof typeof crops }) {
  const [x, y, width, height] = crops[shape];
  return (
    <div
      className={`hud-artwork hud-artwork-${shape}`}
      aria-hidden="true"
      style={{
        backgroundImage: `url('${COMBAT_IMAGES['hud-artwork']}')`,
        backgroundSize: `${(1670 / width) * 100}% ${(942 / height) * 100}%`,
        backgroundPosition: `${(x / (1670 - width)) * 100}% ${(y / (942 - height)) * 100}%`,
        backgroundRepeat: 'no-repeat',
      }}
    />
  );
}
