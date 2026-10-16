/** Two consecutive workloads use the same 16-task geometry and frame-driven Three.js. */
export const FPS=30;
export const ORIGINAL_FRAMES=324;
export const DURATION=744;
export const TASKS=16;
export const TASK_CUBE_SIZE=.40;
export const CPU_CORES=4;
export const GPU_LANES=16;
export type Kind='cpu'|'gpu';
export type Stage='cpu'|'gpu'|'compare'|
  'mixed-intro'|'mixed-cpu'|'mixed-gpu'|'mixed-compare';
export type Shape='cube'|'sphere'|'tetrahedron'|'cylinder';
export type TaskPhase='waiting'|'entering'|'processing'|'leaving'|'done';
export type Point=readonly [number,number,number];
export type CameraState={
  focusX:number;zoom:number;distance:number;
  yaw:number;pitch:number;targetY:number;
};

export const CENTER:Record<Kind,number>={cpu:-8.4,gpu:8.4};
export const CHIP_HALF=3.275;
export const GRID_STEP=.63;

// Perspective lens with extra margin for the foreshortened near chip edges.
// 'zoom' remains a framing cue; actual perspective push-ins move in 3D.
export const PERSPECTIVE_FOV=38;
export const CAMERA_FRAME_HEIGHT=720;
export const CAMERA_FRAMING_MARGIN=1.30;
export const perspectiveDistance=(framingZoom:number)=>
  CAMERA_FRAME_HEIGHT*CAMERA_FRAMING_MARGIN/
  (2*framingZoom*Math.tan(PERSPECTIVE_FOV*Math.PI/360));
export const INPUT_X=-6.9;
export const OUTPUT_X=5.25;
export const clamp=(n:number)=>Math.max(0,Math.min(1,n));
export const smooth=(n:number)=>{
  const t=clamp(n);
  return t*t*(3-2*t);
};
export const stageAt=(frame:number):Stage=>
  frame<175?'cpu':frame<250?'gpu':
  frame<ORIGINAL_FRAMES?'compare':
  frame<389?'mixed-intro':frame<549?'mixed-cpu':
  frame<689?'mixed-gpu':'mixed-compare';

/**
 * Symmetric chapter introductions and chip-anchored conclusions.
 * Only the workload changes; the 3D camera keeps its original continuous path.
 * All timings are frames, so Remotion seek and browser playback agree exactly.
 */
export type StoryBeat='none'|'round-one'|'gpu-wins'|'round-two'|'cpu-wins';
export const storyBeatAt=(frame:number):StoryBeat=>
  frame<56?'round-one':
  frame>=700?'cpu-wins':
  frame>=324&&frame<380?'round-two':
  frame>=274&&frame<316?'gpu-wins':'none';

export const storyOpacityAt=(frame:number)=>{
  switch(storyBeatAt(frame)){
    case 'round-one':return smooth(frame/11)*(1-smooth((frame-44)/12));
    case 'gpu-wins':return smooth((frame-274)/10)*
      (1-smooth((frame-306)/10));
    case 'round-two':return smooth((frame-324)/11)*
      (1-smooth((frame-368)/12));
    case 'cpu-wins':return smooth((frame-700)/10);
    default:return 0;
  }
};
/** Quiet linear-light sweep in the cut between the two workloads. */
export const handoverProgressAt=(frame:number)=>
  smooth((frame-309)/44);
export const handoverOpacityAt=(frame:number)=>
  smooth((frame-311)/11)*(1-smooth((frame-340)/12));

/**
 * Act I starts directly on the CPU: the obsolete single-tile introduction and
 * its 96 frames are removed. The remaining camera, task and mixed-workload
 * cues equal their former frame numbers minus 96.
 */
