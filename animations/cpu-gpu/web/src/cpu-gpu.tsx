import React,{useLayoutEffect} from 'react';
import {AbsoluteFill,useCurrentFrame} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {
  TASKS,TASK_CUBE_SIZE,CPU_CORES,GPU_LANES,CENTER,GENERIC_X,
  cameraAt,completedCount,workingCount,taskAt,stageAt,smooth,
  corePosition,exampleAt,type Kind,
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
    const {focusX,zoom,angle,targetY}=cameraAt(frame);
    camera.position.set(focusX+4.5+angle*5,12,19-angle*9);
    camera.lookAt(focusX,targetY,0);
    if(camera instanceof THREE.OrthographicCamera)camera.zoom=zoom;
    camera.updateProjectionMatrix();
  },[camera,frame]);
  return null;
};

/** Generic arithmetic unit exists at its OWN location, not inside CPU/GPU. */
const GenericArithmeticUnit:React.FC<{frame:number}>=({frame})=>{
  const state=exampleAt(frame);
  const shade=new THREE.Color(WHITE).lerp(new THREE.Color(BLUE),state.dyed);
  const activity=state.phase==='processing'?1:0;
  return <group position={[GENERIC_X,0,0]}>
    <Block pos={[0,-.32,0]} size={[2.45,.35,2.45]} color="#899096" metal={.20}/>
    <Block pos={[0,.17,0]} size={[1.96,.71,1.96]} color="#b4b5b0"
      metal={.18} opacity={.68}/>
    <Block pos={[0,.56,0]} size={[1.58,.08,1.58]}
      color={activity?'#9fabb0':'#d8d8d1'} metal={.12}
      glow={BLUE} power={activity?.08:0}/>
    {/* The input crosses this isolated arithmetic cell, turning blue inside. */}
    <Block pos={[...state.point]} size={[.82,.82,.82]}
      color={'#'+shade.getHexString()}/>
    {/* Tiny landing marks separate source, cell and finished result. */}
    <Block pos={[-2.55,-.29,0]} size={[1.1,.07,1.1]} color="#c6c5bf"/>
    <Block pos={[2.55,-.29,0]} size={[1.1,.07,1.1]} color="#a9c6cb"/>
  </group>;
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
      t%CPU_CORES===i&&taskAt(frame,'cpu',t).phase==='processing');
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
    const active=taskAt(frame,'gpu',i).phase==='processing';
    return <group key={i}>
      <Block pos={[x,-.003,z]} size={[.89,.105,1.02]}
        color="#547886" metal={.25}/>
      <Block pos={[x,.058,z]} size={[.77,.020,.89]}
        color={active?'#b0d8df':'#8aabb4'} metal={.16}
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
  const size=TASK_CUBE_SIZE*(1-.59*inside);
  const pos:Vec=[
    state.point[0],state.point[1]-.20*inside,state.point[2],
  ];
  const color=new THREE.Color(WHITE).lerp(new THREE.Color(BLUE),state.dyed);
  return <Block pos={pos} size={[size,size,size]}
    color={'#'+color.getHexString()} rotation={[0,state.rotation,0]}/>;
};

const Chip:React.FC<{kind:Kind;frame:number}>=({kind,frame})=>
  <group position={[CENTER[kind],0,0]}>
    <Package kind={kind}/>
    {kind==='cpu'?<CpuDie frame={frame}/>:<GpuDie frame={frame}/>}
    <JobStations/>
    {Array.from({length:TASKS},(_,i)=>(
      <TaskCube key={i} kind={kind} index={i} frame={frame}/>
    ))}
  </group>;

const World:React.FC<{frame:number}>=({frame})=>(
  <>
    <Camera frame={frame}/>
    <ambientLight intensity={1.55}/>
    <directionalLight position={[-7,16,12]} intensity={2.55} color="#fff7eb"/>
    <directionalLight position={[11,8,-7]} intensity={.78} color="#e4eff2"/>
    <GenericArithmeticUnit frame={frame}/>
    <Chip kind="cpu" frame={frame}/>
    <Chip kind="gpu" frame={frame}/>
  </>
);

const Caption:React.FC<{frame:number}>=({frame})=>{
  const label={
    task:'獨立計算單元：白色輸入 +1 → 藍色結果',
    cpu:'CPU · 4 個大核心，分 4 批處理同樣的任務',
    gpu:'GPU · 16 個小單元，同時處理同樣的任務',
    compare:'同樣 16 項任務，結果全部離開晶片',
  }[stageAt(frame)];
  return <div aria-hidden="true" style={{
    position:'absolute',top:56,left:62,pointerEvents:'none',
    fontFamily:'"Noto Sans CJK SC","Microsoft YaHei",system-ui,sans-serif',
    fontWeight:650,fontSize:31,letterSpacing:.4,color:'#343c40',
  }}><span>{label}</span></div>;
};

export const CpuGpuScene:React.FC=()=>{
  const frame=useCurrentFrame();
  return <AbsoluteFill data-testid="cpu-gpu-native-scene"
    data-renderer="react-threejs-webgl"
    data-chip-design="complete-silicon-top"
    data-workload={stageAt(frame)}
    data-example-progress={exampleAt(frame).progress}
    data-example-dyed={exampleAt(frame).dyed}
    data-example-location={GENERIC_X}
    data-cpu-location={CENTER.cpu}
    data-gpu-location={CENTER.gpu}
    data-camera-zoom={cameraAt(frame).zoom}
    data-task-count={TASKS}
    data-cpu-done={completedCount(frame,'cpu')}
    data-gpu-done={completedCount(frame,'gpu')}
    data-cpu-working={workingCount(frame,'cpu')}
    data-gpu-working={workingCount(frame,'gpu')}
    style={{background:'linear-gradient(#f4f0e7,#e8e2d9)',overflow:'hidden'}}>
    <ThreeCanvas orthographic width={1280} height={720}
      camera={{position:[GENERIC_X+4.5,12,19],zoom:70,near:.1,far:160}}
      gl={{alpha:true,antialias:true,preserveDrawingBuffer:true}}
      style={{position:'absolute',inset:0,width:1280,height:720,background:'transparent'}}>
      <World frame={frame}/>
    </ThreeCanvas>
    <Caption frame={frame}/>
  </AbsoluteFill>;
};
