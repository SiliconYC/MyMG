/**
 * A single, quiet demonstration: four independent CPU cores versus an array of
 * GPU arithmetic lanes. Every visible change is derived from the frame.
 * Hardware counts and cadence are explanatory, NOT performance measurements.
 */
export const FPS = 30;
export const DURATION = 450;
export const CPU_CORES = 4;
export const GPU_LANES = 64;
export const clamp = (n: number) => Math.max(0, Math.min(1, n));
export const smooth = (n: number) => {
  const t = clamp(n);
  return t * t * (3 - 2 * t);
};
export type Stage = 'cpu' | 'gpu' | 'compare';

export const stageAt = (frame: number): Stage =>
  frame < 166 ? 'cpu' : frame < 320 ? 'gpu' : 'compare';

/**
 * The camera is the narrator: one focal point at a time, then one comparison.
 * CPU -> GPU: frame 134..177; GPU -> both: frame 287..332.
 */
export const cameraAt = (frame: number) => ({
  focusX: -5.4 + 10.8 * smooth((frame - 134) / 43)
    - 5.4 * smooth((frame - 287) / 45),
  zoom: 85 - 38 * smooth((frame - 287) / 45),
});

/** CPU: each large independent core takes its own turn. */
export const cpuActivity = (frame: number, index: number) => {
  const t = ((frame - 12) % 88 + 88) % 88;
  const local = t - index * 22;
  if (frame < 12 || local < 0 || local >= 22) return 0;
  return smooth(local / 6) * (1 - smooth((local - 15) / 7));
};

/** GPU: many lightweight execution lanes perform the same operation together. */
export const gpuActivity = (frame: number) => {
  if (frame < 169) return 0;
  const cycle = ((frame - 169) % 44 + 44) % 44;
  return smooth(cycle / 8) * (1 - smooth((cycle - 28) / 9));
};

export const cpuActiveCount = (frame: number) =>
  Array.from({length: CPU_CORES}, (_, i) => cpuActivity(frame, i))
    .filter(n => n > .25).length;
export const gpuActiveCount = (frame: number) =>
  gpuActivity(frame) > .25 ? GPU_LANES : 0;
