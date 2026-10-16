import React,{useLayoutEffect} from 'react';
import {AbsoluteFill,useCurrentFrame} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {
  TASKS,TASK_CUBE_SIZE,CPU_CORES,GPU_LANES,CENTER,
  cameraAt,completedCount,workingCount,taskAt,stageAt,smooth,
  storyBeatAt,storyOpacityAt,handoverProgressAt,handoverOpacityAt,
  PERSPECTIVE_FOV,ORIGINAL_FRAMES,shapeAt,
  mixedTaskAt,mixedCompletedCount,mixedWorkingCount,mixedIdleLanes,
  corePosition,type Kind,type Shape,
} from './model';

const WHITE='#e7e6e1';
const BLUE='#418ca7';
const CPU='#b78057';
const GPU='#648e9e';
type Vec=[number,number,number];
type BlockProps={
  pos:Vec;size:Vec;color:string;metal?:number;
  opacity?:number;rotation?:Vec;glow?:string;power?:number;
};
const Block:React.FC<BlockProps>=({
  pos,size,color,metal=.08,opacity=1,rotation=[0,0,0],
  glow='#000000',power=0,
})=>(
  <mesh position={pos} rotation={rotation}>
    <boxGeometry args={size}/>
    <meshStandardMaterial color={color} metalness={metal} roughness={.51}
      emissive={glow} emissiveIntensity={power}
      transparent={opacity<1} opacity={opacity} depthWrite={opacity>=.999}/>
  </mesh>
);

const Camera:React.FC<{frame:number}>=({frame})=>{
  const {camera}=useThree();
  useLayoutEffect(()=>{
    const {focusX,distance,yaw,pitch,targetY}=cameraAt(frame);
    // Real perspective: the dolly distance changes on zoom cues. Yaw and pitch
    // still orbit the target, now with natural near/far size differences.
    if(!(camera instanceof THREE.PerspectiveCamera)){
      throw new Error('CPU/GPU must use a PerspectiveCamera');
    }
    const radius=distance;
    camera.position.set(
      focusX+radius*Math.cos(pitch)*Math.sin(yaw),
      targetY+radius*Math.sin(pitch),
      radius*Math.cos(pitch)*Math.cos(yaw),
    );
    camera.lookAt(focusX,targetY,0);
    // PerspectiveCamera.zoom stays at 1: no orthographic-style scaling.
    camera.updateProjectionMatrix();
  },[camera,frame]);
  return null;
};

/** CPU/GPU both have a complete, solid top slab; no cutaway hole or lid. */
const Package:React.FC<{kind:Kind}>=({kind})=>{
  const metal=kind==='cpu'?'#b8b4a9':'#aab6b9';
  const die=kind==='cpu'?'#59676b':'#4e6773';
  const edge=kind==='cpu'?'#cab58c':'#b6aca0';
  return <group>
    <Block pos={[0,-.58,0]} size={[6.55,.34,6.55]} color="#465359" metal={.3}/>
    <Block pos={[0,-.38,0]} size={[6.43,.10,6.43]} color={metal} metal={.46}/>
    <Block pos={[0,-.23,0]} size={[5.53,.30,5.53]} color={die} metal={.45}/>
    <Block pos={[0,-.065,0]} size={[5.37,.028,5.37]}
      color={kind==='cpu'?'#65757a':'#67848c'} metal={.26}/>
    {Array.from({length:8},(_,i)=>{
      const n=(i-3.5)*.70;
      return <React.Fragment key={i}>
        <Block pos={[n,-.56,-3.35]} size={[.33,.10,.25]} color={edge} metal={.66}/>
        <Block pos={[n,-.56,3.35]} size={[.33,.10,.25]} color={edge} metal={.66}/>
        <Block pos={[-3.35,-.56,n]} size={[.25,.10,.33]} color={edge} metal={.66}/>
        <Block pos={[3.35,-.56,n]} size={[.25,.10,.33]} color={edge} metal={.66}/>
      </React.Fragment>;
    })}
  </group>;
};

