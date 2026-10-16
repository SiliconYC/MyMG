/** Deterministic, frame-indexed closed-loop Watt governor teaching model.
 *
 * The crank does NOT run at a scripted angular speed: we integrate a simple
 * steam-torque / load balance and a lagged centrifugal arm. That arm moves the
 * sleeve, which pulls the intake throttle toward closed. Every browser seek,
 * pause and Remotion render returns exactly the same state at a given frame.
 *
 * Dimensionless gains are deliberately illustrative, not calibrated to a
 * particular nineteenth-century engine.
 */
export const GOVERNOR_START_FRAME = 0;
export const GOVERNOR_END_FRAME = 600;
export const GOVERNOR_FPS = 30;
export const NOMINAL_THROTTLE = 0.58;
export const NOMINAL_ANGLE = 0.70;
const NOMINAL_OMEGA = Math.PI * 2 * 0.56;
const dt = 1 / GOVERNOR_FPS;

const clamp = (v: number, low: number, high: number) => Math.max(low, Math.min(high, v));
const ease = (v: number) => {
  const t = clamp(v, 0, 1);
  return t * t * (3 - 2 * t);
};

/** A temporary reduction of load (not an artificial change of ball angle). */
export const loadReliefAt = (seconds: number) =>
  ease((seconds - 7.60) / .36) * (1 - ease((seconds - 12.10) / .60));

export type GovernorState = {
  theta: number;
  omega: number;
  relativeSpeed: number;
  angle: number;
  sleeveY: number;
  throttle: number;
  loadRelief: number;
  spindlePhase: number;
};
const neutralTheta = GOVERNOR_START_FRAME / GOVERNOR_FPS * NOMINAL_OMEGA - Math.PI / 2;
const neutral = (): GovernorState => ({
  theta:neutralTheta, omega:NOMINAL_OMEGA, relativeSpeed:1,
  angle:NOMINAL_ANGLE, sleeveY:2.73 - 1.76 * Math.cos(NOMINAL_ANGLE),
  throttle:NOMINAL_THROTTLE, loadRelief:0, spindlePhase:neutralTheta*2.2,
});

/** Integrate once, then expose a read-only per-frame lookup table. */
const states: GovernorState[] = [neutral()];
for (let i=1; i<=GOVERNOR_END_FRAME-GOVERNOR_START_FRAME; i++) {
  const prev=states[i-1];
  const seconds=(GOVERNOR_START_FRAME+i) / GOVERNOR_FPS;
  const relief=loadReliefAt(seconds);
  // Centrifugal equilibrium cos(alpha) ~ 1 / omega² (upper ball arm).
  const equilibrium=clamp(
    Math.acos(clamp(Math.cos(NOMINAL_ANGLE)/(prev.relativeSpeed**2),-1,1)),
    .20,1.23,
  );
  const angle=prev.angle+(equilibrium-prev.angle)*dt/.44;
  const sleeveY=2.73 - 1.76 * Math.cos(angle);
  // High sleeve -> throttle closes -> weaker steam torque.
  const throttle=clamp(NOMINAL_THROTTLE-1.5*(angle-NOMINAL_ANGLE),.14,.85);
  // Rotor inertia: steam drive - friction/load + temporary load reduction.
  const acceleration=2.0*(throttle-NOMINAL_THROTTLE)
    -.20*(prev.relativeSpeed-1)+1.15*relief;
  const relativeSpeed=clamp(prev.relativeSpeed+dt*acceleration,.6,1.9);
  const omega=NOMINAL_OMEGA*relativeSpeed;
  states.push({
    theta:prev.theta + dt*(prev.omega+omega)/2,
    omega, relativeSpeed, angle, sleeveY, throttle,
    loadRelief:relief,
    spindlePhase:prev.spindlePhase + dt*(prev.omega+omega)*1.10,
  });
}

export function governorAtFrame(frame:number):GovernorState {
  if(frame<GOVERNOR_START_FRAME) {
    return {
      ...states[0],
      spindlePhase:(frame/GOVERNOR_FPS*NOMINAL_OMEGA-Math.PI/2)*2.2,
    };
  }
  const index=clamp(Math.round(frame)-GOVERNOR_START_FRAME,0,states.length-1);
  return states[index];
}
