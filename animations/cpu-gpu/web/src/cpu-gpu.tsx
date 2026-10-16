import React, {useLayoutEffect} from 'react';
import {AbsoluteFill,useCurrentFrame} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {
  TASKS, TASK_CUBE_SIZE, CPU_CORES, GPU_LANES, cameraAt, completedCount, workingCount,
  taskAt, stageAt, smooth, corePosition, lidOpening,
  type Kind,
} from './model';

// Warm HBM-like studio lighting. Task color means one thing ONLY:
// neutral = queued; cyan = the same task has been computed.
const QUEUED='#c3c5c1';
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

/** A recognizable single processor package, not three disconnected tracks. */
const Package:React.FC<{kind:Kind}>=({kind})=>{
  const copper=kind==='cpu'?'#c1a87d':'#b29a70';
  const silicon=kind==='cpu'?'#39434c':'#263e4a';
  return <group>
    {/* Square PCB/ceramic substrate with layered edge and one central silicon die. */}
    <Box pos={[0,-.58,0]} size={[6.55,.34,6.55]} color="#39474d" metal={.36}/>
    <Box pos={[0,-.385,0]} size={[6.37,.07,6.37]} color="#7e8c86" metal={.18}/>
    <Box pos={[0,-.25,0]} size={[5.50,.25,5.50]} color={silicon} metal={.48}/>
    <Box pos={[0,-.115,0]} size={[5.27,.025,5.27]} color="#4d5b60" metal={.25}/>
    {/* Just eight edge contacts on each side, visible enough to read as a chip. */}
    {Array.from({length:8},(_,i)=>{
      const n=(i-3.5)*.70;
      return <React.Fragment key={i}>
        <Box pos={[n,-.56,-3.35]} size={[.33,.10,.25]} color={copper} metal={.7}/>
        <Box pos={[n,-.56,3.35]} size={[.33,.10,.25]} color={copper} metal={.7}/>
        <Box pos={[-3.35,-.56,n]} size={[.25,.10,.33]} color={copper} metal={.7}/>
        <Box pos={[3.35,-.56,n]} size={[.25,.10,.33]} color={copper} metal={.7}/>
      </React.Fragment>;
    })}
    {/* A restrained metal perimeter clearly frames the exposed die. */}
    {[-1,1].map(side=><React.Fragment key={side}>
      <Box pos={[side*2.69,-.08,0]} size={[.07,.09,5.45]} color="#b1afa9" metal={.63}/>
      <Box pos={[0,-.08,side*2.69]} size={[5.45,.09,.07]} color="#b1afa9" metal={.63}/>
    </React.Fragment>)}
  </group>;
};

/** CPU: four large, distinct cores and two quiet cache stripes. */
const CpuDie:React.FC<{frame:number}>=({frame})=><group>
  {Array.from({length:CPU_CORES},(_,i)=>{
    const [x,,z]=corePosition('cpu',i);
    const active=Array.from({length:TASKS},(_,t)=>t).some(t=>
      t%CPU_CORES===i && taskAt(frame,'cpu',t).phase==='processing');
    return <group key={i}>
      <Box pos={[x,.105,z]} size={[1.91,.32,1.90]} color="#745b4c" metal={.32}/>
      <Box pos={[x,.28,z]} size={[1.69,.075,1.68]}
        color={active?'#efc6a4':'#c29c80'} metal={.22}
        glow={CPU} power={active?.34:.025}/>
      {/* Two visible internal arithmetic sub-blocks, no microcircuit spaghetti. */}
      <Box pos={[x-.36,.326,z]} size={[.32,.02,.91]} color="#957b68" metal={.25}/>
      <Box pos={[x+.36,.326,z]} size={[.32,.02,.91]} color="#957b68" metal={.25}/>
    </group>;
  })}
  {/* Cache is secondary and visibly unlike a fifth core. */}
  {[-1,1].map(s=><Box key={s} pos={[0,-.065,s*2.49]} size={[3.8,.06,.17]}
    color="#a2a6a1" metal={.25}/>)}
</group>;

/** GPU: same die footprint, but 16 small parallel lanes in a dense matrix. */
const GpuDie:React.FC<{frame:number}>=({frame})=><group>
  {Array.from({length:GPU_LANES},(_,i)=>{
    const [x,,z]=corePosition('gpu',i);
    const active=taskAt(frame,'gpu',i).phase==='processing';
    return <group key={i}>
      <Box pos={[x,.105,z]} size={[.88,.28,1.00]} color="#47616c" metal={.30}/>
      <Box pos={[x,.26,z]} size={[.74,.07,.86]}
        color={active?'#b3dbe2':'#83a7b1'} metal={.18}
        glow={GPU} power={active?.42:.015}/>
    </group>;
  })}
</group>;

/** Brief packaging reveal makes it immediately read as a semiconductor chip. */
const Lid:React.FC<{frame:number;kind:Kind}>=({frame,kind})=>{
  const open=lidOpening(frame,kind);
  const tone=kind==='cpu'?'#c5c4bc':'#9cbbc2';
  // Keep the same mesh through the whole film. The former return-null at
  // open>=.998 created an unmistakable one-frame disappearance.
  // Raise and slide backwards inside the camera framing, then fade softly.
  const alpha=1-smooth((open-.61)/.39);
  return <group position={[0,1.26*open,-2.10*open]}>
    <Box pos={[0,.58,0]} size={[5.50,.29,5.50]} color={tone} metal={.73}
      opacity={alpha}/>
    <Box pos={[0,.734,0]} size={[4.55,.027,4.55]}
      color={kind==='cpu'?'#dad7cf':'#acc5c9'} metal={.52}
      opacity={alpha}/>
  </group>;
};

/** Work is consumed BY the chip. The source and destination are bare cubes,
 * not disconnected rectangular factory floors. */
const TaskCube:React.FC<{kind:Kind;index:number;frame:number}>=
({kind,index,frame})=>{
  const state=taskAt(frame,kind,index);
  const progress=state.progress;
  const inside=smooth((progress-.27)/.13)*(1-smooth((progress-.60)/.12));
  const size=TASK_CUBE_SIZE*(1-.59*inside);
  const pos:Vec=[
    CENTER[kind]+state.point[0],
    state.point[1]-.22*inside,
    state.point[2],
  ];
  const c=new THREE.Color(QUEUED).lerp(new THREE.Color(FINISHED),state.dyed);
  return <Box pos={pos} size={[size,size,size]} color={'#'+c.getHexString()}
    rotation={[0,state.rotation,0]}/>;
};

const Chip:React.FC<{kind:Kind;frame:number}>=({kind,frame})=>
  <group>
    {/* Both packages stay mounted at constant scale and position. No pop-in. */}
    <group position={[CENTER[kind],0,0]}>
      <Package kind={kind}/>
      {kind==='cpu'?<CpuDie frame={frame}/>:<GpuDie frame={frame}/>}
      <Lid kind={kind} frame={frame}/>
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
    task:'灰色任務即將進入 CPU 晶片',
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
    data-chip-design="package-with-exposed-silicon"
    data-workload={stageAt(frame)}
    data-camera-zoom={cameraAt(frame).zoom}
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
