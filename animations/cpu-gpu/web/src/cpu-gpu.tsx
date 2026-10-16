import React, {useLayoutEffect} from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {
  CPU_CORES, GPU_LANES, cameraAt, cpuActivity, gpuActivity,
  cpuActiveCount, gpuActiveCount, smooth, stageAt,
} from './model';

type Vec3 = [number, number, number];
const CPU_X = -5.4;
const GPU_X = 5.4;
const CPU_COLOR = '#c46f4f';
const GPU_COLOR = '#5a99a1';

/** Deliberately plain geometry; lighting rather than decorations gives depth. */
const Block: React.FC<{
  pos: Vec3; size: Vec3; color: string;
  metal?: number; emissive?: string; power?: number;
}> = ({pos,size,color,metal=.15,emissive='#000000',power=0}) => (
  <mesh position={pos}>
    <boxGeometry args={size}/>
    <meshStandardMaterial color={color} metalness={metal} roughness={.5}
      emissive={emissive} emissiveIntensity={power}/>
  </mesh>
);

const Camera: React.FC<{frame:number}> = ({frame}) => {
  const {camera} = useThree();
  useLayoutEffect(() => {
    const {focusX,zoom}=cameraAt(frame);
    // A single real orthographic 3D camera pans CPU -> GPU -> a shared wide shot.
    camera.position.set(focusX+6.4,11.8,19);
    camera.lookAt(focusX,0,0);
    if(camera instanceof THREE.OrthographicCamera)camera.zoom=zoom;
    camera.updateProjectionMatrix();
  },[camera,frame]);
  return null;
};

const Substrate:React.FC<{x:number}> = ({x}) => (
  <group position={[x,0,0]}>
    <Block pos={[0,-.5,0]} size={[7.05,.35,7.05]} color="#353d43" metal={.35}/>
    <Block pos={[0,-.305,0]} size={[6.84,.075,6.84]} color="#555b5d" metal={.22}/>
    {/* One low-contrast contact shadow, no floor grid, traces or neon outlines. */}
    <mesh position={[0,-.715,0]} rotation={[-Math.PI/2,0,0]}>
      <planeGeometry args={[7.65,7.65]}/>
      <meshBasicMaterial color="#766f67" transparent opacity={.12} depthWrite={false}/>
    </mesh>
  </group>
);

const Cpu:React.FC<{frame:number}>=({frame}) => (
  <group>
    <Substrate x={CPU_X}/>
    {Array.from({length:CPU_CORES},(_,i)=>{
      const x=CPU_X+(i%2===0?-1.61:1.61);
      const z=i<2?-1.61:1.61;
      const activity=cpuActivity(frame,i);
      return <group key={i} position={[x,0,z]}>
        <Block pos={[0,.005,0]} size={[2.62,.44,2.62]} color="#695b52" metal={.28}/>
        <Block pos={[0,.305+.23*activity,0]} size={[2.38,.33,2.38]}
          color={activity>.2?'#dc9a73':'#b5977e'} metal={.23}
          emissive={CPU_COLOR} power={activity*.28}/>
      </group>;
    })}
  </group>
);

const Gpu:React.FC<{frame:number}>=({frame})=>{
  const energy=gpuActivity(frame);
  return <group>
    <Substrate x={GPU_X}/>
    {Array.from({length:GPU_LANES},(_,i)=>{
      const x=GPU_X+(i%8-3.5)*.79;
      const z=(Math.floor(i/8)-3.5)*.79;
      return <group key={i} position={[x,0,z]}>
        <Block pos={[0,-.03,0]} size={[.68,.30,.68]} color="#385760" metal={.25}/>
        <Block pos={[0,.19+energy*.21,0]} size={[.61,.22,.61]}
          color={energy>.2?'#8dcbd0':'#749aa1'} metal={.16}
          emissive={GPU_COLOR} power={energy*.34}/>
      </group>;
    })}
  </group>;
};

const World:React.FC<{frame:number}>=({frame})=>(
  <>
    <Camera frame={frame}/>
    <ambientLight intensity={1.8}/>
    <directionalLight position={[-9,15,18]} intensity={2.1} color="#fff6ed"/>
    <directionalLight position={[12,8,-9]} intensity={.8} color="#d7e7e9"/>
    <Cpu frame={frame}/>
    <Gpu frame={frame}/>
  </>
);

const Caption:React.FC<{frame:number}>=({frame})=>{
  const first=1-smooth((frame-137)/32);
  const second=smooth((frame-150)/26)*(1-smooth((frame-287)/35));
  const last=smooth((frame-310)/25);
  const common:React.CSSProperties={
    position:'absolute',top:64,fontFamily:'Inter,Arial,sans-serif',
    fontWeight:700,fontSize:46,letterSpacing:-1.5,lineHeight:1,
  };
  return <div style={{position:'absolute',inset:0,pointerEvents:'none'}}>
    {first>0&&<span style={{...common,left:70,color:CPU_COLOR,opacity:first}}>CPU</span>}
    {second>0&&<span style={{...common,left:70,color:GPU_COLOR,opacity:second}}>GPU</span>}
    {last>0&&<>
      <span style={{...common,left:346,color:CPU_COLOR,opacity:last}}>CPU</span>
      <span style={{...common,left:888,color:GPU_COLOR,opacity:last}}>GPU</span>
    </>}
  </div>;
};

/**
 * The image contains only two processors and their motion. No scoreboard,
 * colored particles, floor grid, callouts, or explainer slide text.
 */
export const CpuGpuScene:React.FC=()=>{
  const frame=useCurrentFrame();
  return <AbsoluteFill data-testid="cpu-gpu-native-scene"
    data-renderer="react-threejs-webgl"
    data-workload={stageAt(frame)}
    data-cpu-active={cpuActiveCount(frame)}
    data-gpu-active={gpuActiveCount(frame)}
    style={{background:'linear-gradient(to bottom,#f4f0e7,#e8e2d9)',overflow:'hidden'}}>
    <ThreeCanvas orthographic width={1280} height={720}
      camera={{position:[0,12,20],zoom:95,near:.1,far:150}}
      gl={{alpha:true,antialias:true,preserveDrawingBuffer:true}}
      style={{position:'absolute',inset:0,width:1280,height:720,background:'transparent'}}>
      <World frame={frame}/>
    </ThreeCanvas>
    <Caption frame={frame}/>
  </AbsoluteFill>;
};
