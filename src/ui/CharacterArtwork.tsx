import type { AugmentId } from '../domain/character';

// Authored order in docs/source/character-polish-v1/augment-icons.png.
const AUGMENT_FRAME: Record<AugmentId, number> = {
  vigor: 0, might: 1, swift: 2, reservoir: 3, iron: 4, tempo: 5, medicine: 6, resolve: 7,
};
export function AugmentArtwork({ id }: { id: AugmentId }) {
  const index = AUGMENT_FRAME[id], x = (index % 4) * 443.5, y = Math.floor(index / 4) * 443.5;
  return <svg className="art-glyph augment-artwork" viewBox={`${x} ${y} 443.5 443.5`} aria-hidden="true" focusable="false">
    <image href="/art/character-polish-v1/augment-icons.webp" width="1774" height="887" />
  </svg>;
}
