/** Deterministic sampling of an actual recoil escapement, never a timed wheel.
 * Both axes are integrated from gravity, drive torque and unilateral contact.
 */
import {RecoilSimulation,PHYSICS,type PhysicsState} from './recoil-physics.ts';
import {TEETH,type Side} from './recoil-geometry.ts';
export {TEETH};
export const FPS=30;
export const DURATION=30*FPS;
export const PERIOD_SECONDS=2*Math.PI/Math.sqrt(PHYSICS.gravity); // metadata, not a driver
export type ClockState={
  seconds:number;pendulumAngle:number;anchorAngle:number;wheelAngle:number;
  secondHandAngle:number;minuteHandAngle:number;beats:number;lock:Side|null;
  contact:Side|null;tooth:number;
  pendulumVelocity:number;wheelVelocity:number;contactImpulse:number;
  energy:number;driveWork:number;energyResidual:number;penetration:number;
};
const simulation=new RecoilSimulation();
const snapshots:RecoilSimulation[]=[simulation.fork()];
const initialWheel=simulation.state.wheel;
function stateAtFrame(frame:number):PhysicsState{
  const bounded=Number.isFinite(frame)?Math.max(0,Math.min(DURATION,frame)):0;
  const whole=Math.floor(bounded),stepsPerFrame=Math.round(1/(FPS*PHYSICS.step));
  while(snapshots.length<=whole){
    for(let i=0;i<stepsPerFrame;i++)simulation.advance();
    snapshots.push(simulation.fork());
  }
  const fraction=Math.round((bounded-whole)*stepsPerFrame);
  if(fraction===0)return snapshots[whole].state;
  const replay=snapshots[whole].fork();
  for(let i=0;i<fraction;i++)replay.advance();
  return replay.state;
}
export function clockAtFrame(frame:number):ClockState{
  const s=stateAtFrame(frame);
  return {
    seconds:s.time,pendulumAngle:s.angle,anchorAngle:s.angle,wheelAngle:s.wheel,
    secondHandAngle:s.wheel-initialWheel,minuteHandAngle:(s.wheel-initialWheel)/60,
    beats:s.beats,lock:s.contact,contact:s.contact,tooth:s.tooth,
    pendulumVelocity:s.velocity,wheelVelocity:s.wheelVelocity,contactImpulse:s.impulse,
    energy:s.energy,driveWork:s.driveWork,energyResidual:s.residual,penetration:s.penetration,
  };
}
