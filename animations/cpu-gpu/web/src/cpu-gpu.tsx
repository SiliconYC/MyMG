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



/**
 * Victory belongs to the CHIPS, not a detached typographic card.
 * Four slim luminous strokes trace the successful die's perimeter. During
 * ordinary computing these strokes are not mounted at all.
 */
const VictoryTrace:React.FC<{kind:Kind;frame:number}>=({kind,frame})=>{
  const beat=storyBeatAt(frame);
  const winner=beat==='gpu-wins'?'gpu':beat==='cpu-wins'?'cpu':null;
  if(winner!==kind)return null;
  const alpha=storyOpacityAt(frame)*(.81+.10*Math.sin(frame*.16));
  const line=kind==='gpu'?'#5c9eb5':'#c58d61';
  const extent=3.58;
  const thickness=.065;
  return <group position={[0,.16,0]}>
    <Block pos={[0,0,-extent]} size={[extent*2,thickness,thickness]}
      color={line} glow={line} power={.32} opacity={alpha}/>
    <Block pos={[0,0,extent]} size={[extent*2,thickness,thickness]}
      color={line} glow={line} power={.32} opacity={alpha}/>
    <Block pos={[-extent,0,0]} size={[thickness,thickness,extent*2]}
      color={line} glow={line} power={.32} opacity={alpha}/>
    <Block pos={[extent,0,0]} size={[thickness,thickness,extent*2]}
      color={line} glow={line} power={.32} opacity={alpha}/>
  </group>;
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
    <VictoryTrace kind={kind} frame={frame}/>
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


/** Always one quiet, consistent annotation when a chapter title is absent. */
const Caption:React.FC<{frame:number}>=({frame})=>{
  const label={
    cpu:'CPU · 四核心分批执行',
    gpu:'GPU · 十六路同步执行',
    compare:'16 项相同任务 · 并行吞吐',
    'mixed-intro':'16 项混合任务 · 四条执行路径',
    'mixed-cpu':'CPU · 独立处理不同分支',
    'mixed-gpu':'GPU · 分歧通道需要等待',
    'mixed-compare':'16 项混合任务 · 控制流分歧',
  }[stageAt(frame)];
  const alpha=1-smooth(storyOpacityAt(frame)*1.2);
  return <div aria-hidden="true" data-testid="cpu-gpu-caption" style={{
    position:'absolute',top:56,left:66,pointerEvents:'none',
    fontFamily:'"Noto Sans CJK SC","Microsoft YaHei",system-ui,sans-serif',
    fontWeight:570,fontSize:25,letterSpacing:.45,color:'#45545a',
    opacity:alpha,
  }}><span>{label}</span></div>;
};

/**
 * Two IDENTICAL typographic chapter entrances; no card, background plate,
 * rounded corners, giant victory banners or unrelated overlay graphic.
 * Victory gets a small anchored lower-third matching its illuminated chip.
 */
const StoryAnnouncement:React.FC<{frame:number}>=({frame})=>{
  const beat=storyBeatAt(frame);
  const alpha=storyOpacityAt(frame);
  const chapter=beat==='round-one'||beat==='round-two';
  const roundTwo=beat==='round-two';
  const gpuWin=beat==='gpu-wins';
  const cpuWin=beat==='cpu-wins';
  const enterStart=roundTwo?324:gpuWin?274:cpuWin?700:0;
  const reveal=smooth((frame-enterStart)/12);
  const sweep=handoverProgressAt(frame);
  const sweepOpacity=handoverOpacityAt(frame);
  const accent=gpuWin?'#477e96':cpuWin?'#b17b55':'#506872';
  return <>
    <div aria-hidden="true" data-testid="cpu-gpu-round-wipe"
      data-active={sweepOpacity>.02?'true':'false'}
      style={{
        position:'absolute',zIndex:2,left:0,top:'-8%',
        width:125,height:'116%',pointerEvents:'none',
        opacity:sweepOpacity*.42,
        background:'linear-gradient(90deg,transparent,#d4dfdc 38%,#edf0e9 55%,transparent)',
        transform:`translateX(${-190+1470*sweep}px) skewX(-8deg)`,
      }}/>
    {beat!=='none'&&<div aria-hidden="true"
      data-testid="cpu-gpu-story-title"
      data-beat={beat}
      data-layout={chapter?'chapter':'verdict'}
      style={{
        position:'absolute',zIndex:3,
        left:chapter?66:gpuWin?785:105,
        top:chapter?53:'auto',bottom:chapter?'auto':64,
        pointerEvents:'none',
        width:chapter?510:380,
        opacity:alpha,
        fontFamily:'"Noto Sans CJK SC","Microsoft YaHei",system-ui,sans-serif',
        transform:`translateY(${(1-reveal)*(chapter?13:9)}px)`,
        color:'#394e57',textAlign:'left',
        textShadow:'0 1px 2px rgba(250,247,240,.76)',
      }}>
      {chapter?<>
        <div style={{
          fontSize:16,fontWeight:750,letterSpacing:3.5,color:'#6e7b7e',
          display:'flex',alignItems:'center',gap:13,marginBottom:11,
        }}>
          <span style={{fontVariantNumeric:'tabular-nums',color:'#a47758'}}>
            {roundTwo?'02':'01'}</span>
          <span style={{height:1,width:38,background:'#8f9997'}}/>
          <span>{roundTwo?'第二轮':'第一轮'}</span>
        </div>
        <div style={{
          fontSize:43,fontWeight:740,letterSpacing:.9,lineHeight:1.22,
        }}>{roundTwo?'16 个混合任务':'16 个相同任务'}</div>
        <div style={{
          fontSize:19,fontWeight:460,letterSpacing:1.1,
          marginTop:12,color:'#63737a',
        }}>{roundTwo?'形状不同 · 分支各异':'规则一致 · 并行处理'}</div>
      </>:<>
        <div style={{
          fontSize:16,fontWeight:670,letterSpacing:2.5,
          color:'#697b81',marginBottom:11,
        }}>{gpuWin?'01  /  同质任务':'02  /  分歧任务'}</div>
        <div style={{
          display:'flex',alignItems:'baseline',gap:13,
          letterSpacing:.4,lineHeight:1.2,
        }}>
          <span style={{fontSize:49,fontWeight:800,color:accent}}>
            {gpuWin?'GPU':'CPU'}</span>
          <span style={{fontSize:33,fontWeight:600,color:'#4b5960'}}>胜出</span>
        </div>
        <div style={{
          height:3,width:106,background:accent,
          marginTop:13,
          transformOrigin:'left center',transform:`scaleX(${reveal})`,
        }}/>
      </>}
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
