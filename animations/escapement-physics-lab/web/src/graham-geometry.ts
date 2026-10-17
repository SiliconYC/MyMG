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
  // Separate phase relief (half the 3° total pallet action). Explicitly
  // a geometric prototype clearance, not a claim of machining accuracy.
  palletPhaseReliefDeg: 1.5,
  // Two tangents to the tip circle at +/- 45 degrees meet here.
  pivotY: 2.4 / Math.cos(45 * RAD),
  startWheelDeg: -5.4, // Nominal initial phase; audited separately from shape construction
  startAnchorDeg: 0,   // true BHI drawing datum; do not synthesize an animated beat
});

/** The escape wheel has real windows, not paint over a circular collider.
 * Every segment and spoke is a convex Rapier collider and matching SVG. */
export const WHEEL_STRUCTURE = Object.freeze({
  rimInnerRadius: 1.60, rimOuterRadius: 1.82,
  hubRadius: 0.24, spokes: 6, spokeHalfWidth: 0.075,
});
export function wheelRimSector(i: number): Point2[] {
  const a = i * GRAHAM.pitchDeg * RAD;
  const b = (i + 1) * GRAHAM.pitchDeg * RAD;
  return [
    polar(WHEEL_STRUCTURE.rimInnerRadius,a),
    polar(WHEEL_STRUCTURE.rimOuterRadius,a),
    polar(WHEEL_STRUCTURE.rimOuterRadius,b),
    polar(WHEEL_STRUCTURE.rimInnerRadius,b),
  ];
}
export function wheelSpoke(i: number): Point2[] {
  const a = 2 * Math.PI * i / WHEEL_STRUCTURE.spokes;
  const u: Point2 = [Math.cos(a),Math.sin(a)];
  const n: Point2 = [-Math.sin(a),Math.cos(a)];
  const q = (r: number,s: number): Point2 =>
    [r*u[0] + s*WHEEL_STRUCTURE.spokeHalfWidth*n[0],
     r*u[1] + s*WHEEL_STRUCTURE.spokeHalfWidth*n[1]];
  return [q(0.18,-1),q(1.66,-1),q(1.66,1),q(0.18,1)];
}

export function wheelTooth(i: number): Point2[] {
  const a = i * GRAHAM.pitchDeg * RAD;
  const halfTip = GRAHAM.tipThicknessDeg * RAD / 2;
  // Correct clockwise LEADING edge: tooth tip must lead its root toward
  // lower angular coordinates; the old model leant backwards and wedged.
  // BHI: ~6° undercut of leading flank, 0.5° tip, 12° tooth pitch.
  return [
    polar(GRAHAM.rootRadius, a + 6 * RAD),
    polar(GRAHAM.tipRadius, a - halfTip),
    polar(GRAHAM.tipRadius, a + halfTip),
    polar(GRAHAM.rootRadius, a + 11 * RAD),
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
const phaseRelief = (points: Point2[], side: 'left' | 'right'): Point2[] => {
  const a = (side === 'left' ? -1 : 1) * GRAHAM.palletPhaseReliefDeg * RAD;
  return points.map(([x,y]): Point2 =>
    [x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a)]);
};
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
    return phaseRelief([
      polar(rc - .08, theta - .15 * RAD),
      C,
      polar(rc, theta + .5 * lockDeg * RAD),
      G,
      H,
      polar(rd - .08, theta + (lockDeg + liftDeg + .15) * RAD),
    ], side);
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
  return phaseRelief([
    polar(rf + .08, theta - .15 * RAD),
    F,
    I,
    L,
    polar(re + .08, theta + (liftDeg + lockDeg + .15) * RAD),
  ], side);
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
    palletPhaseReliefDeg: GRAHAM.palletPhaseReliefDeg,
  };
}
