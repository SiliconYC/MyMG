/** Pure frame-driven kinematics for a seconds pendulum and 30-tooth escapement.
 * A 2 s period gives one 1 s beat. An anchor alternates its entry/exit pallets.
 * The escape wheel turns half of one tooth pitch per beat: 360 / (2 * 30) = 6°.
 * The seconds hand shares the same calculated shaft angle, never Date.now().
 * The 0.18s release interval is deliberately exaggerated for legibility;
 * this is a timed explanatory model, not a force/contact physics solver.
 */
export const FPS = 30;
export const DURATION = 60 * FPS;
export const TEETH = 30;
export const BEAT_SECONDS = 1;
export const PERIOD_SECONDS = 2;
export const RELEASE_OFFSET = 0.42;
export const RELEASE_DURATION = 0.18;

export type ClockState = {
  seconds: number;
  pendulumAngle: number;
  anchorAngle: number;
  wheelAngle: number;
  secondHandAngle: number;
  minuteHandAngle: number;
  beats: number;
  lock: 'entry' | 'exit';
  releasing: boolean;
  releaseProgress: number;
};

const clamp = (x: number): number => Math.max(0, Math.min(1, x));
const smoothstep = (x: number): number => {
  const v = clamp(x);
  return v * v * (3 - 2 * v);
};

/** Stateless: seeking directly to any frame returns exactly the same state. */
export function clockAtFrame(frame: number): ClockState {
  const seconds = Math.max(0, frame) / FPS;
  const pendulumAngle = 0.115 * Math.cos(Math.PI * seconds);
  const rawBeat = Math.floor(seconds - RELEASE_OFFSET) + 1;
  const beatsBeforeRelease = Math.max(0, rawBeat - 1);
  const releaseStart = beatsBeforeRelease + RELEASE_OFFSET;
  const releasing = rawBeat > 0 &&
    seconds >= releaseStart && seconds < releaseStart + RELEASE_DURATION;
  const releaseProgress = rawBeat > 0
    ? smoothstep((seconds - releaseStart) / RELEASE_DURATION)
    : 0;
  const beats = Math.max(0, rawBeat);
  const beatTravel = beats === 0 ? 0 : beatsBeforeRelease + releaseProgress;
  const wheelAngle = beatTravel * Math.PI / TEETH;
  return {
    seconds,
    pendulumAngle,
    anchorAngle: pendulumAngle * 0.83,
    wheelAngle,
    secondHandAngle: wheelAngle,
    minuteHandAngle: wheelAngle / 60,
    beats,
    lock: beats % 2 === 0 ? 'entry' : 'exit',
    releasing,
    releaseProgress,
  };
}
