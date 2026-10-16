import React, {useLayoutEffect} from 'react';
import {AbsoluteFill,useCurrentFrame} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {
  TASKS, CPU_CORES, GPU_LANES, cameraAt, completedCount, workingCount,
  taskAt, sampleAt, stageAt, smooth, type Kind, type Point,
} from './model';

// Only two visual identities: unprocessed gray and processed blue.
// Terracotta and slate describe the mechanism, NOT additional task types.
const INPUT='#c3c5c1';
const OUTPUT='#418ca7';
const CPU_BODY='#a98063';
const GPU_BODY='#788b92';
const CENTER:Record<Kind,number>={cpu:-6.5,gpu:6.5};
type Vec=[number,number,number];

const Box:React.FC<{pos:Vec;size:Vec;color:string;metal?:number;
  opacity?:number; rotation?:Vec}> =
({pos,size,color,metal=.05,opacity=1,rotation=[0,0,0]})=>(
  <mesh position={pos} rotation={rotation}>
    <boxGeometry args={size}/>
    <meshStandardMaterial color={color} roughness={.61} metalness={metal}
      transparent={opacity<1} opacity={opacity}/>
  </mesh>
);

const Camera:React.FC<{frame:number}>=({frame})=>{
  const {camera}=useThree();
  useLayoutEffect(()=>{
    const {focusX,zoom,angle}=cameraAt(frame);
    // Cinematography is authored as 3D movement, not a CSS stage transition.
    camera.position.set(focusX+4.5+angle*5,11.5,19-angle*9);
    camera.lookAt(focusX,0,0);
    if(camera instanceof THREE.OrthographicCamera) camera.zoom=zoom;
    camera.updateProjectionMatrix();
  },[camera,frame]);
  return null;
};

const TaskCube:React.FC<{kind:Kind;index:number;frame:number}>=
({kind,index,frame})=>{
  const state=taskAt(frame,kind,index);
  const pos:Vec=[...state.point];
  const dyed=new THREE.Color(INPUT).lerp(new THREE.Color(OUTPUT),state.dyed);
  return <Box pos={pos} size={[.46,.43,.46]} color={'#'+dyed.getHexString()}
    rotation={[0,state.rotation,0]}/>;
};

const Mechanism:React.FC<{kind:Kind;frame:number}>=({kind,frame})=>{
  const center=CENTER[kind];
  const appear=smooth((frame-67)/35);
  return <group position={[center,0,0]} scale={Math.max(.001,appear)}>
    {/* Three physically separate regions: source -> machine -> destination. */}
    <Box pos={[0,-.61,0]} size={[8.35,.26,7.12]} color="#c8c5be"/>
    <Box pos={[-2.9,-.453,0]} size={[2.3,.075,6.5]} color="#b5b4af"/>
    <Box pos={[0,-.443,0]} size={[2.23,.075,6.5]} color="#bdbbb4"/>
    <Box pos={[2.94,-.453,0]} size={[2.3,.075,6.5]} color="#b1c5c8"/>
    {kind==='cpu'
      ? Array.from({length:CPU_CORES},(_,i)=>(
          <group key={i}>
            <Box pos={[-.15,-.20,(i-1.5)*1.43]} size={[1.28,.44,1.15]}
              color={CPU_BODY} metal={.22}/>
            <Box pos={[-.15,.045,(i-1.5)*1.43]} size={[.99,.07,.92]}
              color="#dbc2aa"/>
          </group>
        ))
      : Array.from({length:GPU_LANES},(_,i)=>(
          <group key={i}>
            <Box pos={[(i%4-1.5)*.52,-.23,(Math.floor(i/4)-1.5)*1.43]}
              size={[.48,.38,.87]} color={GPU_BODY} metal={.18}/>
            <Box pos={[(i%4-1.5)*.52,-.022,(Math.floor(i/4)-1.5)*1.43]}
              size={[.39,.05,.71]} color="#b5c5c7"/>
          </group>
        ))}
    {Array.from({length:TASKS},(_,i)=>(
      <TaskCube key={i} index={i} frame={frame} kind={kind}/>
    ))}
  </group>;
};

const Intro:React.FC<{frame:number}>=({frame})=>{
  if(frame>=80)return null;
  const a=1-smooth((frame-65)/14);
  const {x,y,dyed}=sampleAt(frame);
  const color=new THREE.Color(INPUT).lerp(new THREE.Color(OUTPUT),dyed);
  return <group>
    <Box pos={[-1.8,-.31,0]} size={[1.45,.15,1.45]} color="#aaa9a4" opacity={a}/>
    <Box pos={[1.8,-.31,0]} size={[1.45,.15,1.45]} color="#b1c5c8" opacity={a}/>
    <Box pos={[x,y,0]} size={[.99,.99,.99]} color={'#'+color.getHexString()} opacity={a}/>
  </group>;
};

const Scene:React.FC<{frame:number}>=({frame})=>(
  <>
    <Camera frame={frame}/>
    <ambientLight intensity={1.7}/>
    <directionalLight position={[-7,16,12]} intensity={2.5} color="#fff7eb"/>
    <directionalLight position={[11,8,-7]} intensity={.65} color="#e4eff2"/>
    <Intro frame={frame}/>
    <Mechanism kind="cpu" frame={frame}/>
    <Mechanism kind="gpu" frame={frame}/>
  </>
);

const Caption:React.FC<{frame:number}>=({frame})=>{
  const stage=stageAt(frame);
  const label={
    task:'任務：把灰色方塊變成藍色',
    cpu:'CPU · 4 個核心，分批完成',
    gpu:'GPU · 16 個單元，同時處理',
    compare:'同樣的任務，不同的並行方式',
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
    data-workload={stageAt(frame)}
    data-task-count={TASKS}
    data-cpu-done={completedCount(frame,'cpu')}
    data-gpu-done={completedCount(frame,'gpu')}
    data-cpu-working={workingCount(frame,'cpu')}
    data-gpu-working={workingCount(frame,'gpu')}
    style={{background:'linear-gradient(#f4f0e7,#e8e2d9)',overflow:'hidden'}}>
    <ThreeCanvas orthographic width={1280} height={720}
      camera={{position:[4.5,11.5,19],zoom:114,near:.1,far:160}}
      gl={{alpha:true,antialias:true,preserveDrawingBuffer:true}}
      style={{position:'absolute',inset:0,width:1280,height:720,background:'transparent'}}>
      <Scene frame={frame}/>
    </ThreeCanvas>
    <Caption frame={frame}/>
  </AbsoluteFill>;
};
