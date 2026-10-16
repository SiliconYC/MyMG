import React, {useLayoutEffect} from 'react';
import {AbsoluteFill,useCurrentFrame} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {
  TASKS, TASK_CUBE_SIZE, CPU_CORES, GPU_LANES, cameraAt, completedCount, workingCount,
  taskAt, stageAt, smooth, corePosition, taskOpacity, taskScale,
  type Kind,
} from './model';

// Warm HBM-like studio lighting. Task color means one thing ONLY:
// neutral = queued; cyan = the same task has been computed.
const QUEUED='#e7e6e1';
const FINISHED='#418ca7';
const CPU='#b78057';
const GPU='#648e9e';
const CENTER:Record<Kind,number>={cpu:-6.5,gpu:6.5};
type Vec=[number,number,number];
type BoxProps={pos:Vec;size:Vec;color:string;metal?:number;opacity?:number;
  rotation?:Vec;glow?:string;power?:number};
const Box:React.FC<BoxProps>=({
  pos,size,color,metal=.08,opacity=1,rotation=[0,0,0],glow='#000000',power=0,
})=>(
  <mesh position={pos} rotation={rotation}>
    <boxGeometry args={size}/>
    <meshStandardMaterial color={color} metalness={metal} roughness={.51}
      emissive={glow} emissiveIntensity={power}
      transparent={opacity<1} opacity={opacity}
      depthWrite={opacity>=.999}/>
  </mesh>
);

const Camera:React.FC<{frame:number}>=({frame})=>{
  const {camera}=useThree();
  useLayoutEffect(()=>{
    const {focusX,zoom,angle,targetY}=cameraAt(frame);
    camera.position.set(focusX+4.5+angle*5,12,19-angle*9);
    camera.lookAt(focusX,targetY,0);
    if(camera instanceof THREE.OrthographicCamera)camera.zoom=zoom;
    camera.updateProjectionMatrix();
  },[camera,frame]);
  return null;
};

/**
 * One continuous, solid chip top. The previous exposed 5.5-wide black
 * "well" surrounded by thick borders read as the top having been sawed off.
 * Now the die is a FULL, low-profile slab with an uninterrupted top plane.
 * Core shapes are shallow markings ABOVE its surface rather than holes.
 */
const Package:React.FC<{kind:Kind}>=({kind})=>{
  const metal=kind==='cpu'?'#b8b4a9':'#aab6b9';
  const die=kind==='cpu'?'#59676b':'#4e6773';
  const edge=kind==='cpu'?'#cab58c':'#b6aca0';
  return <group>
    <Box pos={[0,-.58,0]} size={[6.55,.34,6.55]} color="#465359" metal={.30}/>
    <Box pos={[0,-.38,0]} size={[6.43,.10,6.43]} color={metal} metal={.46}/>
    {/* Die has a real top and real side faces; no recess, hole or cutout. */}
    <Box pos={[0,-.23,0]} size={[5.53,.30,5.53]} color={die} metal={.45}/>
    <Box pos={[0,-.065,0]} size={[5.37,.028,5.37]}
      color={kind==='cpu'?'#65757a':'#67848c'} metal={.26}/>
    {Array.from({length:8},(_,i)=>{
      const n=(i-3.5)*.70;
      return <React.Fragment key={i}>
        <Box pos={[n,-.56,-3.35]} size={[.33,.10,.25]} color={edge} metal={.66}/>
        <Box pos={[n,-.56,3.35]} size={[.33,.10,.25]} color={edge} metal={.66}/>
        <Box pos={[-3.35,-.56,n]} size={[.25,.10,.33]} color={edge} metal={.66}/>
        <Box pos={[3.35,-.56,n]} size={[.25,.10,.33]} color={edge} metal={.66}/>
      </React.Fragment>;
    })}
  </group>;
};

/** CPU: exactly four LARGE arithmetic cores, flush on the complete die top. */
const CpuDie:React.FC<{frame:number}>=({frame})=><group>
  {Array.from({length:CPU_CORES},(_,i)=>{
    const [x,,z]=corePosition('cpu',i);
    const active=Array.from({length:TASKS},(_,t)=>t).some(t=>
      t%CPU_CORES===i && taskAt(frame,'cpu',t).phase==='processing');
    return <group key={i}>
      <Box pos={[x,-.003,z]} size={[2.02,.12,2.03]} color="#997e69" metal={.29}/>
      <Box pos={[x,.070,z]} size={[1.86,.027,1.88]}
        color={active?'#e0b28e':'#c19d81'} metal={.18}
        glow={CPU} power={active?.18:.005}/>
      {/* Minimal tile seam makes each core read as part of one intact silicon top. */}
      <Box pos={[x-.42,.087,z]} size={[.20,.01,.79]} color="#a68a71"/>
      <Box pos={[x+.42,.087,z]} size={[.20,.01,.79]} color="#a68a71"/>
    </group>;
  })}
