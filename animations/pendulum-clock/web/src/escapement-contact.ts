/** Dimensioned 2D construction for the clock's RECOIL ANCHOR silhouette.
 * The animation's angular timeline is still prescribed kinematics; these
 * manufactured XY polygons are shared by the 3D meshes and collision audit.
 * Inspired by Chetvorno's CC0 anchor escapement animation (Wikimedia Commons).
 */
import {TEETH,PENDULUM_AMPLITUDE,type ClockState} from './clock-model.ts';

export type Side='entry'|'exit';
export type Point=readonly [number,number];
export const WHEEL_Y=.6;
export const WHEEL_SCALE=.60;
export const OUTER_RADIUS=1.55*WHEEL_SCALE;
export const ROOT_RADIUS=1.20*WHEEL_SCALE;
/** Traditional anchor drawings place the fork axis ~1.4 wheel radii above O. */
export const PIVOT_Y=WHEEL_Y+1.4*OUTER_RADIUS;
export const PITCH=2*Math.PI/TEETH;
export const PALLET_CLEARANCE=.012;
export const PALLET_BASE_HEIGHT=.19;

/** Each sector is measured about the common ANCHOR AXLE, NOT the wheel axle.
 * Different entry/exit dimensions are intentional; mirror-copying the shoe
 * geometry hides the different entry and exit impulse/locking faces.
 * radii, sweep and roots are all in clock world units / radians.
 */
export type PalletSector=Readonly<{
  side:Side; centerAngle:number; halfSweep:number;
  innerRadius:number; outerRadius:number; samples:number;
}>;
export const ENTRY_PALLET_DEF:PalletSector={
  side:'entry',centerAngle:-127*Math.PI/180,halfSweep:.11,
  innerRadius:.572,outerRadius:.762,samples:18,
};
export const EXIT_PALLET_DEF:PalletSector={
  side:'exit',centerAngle:133.5*Math.PI/180,halfSweep:.105,
  innerRadius:.395,outerRadius:.575,samples:18,
};
export const palletDefinition=(side:Side):PalletSector=>
  side==='entry'?ENTRY_PALLET_DEF:EXIT_PALLET_DEF;

/** Polar convention matches the original wheel tooth design: 0 is +Y. */
const polar=(r:number,a:number):Point=>[r*Math.sin(a),r*Math.cos(a)];
const rotate=(p:Point,a:number):Point=>[
  p[0]*Math.cos(a)-p[1]*Math.sin(a),
  p[0]*Math.sin(a)+p[1]*Math.cos(a),
];
const sub=(a:Point,b:Point):Point=>[a[0]-b[0],a[1]-b[1]];
const cross=(a:Point,b:Point):number=>a[0]*b[1]-a[1]*b[0];

/** The wheel solid has one single physical polygon, rather than extra
 * glowing tooth overlays. Both renderer and collision checks use this data.
 */
export const WHEEL_PROFILE:readonly Point[]=[
  [0,ROOT_RADIUS-.02],[.19,ROOT_RADIUS],[.34,1.53*WHEEL_SCALE],
  [.43,OUTER_RADIUS],[.69,ROOT_RADIUS],[.93,ROOT_RADIUS-.02],
];
export function wheelOutline(wheelAngle:number):Point[]{
  return Array.from({length:TEETH},(_,k)=>
    WHEEL_PROFILE.map(([phase,r]):Point=>
      polar(r,k*PITCH+wheelAngle+phase*PITCH)))
    .flat().map(([x,y]):Point=>[x,y+WHEEL_Y]);
}

/** 2D ruler-and-compass construction: two concentric arcs about the anchor
 * pivot joined by short radial ends, yielding a genuine annular FAN.
 * Not a triangular tooth, not a visual-only object, not mirrored geometry.
 */
