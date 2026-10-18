/** One-piece tapered seconds hand: broad root at the pivot and a sharp
 * outward-facing tip, with no protruding cylinder or separate arrowhead.
 * ConeGeometry's native +Y direction is radial-outward at 12 o'clock.
 */
export const SECOND_HAND={
  baseRadius:.074,
  height:1.47,
  tipCenterY:.735,
  dialMarkOuterRadius:1.52,
} as const;
