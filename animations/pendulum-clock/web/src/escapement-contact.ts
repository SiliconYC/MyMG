/** One rigid anchor + pendulum, with tooth-flank geometry on a separate
 * intermittent escape wheel. No pallet moves independently of the pendulum.
 * Contact is a point/line educational approximation, not dynamics simulation.
 */
import {TEETH, PENDULUM_AMPLITUDE, RELEASE_OFFSET,
  type ClockState} from './clock-model.ts';

export type Side='entry'|'exit';
export type Point=readonly [number,number];
export const WHEEL_Y=0.6;
/** Scale the escapement, NOT the dial or the seconds pendulum. */
export const WHEEL_SCALE=0.60;
export const PIVOT_Y=WHEEL_Y+(2.56-WHEEL_Y)*WHEEL_SCALE;
export const PITCH=2*Math.PI/TEETH;
export const PALLET_CLEARANCE=0.006;
/** Conservatively clears the whole moving shoe, not just its nominal nose. */
export const PALLET_RADIAL_SETBACK=0.115;
export const OUTER_RADIUS=1.55*WHEEL_SCALE;
/** Give the pallet sweep clearance at the inner tooth roots. */
export const ROOT_RADIUS=1.20*WHEEL_SCALE;
const FLANK_FROM=.43;
const FLANK_TO=.69;
/** Shift working faces closer to the tooth shoulder: the opposing tip has clearance. */
const FLANK_T=.40;
const CONTACT_ANGLE=PENDULUM_AMPLITUDE*Math.cos(Math.PI*RELEASE_OFFSET);

const polar=(r:number,a:number):Point=>[r*Math.sin(a),r*Math.cos(a)];
const blend=(a:Point,b:Point,t:number):Point=>[
  a[0]*(1-t)+b[0]*t,a[1]*(1-t)+b[1]*t,
];
const length=(a:Point):number=>Math.hypot(a[0],a[1]);
const unit=(a:Point):Point=>[a[0]/length(a),a[1]/length(a)];
const rotate=(a:Point,rad:number):Point=>[
  a[0]*Math.cos(rad)-a[1]*Math.sin(rad),
  a[0]*Math.sin(rad)+a[1]*Math.cos(rad),
];

export type Flank={
  toothIndex:number;start:Point;end:Point;point:Point;
  outwardNormal:Point;radial:Point;angle:number;
};

/** Exactly the same flank vertices as the real Three.js wheel mesh. */
export function flankAt(toothIndex:number,wheelAngle:number):Flank {
  const base=toothIndex*PITCH+wheelAngle;
  const start=polar(OUTER_RADIUS,base+FLANK_FROM*PITCH);
  const end=polar(ROOT_RADIUS,base+FLANK_TO*PITCH);
  const point=blend(start,end,FLANK_T);
  const delta:Point=[end[0]-start[0],end[1]-start[1]];
  const candidate=unit([-delta[1],delta[0]]);
  const radial=unit(point);
  const dot=candidate[0]*radial[0]+candidate[1]*radial[1];
  const outwardNormal:Point=dot>0?candidate:[-candidate[0],-candidate[1]];
  return {toothIndex,start,end,point,outwardNormal,radial,
    angle:Math.atan2(point[0],point[1])};
}
const REFERENCE={
  entry:flankAt(-4,0),
  exit:flankAt(3,PITCH/2),
} as const;

/** Starting tooth index changes as the wheel advances; the fork does not. */
export function nearestFlank(side:Side,wheelAngle:number):Flank {
  const toothIndex=(side==='entry'?-4:3)+Math.round(
    ((side==='entry'?0:PITCH/2)-wheelAngle)/PITCH);
  return flankAt(toothIndex,wheelAngle);
}

/** Local coordinate fixed on the pendulum shaft, calibrated at a release angle.
 * Both wedges live permanently in the same rotating parent group as pendulum.
 */
export function palletLocalTip(side:Side):Point {
  const f=REFERENCE[side],angle=side==='entry'?CONTACT_ANGLE:-CONTACT_ANGLE;
  const near:Point=[
    f.point[0]+f.outwardNormal[0]*PALLET_CLEARANCE,
    WHEEL_Y+f.point[1]+f.outwardNormal[1]*PALLET_CLEARANCE,
  ];
  // A nose calibrated on the flank itself intersects nearby teeth during
  // the scripted half-pitch release. Move the entire rigid shoe outward,
  // rather than letting its tip and the visible solid occupy the same space.
  const outward=unit([near[0],near[1]-WHEEL_Y]);
  const target:Point=[
    near[0]+outward[0]*PALLET_RADIAL_SETBACK,
    near[1]+outward[1]*PALLET_RADIAL_SETBACK,
  ];
  return rotate([target[0],target[1]-PIVOT_Y],angle);
}
/** Pallet meshes run from the tooth-contact nose to a transverse weld base. */
/** The shoe is a short transverse bar, NOT a continuation of its arm.
 * Solve b·(b-tip)=0: shoe axis (b-tip) is precisely 90° to the
 * fork from the common anchor axle to its mounting point b.
 * The outward-hand solution keeps the welded shoe base outside the wheel.
 */
export const PALLET_BASE_HEIGHT=.28;
export function palletLocalBase(side:Side):Point {
  const tip=palletLocalTip(side);
  const radius=length(tip);
  const ratio=PALLET_BASE_HEIGHT/radius;
  const outward=side==='entry'?-1:1;
  const tangential:Point=[-tip[1]/radius,tip[0]/radius];
  const baseRadial=1-ratio*ratio;
  const baseTangential=outward*PALLET_BASE_HEIGHT*Math.sqrt(baseRadial);
  return [
    tip[0]*baseRadial+tangential[0]*baseTangential,
    tip[1]*baseRadial+tangential[1]*baseTangential,
  ];
}
export function palletOrientation(side:Side):number {
  const tip=palletLocalTip(side),base=palletLocalBase(side);
  return Math.atan2(tip[0]-base[0],base[1]-tip[1]);
}
export function palletWorldBase(side:Side,pendulumAngle:number):Point {
  const base=rotate(palletLocalBase(side),-pendulumAngle);
  return [base[0],base[1]+PIVOT_Y];
}

