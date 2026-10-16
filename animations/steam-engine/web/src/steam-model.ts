/** Pure frame-driven physical model; independent of React and clipping state. */
import {governorAtFrame, GOVERNOR_START_FRAME, type GovernorState} from './governor-model';

export const FPS = 30;
export const DURATION = 960;
export const CRANK_X = 3.08;
export const CRANK_RADIUS = 0.66;
export const CONNECTING_ROD = 2.72;
export const PISTON_OFFSET = 1.50;
export const CYLINDER_LEFT = -3.13;
export const CYLINDER_RIGHT = -0.17;
export const CYLINDER_OUTER_RADIUS = 1.10;
export const CYLINDER_INNER_RADIUS = 0.95;
export const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
export const smoothstep = (v: number): number => {
  const x = clamp01(v);
  return x * x * (3 - 2 * x);
};
export type SteamFrame = {
  time: number;
  theta: number;
  pistonX: number;
  crossheadX: number;
  pinX: number;
  pinY: number;
  cut: number;
  cutZ: number;
  leftPressure: number;
  rightPressure: number;
  motion: 'right' | 'left';
  governor: GovernorState;
};
/** Closed-form slider-crank constraint: pin, connecting rod, crosshead, piston synchronized. */
export function steamAtFrame(frame: number): SteamFrame {
  const time = frame / FPS;
  const governor = governorAtFrame(frame);
  const theta = frame <= GOVERNOR_START_FRAME
    ? time * Math.PI * 2 * 0.56 - Math.PI / 2 : governor.theta;
  const pinX = CRANK_X + CRANK_RADIUS * Math.cos(theta);
  const pinY = CRANK_RADIUS * Math.sin(theta);
  const crossheadX = pinX - Math.sqrt(CONNECTING_ROD ** 2 - pinY ** 2);
  const pistonX = crossheadX - PISTON_OFFSET;
  // A moving clipping plane approaches from the viewer side, holds, then retracts.
  const cut = smoothstep((frame - 40) / 112) * (1 - smoothstep((frame - 365) / 110));
  const cutZ = 1.42 - cut * 1.49;
  const velocity = -Math.sin(theta);
  return {
    time, theta, pistonX, crossheadX, pinX, pinY, cut, cutZ,
    leftPressure: (0.28 + 0.64 * Math.max(0, velocity)) * governor.throttle / .58,
    rightPressure: (0.28 + 0.64 * Math.max(0, -velocity)) * governor.throttle / .58,
    motion: velocity >= 0 ? 'right' : 'left',
    governor,
  };
}