export const cameraAt=(frame:number):CameraState=>{
  if(frame>=ORIGINAL_FRAMES)return mixedCameraAt(frame);
  const gpu=smooth((frame-141)/29);
  const together=smooth((frame-236)/45);
  const zoom=70
    -7*smooth((frame-142)/12)+7*smooth((frame-154)/17)
    -35*together;
  return {
    focusX:CENTER.cpu+(CENTER.gpu-CENTER.cpu)*gpu-CENTER.gpu*together,
    zoom,
    distance:perspectiveDistance(zoom),
    yaw:-.27+.31*smooth((frame-14)/116)
      -.66*smooth((frame-141)/29)
      +.33*smooth((frame-184)/45)
      +.36*together,
    pitch:.64-.20*gpu+.08*together,
    targetY:.12,
  };
};

export const taskPhase=(p:number):TaskPhase=>
  p<=0?'waiting':p<.34?'entering':p<.66?'processing':p<1?'leaving':'done';

const lerp=(a:number,b:number,k:number)=>a+(b-a)*k;

/**
 * SHARED task trajectory for all three scenes. Source cube follows a smooth
 * arc above an exposed solid tile; it changes color at the center, never goes
 * inside a transparent box, then settles at the output pad.
 */
export const flowAt=(p:number,input:Point,processor:Point,output:Point)=>{
  const progress=clamp(p);
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
    coreScale:1-.59*smooth((progress-.27)/.13)*
      (1-smooth((progress-.60)/.12)),
  };
};

