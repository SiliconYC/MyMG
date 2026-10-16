/**
 * Teaching model: apply the SAME small operation (add one) to sixteen inputs.
 * Neutral cubes represent queued values; blue cubes indicate completed work.
 * All camera, timing and geometry states derive from the Remotion frame.
 *
 * Neither counts nor animation speed claims real CPU/GPU benchmark results.
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

export const clamp = (n:number) => Math.max(0,Math.min(1,n));
export const smooth = (n:number) => {
  const t=clamp(n);
  return t*t*(3-2*t);
};
export const stageAt = (frame:number):Stage =>
  frame < 70 ? 'task' : frame < 271 ? 'cpu' :
  frame < 397 ? 'gpu' : 'compare';

/** No cuts: watch one real job, then CPU batches, GPU parallel wave, wide shot. */
export const cameraAt = (frame:number) => {
  const gpu=smooth((frame-243)/67);
  const together=smooth((frame-376)/72);
  return {
    focusX:-8.4+16.8*gpu-8.4*together,
    zoom:67-27*together,
    angle:.07*smooth((frame-90)/65)-.07*together,
    targetY:.15,
  };
};

/**
 * Intro is not a separate decorative object: CPU task ZERO immediately starts
 * at frame 0, completes around frame 64 and stays blue at the output.
 * The other fifteen jobs then continue on the same real 3D die.
 */
export const jobStart = (_frame:number,kind:Kind,index:number) =>
  kind==='gpu' ? 313 :
  index===0 ? 0 :
  index<4 ? 72 :
  110+(Math.floor(index/CPU_CORES)-1)*38;
export const jobDuration = (_frame:number,kind:Kind,index=1) =>
  kind==='cpu'&&index===0 ? 64 : kind==='cpu'?36:44;
export const jobProgress = (frame:number,kind:Kind,index:number) =>
  clamp((frame-jobStart(frame,kind,index))/jobDuration(frame,kind,index));
export const taskPhase = (p:number):TaskPhase =>
  p<=0?'waiting':p<.34?'entering':p<.66?'processing':p<1?'leaving':'done';

export const corePosition = (kind:Kind,index:number):Point => {
  if(kind==='cpu')return [
    index%2===0?-1.1:1.1,
    .36,
    index<2?-1.15:1.15,
  ];
  return [
    ((index%4)-1.5)*1.02,
    .36,
    (Math.floor(index/4)-1.5)*1.15,
  ];
};
export const taskPositions = (kind:Kind,index:number):{
  input:Point;processor:Point;output:Point;
} => {
  const wave=Math.floor(index/4),lane=index%4;
  const z=(kind==='cpu'?lane:wave)-1.5;
  return {
    input:[-5.15+(kind==='cpu'?wave:lane)*.50,.45,z*1.43],
    processor:corePosition(kind,kind==='cpu'?lane:index),
    output:[3.40+(kind==='cpu'?wave:lane)*.60,.45,z*1.43],
  };
};

const lerp=(a:number,b:number,k:number)=>a+(b-a)*k;
export const taskAt=(frame:number,kind:Kind,index:number)=>{
  const progress=jobProgress(frame,kind,index);
  const {input,processor,output}=taskPositions(kind,index);
  const enter=smooth(progress/.34);
  const exit=smooth((progress-.66)/.34);
  const point:Point=[
    lerp(lerp(input[0],processor[0],enter),output[0],exit),
    lerp(lerp(input[1],processor[1],enter),output[1],exit)
      +.27*Math.sin(Math.PI*clamp(progress/.34))
      +.20*Math.sin(Math.PI*clamp((progress-.66)/.34))*(progress>.66?1:0),
    lerp(lerp(input[2],processor[2],enter),output[2],exit),
  ];
  return {
    phase:taskPhase(progress),
    progress,
    point,
    dyed:smooth((progress-.35)/.31),
    rotation:progress>0&&progress<1?.18*Math.sin(progress*Math.PI*2):0,
  };
};

/** Keep the first numeric +1 example legible before exposing the 15-job queue. */
export const taskOpacity=(frame:number,kind:Kind,index:number)=>
  kind==='cpu'&&index>0 ? smooth((frame-63)/15) : 1;
export const taskScale=(frame:number,kind:Kind,index:number)=>
  kind==='cpu'&&index===0 ? 1+.45*(1-smooth((frame-60)/14)) : 1;

export const completedCount=(frame:number,kind:Kind)=>
  Array.from({length:TASKS},(_,i)=>taskAt(frame,kind,i).phase)
    .filter(p=>p==='done').length;
export const workingCount=(frame:number,kind:Kind)=>
  Array.from({length:TASKS},(_,i)=>taskAt(frame,kind,i).phase)
    .filter(p=>p==='entering'||p==='processing'||p==='leaving').length;
