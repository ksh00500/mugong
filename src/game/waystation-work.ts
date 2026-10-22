export const WORK_ART = {
  physician: '/art/waystation-work-v1/physician.png',
  merchant: '/art/waystation-work-v1/merchant.png',
  blacksmith: '/art/waystation-work-v1/blacksmith.png',
} as const;
export type WorkNpc = keyof typeof WORK_ART;
export const WORK_CALIBRATION = {
  physician: {
    bodyHeight: 693,
    feet: [
      [284, 709],
      [287, 709],
      [288, 709],
      [290, 709],
    ],
  },
  merchant: {
    bodyHeight: 686,
    feet: [
      [320, 694],
      [290, 694],
      [260, 694],
      [229, 694],
    ],
  },
  blacksmith: {
    bodyHeight: 654,
    feet: [
      [400, 707],
      [422, 707],
      [415, 707],
      [417, 706],
    ],
  },
} as const;
/** A held anticipation, fast contact and longer recovery; no body scale or joint warping. */
export function workPose(seconds: number, reduced = false) {
  if (seconds < 0 || seconds >= 1.6) return null;
  if (reduced) return 2;
  return seconds < 0.28 ? 0 : seconds < 0.58 ? 1 : seconds < 0.78 ? 2 : seconds < 1.25 ? 3 : 0;
}
