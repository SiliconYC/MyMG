/** Shared manufacture-space geometry for 3D meshes AND rigid contact.
 * One world XY plane is the working plane; Z is purely the extrusion axis.
 * Positive wheel/anchor angles are clockwise when viewed from +Z.
 */
import {FORK_ARM_RADIUS} from './escapement-axial.ts';
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
export const FORK_RADIUS=FORK_ARM_RADIUS;
export const START_AMPLITUDE=.145;
export const WHEEL_PROFILE:ReadonlyArray<readonly [number,number]>=[
  [0,1.29],[.19,1.31],[.34,1.53],[.43,1.55],[.69,1.32],[.93,1.29],
];
export const PALLET_ARC_BAND=.045;
export const PALLET_LOCK_SWEEP=.045;
export const PALLET_SEGMENTS=7;
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
/** A genuine deadbeat locking face is a short circular ARC about the
 * anchor pivot. A tooth may HOLD the driven wheel without blocking free
 * pendulum rotation; at the arc's END it releases, and the opposite tooth
 * collides with the other shoe. A straight radial shoe wedges and jams.
 *
 * Both face and radius/bounds are manufactured in anchor-local coordinates
 * and are shared by contact quads and the visible continuous 3D solid.
 */
const anchorPolar=(radius:number,phi:number):Point=>
  [radius*Math.sin(phi),-radius*Math.cos(phi)];
function makeDeadbeat(side:Side){
  const entry=side==='entry';
  const index=entry?-4:3;
  const initialWheel=entry?0:PITCH/2;
  const vertices=toothWorld(index,initialWheel);
  // Lock against the NEAREST wheel-to-pivot perimeter, not a point halfway
  // along the tooth flank. The latter put the shoe 0.10-0.15 units INSIDE
  // the solid tooth body and made a physical release impossible.
  const closest=vertices.reduce((a,b)=>len(sub(a,[0,PIVOT_Y]))<
    len(sub(b,[0,PIVOT_Y]))?a:b);
  const p=sub(closest,[0,PIVOT_Y]);
  const rootRadius=len(p);
  const rootAngle=Math.atan2(p[0],-p[1]);
  // Calibrated to real polygon swept-volume collisions: at the beginning
  // of a lock the wheel can turn into the arc but it cannot start inside
  // adjacent tooth material; the next 0.05 rad of fork movement clears it.
  const radius=rootRadius+(entry?.005:-.005);
  const phi=rootAngle+(entry?-.005:.01);
  const lo=phi+(entry?START_AMPLITUDE-PALLET_LOCK_SWEEP:
    -START_AMPLITUDE-.005);
  const hi=phi+(entry?START_AMPLITUDE+.005:
    -START_AMPLITUDE+PALLET_LOCK_SWEEP);
  return {radius,phi,lo,hi};
}
const DEADBEAT={entry:makeDeadbeat('entry'),exit:makeDeadbeat('exit')};
export const palletArcSpec=(side:Side)=>DEADBEAT[side];
export const palletTip=(side:Side):Point=>{
  const s=DEADBEAT[side];
  return anchorPolar(s.radius,side==='entry'?s.lo:s.hi);
};
export const palletBase=(side:Side):Point=>{
  const s=DEADBEAT[side];
  return anchorPolar(s.radius-PALLET_ARC_BAND-.018,(s.lo+s.hi)/2);
};
export function palletOutline(side:Side):Point[]{
  const s=DEADBEAT[side];
  const outline:Point[]=[];
  for(let i=0;i<=PALLET_SEGMENTS;i++){
    outline.push(anchorPolar(s.radius,s.lo+(s.hi-s.lo)*i/PALLET_SEGMENTS));
  }
  for(let i=PALLET_SEGMENTS;i>=0;i--){
    outline.push(anchorPolar(s.radius-PALLET_ARC_BAND,
      s.lo+(s.hi-s.lo)*i/PALLET_SEGMENTS));
  }
  return outline;
}
/** Convex planar collision strips exactly tessellate the rendered arc. */
export function palletPieces(side:Side):Point[][]{
  const s=DEADBEAT[side];
  return Array.from({length:PALLET_SEGMENTS},(_,i)=>{
    const lo=s.lo+(s.hi-s.lo)*i/PALLET_SEGMENTS;
    const hi=s.lo+(s.hi-s.lo)*(i+1)/PALLET_SEGMENTS;
    return [
      anchorPolar(s.radius,lo),anchorPolar(s.radius,hi),
      anchorPolar(s.radius-PALLET_ARC_BAND,hi),
      anchorPolar(s.radius-PALLET_ARC_BAND,lo),
    ];
  });
}
export const palletWorld=(side:Side,angle:number):Point[] =>
  palletOutline(side).map(p=>worldAnchor(p,angle));
export const palletCollisionWorld=(side:Side,angle:number):Point[][] =>
  palletPieces(side).map(piece=>piece.map(p=>worldAnchor(p,angle)));
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
