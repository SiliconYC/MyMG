/** Shared manufacture-space geometry for 3D meshes AND rigid contact.
 * One world XY plane is the working plane; Z is purely the extrusion axis.
 * Positive wheel/anchor angles are clockwise when viewed from +Z.
 */
export type Point=readonly [number,number];
export type Side='entry'|'exit';
export const TEETH=30;
export const PITCH=2*Math.PI/TEETH;
export const WHEEL_Y=.60;
export const PIVOT_Y=2.56;
export const WHEEL_ROOT_RADIUS=1.29;
export const WHEEL_TIP_RADIUS=1.55;
export const PENDULUM_LENGTH=6.28;
export const PALLET_LENGTH=.27;
export const FORK_RADIUS=.036;
export const START_AMPLITUDE=.145;
export const WHEEL_PROFILE:ReadonlyArray<readonly [number,number]>=[
  [0,1.29],[.19,1.31],[.34,1.53],[.43,1.55],[.69,1.32],[.93,1.29],
];
export const PALLET_SHOE_POLAR=.035;
export const LOCK_REFERENCE_ANGLE=START_AMPLITUDE*Math.cos(Math.PI*.42);

export const polar=(r:number,a:number):Point=>[r*Math.sin(a),r*Math.cos(a)];
export const rotate=(p:Point,a:number):Point=>[
  p[0]*Math.cos(a)-p[1]*Math.sin(a),
  p[0]*Math.sin(a)+p[1]*Math.cos(a),
];
export const add=(a:Point,b:Point):Point=>[a[0]+b[0],a[1]+b[1]];
export const scale=(p:Point,k:number):Point=>[p[0]*k,p[1]*k];
export const sub=(a:Point,b:Point):Point=>[a[0]-b[0],a[1]-b[1]];
export const len=(a:Point):number=>Math.hypot(...a);
export const unit=(p:Point):Point=>scale(p,1/len(p));
export const dot=(a:Point,b:Point):number=>a[0]*b[0]+a[1]*b[1];
export const worldWheel=(p:Point,angle:number):Point=>
  add(rotate(p,-angle),[0,WHEEL_Y]);
export const worldAnchor=(p:Point,angle:number):Point=>
  add(rotate(p,-angle),[0,PIVOT_Y]);

/** Each convex tooth prism exactly follows the displayed tooth outline. */
export function toothOutline(index:number):Point[]{
  return WHEEL_PROFILE.map(([u,r])=>polar(r,(index+u)*PITCH));
}
/** World polygon at a wheel pose; used directly by the collision solver. */
export function toothWorld(index:number,angle:number):Point[]{
  return toothOutline(index).map(p=>worldWheel(p,angle));
}
function originalFlankPoint(index:number,angle:number):Point{
  const a=polar(WHEEL_TIP_RADIUS,(index+.43)*PITCH+angle);
  const b=polar(1.32,(index+.69)*PITCH+angle);
  return add(scale(a,.60),scale(b,.40));
}
/** Fork shoes are mounted OUTSIDE the wheel rim and point inward. The old
 * shoe bases were inside the wheel's SOLID swept disk, which made the V arms
 * cut across the teeth. Both arms now stay radially outside the teeth.
 *
 * Zero is the anchor pivot. This reference is a physical manufactured part:
 * both shoe outlines and fork bases are time-independent on the anchor.
 */
function makePallet(side:Side):{
  tip:Point;base:Point;outline:Point[];angle:number;
}{
  const entry=side==='entry';
  const i=entry?-4:3;
  const wheelAngle=entry?0:PITCH/2;
  const pendAngle=entry?LOCK_REFERENCE_ANGLE:-LOCK_REFERENCE_ANGLE;
  const ref=originalFlankPoint(i,wheelAngle);
  const radial=unit(ref);
  // A short working nose dips into the swept tooth band; its backside and
  // mounting arm are OUTSIDE the 1.55 wheel tip radius.
  const tipWheel=add(ref,scale(radial,.014));
  // Clear the opposite (idle) tooth arc: the original symmetric wedge
  // intersected tooth #4 at the FIRST frame, freezing the whole mechanism.
  // This axial-free tangential adjustment was selected using two-pose SAT
  // tests including BOTH full fork arm solids, not only their noses.
  const trim:Point=entry?[0,0]:[-.20,.275];
  const localTip=add(
    rotate(sub(add(tipWheel,[0,WHEEL_Y]),[0,PIVOT_Y]),pendAngle),
    trim,
  );
  const tangent:Point=[-radial[1],radial[0]];
  const outLocal=rotate(radial,pendAngle);
  const tanLocal=rotate(tangent,pendAngle);
  const base=add(localTip,scale(outLocal,PALLET_LENGTH));
  const outline=[
    add(localTip,scale(tanLocal,-PALLET_SHOE_POLAR)),
    add(localTip,scale(tanLocal,PALLET_SHOE_POLAR)),
    add(base,scale(tanLocal,.045)),
    add(base,scale(tanLocal,-.045)),
  ];
  return {tip:localTip,base,outline,angle:Math.atan2(outLocal[0],outLocal[1])};
}
const PALLETS={entry:makePallet('entry'),exit:makePallet('exit')};
export const palletTip=(side:Side):Point=>PALLETS[side].tip;
export const palletBase=(side:Side):Point=>PALLETS[side].base;
export const palletOutline=(side:Side):Point[]=>PALLETS[side].outline;
export const palletWorld=(side:Side,angle:number):Point[] =>
  palletOutline(side).map(p=>worldAnchor(p,angle));
export const palletBaseWorld=(side:Side,angle:number):Point=>
  worldAnchor(palletBase(side),angle);
export function forkOutline(side:Side):Point[]{
  const base=palletBase(side),delta=unit(base);
  const t:Point=[-delta[1],delta[0]];
  return [
    scale(t,FORK_RADIUS),
    add(base,scale(t,FORK_RADIUS)),
    add(base,scale(t,-FORK_RADIUS)),
    scale(t,-FORK_RADIUS),
  ];
}
export const forkWorld=(side:Side,angle:number):Point[]=>
  forkOutline(side).map(p=>worldAnchor(p,angle));

/** Mesh profile for continuous disc-free thin escape rim: the centre is
 * removed and six spokes live in an axially separate plane.
 */
export const WHEEL_RIM_INNER_RADIUS=1.265;
/** Only mutually-intended intersections (fork/shoe welds) are allowed. */
export const radialDistanceFromWheel=(p:Point):number=>
  Math.hypot(p[0],p[1]-WHEEL_Y);
