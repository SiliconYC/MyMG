/** Geometrically registered anchor-pallet contacts for the 30-tooth wheel.
 *
 * The mesh profile in pendulum-clock.tsx and this function use the SAME
 * tooth flank: from polar(.43 pitch, r=1.55) to polar(.69 pitch, r=1.32).
 * Entry lock occurs at even half-pitch counts, exit at odd counts.
 * Pallet tips are offset only a tiny visible clearance from real flank edges,
 * not attached to unrelated screen-space positions.
 *
 * A deliberately simplified teaching escapement, not a collision solver.
 */
import {TEETH, type ClockState} from './clock-model.ts';

export type Side='entry'|'exit';
export type Point=readonly [number,number];
export const WHEEL_Y=0.6;
export const PITCH=2*Math.PI/TEETH;
export const PALLET_CLEARANCE=0.006;
const OUTER_RADIUS=1.55;
const ROOT_RADIUS=1.32;
const FLANK_FROM=.43;
const FLANK_TO=.69;
const FLANK_T=.52;

const polar=(r:number,a:number):Point=>[r*Math.sin(a),r*Math.cos(a)];
const blend=(a:Point,b:Point,t:number):Point=>[
  a[0]*(1-t)+b[0]*t,a[1]*(1-t)+b[1]*t,
];
const length=(a:Point):number=>Math.hypot(a[0],a[1]);
const unit=(a:Point):Point=>[a[0]/length(a),a[1]/length(a)];
const smooth=(x:number):number=>{
  const u=Math.max(0,Math.min(1,x));
  return u*u*(3-2*u);
};
export type Flank={
  toothIndex:number;start:Point;end:Point;
  point:Point;outwardNormal:Point;radial:Point;
  angle:number;
};

/** Same two vertices used by makeEscapeWheel; position in wheel LOCAL XY. */
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

/** During the lock the tooth flank recurs exactly after full tooth pitches. */
export function nearestFlank(side:Side,wheelAngle:number):Flank {
  const ref=REFERENCE[side];
  const referenceTooth=side==='entry'?-4:3;
  const referenceWheelAngle=side==='entry'?0:PITCH/2;
  const toothIndex=referenceTooth+Math.round(
    (referenceWheelAngle-wheelAngle)/PITCH);
  const f=flankAt(toothIndex,wheelAngle);
  // The nearest tooth can only deviate by half the 12° pitch during release.
  return f;
}

export type PalletPose={
  side:Side;
  tip:Point;                  // world XY (including WHEEL_Y)
  mounting:Point;             // world XY, slender arm attaches here
  nominalTooth:Point;          // actual wheel flank at this frame
  gap:number;                  // normal tip clearance when engaged
  toothIndex:number;
  radialAngle:number;
  engaged:boolean;
  flankStart:Point;            // world XY highlighting the REAL flank
  flankEnd:Point;
};

export function palletPose(side:Side,state:ClockState):PalletPose {
  const baseline=REFERENCE[side];
  const currentTooth=nearestFlank(side,state.wheelAngle);
  const newSide=state.lock;
  // The engine labels the incoming pallet as soon as a release begins.
  // Keep the *previous* pallet locked initially; withdraw it, step the
  // wheel, then let the incoming pallet enter its real tooth flank.
  let retract=side===state.lock?0:.24;
  if(state.releasing){
    const progress=state.releaseProgress;
    retract=side===newSide
      ? .24*(1-smooth((progress-.68)/.32))
      : .24*smooth(progress/.32);
  }
  const clearance=PALLET_CLEARANCE+retract;
  const [nx,ny]=baseline.outwardNormal;
  const [rx,ry]=baseline.radial;
  const x=baseline.point[0]+nx*PALLET_CLEARANCE+rx*retract;
  const y=WHEEL_Y+baseline.point[1]+ny*PALLET_CLEARANCE+ry*retract;
  const world=(p:Point):Point=>[p[0],p[1]+WHEEL_Y];
  return {
    side,tip:[x,y],mounting:[x+rx*.19,y+ry*.19],
    nominalTooth:world(currentTooth.point),
    gap:clearance,toothIndex:currentTooth.toothIndex,
    radialAngle:baseline.angle,
    engaged:retract<.018,
    flankStart:world(currentTooth.start),
    flankEnd:world(currentTooth.end),
  };
}

/** Measures actual XY separation to the rendered tooth flank reference. */
export function contactDistance(side:Side,state:ClockState):number {
  const p=palletPose(side,state);
  return Math.hypot(p.tip[0]-p.nominalTooth[0],p.tip[1]-p.nominalTooth[1]);
}
