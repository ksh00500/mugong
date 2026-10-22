/** Reviewed against directions-0/1.webp, not the requested column order.
 * Sector order: E, SE, S, SW, W, NW, N, NE (screen Y points down).
 * The second sheet's rear three-quarter view points LEFT; the first points RIGHT.
 * Walk action cells are not directional pairs and must never replace these views.
 */
export type HeroDirection = { view: number; flip: boolean };
const firstSheet: readonly HeroDirection[] = [
  { view: 4, flip: true },
  { view: 7, flip: false },
  { view: 2, flip: false },
  { view: 7, flip: true },
  { view: 4, flip: false },
  { view: 5, flip: true },
  { view: 6, flip: false },
  { view: 5, flip: false },
];
function secondSheet(side: number, front: number, sideFlip = true): readonly HeroDirection[] {
  return [
    { view: side, flip: sideFlip },
    { view: front, flip: false },
    { view: 2, flip: false },
    { view: front, flip: true },
    { view: side, flip: !sideFlip },
    { view: 4, flip: false },
    { view: 6, flip: false },
    { view: 4, flip: true },
  ];
}
export const HERO_ROSTER_DIRECTIONS: readonly (readonly HeroDirection[])[] = [
  firstSheet,
  firstSheet,
  firstSheet,
  firstSheet,
  firstSheet,
  secondSheet(7, 1, false), // yellow monk: right profile, front-right, rear-left
  secondSheet(5, 0), // lavender: left profile, front-right, rear-left
  secondSheet(5, 7), // elder
  secondSheet(5, 7), // blue traveller
  secondSheet(5, 0), // pink ribbons
];
export function heroDirection(appearance: number, sector: number): HeroDirection {
  const direction = HERO_ROSTER_DIRECTIONS[appearance]?.[sector];
  if (!direction) throw new Error(`Unreviewed hero direction: ${appearance}/${sector}`);
  return direction;
}
