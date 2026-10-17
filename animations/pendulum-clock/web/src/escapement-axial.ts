/** Axial (Z) dimensions of the 3D clock escapement.
 * The wheel teeth and both pallet shoes MUST occupy one machining plane.
 * The static journal must have a real bore and the rotating spindle must
 * pass all the way from the wheel hub through that bearing.
 *
 * The XY contact solver remains unchanged. This module specifically protects
 * the 3D alignment which a two-dimensional solver cannot detect.
 */
export const WHEEL_PLANE_Z = -0.02;
export const WHEEL_THICKNESS = 0.04;
export const PALLET_THICKNESS = 0.09;
export const PALLET_PLANE_Z = WHEEL_PLANE_Z;
export const PALLET_ARM_WELD_Z = -0.08;
/** Two straight, parallel fork rods mounted just behind the thin escape
 * wheel. Their axes never slope. They are close to the wheel in profile but
 * do NOT share its occupied Z volume; each shoe extends axially to mesh.
 * This small 0.06 offset is mechanically necessary: physically solid parts
 * cannot share the same X/Y sweep AND the same occupied Z range.
 */
export const FORK_ARM_PLANE_Z = PALLET_ARM_WELD_Z;
export const FORK_ARM_RADIUS = 0.028;
export const forkZRange = zRange(FORK_ARM_PLANE_Z,FORK_ARM_RADIUS*2);
export const WHEEL_SPINDLE_RADIUS = 0.13;
export const WHEEL_SPINDLE_REAR_Z = -0.55;
export const WHEEL_SPINDLE_FRONT_Z = 0.16;
export const BEARING_CENTER_Z = -0.42;
export const BEARING_DEPTH = 0.22;
export const BEARING_INNER_RADIUS = 0.145;
export const BEARING_OUTER_RADIUS = 0.23;

export const zRange = (centre: number, depth: number): readonly [number,number] =>
  [centre-depth/2,centre+depth/2];

export const wheelZRange = zRange(WHEEL_PLANE_Z,WHEEL_THICKNESS);
export const palletZRange = zRange(PALLET_PLANE_Z,PALLET_THICKNESS);
export const bearingZRange = zRange(BEARING_CENTER_Z,BEARING_DEPTH);
export const spindleZRange:readonly [number,number] =
  [WHEEL_SPINDLE_REAR_Z,WHEEL_SPINDLE_FRONT_Z];

export const zOverlap=(a:readonly [number,number], b:readonly [number,number]):number=>
  Math.max(0,Math.min(a[1],b[1])-Math.max(a[0],b[0]));
