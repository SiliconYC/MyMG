/** Mechanically constrained two-rotor pendulum escapement.
 *
 * BOTH generalized coordinates are integrated from torques. No cosine
 * animation, beat timer, seek-dependent phase reset, or pre-scripted lock.
 * Every tooth prism, pallet and fork arm is included in the swept collision
 * tests via escapement-geometry.ts (the same polygons used by the 3D mesh).
 *
 * Contacts enforce a non-penetrating unilateral velocity constraint; the
 * impulse changes BOTH wheel and pendulum angular velocities. A locked
 * tooth can stay still despite train torque. An impossible mechanism jams.
 *
 * Scope: fixed-axis planar rigid dynamics, not FEM, lubrication, or 3D bearing
 * stress. The simulated joint axes are constrained; finite Z overlap is
 * validated separately by escapement-axial.ts.
 */
import {
  TEETH,PITCH,WHEEL_Y,PIVOT_Y,START_AMPLITUDE,
  palletCollisionWorld,forkWorld,toothWorld,sub,dot,len,
  type Point,type Side,
} from './escapement-geometry.ts';
export {TEETH} from './escapement-geometry.ts';

export const FPS=30;
export const DURATION=FPS*60;
export const PERIOD_SECONDS=2;
export const PENDULUM_AMPLITUDE=START_AMPLITUDE;
export const PHYSICS_HZ=240;
export const DT=1/PHYSICS_HZ;
/** g/L tuned for a 2 s ideal pendulum; -sin(theta) is the real restoring term. */
export const GRAVITY_OVER_LENGTH=Math.PI*Math.PI;
export const WHEEL_INERTIA=.015;
export const PENDULUM_INERTIA=1.0;
export const DRIVE_TORQUE=.035;
export const WHEEL_DAMPING=.035;
export const PENDULUM_DAMPING=.002;
export const CONTACT_RESTITUTION=.05;
const HALF_PITCH=PITCH/2;
const SUBSTEPS=PHYSICS_HZ/FPS;
const CONTACT_SLOP=2e-5;
const CONTACT_CORRECTION=.83;
const MAX_CONTACT_PENETRATION=.04;

export type ClockState={
  seconds:number;pendulumAngle:number;pendulumVelocity:number;
  anchorAngle:number;wheelAngle:number;wheelVelocity:number;
  secondHandAngle:number;minuteHandAngle:number;beats:number;
  lock:Side;releasing:boolean;releaseProgress:number;
  contactCount:number;impact:boolean;contactImpulse:number;
  maxPenetration:number;jammed:boolean;armClearance:number;
};
type Machine={
  p:number;pv:number;w:number;wv:number;contactCount:number;
  contactImpulse:number;maxPenetration:number;
  contactSide:Side|null;lockedSteps:number;armClearance:number;
};
const machine:Machine={
  p:START_AMPLITUDE,pv:0,w:0,wv:0,contactCount:0,
  contactImpulse:0,maxPenetration:0,contactSide:null,
  lockedSteps:0,armClearance:Infinity,
};

/** SAT on the ACTUAL 2D convex polygons (no point/line contact proxy).
 * n points from the wheel tooth into the anchor part.
 */
type Overlap={depth:number;n:Point;wheelContact:Point;anchorContact:Point};
function polygonOverlap(wheel:Point[],anchor:Point[]):Overlap|null {
  let minDepth=Infinity;
  let axis:Point=[0,1];
  const axes=(poly:Point[]):Point[]=>poly.map((p,i)=>{
    const q=poly[(i+1)%poly.length];
    const d=sub(q,p),l=len(d);
    return l>1e-9?[-d[1]/l,d[0]/l]:[0,1];
  });
  const centre=(poly:Point[]):Point=>[
    poly.reduce((n,p)=>n+p[0],0)/poly.length,
    poly.reduce((n,p)=>n+p[1],0)/poly.length,
  ];
  const centreDelta=sub(centre(anchor),centre(wheel));
  for(const candidate of [...axes(wheel),...axes(anchor)]){
    const projectionsA=wheel.map(p=>dot(p,candidate));
    const projectionsB=anchor.map(p=>dot(p,candidate));
    const amin=Math.min(...projectionsA),amax=Math.max(...projectionsA);
    const bmin=Math.min(...projectionsB),bmax=Math.max(...projectionsB);
    if(amax<=bmin||bmax<=amin)return null;
    const depth=Math.min(amax-bmin,bmax-amin);
    if(depth<minDepth){
      minDepth=depth;
      axis=dot(candidate,centreDelta)>=0?candidate:[-candidate[0],-candidate[1]];
    }
  }
  const wheelContact=wheel.reduce((best,p)=>dot(p,axis)>dot(best,axis)?p:best);
  const anchorContact=anchor.reduce((best,p)=>dot(p,axis)<dot(best,axis)?p:best);
  return {depth:minDepth,n:axis,wheelContact,anchorContact};
}
/** Four collision triangles covering the visible wheel tooth perimeter;
 * avoids incorrectly treating a potentially concave tooth as a SAT convex
 * polygon. The vertices come from the EXACT render profile.
 */
