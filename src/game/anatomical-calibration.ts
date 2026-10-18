import landmarks from '../platform/anatomical-landmarks.json';
import slashLandmarks from '../platform/hero-slash-landmarks.json';
import monkLandmarks from '../platform/monk-skull-landmarks.json';
import guardCalibration from '../platform/hero-guard-calibration.json';

type Plate = {
  width: number;
  height: number;
  units: Record<string, number>;
  skulls?: Record<string, number>;
};
const plates: Record<string, Plate> = {
  ...landmarks,
  ...slashLandmarks,
  ...monkLandmarks,
  ...guardCalibration.landmarks,
};

/** Reviewed scale references on isolated source figures. Monk upright drawings
 * use stature; physical scalp spans are stored separately for combat matching.
 * Weapons, cloak area and a horizontal corpse are not stature references.
 * A changed source must receive a new calibration rather than reuse old UVs. */
export function anatomicalUnit(image: unknown, width: number, height: number, frame: string) {
  const src = (image as HTMLImageElement | null)?.src;
  if (!src) return undefined;
  const path = new URL(src, window.location.href).pathname;
  const plate = plates[path];
  if (!plate) return undefined;
  if (plate.width !== width || plate.height !== height)
    throw new Error(`Anatomical calibration/source mismatch: ${path}`);
  const unit = plate.units[frame];
  if (!(unit > 0)) throw new Error(`Missing anatomical landmark: ${path}/${frame}`);
  return unit;
}

/** Physical scalp width is independent of upright stature. Match combat poses
 * to the current walking view without including a staff, glove or prone body. */
export function anatomicalSkullUnit(image: unknown, width: number, height: number, frame: string) {
  const src = (image as HTMLImageElement | null)?.src;
  if (!src) return undefined;
  const path = new URL(src, window.location.href).pathname;
  const plate = plates[path];
  if (!plate?.skulls) return undefined;
  if (plate.width !== width || plate.height !== height)
    throw new Error(`Anatomical calibration/source mismatch: ${path}`);
  return plate.skulls[frame];
}
