/** All visible steam pipes, governor and throttle share physical endpoints.
 * The governor is mounted DIRECTLY above the inline copper inlet valve. */
import type {PipePoint} from './pipe-path.ts';
export const GOV_X = .45;
export const GOV_Z = -.28;
export const GOV_LIFT = 1.60; // visual height above the frame-indexed governor model
export const GOV_PIVOT_Y = 2.73 + GOV_LIFT;
export const GOV_ARM = .88;
export const THROTTLE_X = GOV_X;
export const THROTTLE_Y = 2.33;
export const THROTTLE_Z = GOV_Z;
export const THROTTLE_LEFT = THROTTLE_X - .28;
export const THROTTLE_RIGHT = THROTTLE_X + .28;

// Both round cast ports slightly enter the outside of the cylinder shell.
export const INLET_PORT:PipePoint = [-2.72,.58,-.94];
export const EXHAUST_PORT:PipePoint = [-.56,.58,-.94];

// The brass supply crosses a single INLINE valve directly below the weights,
// then runs into the cylinder. The blue tube vents independently.
export const BOILER_TO_VALVE:PipePoint[] = [
  [1.85,4.28,-.78],[1.85,2.72,-.78],
  [1.85,THROTTLE_Y,THROTTLE_Z],
  [THROTTLE_RIGHT,THROTTLE_Y,THROTTLE_Z],
];
export const VALVE_TO_CYLINDER:PipePoint[] = [
  [THROTTLE_LEFT,THROTTLE_Y,THROTTLE_Z],
  [-2.72,THROTTLE_Y,THROTTLE_Z],
  [-2.72,1.55,-.94],INLET_PORT,
];
export const CYLINDER_TO_EXHAUST:PipePoint[] = [
  EXHAUST_PORT,[-.56,1.50,-1.30],
  [-3.42,1.50,-1.30],[-3.42,3.10,-1.30],
];

/** Single straight nonrotating valve stem, coaxial with the spindle and
 * copper inlet. The metal stem is fixed-length: it is carried down by the
 * sliding sleeve, rather than using floating or telescoping side linkages.
 * Keeping the earlier gate height preserves the feedback demonstration. */
export function throttleLinkage(sleeveY:number){
  const x=THROTTLE_X,z=THROTTLE_Z;
  const collarPin:PipePoint=[x,sleeveY+GOV_LIFT,z];
  const gateCenter:PipePoint=[x,sleeveY+.32,z];
  const gateBottom:PipePoint=[x,sleeveY-.03,z];
  const gateTop:PipePoint=[x,sleeveY+.67,z];
  const valvePin:PipePoint=[...gateTop];
  return {collarPin,valvePin,gateBottom,gateTop,gateCenter};
}
