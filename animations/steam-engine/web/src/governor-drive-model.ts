/** Geometric drive constraints: engine crankshaft -> closed belt -> horizontal
 * layshaft -> right-angle bevel pair -> governor spindle.
 * The integrated governor model already enforces 11:5 gearing:
 * spindlePhase === (11 / 5) * theta, without independently keyed rotation.
 */
import {CRANK_X} from './steam-model.ts';
import {GOV_X,GOV_Z} from './steam-plumbing.ts';
export const DRIVE_RATIO=11/5;
export const DRIVE_BELT_RADIUS=.235;
export const DRIVE_BELT_Z=GOV_Z-.55;
export const DRIVE_SHAFT_Y=0;
export const DRIVE_CRANK_X=CRANK_X;
export const DRIVE_GOV_X=GOV_X;
export const BEVEL_APEX:[number,number,number]=[GOV_X,DRIVE_SHAFT_Y,GOV_Z];
export const DRIVE_SUPPORT_Y=-1.34;
const span=CRANK_X-GOV_X;
export const BELT_LENGTH=2*span+2*Math.PI*DRIVE_BELT_RADIUS;

/** Positive crank rotation moves the upper run of this uncrossed belt LEFT.
 * Both pulleys have equal diameters and therefore rotate at crank angular speed. */
export function beltPointAtTravel(travel:number):[number,number,number]{
  const r=DRIVE_BELT_RADIUS;
  const d=((travel%BELT_LENGTH)+BELT_LENGTH)%BELT_LENGTH;
  const arc=Math.PI*r;
  if(d<span)return [CRANK_X-d,r,DRIVE_BELT_Z];
  if(d<span+arc){
    const angle=Math.PI/2+(d-span)/r;
    return [GOV_X+r*Math.cos(angle),r*Math.sin(angle),DRIVE_BELT_Z];
  }
  if(d<2*span+arc){
    return [GOV_X+d-span-arc,-r,DRIVE_BELT_Z];
  }
  const angle=-Math.PI/2+(d-2*span-arc)/r;
  return [CRANK_X+r*Math.cos(angle),r*Math.sin(angle),DRIVE_BELT_Z];
}
export function beltTravelAt(theta:number,index=0,count=4):number{
  const start=-Math.PI/2;
  const linear=(theta-start)*DRIVE_BELT_RADIUS;
  return ((linear+(index/count)*BELT_LENGTH)%BELT_LENGTH+BELT_LENGTH)%BELT_LENGTH;
}

/** The exact pitch cone apices of the two orthogonal bevel gears coincide.
 * 22:10 tooth counts give 2.2 turns of governor for each engine turn. */
export const BEVEL_INPUT_TEETH=22;
export const BEVEL_OUTPUT_TEETH=10;
export const BEVEL_INPUT_LENGTH=.13;
export const BEVEL_OUTPUT_LENGTH=.26;
export const BEVEL_INPUT_RADIUS=BEVEL_INPUT_LENGTH*DRIVE_RATIO;
export const BEVEL_OUTPUT_RADIUS=BEVEL_OUTPUT_LENGTH/DRIVE_RATIO;

export function gearPhaseResidual(theta:number,spindlePhase:number):number{
  return spindlePhase-DRIVE_RATIO*theta;
}