export function palletLocalOutline(side:Side):Point[]{
  const p=palletDefinition(side);
  const samples=Array.from({length:p.samples+1},(_,i)=>
    p.centerAngle-p.halfSweep+2*p.halfSweep*i/p.samples);
  return [
    ...samples.map(a=>polar(p.outerRadius,a)),
    ...samples.reverse().map(a=>polar(p.innerRadius,a)),
  ];
}
export function palletOutline(side:Side,pendulumAngle:number):Point[]{
  return palletLocalOutline(side).map(p=>{
    const q=rotate(p,-pendulumAngle);
    return [q[0],q[1]+PIVOT_Y];
  });
}
/** Welding land is embedded in the sector root rather than its contact tip. */
export function palletLocalBase(side:Side):Point{
  const p=palletDefinition(side);
  return polar(p.innerRadius+.018,p.centerAngle);
}
export function palletLocalTip(side:Side):Point{
  const p=palletDefinition(side);
  return polar(p.outerRadius,p.centerAngle);
}
export function palletOrientation(side:Side):number{
  return palletDefinition(side).centerAngle;
}
export function palletWorldBase(side:Side,angle:number):Point{
  const q=rotate(palletLocalBase(side),-angle);
  return [q[0],q[1]+PIVOT_Y];
}
export function palletWorldTip(side:Side,angle:number):Point{
  const q=rotate(palletLocalTip(side),-angle);
  return [q[0],q[1]+PIVOT_Y];
}
export type Flank={
  toothIndex:number; start:Point;end:Point;point:Point;
  outwardNormal:Point;radial:Point;angle:number;
};
export function flankAt(toothIndex:number,wheelAngle:number):Flank{
  const base=toothIndex*PITCH+wheelAngle;
  const start=polar(OUTER_RADIUS,base+.43*PITCH);
  const end=polar(ROOT_RADIUS,base+.69*PITCH);
  const point:Point=[start[0]*.6+end[0]*.4,start[1]*.6+end[1]*.4];
  const d=sub(end,start);
  const length=Math.hypot(...d);
  let outwardNormal:Point=[-d[1]/length,d[0]/length];
  const r=Math.hypot(...point);
  const radial:Point=[point[0]/r,point[1]/r];
  if(outwardNormal[0]*radial[0]+outwardNormal[1]*radial[1]<0)
    outwardNormal=[-outwardNormal[0],-outwardNormal[1]];
  return {toothIndex,start,end,point,outwardNormal,radial,
    angle:Math.atan2(point[0],point[1])};
}
export function nearestFlank(side:Side,wheelAngle:number):Flank{
  const index=(side==='entry'?-4:3)+Math.round(
    ((side==='entry'?0:PITCH/2)-wheelAngle)/PITCH);
  return flankAt(index,wheelAngle);
}

function segmentDistance(p:Point,a:Point,b:Point):number{
  const d=sub(b,a),v=sub(p,a),ll=d[0]*d[0]+d[1]*d[1];
  const t=ll>0?Math.max(0,Math.min(1,
    (v[0]*d[0]+v[1]*d[1])/ll)):0;
  return Math.hypot(v[0]-t*d[0],v[1]-t*d[1]);
}
function properCross(a:Point,b:Point,c:Point,d:Point):boolean{
  const ab=sub(b,a),cd=sub(d,c),den=cross(ab,cd);
  if(Math.abs(den)<1e-12)return false;
  const t=cross(sub(c,a),cd)/den,u=cross(sub(c,a),ab)/den;
  return t>1e-9&&t<1-1e-9&&u>1e-9&&u<1-1e-9;
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
export function polygonInterference(a:readonly Point[],b:readonly Point[]):boolean{
  for(let i=0;i<a.length;i++){
    for(let j=0;j<b.length;j++){
      if(properCross(a[i],a[(i+1)%a.length],
        b[j],b[(j+1)%b.length]))return true;
    }
  }
  return inside(a[0],b)||inside(b[0],a);
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
/** Swept solids, NOT a fake tooth-tip contact point. */
export function palletWheelInterference(side:Side,state:ClockState):boolean{
  return polygonInterference(palletOutline(side,state.pendulumAngle),
    wheelOutline(state.wheelAngle));
}
export function contactDistance(side:Side,state:ClockState):number{
  return polygonClearance(palletOutline(side,state.pendulumAngle),
    wheelOutline(state.wheelAngle));
}
export function forkWheelClearance(side:Side,state:ClockState):number{
  const wheel=wheelOutline(state.wheelAngle);
  const root:Point=[0,PIVOT_Y];
  const base=palletWorldBase(side,state.pendulumAngle);
  let best=Infinity;
  for(let i=0;i<wheel.length;i++){
    const a=wheel[i],b=wheel[(i+1)%wheel.length];
    if(properCross(root,base,a,b))return 0;
    best=Math.min(best,
      segmentDistance(a,root,base),segmentDistance(b,root,base),
      segmentDistance(root,a,b),segmentDistance(base,a,b));
  }
  return best;
}
export type PalletPose={
  side:Side; tip:Point;mounting:Point;nominalTooth:Point;gap:number;
  toothIndex:number;radialAngle:number;engaged:boolean;
  flankStart:Point;flankEnd:Point;
};
export function palletPose(side:Side,state:ClockState):PalletPose{
  const f=nearestFlank(side,state.wheelAngle);
  const world=(p:Point):Point=>[p[0],p[1]+WHEEL_Y];
  const start=state.releaseProgress;
  const engaged=state.releasing
    ?(side===state.lock?start>.85:start<.15)
    :side===state.lock;
  return {
    side,tip:palletWorldTip(side,state.pendulumAngle),
    mounting:palletWorldBase(side,state.pendulumAngle),
    nominalTooth:world(f.point),gap:contactDistance(side,state),
    toothIndex:f.toothIndex,radialAngle:f.angle,engaged,
    flankStart:world(f.start),flankEnd:world(f.end),
  };
}
