/** Shared, dimensioned 2D geometry for the real wheel mesh and contact solver.
 * Coordinates: wheel centre (0,WHEEL_Y), anchor spindle (0,PIVOT_Y).
 * Angles increase clockwise from 12 o'clock. All working teeth are the
 * actual tips of the rendered polygon, not invisible proxy pins.
 */
export type Point=readonly [number,number];
export type Side='entry'|'exit';
export const TEETH=30;
export const PITCH=2*Math.PI/TEETH;
export const HALF_PITCH=PITCH/2;
export const TIP_FRACTION=.25;
export const WHEEL_TIP_RADIUS=1.54;
export const WHEEL_ROOT_RADIUS=1.10;
export const WHEEL_Y=.60;
export const PIVOT_Y=2.56;
export const CENTER_DISTANCE=PIVOT_Y-WHEEL_Y;
/** The 30-tooth wheel is stopped by opposite tooth tips at -45° and +45°. */
export const LOCK_TOOTH_ANGLE=Math.PI/4;
export const LOCK_RADIUS=Math.hypot(
  WHEEL_TIP_RADIUS*Math.sin(LOCK_TOOTH_ANGLE),
  CENTER_DISTANCE-WHEEL_TIP_RADIUS*Math.cos(LOCK_TOOTH_ANGLE),
);
export const LOCK_POLAR=Math.atan2(
  WHEEL_TIP_RADIUS*Math.sin(LOCK_TOOTH_ANGLE),
  CENTER_DISTANCE-WHEEL_TIP_RADIUS*Math.cos(LOCK_TOOTH_ANGLE),
);
/** Each locking face is an arc CONCENTRIC WITH THE ANCHOR AXLE.
 * Its sweep supplies a geometric release condition, not a timer.
 * The .034 rad run-out is the anchor rotation at each unlock.
 */
export const RELEASE_ANGLE=.034;
export const LOCK_SWEEP=.15;
export const PALLET_BAND=.020;
export const PALLET_RANGES={
  entry:[-LOCK_POLAR+RELEASE_ANGLE,-LOCK_POLAR+LOCK_SWEEP],
  exit:[ LOCK_POLAR-LOCK_SWEEP, LOCK_POLAR-RELEASE_ANGLE],
} as const satisfies Record<Side,readonly [number,number]>;
export const polar=(radius:number,angle:number):Point=>[
  radius*Math.sin(angle),radius*Math.cos(angle),
];
export const anchorPolar=(radius:number,angle:number):Point=>[
  radius*Math.sin(angle),-radius*Math.cos(angle),
];
export const rotate=(p:Point,angle:number):Point=>[
  p[0]*Math.cos(angle)-p[1]*Math.sin(angle),
  p[0]*Math.sin(angle)+p[1]*Math.cos(angle),
];
export const wheelTip=(toothIndex:number,wheelAngle:number):Point=>{
  const p=polar(WHEEL_TIP_RADIUS,(toothIndex+TIP_FRACTION)*PITCH+wheelAngle);
  return [p[0],p[1]+WHEEL_Y];
};
/** Tooth indices for parked positions of the two alternating faces. */
export const lockedToothIndex=(side:Side,beat:number):number=>
  side==='entry'?-4-Math.floor(beat/2):3-Math.floor(beat/2);
export const lockedSide=(beat:number):Side=>beat%2===0?'entry':'exit';
/** Angle of a tooth tip in the shaft's LOCAL coordinate system. */
export const localTipPolar=(side:Side,pendulumAngle:number):number=>
  (side==='entry'?-LOCK_POLAR:LOCK_POLAR)+pendulumAngle;
export const faceContains=(side:Side,pendulumAngle:number):boolean=>{
  const a=localTipPolar(side,pendulumAngle);
  const [lo,hi]=PALLET_RANGES[side];
  return a>=lo && a<=hi;
};
/** The tip profile below is also consumed by the THREE.ExtrudeGeometry mesh. */
/** Swept-back asymmetric escape teeth. The two root shoulders trail
 * the point, leaving room for the opposite locking shoe to clear.
 */
export const WHEEL_PROFILE:ReadonlyArray<readonly [number,number]>=[
  [0,WHEEL_ROOT_RADIUS],[.25,WHEEL_TIP_RADIUS],
  [.03,WHEEL_ROOT_RADIUS],[.999,WHEEL_ROOT_RADIUS],
];