export function palletWorldTip(side:Side,pendulumAngle:number):Point {
  const swung=rotate(palletLocalTip(side),-pendulumAngle);
  return [swung[0],swung[1]+PIVOT_Y];
}

export type PalletPose={
  side:Side;tip:Point;mounting:Point;nominalTooth:Point;gap:number;
  toothIndex:number;radialAngle:number;engaged:boolean;
  flankStart:Point;flankEnd:Point;
};

/** Every field for highlighting and QA comes from the same rigid shaft. */
export function palletPose(side:Side,state:ClockState):PalletPose {
  const currentTooth=nearestFlank(side,state.wheelAngle);
  const tip=palletWorldTip(side,state.pendulumAngle);
  const start=state.releaseProgress;
  const engaged=state.releasing
    ? (side===state.lock?start>.85:start<.15)
    : side===state.lock;
  const world=(p:Point):Point=>[p[0],p[1]+WHEEL_Y];
  const base=palletWorldBase(side,state.pendulumAngle);
  return {
    side,tip,mounting:base,
    nominalTooth:world(currentTooth.point),
    gap:contactDistance(side,state),
    toothIndex:currentTooth.toothIndex,
    radialAngle:REFERENCE[side].angle,
    engaged,flankStart:world(currentTooth.start),
    flankEnd:world(currentTooth.end),
  };
}

/** Shortest honest distance from a rigidly moving wedge tip to tooth FLANK.
 * Unlike the old model this value is not artificially kept at 0.006.
 */
export function contactDistance(side:Side,state:ClockState):number {
  const f=nearestFlank(side,state.wheelAngle);
  const tip=palletWorldTip(side,state.pendulumAngle);
  const ax=f.start[0],ay=f.start[1]+WHEEL_Y;
  const dx=f.end[0]-f.start[0],dy=f.end[1]-f.start[1];
  const u=Math.max(0,Math.min(1,
    ((tip[0]-ax)*dx+(tip[1]-ay)*dy)/(dx*dx+dy*dy)));
  return Math.hypot(tip[0]-ax-u*dx,tip[1]-ay-u*dy);
}

/** Manufacturing-space XY silhouettes. Shared by rendering and the sweep audit.
 * The test treats the escape wheel as a solid outer polygon (conservative even
 * though the center bore is empty), checking the COMPLETE shoe rather than a
 * single moving point. Three.js bevel lips are budgeted by the setback above.
 */
export const WHEEL_PROFILE:readonly (readonly [number,number])[]=[
  [0,ROOT_RADIUS-.02],[.19,ROOT_RADIUS],[.34,1.53*WHEEL_SCALE],
  [.43,OUTER_RADIUS],[.69,ROOT_RADIUS],[.93,ROOT_RADIUS-.02],
];
export const PALLET_PROFILE:readonly Point[]=[
  [0,0],[.008,.016],[.018,.070],[.042,PALLET_BASE_HEIGHT],
  [-.042,PALLET_BASE_HEIGHT],[-.020,.068],[-.008,.016],
];
export function wheelOutline(wheelAngle:number):Point[]{
  return Array.from({length:TEETH},(_,k)=>
    WHEEL_PROFILE.map(([phase,r]):Point=>[
      r*Math.sin(k*PITCH+wheelAngle+phase*PITCH),
      WHEEL_Y+r*Math.cos(k*PITCH+wheelAngle+phase*PITCH),
    ])).flat();
}
export function palletOutline(side:Side,pendulumAngle:number):Point[]{
  const tip=palletLocalTip(side),orientation=palletOrientation(side);
  return PALLET_PROFILE.map(p=>{
    const local=rotate(p,orientation);
    const world=rotate([tip[0]+local[0],tip[1]+local[1]],-pendulumAngle);
    return [world[0],world[1]+PIVOT_Y];
  });
}
const cross=(a:Point,b:Point):number=>a[0]*b[1]-a[1]*b[0];
const sub=(a:Point,b:Point):Point=>[a[0]-b[0],a[1]-b[1]];
function edgeCrosses(a:Point,b:Point,c:Point,d:Point):boolean{
  const ab=sub(b,a),cd=sub(d,c),den=cross(ab,cd);
  if(Math.abs(den)<1e-12)return false;
  const t=cross(sub(c,a),cd)/den,u=cross(sub(c,a),ab)/den;
  return t>1e-9&&t<1-1e-9&&u>1e-9&&u<1-1e-9;
}
function inside(p:Point,polygon:readonly Point[]):boolean{
  let odd=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
    const a=polygon[i],b=polygon[j];
    if((a[1]>p[1])!==(b[1]>p[1]) &&
      p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0]) odd=!odd;
  }
  return odd;
}
/** True when the 2D solid outlines penetrate (not simply share a Z plane). */
export function palletWheelInterference(side:Side,state:ClockState):boolean{
  const wheel=wheelOutline(state.wheelAngle);
  const shoe=palletOutline(side,state.pendulumAngle);
  for(let i=0;i<shoe.length;i++){
    const a=shoe[i],b=shoe[(i+1)%shoe.length];
    for(let j=0;j<wheel.length;j++){
      const c=wheel[j],d=wheel[(j+1)%wheel.length];
      if(edgeCrosses(a,b,c,d))return true;
    }
  }
  return inside(shoe[0],wheel)||inside(wheel[0],shoe);
}