</group>;

/** GPU: complete same-size die with an etched 4x4 lightweight lane grid. */
const GpuDie:React.FC<{frame:number}>=({frame})=><group>
  {Array.from({length:GPU_LANES},(_,i)=>{
    const [x,,z]=corePosition('gpu',i);
    const active=taskAt(frame,'gpu',i).phase==='processing';
    return <group key={i}>
      <Box pos={[x,-.003,z]} size={[.89,.105,1.02]} color="#547886" metal={.25}/>
      <Box pos={[x,.058,z]} size={[.77,.020,.89]}
        color={active?'#b0d8df':'#8aabb4'} metal={.16}
        glow={GPU} power={active?.20:.005}/>
    </group>;
  })}
</group>;

/** Work is consumed BY the chip. The source and destination are bare cubes,
 * not disconnected rectangular factory floors. */
const TaskCube:React.FC<{kind:Kind;index:number;frame:number}>=
({kind,index,frame})=>{
  const state=taskAt(frame,kind,index);
  const progress=state.progress;
  const inside=smooth((progress-.27)/.13)*(1-smooth((progress-.60)/.12));
  const size=TASK_CUBE_SIZE*(1-.59*inside)*taskScale(frame,kind,index);
  const pos:Vec=[
    CENTER[kind]+state.point[0],
    state.point[1]-.20*inside,
    state.point[2],
  ];
  const c=new THREE.Color(QUEUED).lerp(new THREE.Color(FINISHED),state.dyed);
  return <Box pos={pos} size={[size,size,size]} color={'#'+c.getHexString()}
    opacity={taskOpacity(frame,kind,index)}
    rotation={[0,state.rotation,0]}/>;
};

const Chip:React.FC<{kind:Kind;frame:number}>=({kind,frame})=>
  <group>
    {/* Both packages stay mounted at constant scale and position. No pop-in. */}
    <group position={[CENTER[kind],0,0]}>
      <Package kind={kind}/>
      {kind==='cpu'?<CpuDie frame={frame}/>:<GpuDie frame={frame}/>}
    </group>
    {Array.from({length:TASKS},(_,i)=>(
      <TaskCube key={i} kind={kind} index={i} frame={frame}/>
    ))}
  </group>;

const Scene:React.FC<{frame:number}>=({frame})=>(
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
  const stage=stageAt(frame);
  const label={
    task:'任務：每筆數據加 1，白色待算，藍色代表完成',
    cpu:'CPU · 4 個大型核心，分批運算',
    gpu:'GPU · 16 條運算通道，同步處理',
    compare:'兩顆晶片，處理相同的 16 個任務',
  }[stage];
  return <div aria-hidden="true" style={{
    position:'absolute',top:56,left:62,pointerEvents:'none',
    fontFamily:'"Noto Sans CJK SC","Microsoft YaHei",system-ui,sans-serif',
    fontWeight:650,fontSize:31,letterSpacing:.4,color:'#343c40',
  }}>
    <span>{label}</span>
  </div>;
};

export const CpuGpuScene:React.FC=()=>{
  const frame=useCurrentFrame();
  return <AbsoluteFill data-testid="cpu-gpu-native-scene"
    data-renderer="react-threejs-webgl"
    data-chip-design="complete-silicon-top"
    data-workload={stageAt(frame)}
    data-camera-zoom={cameraAt(frame).zoom}
    data-intro-task-progress={taskAt(frame,'cpu',0).progress}
    data-intro-task-dyed={taskAt(frame,'cpu',0).dyed}
    data-task-count={TASKS}
    data-cpu-done={completedCount(frame,'cpu')}
    data-gpu-done={completedCount(frame,'gpu')}
    data-cpu-working={workingCount(frame,'cpu')}
    data-gpu-working={workingCount(frame,'gpu')}
    style={{background:'linear-gradient(#f4f0e7,#e8e2d9)',overflow:'hidden'}}>
    <ThreeCanvas orthographic width={1280} height={720}
      camera={{position:[-2,12,19],zoom:67,near:.1,far:160}}
      gl={{alpha:true,antialias:true,preserveDrawingBuffer:true}}
      style={{position:'absolute',inset:0,width:1280,height:720,background:'transparent'}}>
      <Scene frame={frame}/>
    </ThreeCanvas>
    <Caption frame={frame}/>
  </AbsoluteFill>;
};
