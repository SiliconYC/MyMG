/** Shared geometric audit for the physically coupled recoil anchor. */
import type {ClockState} from './clock-model.ts';
import {FACES,anchorLocalOutline,anchorOutline,palletOutline,wheelOutline,
  anchorWorld,WHEEL_Y,PIVOT_Y,PITCH,OUTER_RADIUS,ROOT_RADIUS,WHEEL_PROFILE,
  sub,type Point,type Side} from './recoil-geometry.ts';
export {FACES,anchorLocalOutline,anchorOutline,palletOutline,wheelOutline,
  WHEEL_Y,PIVOT_Y,PITCH,OUTER_RADIUS,ROOT_RADIUS,WHEEL_PROFILE};
export type {Point,Side};
const cross=(a:Point,b:Point)=>a[0]*b[1]-a[1]*b[0];
function segmentDistance(p:Point,a:Point,b:Point):number{
  const d=sub(b,a),v=sub(p,a),ll=d[0]*d[0]+d[1]*d[1];
  const t=ll>0?Math.max(0,Math.min(1,
    (v[0]*d[0]+v[1]*d[1])/ll)):0;
  return Math.hypot(v[0]-t*d[0],v[1]-t*d[1]);
}
function inside(p:Point,polygon:readonly Point[]):boolean{
  let result=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
    const a=polygon[i],b=polygon[j];
    if((a[1]>p[1])!==(b[1]>p[1])&&
      p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])result=!result;
  }
  return result;
}
/** An overlap must have interior width: a floating-point touch is not
 * penetration. Edge intervals also catch crossing bars with no inside vertex.
 */
export function polygonInterference(a:readonly Point[],b:readonly Point[],tolerance=1e-7):boolean{
  const deep=(p:Point,polygon:readonly Point[]):boolean=>{
    if(!inside(p,polygon))return false;
    for(let j=0;j<polygon.length;j++)
      if(segmentDistance(p,polygon[j],polygon[(j+1)%polygon.length])<=tolerance)return false;
    return true;
  };
  for(const [poly,other] of [[a,b],[b,a]] as const){
    for(let i=0;i<poly.length;i++){
      const p=poly[i],q=poly[(i+1)%poly.length];
      if(deep(p,other))return true;
      const ts=[0,1],ab=sub(q,p);
      for(let j=0;j<other.length;j++){
        const c=other[j],d=other[(j+1)%other.length],cd=sub(d,c),den=cross(ab,cd);
        if(Math.abs(den)<1e-14)continue;
        const t=cross(sub(c,p),cd)/den,u=cross(sub(c,p),ab)/den;
        if(t>0&&t<1&&u>=0&&u<=1)ts.push(t);
      }
      if(ts.length>2){
        ts.sort((x,y)=>x-y);
        for(let j=1;j<ts.length;j++){
          const t=(ts[j-1]+ts[j])/2;
          if(deep([p[0]+ab[0]*t,p[1]+ab[1]*t],other))return true;
        }
      }
    }
  }
  return false;
}
export function polygonClearance(a:readonly Point[],b:readonly Point[]):number{
  if(polygonInterference(a,b))return 0;
  let result=Infinity;
  for(const [vertices,edges] of [[a,b],[b,a]] as const){
    for(const p of vertices){
      for(let j=0;j<edges.length;j++){
        result=Math.min(result,segmentDistance(p,edges[j],
          edges[(j+1)%edges.length]));
      }
    }
  }
  return result;
}

export function anchorWheelInterference(state:ClockState):boolean{
  return polygonInterference(anchorOutline(state.pendulumAngle),wheelOutline(state.wheelAngle));
}
export function anchorWheelClearance(state:ClockState):number{
  return polygonClearance(anchorOutline(state.pendulumAngle),wheelOutline(state.wheelAngle));
}
export function contactDistance(side:Side,state:ClockState):number{
  return polygonClearance(palletOutline(side,state.pendulumAngle),wheelOutline(state.wheelAngle));
}
export function palletPose(side:Side,state:ClockState){
  return {side,engaged:state.contact===side,gap:contactDistance(side,state),
    tip:anchorWorld(FACES[side].toe,state.pendulumAngle),
    mounting:anchorWorld(FACES[side].heel,state.pendulumAngle),toothIndex:state.tooth};
}
