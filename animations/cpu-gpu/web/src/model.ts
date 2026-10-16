/**
 * CPU / GPU storytelling model. ONE generic arithmetic cell first performs
 * (+1) on a white input and returns a blue result. The same independent job
 * then runs on CPU's 4 large cores and GPU's 16 parallel lightweight lanes.
 * Layout and every animation state are deterministic from Remotion frame.
 */
export const FPS=30;
export const DURATION=480;
export const TASKS=16;
export const TASK_CUBE_SIZE=.40;
export const CPU_CORES=4;
export const GPU_LANES=16;
export type Kind='cpu'|'gpu';
export type Stage='task'|'cpu'|'gpu'|'compare';
export type TaskPhase='waiting'|'entering'|'processing'|'leaving'|'done';
export type Point=readonly [number,number,number];

export const GENERIC_X=-26.5;
export const CENTER:Record<Kind,number>={cpu:-8.4,gpu:8.4};
export const CHIP_HALF=3.275;
/** Exterior queue and result grids are entirely outside each chip. */
export const GRID_STEP=.63;
export const INPUT_X=-6.9;
export const OUTPUT_X=5.25;
export const clamp=(n:number)=>Math.max(0,Math.min(1,n));
export const smooth=(n:number)=>{
  const t=clamp(n);
  return t*t*(3-2*t);
};
export const stageAt=(frame:number):Stage=>
  frame<108?'task':frame<308?'cpu':frame<404?'gpu':'compare';

/** Camera is one continuously moving observer; no scene or object teleport. */
export const cameraAt=(frame:number)=>{
  const cpu=smooth((frame-55)/65);
  const gpu=smooth((frame-257)/60);
  const together=smooth((frame-380)/70);
  return {
    focusX:GENERIC_X+(CENTER.cpu-GENERIC_X)*cpu+
      (CENTER.gpu-CENTER.cpu)*gpu-CENTER.gpu*together,
    zoom:70-35*together,
    angle:.055*smooth((frame-113)/48)-.055*together,
    targetY:.12,
  };
};

/** A physically separate, anonymous arithmetic unit. NEVER part of a CPU. */
export const exampleStart=0;
export const exampleDuration=60;
export const exampleProgress=(frame:number)=>clamp((frame-exampleStart)/exampleDuration);
export const exampleAt=(frame:number)=>{
  const progress=exampleProgress(frame);
  const inT=smooth(progress/.34);
  const outT=smooth((progress-.65)/.35);
  const point:Point=[
    (-2.55)*(1-inT)+2.55*outT,
    .16+.25*Math.sin(Math.PI*clamp(progress/.34))+
      .18*Math.sin(Math.PI*clamp((progress-.65)/.35)),
    0,
  ];
  return {
    phase:taskPhase(progress),
    progress,
    point,
    dyed:smooth((progress-.34)/.32),
  };
};

/** All 16 inputs and outputs form four-by-four grids OUTSIDE the package. */
export const queuePosition=(kind:Kind,index:number,side:'input'|'output'):Point=>{
  const col=index%4,row=Math.floor(index/4);
  return [
    (side==='input'?INPUT_X:OUTPUT_X)+col*GRID_STEP,
    .10,
    (row-1.5)*GRID_STEP,
  ];
};
export const corePosition=(kind:Kind,index:number):Point=>{
  if(kind==='cpu'){
    const core=index%4;
    return [core%2===0?-1.1:1.1,.36,core<2?-1.15:1.15];
  }
  return [(index%4-1.5)*1.02,.36,(Math.floor(index/4)-1.5)*1.15];
};
export const taskPositions=(kind:Kind,index:number)=>{
  return {
    input:queuePosition(kind,index,'input'),
    processor:corePosition(kind,index),
    output:queuePosition(kind,index,'output'),
  };
};

export const jobStart=(_frame:number,kind:Kind,index:number)=>
  kind==='cpu'?123+Math.floor(index/CPU_CORES)*34:326;
export const jobDuration=(_frame:number,kind:Kind)=>kind==='cpu'?32:42;
export const jobProgress=(frame:number,kind:Kind,index:number)=>
  clamp((frame-jobStart(frame,kind,index))/jobDuration(frame,kind));
export const taskPhase=(p:number):TaskPhase=>
  p<=0?'waiting':p<.34?'entering':p<.66?'processing':p<1?'leaving':'done';
const lerp=(a:number,b:number,k:number)=>a+(b-a)*k;
export const taskAt=(frame:number,kind:Kind,index:number)=>{
  const progress=jobProgress(frame,kind,index);
  const {input,processor,output}=taskPositions(kind,index);
  const enter=smooth(progress/.34);
  const exit=smooth((progress-.66)/.34);
  const point:Point=[
    lerp(lerp(input[0],processor[0],enter),output[0],exit),
    lerp(lerp(input[1],processor[1],enter),output[1],exit)+
      .20*Math.sin(Math.PI*clamp(progress/.34))+
      .13*Math.sin(Math.PI*clamp((progress-.66)/.34)),
    lerp(lerp(input[2],processor[2],enter),output[2],exit),
  ];
  return {
    phase:taskPhase(progress),
    progress,
    point,
    dyed:smooth((progress-.34)/.32),
    rotation:progress>0&&progress<1?.18*Math.sin(progress*Math.PI*2):0,
  };
};
export const completedCount=(frame:number,kind:Kind)=>
  Array.from({length:TASKS},(_,i)=>taskAt(frame,kind,i).phase)
    .filter(x=>x==='done').length;
export const workingCount=(frame:number,kind:Kind)=>
  Array.from({length:TASKS},(_,i)=>taskAt(frame,kind,i).phase)
    .filter(x=>x==='entering'||x==='processing'||x==='leaving').length;
