/** Deterministic frame-time helpers: no clocks, randomness or render loops. */
export const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
export const easeOutCubic = (progress: number): number =>
  1 - (1 - clamp01(progress)) ** 3;
export const smoothstep = (progress: number): number => {
  const p = clamp01(progress);
  return p * p * (3 - 2 * p);
};
export const arrival = (frame: number, start: number, duration: number): number => {
  if (!(duration > 0)) throw new Error('Duration must be positive');
  return easeOutCubic((frame - start) / duration);
};
export const cameraZoom = (
  frame: number, fromFrame: number, toFrame: number,
  fromZoom: number, toZoom: number
): number => {
  if (toFrame <= fromFrame) throw new Error('Invalid zoom interval');
  return fromZoom + (toZoom - fromZoom) *
    smoothstep((frame - fromFrame) / (toFrame - fromFrame));
};