const CpuDie:React.FC<{frame:number}>=({frame})=><group>
  {Array.from({length:CPU_CORES},(_,i)=>{
    const [x,,z]=corePosition('cpu',i);
    const active=Array.from({length:TASKS},(_,t)=>t).some(t=>
      t%CPU_CORES===i&&
      (frame<ORIGINAL_FRAMES?taskAt(frame,'cpu',t).phase==='processing':
        mixedTaskAt(frame,'cpu',t).active));
    return <group key={i}>
      <Block pos={[x,-.003,z]} size={[2.02,.12,2.03]}
        color="#997e69" metal={.29}/>
      <Block pos={[x,.070,z]} size={[1.86,.027,1.88]}
        color={active?'#e0b28e':'#c19d81'} metal={.18}
        glow={CPU} power={active?.18:.005}/>
      <Block pos={[x-.42,.087,z]} size={[.20,.01,.79]} color="#a68a71"/>
      <Block pos={[x+.42,.087,z]} size={[.20,.01,.79]} color="#a68a71"/>
    </group>;
  })}
</group>;

const GpuDie:React.FC<{frame:number}>=({frame})=><group>
  {Array.from({length:GPU_LANES},(_,i)=>{
    const [x,,z]=corePosition('gpu',i);
    const active=frame<ORIGINAL_FRAMES?
      taskAt(frame,'gpu',i).phase==='processing':
      mixedTaskAt(frame,'gpu',i).active;
    const idle=frame>=ORIGINAL_FRAMES&&mixedTaskAt(frame,'gpu',i).idle;
    return <group key={i}>
      <Block pos={[x,-.003,z]} size={[.89,.105,1.02]}
        color="#547886" metal={.25}/>
      <Block pos={[x,.058,z]} size={[.77,.020,.89]}
        color={active?'#b0d8df':idle?'#5b777e':'#8aabb4'} metal={.16}
        glow={GPU} power={active?.20:.005}/>
    </group>;
  })}
</group>;

/** The two distant pads are destinations, NOT conveyor mechanisms. */
const JobStations:React.FC=()=>(
  <>
    <Block pos={[-5.95,-.14,0]} size={[2.55,.065,2.70]} color="#cbc9c1"/>
    <Block pos={[6.25,-.14,0]} size={[2.55,.065,2.70]} color="#a7c7cb"/>
  </>
);

const TaskCube:React.FC<{kind:Kind;index:number;frame:number}>=
({kind,index,frame})=>{
  const state=taskAt(frame,kind,index);
  const p=state.progress;
  const inside=smooth((p-.27)/.13)*(1-smooth((p-.60)/.12));
  // Complete the clearing BEFORE the next workload is mounted.
  // The last act-I result is invisible on frame 323, and on frame 324 all
  // original TaskCube meshes are unmounted, never merely opacity=0.
  const fade=1-smooth((frame-(ORIGINAL_FRAMES-14))/13);
  const size=TASK_CUBE_SIZE*state.coreScale;
  const pos:Vec=[
    state.point[0],state.point[1]-.20*inside,state.point[2],
  ];
  const color=new THREE.Color(WHITE).lerp(new THREE.Color(BLUE),state.dyed);
  return <Block pos={pos} size={[size,size,size]}
    color={'#'+color.getHexString()} rotation={[0,state.rotation,0]}
    opacity={fade}/>;
};


/** One shared silhouette palette: 4 cubes, spheres, tetrahedra and cylinders. */
const ShapeGeometry:React.FC<{shape:Shape}>=({shape})=>{
  if(shape==='sphere')return <sphereGeometry args={[.30,18,12]}/>;
  if(shape==='tetrahedron')return <tetrahedronGeometry args={[.42,0]}/>;
  if(shape==='cylinder')return <cylinderGeometry args={[.265,.265,.56,16]}/>;
  return <boxGeometry args={[.53,.53,.53]}/>;
};

/**
 * Four shapes stand for four DIFFERENT execution branches. All geometry
 * remains in one ThreeCanvas; task positions are evaluated from the frame,
 * so seeking and restarting reproduce the exact same shot.
 */
