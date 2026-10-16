/** Shared physical attachment points. One shape source for pipe meshes, ports,
 * valve actuator and regression tests: do not independently hand-place ends. */
import type {PipePoint} from './pipe-path.ts';
export const GOV_X = 1.72;
export const GOV_Z = 1.20;
export const GOV_PIVOT_Y = 2.73;
export const GOV_ARM = .88;
export const THROTTLE_X = .12;
export const THROTTLE_Y = 2.33;
export const THROTTLE_Z = -.28;
export const THROTTLE_LEFT = THROTTLE_X - .28;
export const THROTTLE_RIGHT = THROTTLE_X + .28;

// Two short end ports pass through the cylinder's upper-rear flank, without
// a bulky exposed steam-chest box. Their radius matches the cast cylinder.
export const INLET_PORT:PipePoint = [-2.72,.58,-.94];
export const EXHAUST_PORT:PipePoint = [-.56,.58,-.94];
export const BOILER_TO_VALVE:PipePoint[] = [
  [.78,4.28,-.78],[.78,2.70,-.78],
  [.78,THROTTLE_Y,THROTTLE_Z],[THROTTLE_RIGHT,THROTTLE_Y,THROTTLE_Z],
];
export const VALVE_TO_CYLINDER:PipePoint[] = [
  [THROTTLE_LEFT,THROTTLE_Y,THROTTLE_Z],
  [-2.72,THROTTLE_Y,THROTTLE_Z],INLET_PORT,
];
export const CYLINDER_TO_EXHAUST:PipePoint[] = [
  EXHAUST_PORT,[-.56,1.50,-1.30],
  [-3.42,1.50,-1.30],[-3.42,3.10,-1.30],
];

/** The governor's *nonrotating* sleeve and sliding steam gate form a rigid
 * translating yoke. Its two pins have fixed X/Z positions and the SAME Y at
 * every frame: no telescoping connecting rods or free-floating rocker.
 * The gate closes upwards into the horizontal steam bore as the sleeve rises.
 */
export function throttleLinkage(sleeveY:number){
  const collarPin:PipePoint=[GOV_X-.21,sleeveY,GOV_Z];
  const valvePin:PipePoint=[THROTTLE_X,sleeveY,THROTTLE_Z];
  const gateBottom:PipePoint=[THROTTLE_X,sleeveY-.05,THROTTLE_Z];
  const gateTop:PipePoint=[THROTTLE_X,sleeveY+.65,THROTTLE_Z];
  const gateCenter:PipePoint=[THROTTLE_X,sleeveY+.30,THROTTLE_Z];
  return {collarPin,valvePin,gateBottom,gateTop,gateCenter};
}
