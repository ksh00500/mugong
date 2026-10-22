import { useId } from 'react';
import { UI_IMAGES } from '../platform/assets';

/** SVG is only a viewport into a painted PNG atlas; no vector paths or substitute artwork. */
export function PaintedSprite({
  sheet = 'symbols',
  index,
  className = '',
  narrow = false,
  rotated = false,
}: {
  sheet?: 'symbols' | 'navigation' | 'newArts' | 'weapons' | 'bossLoot';
  index: number;
  className?: string;
  narrow?: boolean;
  rotated?: boolean;
}) {
  const newArt = sheet === 'newArts';
  const weapon = sheet === 'weapons';
  const loot = sheet === 'bossLoot';
  const cell = loot ? 443.5 : newArt ? 627 : weapon ? 512 : 250;
  const cols = newArt ? 2 : weapon ? 3 : 4;
  const x = (index % cols) * cell,
    y = Math.floor(index / cols) * cell;
  const crop = loot
    ? `${x + 8} ${y + 8} 427.5 427.5`
    : weapon
      ? narrow
        ? rotated
          ? `${x + 8} ${y + 138} 496 236`
          : `${x + 138} ${y + 8} 236 496`
        : `${x + 8} ${y + 8} 496 496`
      : newArt
        ? `${x} ${y} ${cell} ${cell}`
        : narrow
          ? rotated
            ? `${x + 4} ${y + 82} 242 94`
            : `${x + 90} ${y + 2} 85 246`
          : `${x + 4} ${y + 4} 242 242`;
  const clipId = useId();
  const [cx, cy, cw, ch] = crop.split(' ').map(Number);
  return (
    <svg
      className={`painted-sprite ${className}`}
      viewBox={crop}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <clipPath id={clipId}>
          <rect x={cx} y={cy} width={cw} height={ch} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <image
          href={UI_IMAGES[sheet]}
          width={loot ? 1774 : newArt ? 1254 : weapon ? 1536 : 1000}
          height={loot ? 887 : newArt ? 1254 : weapon ? 1024 : 1000}
          transform={
            weapon && narrow
              ? `rotate(${-36 + (rotated ? -90 : 0)} ${x + 256} ${y + 256})`
              : rotated
                ? `rotate(-90 ${x + cell / 2} ${y + cell / 2})`
                : undefined
          }
        />
      </g>
    </svg>
  );
}