const MixedTask:React.FC<{kind:Kind;index:number;frame:number}>=
({kind,index,frame})=>{
  const state=mixedTaskAt(frame,kind,index);
  const appear=smooth((frame-327-(index%4)*2-Math.floor(index/4))/24);
  const shade=new THREE.Color(WHITE)
    .lerp(new THREE.Color('#98a3a5'),state.idle?.56:0)
    .lerp(new THREE.Color(BLUE),state.dyed);
  const scale=appear*state.coreScale;
  return <mesh
    position={[
      state.point[0],
      state.point[1]+.78*(1-appear),
      state.point[2],
    ]}
    scale={[scale,scale,scale]}
    rotation={[.06,state.rotation,shapeAt(index)==='tetrahedron'?.19:0]}>
    <ShapeGeometry shape={shapeAt(index)}/>
    <meshStandardMaterial color={'#'+shade.getHexString()}
      metalness={.08} roughness={.46}
      emissive={state.active?BLUE:'#000000'}
      emissiveIntensity={state.active?.14:0}/>
  </mesh>;
};

const Chip:React.FC<{kind:Kind;frame:number}>=({kind,frame})=>
  <group position={[CENTER[kind],0,0]}>
    <Package kind={kind}/>
    {kind==='cpu'?<CpuDie frame={frame}/>:<GpuDie frame={frame}/>}
    <JobStations/>
    {frame<ORIGINAL_FRAMES&&Array.from({length:TASKS},(_,i)=>(
      <TaskCube key={i} kind={kind} index={i} frame={frame}/>
    ))}
    {frame>=ORIGINAL_FRAMES&&Array.from({length:TASKS},(_,i)=>(
      <MixedTask key={i} kind={kind} index={i} frame={frame}/>
    ))}
  </group>;

const World:React.FC<{frame:number}>=({frame})=>(
  <>
    <Camera frame={frame}/>
    <ambientLight intensity={1.55}/>
    <directionalLight position={[-7,16,12]} intensity={2.55} color="#fff7eb"/>
    <directionalLight position={[11,8,-7]} intensity={.78} color="#e4eff2"/>
    <Chip kind="cpu" frame={frame}/>
    <Chip kind="gpu" frame={frame}/>
  </>
);

const Caption:React.FC<{frame:number}>=({frame})=>{
  const label={
    cpu:'第一轮 · 相同任务｜CPU 四核心分批处理',
    gpu:'第一轮 · 相同任务｜GPU 十六路并行',
    compare:'第一轮 · 相同任务｜并行效率对比',
    'mixed-intro':'第二轮 · 不同形状代表不同任务分支',
    'mixed-cpu':'第二轮 · 分歧任务｜CPU 核心独立工作',
    'mixed-gpu':'第二轮 · 分歧任务｜GPU 分支导致等待',
    'mixed-compare':'第二轮 · 分歧任务｜两种处理方式',
  }[stageAt(frame)];
  return <div aria-hidden="true" style={{
    position:'absolute',top:56,left:62,pointerEvents:'none',
    fontFamily:'"Noto Sans CJK SC","Microsoft YaHei",system-ui,sans-serif',
    fontWeight:650,fontSize:31,letterSpacing:.4,color:'#343c40',
  }}><span>{label}</span></div>;
};


/**
 * Short, animated editorial beats layered over the unchanged native WebGL.
 * Unlike a static slide, a neutral-color diagonal wipe crosses the actual
 * chip camera shot as completed cubes disappear and new shapes fly in.
 * Only one major title is ever visible; no extra charts or text panels.
 */
