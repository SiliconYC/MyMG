/** Analytic tooth-tip ↔ concentric pallet contact for the rendered 3D parts.
 * No hard-coded contact gap and no teleporting tooth/pallet proxies.
 * Both profiles use exactly the same constants as the physics integrator.
 */
import type {ClockState} from './clock-model.ts';
import {PITCH, TIP_FRACTION, WHEEL_Y, PIVOT_Y, LOCK_RADIUS,
  PALLET_BAND, PALLET_RANGES, LOCK_TOOTH_ANGLE,
  WHEEL_TIP_RADIUS, wheelTip, anchorPolar, rotate, faceContains,
  type Side, type Point} from './escapement-geometry.ts';
export {PITCH,PIVOT_Y,WHEEL_Y,type Side,type Point}
  from './escapement-geometry.ts';

const lerp=(a:number,b:number,t:number):number=>a+(b-a)*t;
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
/** Lock arc and the back face form one solid machined shoe per side.
 * Entry material is INSIDE its locking arc; exit material is OUTSIDE.
 * A short beveled arrival edge is the physical impulse land.
 */
export function palletOutline(side:Side):Point[]{
  const [lo,hi]=PALLET_RANGES[side];
  const n=20;
  const points:Point[]=[];
  for(let i=0;i<=n;i++) points.push(anchorPolar(LOCK_RADIUS,lerp(lo,hi,i/n)));
  const backRadius=LOCK_RADIUS+(side==='entry'?-PALLET_BAND:PALLET_BAND);
  // Follow the back of the same finite arc in reverse: no self-intersection.
  // The two free ends are the short inclined impulse edges.
  for(let i=0;i<=n;i++)points.push(anchorPolar(backRadius,lerp(hi,lo,i/n)));
  return points;
}
/** Weld arm to the broad rear edge; never to a sharp tooth-catching nose. */
export function palletLocalBase(side:Side):Point{
  const [lo,hi]=PALLET_RANGES[side];
  const middle=(lo+hi)/2;
  const backRadius=LOCK_RADIUS+(side==='entry'?-PALLET_BAND:PALLET_BAND);
  return anchorPolar(backRadius,middle);
}
export function palletLocalTip(side:Side):Point{
  const [lo,hi]=PALLET_RANGES[side];
  return anchorPolar(LOCK_RADIUS,side==='entry'?lo:hi);
}
export function palletWorldBase(side:Side,angle:number):Point{
  const p=rotate(palletLocalBase(side),-angle);
  return [p[0],p[1]+PIVOT_Y];
}
export function palletWorldTip(side:Side,angle:number):Point{
  const p=rotate(palletLocalTip(side),-angle);
  return [p[0],p[1]+PIVOT_Y];
}
export function workingToothIndex(side:Side,angle:number):number{
  const target=side==='entry'?-LOCK_TOOTH_ANGLE:LOCK_TOOTH_ANGLE;
  // A wheel advances CLOCKWISE, so select the approaching tooth from below.
  return Math.floor((target-angle)/PITCH-TIP_FRACTION+1e-8);
}
export function workingTooth(side:Side,wheelAngle:number):Point{
  return wheelTip(workingToothIndex(side,wheelAngle),wheelAngle);
}
export function palletFaceWorld(side:Side,t:number,angle:number):Point{
  const [lo,hi]=PALLET_RANGES[side];
  const p=rotate(anchorPolar(LOCK_RADIUS,lerp(lo,hi,t)),-angle);
  return [p[0],p[1]+PIVOT_Y];
}
/** Euclidean distance from an ACTUAL tooth tip to the finite working arc.
 * Returns zero for a geometrically seated tooth (no cosmetic 0.006 gap).
 */
export function contactDistance(side:Side,state:ClockState):number{
  const tooth=workingTooth(side,state.wheelAngle);
  const local=rotate([tooth[0],tooth[1]-PIVOT_Y],state.pendulumAngle);
  const r=Math.hypot(local[0],local[1]);
  const phi=Math.atan2(local[0],-local[1]);
  const [lo,hi]=PALLET_RANGES[side];
  const q=anchorPolar(LOCK_RADIUS,clamp(phi,lo,hi));
  return Math.hypot(local[0]-q[0],local[1]-q[1]);
}
export type PalletPose={
  side:Side;tip:Point;mounting:Point;tooth:Point;gap:number;
  toothIndex:number;engaged:boolean;faceStart:Point;faceEnd:Point;
};
export function palletPose(side:Side,state:ClockState):PalletPose{
  const index=workingToothIndex(side,state.wheelAngle);
  return {
    side,tip:palletWorldTip(side,state.pendulumAngle),
    mounting:palletWorldBase(side,state.pendulumAngle),
    tooth:workingTooth(side,state.wheelAngle),
    toothIndex:index,gap:contactDistance(side,state),
    engaged:!state.releasing&&side===state.lock&&faceContains(side,state.pendulumAngle),
    faceStart:palletFaceWorld(side,0,state.pendulumAngle),
    faceEnd:palletFaceWorld(side,1,state.pendulumAngle),
  };
}