function wheelTriangles(index:number,w:number):Point[][] {
  const v=toothWorld(index,w);
  return [1,2,3,4].map(i=>[v[0],v[i],v[i+1]]);
}
type Hit=Overlap&{side:Side;part:'pallet'|'fork'};
function contactPair(s:Machine):Hit[] {
  const collisions:Hit[]=[];
  let armClearance=Infinity;
  for(const side of ['entry','exit'] as const){
    const shoes=palletCollisionWorld(side,s.p);
    const fork=forkWorld(side,s.p);
    // Safety diagnostic: a long arm must not penetrate the swept rim.
    const armDistance=Math.min(...fork.map(p=>Math.hypot(p[0],p[1]-WHEEL_Y)));
    armClearance=Math.min(armClearance,armDistance-1.55);
    const parts:{part:'pallet'|'fork';polygon:Point[]}[]=
      shoes.map(polygon=>({part:'pallet',polygon}));
    if(armDistance<1.575)parts.push({part:'fork',polygon:fork});
    for(const {part,polygon} of parts){
      const cx=polygon.reduce((sum,p)=>sum+p[0],0)/polygon.length;
      const cy=polygon.reduce((sum,p)=>sum+p[1],0)/polygon.length-WHEEL_Y;
      const approx=(Math.atan2(cx,cy)-s.w)/PITCH;
      const near=Math.round(approx-.5);
      for(let i=near-2;i<=near+2;i++){
        for(const triangle of wheelTriangles(i,s.w)){
          const hit=polygonOverlap(triangle,polygon);
          if(hit) collisions.push({...hit,side,part});
        }
      }
    }
  }
  s.armClearance=armClearance;
  collisions.sort((a,b)=>b.depth-a.depth);
  return collisions;
}
function contactJacobians(hit:Hit):readonly [number,number]{
  const rw=sub(hit.wheelContact,[0,WHEEL_Y]);
  const ra=sub(hit.anchorContact,[0,PIVOT_Y]);
  const crossWheel:Point=[rw[1],-rw[0]];
  const crossAnchor:Point=[ra[1],-ra[0]];
  return [-dot(hit.n,crossWheel),dot(hit.n,crossAnchor)];
}
function advance(s:Machine):void{
  s.contactCount=0;s.contactImpulse=0;s.maxPenetration=0;s.contactSide=null;
  s.pv+=(-GRAVITY_OVER_LENGTH*Math.sin(s.p)-
    PENDULUM_DAMPING*s.pv)*DT;
  s.wv+=(DRIVE_TORQUE/WHEEL_INERTIA-WHEEL_DAMPING*s.wv)*DT;
  s.p+=s.pv*DT;
  s.w+=s.wv*DT;
  for(let iteration=0;iteration<6;iteration++){
    const hits=contactPair(s);
    if(!hits.length)break;
    const hit=hits[0];
    s.contactCount++;
    s.maxPenetration=Math.max(s.maxPenetration,hit.depth);
    s.contactSide=hit.side;
    const [jw,ja]=contactJacobians(hit);
    const inv=jw*jw/WHEEL_INERTIA+ja*ja/PENDULUM_INERTIA;
    if(inv<1e-8)break;
    const rel=jw*s.wv+ja*s.pv;
    if(rel<0){
      const impulse=-(1+CONTACT_RESTITUTION)*rel/inv;
      s.wv+=impulse*jw/WHEEL_INERTIA;
      s.pv+=impulse*ja/PENDULUM_INERTIA;
      s.contactImpulse+=Math.abs(impulse);
    }
    const correction=Math.max(0,hit.depth-CONTACT_SLOP)*
      CONTACT_CORRECTION/inv;
    s.w+=correction*jw/WHEEL_INERTIA;
    s.p+=correction*ja/PENDULUM_INERTIA;
  }
  if(s.contactCount&&Math.abs(s.wv)<.01)s.lockedSteps++;
  else s.lockedSteps=0;
}
const frames:ClockState[]=[];
function readFrame(frame:number):ClockState{
  const beats=Math.max(0,Math.floor(Math.max(0,machine.w)/HALF_PITCH));
  const progress=Math.max(0,Math.min(1,
    (machine.w-beats*HALF_PITCH)/HALF_PITCH));
  const locked=machine.contactSide??(beats%2===0?'entry':'exit');
  return {
    seconds:frame/FPS,pendulumAngle:machine.p,
    pendulumVelocity:machine.pv,anchorAngle:machine.p,
    wheelAngle:machine.w,wheelVelocity:machine.wv,
    secondHandAngle:machine.w,minuteHandAngle:machine.w/60,
    beats,lock:locked,releasing:machine.contactCount===0,
    releaseProgress:progress,contactCount:machine.contactCount,
    impact:machine.contactImpulse>1e-8,
    contactImpulse:machine.contactImpulse,
    maxPenetration:machine.maxPenetration,
    jammed:machine.lockedSteps>PHYSICS_HZ,
    armClearance:machine.armClearance,
  };
}
frames.push(readFrame(0));
export function clockAtFrame(frame:number):ClockState{
  const at=Math.max(0,Math.min(DURATION,Math.floor(frame)));
  for(let f=frames.length;f<=at;f++){
    for(let s=0;s<SUBSTEPS;s++)advance(machine);
    frames.push(readFrame(f));
  }
  return frames[at];
}
export function physicsAudit(){
  clockAtFrame(DURATION);
  return {
    samples:frames.length,
    impacts:frames.filter(f=>f.impact).length,
    wheelTravel:frames.at(-1)!.wheelAngle,
    beats:frames.at(-1)!.beats,
    jammedFrames:frames.filter(f=>f.jammed).length,
    maxPenetration:Math.max(...frames.map(f=>f.maxPenetration)),
    minArmClearance:Math.min(...frames.slice(1).map(f=>f.armClearance)),
    maxSpeed:Math.max(...frames.map(f=>Math.abs(f.wheelVelocity))),
  };
}