const StoryAnnouncement:React.FC<{frame:number}>=({frame})=>{
  const beat=storyBeatAt(frame);
  const opacity=storyOpacityAt(frame);
  const wipeOpacity=handoverOpacityAt(frame);
  const sweep=handoverProgressAt(frame);
  const second=beat==='round-two';
  const gpuWin=beat==='gpu-wins';
  const cpuWin=beat==='cpu-wins';
  const entering=second?smooth((frame-324)/12):
    gpuWin?smooth((frame-276)/12):smooth((frame-700)/12);
  const foreground=gpuWin?'#3b7892':cpuWin?'#aa7450':'#344951';
  const left=second?'50%':gpuWin?'68%':'32%';
  return <>
    <div aria-hidden="true" data-testid="cpu-gpu-round-wipe"
      data-active={wipeOpacity>.02?'true':'false'}
      style={{
        position:'absolute',zIndex:2,top:'-17%',left:'-48%',
        width:'96%',height:'135%',pointerEvents:'none',
        background:'linear-gradient(90deg,transparent 0%,#e6e9e7 32%,#f4f0e7 75%,transparent 100%)',
        opacity:wipeOpacity*.97,
        transform:`translateX(${-85+220*sweep}%) rotate(-10deg)`,
      }}/>
    {beat!=='none'&&<div aria-hidden="true"
      data-testid="cpu-gpu-story-title" data-beat={beat}
      style={{
        position:'absolute',zIndex:3,
        top:second?'42%':'50%',left,
        transform:`translate(-50%,-50%) translateY(${(1-entering)*25}px) scale(${.96+.04*entering})`,
        opacity,pointerEvents:'none',textAlign:'center',
        whiteSpace:'nowrap',
        background:'rgba(246,244,238,.92)',
        padding:second?'22px 43px 25px':'17px 34px 21px',
        borderRadius:9,
        fontFamily:'"Noto Sans CJK SC","Microsoft YaHei",system-ui,sans-serif',
        boxShadow:'0 9px 42px rgba(67,79,80,.07)',
      }}>
      <div style={{
        fontSize:second?24:20,fontWeight:650,
        letterSpacing:second?5:3,color:'#68777b',
        marginBottom:7,
      }}>
        {second?'第二轮 · 新的挑战':
          gpuWin?'第一轮 · 相同任务':'第二轮 · 分歧任务'}
      </div>
      <div style={{
        fontSize:second?65:63,lineHeight:1.14,
        fontWeight:820,letterSpacing:second?3:1,
        color:foreground,
      }}>
        {second?'16 个混合任务':gpuWin?'GPU 胜出':'CPU 胜出'}
      </div>
      {second&&<div style={{
        fontSize:22,fontWeight:540,color:'#667378',
        letterSpacing:1,marginTop:10,
      }}>方块 · 球体 · 四面体 · 圆柱</div>}
    </div>}
  </>;
};

export const CpuGpuScene:React.FC=()=>{
  const frame=useCurrentFrame();
  return <AbsoluteFill data-testid="cpu-gpu-native-scene"
    data-renderer="react-threejs-webgl"
    data-chip-design="complete-silicon-top"
    data-workload={stageAt(frame)}
    data-story-beat={storyBeatAt(frame)}
    data-story-opacity={storyOpacityAt(frame)}
    data-handover-opacity={handoverOpacityAt(frame)}
    data-cpu-location={CENTER.cpu}
    data-gpu-location={CENTER.gpu}
    data-camera-zoom={cameraAt(frame).zoom}
    data-camera-projection="perspective"
    data-camera-fov={PERSPECTIVE_FOV}
    data-camera-distance={cameraAt(frame).distance}
    data-camera-yaw={cameraAt(frame).yaw}
    data-camera-pitch={cameraAt(frame).pitch}
    data-task-count={TASKS}
    data-original-task-meshes={frame<ORIGINAL_FRAMES?TASKS*2:0}
    data-mixed-task-meshes={frame>=ORIGINAL_FRAMES?TASKS*2:0}
    data-cpu-done={completedCount(frame,'cpu')}
    data-gpu-done={completedCount(frame,'gpu')}
    data-cpu-working={workingCount(frame,'cpu')}
    data-gpu-working={workingCount(frame,'gpu')}
    data-mixed-task-count={frame>=ORIGINAL_FRAMES?TASKS:0}
    data-mixed-cpu-done={mixedCompletedCount(frame,'cpu')}
    data-mixed-gpu-done={mixedCompletedCount(frame,'gpu')}
    data-mixed-cpu-working={mixedWorkingCount(frame,'cpu')}
    data-mixed-gpu-working={mixedWorkingCount(frame,'gpu')}
    data-mixed-gpu-idle={mixedIdleLanes(frame)}
    style={{background:'linear-gradient(#f4f0e7,#e8e2d9)',overflow:'hidden'}}>
    <ThreeCanvas width={1280} height={720}
      camera={{position:[CENTER.cpu+7,12,19],fov:PERSPECTIVE_FOV,near:.1,far:160}}
      gl={{alpha:true,antialias:true,preserveDrawingBuffer:true}}
      style={{position:'absolute',inset:0,width:1280,height:720,background:'transparent'}}>
      <World frame={frame}/>
    </ThreeCanvas>
    <Caption frame={frame}/>
    <StoryAnnouncement frame={frame}/>
  </AbsoluteFill>;
};
