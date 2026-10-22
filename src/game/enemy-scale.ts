/** A character has one reference drawing, independent of its current view or
 * state. Scalp measurements, where available, must also be used for walking. */
export type ScaleFrame = {
  height: number;
  originY: number;
  referenceHeight: number;
  bodyUnit: number;
  skullUnit?: number;
};

export function enemyPixelScale(source: ScaleFrame, reference: ScaleFrame, height: number) {
  const physical = !!reference.skullUnit;
  if (physical && !source.skullUnit)
    throw new Error('Missing scalp calibration in a scalp-calibrated enemy family');
  const unit = physical ? source.skullUnit! : source.bodyUnit;
  const referenceUnit = physical ? reference.skullUnit! : reference.bodyUnit;
  const targetUnit = (height * referenceUnit) / reference.referenceHeight;
  return {
    pixelScale: targetUnit / unit,
    unit,
    targetUnit,
    basis: physical ? 'scalp' : 'authored',
  };
}

/** Reserve one height for every living drawing in the family. A raised weapon
 * can increase the envelope; a prone corpse cannot move a living health bar. */
export function enemyBarClearance(
  frames: Iterable<ScaleFrame>,
  reference: ScaleFrame,
  height: number,
) {
  let top = height;
  for (const frame of frames)
    top = Math.max(
      top,
      frame.height * frame.originY * enemyPixelScale(frame, reference, height).pixelScale,
    );
  return top + 12;
}

/** Mesh bounds include settling, lunge and recoil, after the source is sized.
 * The bar bottom has at least seven world pixels of clearance. */
export function enemyHealthBarY(groundY: number, clearance: number, renderedTop: number) {
  return Math.min(groundY - clearance, renderedTop - 12);
}
