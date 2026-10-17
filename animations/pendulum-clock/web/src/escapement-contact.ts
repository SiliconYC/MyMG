/** Geometry and telemetry projected from the REAL contact solver.
 * There is no independently animated pallet, lock clock or cosmetic proxy.
 */
import type {ClockState} from './clock-model.ts';
import {
  PITCH,PIVOT_Y,WHEEL_Y,TEETH,
  palletTip,palletBase,palletWorld,palletBaseWorld,
  toothWorld,worldAnchor,worldWheel,
  dot,sub,len,type Side,type Point,
} from './escapement-geometry.ts';
export {PITCH,PIVOT_Y,WHEEL_Y,type Side,type Point} from './escapement-geometry.ts';

const segDist=(p:Point,a:Point,b:Point):number=>{
  const d=sub(b,a),v=sub(p,a);
  const sq=dot(d,d);
  const t=sq>1e-10?Math.max(0,Math.min(1,dot(v,d)/sq)):0;
  return len(sub(p,[a[0]+d[0]*t,a[1]+d[1]*t]));
};
function polygonsDistance(a:Point[],b:Point[]):number{
  let best=Infinity;
  for(const [poly,other] of [[a,b],[b,a]] as const){
    for(const p of poly){
      for(let i=0;i<other.length;i++){
        best=Math.min(best,segDist(p,other[i],other[(i+1)%other.length]));
      }
    }
  }
  return best;
}
export function nearestFlank(side:Side,wheelAngle:number){
  const sign=side==='entry'?-1:1;
  // Candidate near the nominal contact sector. Geometry is always checked
  // at the physics pose; no relative timing assumption is used.
  const worldAngle=sign*Math.PI/4;
  const index=Math.round((worldAngle-wheelAngle)/PITCH-.4);
  return {
    toothIndex:index,
    vertices:toothWorld(index,wheelAngle),
  };
}
export const palletLocalTip=(side:Side):Point=>palletTip(side);
export const palletLocalBase=(side:Side):Point=>palletBase(side);
export const palletWorldTip=(side:Side,angle:number):Point=>
  worldAnchor(palletTip(side),angle);
export const palletWorldBase=(side:Side,angle:number):Point=>
  palletBaseWorld(side,angle);
export const palletOrientation=(side:Side):number=>{
  const a=palletTip(side),b=palletBase(side);
  return Math.atan2(b[0]-a[0],b[1]-a[1]);
};
export type PalletPose={
  side:Side;tip:Point;mounting:Point;gap:number;
  toothIndex:number;engaged:boolean;flankStart:Point;flankEnd:Point;
};
/** Nearest distance to an actual visible wheel tooth polygon. */
export function contactDistance(side:Side,state:ClockState):number{
  const shoe=palletWorld(side,state.pendulumAngle);
  const center=shoe.reduce((acc,p)=>[acc[0]+p[0]/shoe.length,acc[1]+p[1]/shoe.length] as Point,[0,0] as Point);
  const a=Math.atan2(center[0],center[1]-WHEEL_Y);
  const guess=Math.round((a-state.wheelAngle)/PITCH-.4);
  let distance=Infinity;
  for(let i=guess-3;i<=guess+3;i++){
    distance=Math.min(distance,polygonsDistance(shoe,toothWorld(i,state.wheelAngle)));
  }
  return distance;
}
export function palletPose(side:Side,state:ClockState):PalletPose{
  const f=nearestFlank(side,state.wheelAngle);
  return {
    side,tip:palletWorldTip(side,state.pendulumAngle),
    mounting:palletWorldBase(side,state.pendulumAngle),
    toothIndex:f.toothIndex,
    engaged:state.contactCount>0&&state.lock===side,
    gap:contactDistance(side,state),
    flankStart:f.vertices[3],
    flankEnd:f.vertices[4],
  };
}
