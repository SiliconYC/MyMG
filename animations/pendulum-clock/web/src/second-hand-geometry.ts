/** Local coordinates for the front-facing seconds hand (12 o'clock = +Y).
 * The cone is used in Three.js's native +Y orientation, so its point faces
 * the outer minute marks, not the center of the dial.
 */
export const SECOND_HAND={
  tailY:-.32,
  shaftEndY:1.27,
  shaftRadius:.026,
  tipCenterY:1.36,
  tipHeight:.22,
  tipRadius:.073,
  dialMarkOuterRadius:1.52,
} as const;
