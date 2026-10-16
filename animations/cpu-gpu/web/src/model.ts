/** Pure timeline: one frame determines every active unit and output tile. */
export const FPS = 30;
export const DURATION = 630;
export const CPU_CORES = 4;
export const GPU_LANES = 80;
export const OUTPUT_TILES = 40;
export const clamp = (x: number) => Math.min(1, Math.max(0, x));
export const smooth = (x: number) => {
  const t = clamp(x);
  return t * t * (3 - 2 * t);
};
export const stageAt = (frame: number): 'reveal' | 'uniform' | 'branch' | 'compare' =>
  frame < 88 ? 'reveal' : frame < 304 ? 'uniform' :
  frame < 515 ? 'branch' : 'compare';

/** 80 independent data elements, one common instruction on the GPU. */
export const uniformProgress = (frame: number) => ({
  cpu: clamp((frame - 106) / 180),
  gpu: clamp((frame - 106) / 44),
});
/** Branch-heavy / mixed tasks: CPU cores run separate control flows.
 * GPU executes divergent halves of each wave serially. This is qualitative,
 * not a measured benchmark or a universal speedup claim. */
export const branchProgress = (frame: number) => ({
  cpu: clamp((frame - 324) / 125),
  gpu: clamp((frame - 324) / 185),
});
export const laneBranch = (index: number) => index % 2;
export const laneActive = (frame: number, index: number) => {
  const stage = stageAt(frame);
  if (stage === 'reveal') return false;
  if (stage === 'uniform') return frame >= 106 && frame < 286;
  if (stage === 'branch') {
    if (frame < 324) return false;
    return Math.floor((frame - 324) / 22) % 2 === laneBranch(index);
  }
  return false;
};
export const cpuActive = (frame: number, index: number) => {
  const stage = stageAt(frame);
  if (stage === 'reveal' || stage === 'compare') return false;
  if (stage === 'uniform') {
    const progress = uniformProgress(frame).cpu;
    return progress < 1 && (Math.floor((frame - 106) / 6) + index) % 4 !== 3;
  }
  return frame >= 324 && frame < 449;
};
export const tileDone = (frame: number, tile: number, kind: 'cpu' | 'gpu') => {
  const s = stageAt(frame);
  const progress = s === 'branch' || s === 'compare'
    ? branchProgress(frame)[kind]
    : uniformProgress(frame)[kind];
  return tile < Math.floor(progress * OUTPUT_TILES + 0.001);
};
export const pulse = (frame: number, index: number) =>
  (Math.sin(frame * 0.24 + index * 0.4) + 1) * 0.5;
