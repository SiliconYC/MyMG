/**
 * One concrete workload: 16 gray task cubes are processed into 16 blue results.
 * The same spatial input/work/output model drives both processors.
 *
 * This is an illustration of parallel execution, NOT a benchmark. Every task
 * trajectory and camera position is a pure function of Remotion frame.
 */
export const FPS = 30;
export const DURATION = 600;
export const TASKS = 16;
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
  frame < 80 ? 'task' : frame < 292 ? 'cpu' :
  frame < 424 ? 'gpu' : 'compare';

export const cameraAt = (frame:number) => {
  const cpu = smooth((frame - 66) / 55);
  const gpu = smooth((frame - 278) / 56);
  const both = smooth((frame - 400) / 65);
  return {
    focusX: -6.5 * cpu + 13 * gpu - 6.5 * both,
    zoom: 114 - 24 * cpu - 35 * both,
    angle: .11 * smooth((frame-104)/45) - .11 * both,
  };
};

/** Explicit reset for the final side-by-side replay. */
export const jobStart = (frame:number,kind:Kind,index:number) => {
  if(frame >= 424) return kind==='cpu'
    ? 480 + Math.floor(index/CPU_CORES)*28 : 480;
  if(kind==='cpu')return 126 + Math.floor(index/CPU_CORES)*38;
  return 334;
};
export const jobDuration = (frame:number,kind:Kind) =>
  frame>=424 ? (kind==='cpu'?28:36) : (kind==='cpu'?36:44);

/** The entering/processing/leaving phases all have visually distinct motion. */
export const jobProgress = (frame:number,kind:Kind,index:number) => {
  // The other engine is held at its initial tasks until its own scene begins.
  if(frame < 424 && ((kind==='cpu' && frame<80) || (kind==='gpu' && frame<292))) return 0;
  return clamp((frame-jobStart(frame,kind,index))/jobDuration(frame,kind));
};
export const taskPhase = (p:number):TaskPhase =>
  p<=0?'waiting':p<.34?'entering':p<.66?'processing':p<1?'leaving':'done';

export const taskPositions = (kind:Kind,index:number): {
  input:Point; processor:Point; output:Point;
} => {
  const wave=Math.floor(index/4),lane=index%4;
  const z=(lane-1.5)*1.43;
  if(kind==='cpu')return {
    input:[-3.60+wave*.52,.45,z],
    processor:[-.15,.58,z],
    output:[2.05+wave*.52,.45,z],
  };
  return {
    input:[-3.60+lane*.52,.45,(wave-1.5)*1.43],
    processor:[(lane-1.5)*.52,.58,(wave-1.5)*1.43],
    output:[2.05+lane*.52,.45,(wave-1.5)*1.43],
  };
};
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

/** The introduction physically performs the same one-cube transformation. */
export const sampleAt = (frame:number) => {
  const p=clamp((frame-15)/46);
  return {
    x:-1.8 + 3.6*smooth(p),
    y:.55+.43*Math.sin(Math.PI*p),
    dyed:smooth((p-.29)/.43),
  };
};
