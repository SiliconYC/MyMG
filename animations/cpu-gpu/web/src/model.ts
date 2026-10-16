/**
 * One concrete workload: 16 gray task cubes are processed into 16 blue results.
 * The same spatial input/work/output model drives both processors.
 *
 * This is an illustration of parallel execution, NOT a benchmark. Every task
 * trajectory and camera position is a pure function of Remotion frame.
 */
export const FPS = 30;
export const DURATION = 480;
export const TASKS = 16;
export const TASK_CUBE_SIZE = .40;
export const CPU_CORES = 4;
export const GPU_LANES = 16;
export type Stage = 'task' | 'cpu' | 'gpu' | 'compare';
export type Kind = 'cpu' | 'gpu';
export type TaskPhase = 'waiting' | 'entering' | 'processing' | 'leaving' | 'done';
export type Point = readonly [number,number,number];
export const clamp = (n: number) => Math.max(0, Math.min(1, n));
export const smooth = (n: number) => {
  const t = clamp(n);
  return t*t*(3-2*t);
};
export const stageAt = (frame:number):Stage =>
  frame < 80 ? 'task' : frame < 286 ? 'cpu' :
  frame < 405 ? 'gpu' : 'compare';

/**
 * One continuous camera path. At frame zero the CPU and its queued jobs are
 * already present; a single pan reaches the GPU, then zooms out to both chips.
 * Both packages remain at fixed world coordinates through the whole film.
 *
 * 1280×720 / zoom 67 = 19.1×10.7 world units in single-chip view.
 * Previous zoom 114 yielded just 6.3 world units vertically, clipping the
 * 6.55-wide package and its raised metal lid.
 */
export const cameraAt = (frame:number) => {
  const gpu=smooth((frame-263)/65);
  const together=smooth((frame-387)/72);
  return {
    focusX:-8.4+16.8*gpu-8.4*together,
    zoom:67-27*together,
    angle:.07*smooth((frame-90)/65)-.07*together,
    targetY:.15,
  };
};

/** Completed work is NEVER reset by a caption or a camera change. */
export const jobStart = (_frame:number,kind:Kind,index:number) =>
  kind==='cpu' ? 118+Math.floor(index/CPU_CORES)*38 : 330;

export const jobDuration = (_frame:number,kind:Kind) =>
  kind==='cpu'?36:44;

/** Work motion is monotone: waiting → entering → processing → leaving → done. */
export const jobProgress = (frame:number,kind:Kind,index:number) =>
  clamp((frame-jobStart(frame,kind,index))/jobDuration(frame,kind));

export const taskPhase = (p:number):TaskPhase =>
  p<=0?'waiting':p<.34?'entering':p<.66?'processing':p<1?'leaving':'done';

/** The task leaves the scene's margin, passes inside a real silicon die,
 * and reappears outside its opposite edge. Neither side is a conveyor belt. */
export const corePosition = (kind:Kind,index:number):Point => {
  if(kind==='cpu')return [
    index%2===0?-1.1:1.1,
    .58,
    index<2?-1.15:1.15,
  ];
  return [
    ((index%4)-1.5)*1.02,
    .58,
    (Math.floor(index/4)-1.5)*1.15,
  ];
};
export const taskPositions = (kind:Kind,index:number): {
  input:Point; processor:Point; output:Point;
} => {
  const wave=Math.floor(index/4),lane=index%4;
  const z=(kind==='cpu'?lane:wave)-1.5;
  return {
    input:[-5.15+(kind==='cpu'?wave:lane)*.50,.45,z*1.43],
    processor:corePosition(kind,kind==='cpu'?lane:index),
    output:[3.40+(kind==='cpu'?wave:lane)*.60,.45,z*1.43],
  };
};
/** A raised package cover briefly slides away, revealing the real die layout. */
export const lidOpening = (frame:number,kind:Kind) =>
  smooth((frame-(kind==='cpu'?56:291))/42);

/** Even if a browser mishandles transparent opacity, the fully-open lid
 * physically shrinks to a zero-size silhouette instead of hanging over cores.
 * The shrink starts only after the cover has lifted away from the die. */
export const lidScale = (frame:number,kind:Kind) =>
  1-smooth((lidOpening(frame,kind)-.53)/.47);

const lerp = (a:number,b:number,k:number) => a+(b-a)*k;
export const taskAt = (frame:number,kind:Kind,index:number) => {
  const progress=jobProgress(frame,kind,index);
  const {input,processor,output}=taskPositions(kind,index);
  const enter=smooth(progress/.34);
  const exit=smooth((progress-.66)/.34);
  const point:Point=[
    lerp(lerp(input[0],processor[0],enter),output[0],exit),
    lerp(lerp(input[1],processor[1],enter),output[1],exit)
      + .27*Math.sin(Math.PI*clamp(progress/.34))
      + .20*Math.sin(Math.PI*clamp((progress-.66)/.34))*(progress>.66?1:0),
    lerp(lerp(input[2],processor[2],enter),output[2],exit),
  ];
  return {
    phase:taskPhase(progress),
    progress,
    point,
    dyed:smooth((progress-.35)/.31),
    rotation:progress>.0&&progress<1 ? .18*Math.sin(progress*Math.PI*2) : 0,
  };
};
export const completedCount = (frame:number,kind:Kind) =>
  Array.from({length:TASKS},(_,i)=>taskAt(frame,kind,i).phase)
    .filter(p=>p==='done').length;
export const workingCount = (frame:number,kind:Kind) =>
  Array.from({length:TASKS},(_,i)=>taskAt(frame,kind,i).phase)
    .filter(p=>p==='entering'||p==='processing'||p==='leaving').length;