/** Input and 4×4 completed-output grids both live beyond the chip package. */
export const queuePosition=(_kind:Kind,index:number,side:'input'|'output'):Point=>{
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
export const taskPositions=(kind:Kind,index:number)=>({
  input:queuePosition(kind,index,'input'),
  processor:corePosition(kind,index),
  output:queuePosition(kind,index,'output'),
});

/** Scheduled around camera holds, not while the camera is racing between chips. */
export const jobStart=(_frame:number,kind:Kind,index:number)=>
  kind==='cpu'?5+Math.floor(index/CPU_CORES)*34:184;
export const jobDuration=(_frame:number,kind:Kind)=>kind==='cpu'?32:42;
export const jobProgress=(frame:number,kind:Kind,index:number)=>
  clamp((frame-jobStart(frame,kind,index))/jobDuration(frame,kind));
export const taskAt=(frame:number,kind:Kind,index:number)=>{
  const {input,processor,output}=taskPositions(kind,index);
  return flowAt(jobProgress(frame,kind,index),input,processor,output);
};
export const completedCount=(frame:number,kind:Kind)=>
  Array.from({length:TASKS},(_,i)=>taskAt(frame,kind,i).phase)
    .filter(x=>x==='done').length;
export const workingCount=(frame:number,kind:Kind)=>
  Array.from({length:TASKS},(_,i)=>taskAt(frame,kind,i).phase)
    .filter(x=>x==='entering'||x==='processing'||x==='leaving').length;


/**
 * ACT II – 16 dissimilar tasks. They form ONE illustrative GPU SIMD/SIMT
 * cohort containing four different control-flow paths. These are intentionally
 * divergent algorithms, not simply different meshes or a claim that all
 * heterogeneous GPU work must be slower. CPU has four independent paths.
 * Geometry is ONLY the visible shorthand for which path a task follows.
 */
export const SHAPES:readonly Shape[]=['cube','sphere','tetrahedron','cylinder'];
export const shapeIndex=(index:number)=>(index+Math.floor(index/4))%4;
export const shapeAt=(index:number):Shape=>SHAPES[shapeIndex(index)];

export const MIXED_APPEAR=337;
export const MIXED_CPU_FIRST=419;
export const MIXED_CPU_BATCH=24;
export const MIXED_CPU_DURATION=22;
export const MIXED_GPU_ENTER=555;
export const MIXED_GPU_READY=579;
export const MIXED_GPU_FIRST_PATH=581;
export const MIXED_GPU_PATH_SPACING=25;
export const MIXED_GPU_PATH_DURATION=24;

export const mixedTaskAt=(frame:number,kind:Kind,index:number)=>{
  const {input,processor,output}=taskPositions(kind,index);
  if(kind==='cpu'){
    // Core i handles the i-th job of each batch; per-core job types rotate
    // across all four shapes, instead of four specialised CPU queues.
    const start=MIXED_CPU_FIRST+Math.floor(index/CPU_CORES)*MIXED_CPU_BATCH;
    const state=flowAt((frame-start)/MIXED_CPU_DURATION,input,processor,output);
    return {...state,idle:false,active:state.phase==='processing'};
  }

  // All 16 GPU lanes enter TOGETHER, but a single divergent group must
  // serialise its four mutually exclusive control-flow paths.
  const slot=MIXED_GPU_FIRST_PATH+shapeIndex(index)*MIXED_GPU_PATH_SPACING;
  const entering=smooth((frame-MIXED_GPU_ENTER)/(MIXED_GPU_READY-MIXED_GPU_ENTER));
  const leaving=smooth((frame-(slot+15))/9);
  const processing=frame>=slot&&frame<slot+15;
  const phase:TaskPhase=
    frame<MIXED_GPU_ENTER?'waiting':
    frame<MIXED_GPU_READY?'entering':
    frame<slot?'waiting':
    processing?'processing':
    frame<slot+MIXED_GPU_PATH_DURATION?'leaving':'done';
  const point:Point=[
    lerp(lerp(input[0],processor[0],entering),output[0],leaving),
    lerp(lerp(input[1],processor[1],entering),output[1],leaving)
      +.17*Math.sin(Math.PI*entering)+.10*Math.sin(Math.PI*leaving),
    lerp(lerp(input[2],processor[2],entering),output[2],leaving),
  ];
  return {
    phase,point,
    progress:frame<MIXED_GPU_READY?entering*.30:
      .30+.7*smooth((frame-slot)/MIXED_GPU_PATH_DURATION),
    dyed:smooth((frame-(slot+2))/14),
    rotation:processing?.17*Math.sin((frame-slot)*.27):0,
    coreScale:1-.32*smooth((frame-slot)/6)*
      (1-smooth((frame-(slot+13))/7)),
    idle:frame>=MIXED_GPU_READY&&frame<slot,
    active:processing,
  };
};
export const mixedCompletedCount=(frame:number,kind:Kind)=>
  Array.from({length:TASKS},(_,i)=>mixedTaskAt(frame,kind,i).phase)
    .filter(x=>x==='done').length;
export const mixedWorkingCount=(frame:number,kind:Kind)=>
  Array.from({length:TASKS},(_,i)=>mixedTaskAt(frame,kind,i).active)
    .filter(Boolean).length;
/** Number of GPU lanes currently masked off by the divergent path. */
export const mixedIdleLanes=(frame:number)=>
  Array.from({length:TASKS},(_,i)=>mixedTaskAt(frame,'gpu',i).idle)
    .filter(Boolean).length;

/** A direct continuation of the last frame in Act I, never a new camera cut. */
export const mixedCameraAt=(frame:number):CameraState=>{
  const end=cameraAt(ORIGINAL_FRAMES-1);
  const cpu=smooth((frame-347)/40);
  const gpu=smooth((frame-519)/42);
  const wide=smooth((frame-683)/49);
  const zoom=end.zoom+35*cpu-35*wide
    -5*smooth((frame-519)/13)+5*smooth((frame-536)/22);
  return {
    focusX:end.focusX+CENTER.cpu*cpu+
      (CENTER.gpu-CENTER.cpu)*gpu-CENTER.gpu*wide,
    zoom,distance:perspectiveDistance(zoom),
    yaw:end.yaw-.27*cpu+.10*smooth((frame-394)/112)
      -.46*gpu+.10*smooth((frame-586)/85)+.53*wide,
    pitch:end.pitch+.08*cpu-.14*gpu+.06*wide,
    targetY:end.targetY,
  };
};
