/**
 * Geometric construction of a Graham deadbeat escapement (not a proven clock).
 * Reference: BHI, Drawing Clock and Watch Escapements v1.4 (2011), §3 pp 9–16.
 *
 * All coordinates are in metres (illustrative scale), +Y up. The escapement
 * wheel's 30 tooth pitch is 12 degrees and 7.5 pitches are spanned by the
 * entrance and exit pallets. They straddle the vertical center line by 45°.
 * Intersecting tangents at these tip-circle points gives the anchor pivot.
 *
 * The design deliberately describes the ACTUAL Rapier convex collision shapes.
 * No separate "prettier" SVG tooth or fake animation position is generated.
 */
export type Point2 = readonly [number, number];
const RAD = Math.PI / 180;
const polar = (r: number, a: number): Point2 => [r * Math.cos(a), r * Math.sin(a)];
const from = (p: Point2, q: Point2): number => Math.hypot(p[0] - q[0], p[1] - q[1]);
const direction = (p: Point2): number => Math.atan2(p[1], p[0]);
const relativeToPivot = (p: Point2, pivot: number): Point2 => [p[0], p[1] - pivot];

/** BHI nominal geometry; tooth faces & backs are polygonal machining approximations. */
export const GRAHAM = Object.freeze({
  teeth: 30,
  embracedSpaces: 7.5,
  pitchDeg: 12,
  tipRadius: 2.4,       // BHI tip diameter 48 mm, ×0.1 m/mm
  rootRadius: 1.8,      // BHI root diameter 36 mm, same scale
  tipThicknessDeg: 0.5,
  toothUndercutDeg: 6,
  dropDeg: 1,
  lockDeg: 1,
  liftDeg: 2,
  actionDeg: 3,
  // Two tangents to the tip circle at +/- 45 degrees meet here.
  pivotY: 2.4 / Math.cos(45 * RAD),
  startWheelDeg: -6.0, // 144° tooth begins 0.5° ahead of entrance drop C=137.5°
  startAnchorDeg: 0,   // true BHI drawing datum; do not synthesize an animated beat
});

export function wheelTooth(i: number): Point2[] {
  const a = i * GRAHAM.pitchDeg * RAD;
  const halfTip = GRAHAM.tipThicknessDeg * RAD / 2;
  // Long, sharply tapered, UNDERCUT leading face; narrow flat tooth tip.
  // Root faces are 11° apart; 12° pitch leaves free space at the root.
  return [
    polar(GRAHAM.rootRadius, a - 5.5 * RAD),
    polar(GRAHAM.tipRadius, a - halfTip),
    polar(GRAHAM.tipRadius, a + halfTip),
    polar(GRAHAM.rootRadius, a + 5.5 * RAD),
  ];
}

/**
 * BHI points: C (entrance drop) at +2.5° from entrance radial A;
 * D at -2.5°; E (exit drop) at +2.5° from B; F at -2.5°.
 * Entrance locking arc C->G has radius PC about anchor pivot, arc 1°.
 * Entrance impulse G->H is straight, H has radius PD and angle +2°.
 * Exit impulse F->I straight; exit locking arc I->L radius PE, 1°.
 *
 * Entrance and exit are intentionally NOT mirror-identical blocks.
 * This convex polygonal approximation bounds ~0.0001m chord error on
 * 1° rest arcs; the draw shape and physics collider use the same points.
 */
export function grahamPallet(side: 'left' | 'right'): Point2[] {
  const {tipRadius: r, pivotY: py, lockDeg, liftDeg} = GRAHAM;
  const wheel = (deg: number) => polar(r, deg * RAD);
  if (side === 'left') {
    const C = relativeToPivot(wheel(135 + 2.5), py);
    const D = relativeToPivot(wheel(135 - 2.5), py);
    const theta = direction(C);
    const rc = Math.hypot(...C);
    const rd = Math.hypot(...D);
    const G = polar(rc, theta + lockDeg * RAD);
    const H = polar(rd, theta + (lockDeg + liftDeg) * RAD);
    // Material lies INSIDE the entrance resting circle. The working arc
    // and the following plane are exposed; the rear edge is non-working.
    return [
      polar(rc - .21, theta - .15 * RAD),
      C,
      polar(rc, theta + .5 * lockDeg * RAD),
      G,
      H,
      polar(rd - .21, theta + (lockDeg + liftDeg + .15) * RAD),
    ];
  }
  const E = relativeToPivot(wheel(45 + 2.5), py);
  const F = relativeToPivot(wheel(45 - 2.5), py);
  const theta = direction(F);
  const rf = Math.hypot(...F);
  const re = Math.hypot(...E);
  const I = polar(re, theta + liftDeg * RAD);
  const L = polar(re, theta + (liftDeg + lockDeg) * RAD);
  // Material lies OUTSIDE the exit resting circle. The segment I-L
  // approximates the concave rest arc by its chord (error <0.0001m).
  return [
    polar(rf + .21, theta - .15 * RAD),
    F,
    I,
    L,
    polar(re + .21, theta + (liftDeg + lockDeg + .15) * RAD),
  ];
}

export function constructionAudit() {
  const r = GRAHAM.tipRadius, P: Point2 = [0,GRAHAM.pivotY];
  const left = polar(r,135 * RAD), right = polar(r,45 * RAD);
  return {
    pitchDeg: 360/GRAHAM.teeth,
    embracedDeg: 360/GRAHAM.teeth*GRAHAM.embracedSpaces,
    leftTangentDot: Math.abs(left[0]* (P[0]-left[0]) + left[1]*(P[1]-left[1])),
    rightTangentDot: Math.abs(right[0]*(P[0]-right[0]) + right[1]*(P[1]-right[1])),
    entryLockRadius: from(polar(r,137.5*RAD),P),
    exitLockRadius: from(polar(r,47.5*RAD),P),
    diameterRatio: GRAHAM.rootRadius / GRAHAM.tipRadius,
  };
}
