/** Fixed-step, seekable reduced-order rigid-body escapement dynamics.
 * 1) A gravity pendulum has inertia and viscous bearing drag.
 * 2) Torque accelerates the escape wheel until an actual tooth tip meets
 *    the alternate pivot-concentric locking face.
 * 3) The lock is a unilateral hard stop: zero backward movement/penetration.
 * 4) A fraction of the impact energy enters the pendulum on the small
 *    chamfered impulse land; the remainder is dissipated.
 * This is deterministic 2D rigid contact with ideal axle joints, not FEM,
 * elastic impact, bearing wear, or a manufacturability certification.
 */
import {TEETH,HALF_PITCH,PALLET_RANGES,faceContains,lockedSide,
  type Side} from './escapement-geometry.ts';
export {TEETH} from './escapement-geometry.ts';
export const FPS=30;
export const DURATION=60*FPS;
export const PERIOD_SECONDS=2;
/** Initial excursion; subsequent motion is integrated, not prescribed. */
export const PENDULUM_AMPLITUDE=.145;
/** Small-angle natural frequency makes the nominal half-period 1 s. */
export const GRAVITY_OVER_LENGTH=Math.PI*Math.PI;
export const PHYSICS_HZ=600;
export const DRIVE_ACCELERATION=9;
export const WHEEL_DRAG=1.5;
export const PENDULUM_DRAG=.005;
export const WHEEL_INERTIA=.0015;
export const IMPULSE_EFFICIENCY=.38;
const DT=1/PHYSICS_HZ;
const SUBSTEPS=PHYSICS_HZ/FPS;

export type ClockState={
  seconds:number;
  pendulumAngle:number;
  pendulumVelocity:number;
  anchorAngle:number;
  wheelAngle:number;
  wheelVelocity:number;
  secondHandAngle:number;
  minuteHandAngle:number;
  beats:number;
  lock:Side;
  releasing:boolean;
  releaseProgress:number;
  /** Actual wheel-to-pallet collision, NOT a timed phase change. */
  impact:boolean;
  contactEnergy:number;
};
type Dynamics={a:number;v:number;w:number;wv:number;beats:number;
  free:boolean;impactEnergy:number};
const initial=():Dynamics=>({
  a:PENDULUM_AMPLITUDE,v:0,w:0,wv:0,beats:0,
  free:false,impactEnergy:0,
});
function advance(s:Dynamics):boolean{
  let impact=false;
  // The shaft is free to move; a locking arc never requires an extra motor.
  s.v+=(-GRAVITY_OVER_LENGTH*Math.sin(s.a)-PENDULUM_DRAG*s.v)*DT;
  s.a+=s.v*DT;
  const holding=lockedSide(s.beats);
  if(!s.free && !faceContains(holding,s.a)){
    s.free=true;
    s.wv=0;
  }
  if(s.free){
    // A constant train torque and viscous drag drive the real gear angle.
    s.wv+=(DRIVE_ACCELERATION-WHEEL_DRAG*s.wv)*DT;
    s.w+=s.wv*DT;
    const next=s.beats+1;
    const cap=next*HALF_PITCH;
    if(s.w>=cap && faceContains(lockedSide(next),s.a)){
      // Inelastic tooth/impulse-face impact: linearised two-inertia
      // energy exchange. The locking land itself is concentric with the
      // anchor axle and supplies NO continuous driving torque.
      const gained=.5*WHEEL_INERTIA*s.wv*s.wv*IMPULSE_EFFICIENCY;
      s.v=Math.sign(s.v||1)*Math.sqrt(s.v*s.v+2*gained);
      s.impactEnergy=gained;
      s.w=cap;
      s.wv=0;
      s.beats=next;
      s.free=false;
      impact=true;
    }
  }else{
    // A locked tooth balances the driving torque through a normal reaction.
    s.w=s.beats*HALF_PITCH;
    s.wv=0;
  }
  return impact;
}
const states:ClockState[]=[];
const s=initial();
function snapshot(frame:number,impact:boolean):ClockState{
  const step=(s.w-s.beats*HALF_PITCH)/HALF_PITCH;
  const side=lockedSide(s.beats);
  return {
    seconds:frame/FPS,
    pendulumAngle:s.a,pendulumVelocity:s.v,anchorAngle:s.a,
    wheelAngle:s.w,wheelVelocity:s.wv,
    secondHandAngle:s.w,minuteHandAngle:s.w/60,
    beats:s.beats,lock:side,releasing:s.free,
    releaseProgress:s.free?Math.max(0,Math.min(1,step)):0,
    impact,contactEnergy:impact?s.impactEnergy:0,
  };
}
states.push(snapshot(0,false));
for(let f=1;f<=DURATION;f++){
  let impacted=false;
  for(let i=0;i<SUBSTEPS;i++) impacted=advance(s)||impacted;
  states.push(snapshot(f,impacted));
}
/** Fixed integration grid: jumping to frame 1279 gives identical 3D pose. */
export function clockAtFrame(frame:number):ClockState{
  return states[Math.max(0,Math.min(DURATION,Math.floor(frame)))];
}
/** Explicitly inspect the machine's physically derived lock schedule. */
export function contactStats(){
  const impacts=states.filter(x=>x.impact);
  return {impacts:impacts.length,first:impacts[0]?.seconds??null,
    last:impacts.at(-1)?.seconds??null,terminalWheel:states[DURATION].wheelAngle,
    terminalAmplitude:Math.abs(states[DURATION].pendulumAngle),
    leftFace:PALLET_RANGES.entry,rightFace:PALLET_RANGES.exit};
}
