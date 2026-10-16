import React, {useLayoutEffect} from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {useThree} from '@react-three/fiber';
import {
  FPS, DURATION, CPU_CORES, GPU_LANES, OUTPUT_TILES,
  clamp, smooth, stageAt, uniformProgress, branchProgress,
  cpuActive, laneActive, laneBranch, tileDone, pulse,
} from './model';

type Point = [number,number,number];
const CPU = '#ffae58';
const GPU = '#43e9e7';
const cpuColors = ['#ffa954','#b8f294','#c3a0ff','#ffdf83'];
const branchColors = ['#40e8eb','#aa86ff'];
const boardCenters = [-5.2,5.2] as const;

const Block: React.FC<{
  pos: Point; size: Point; color: string;
  emissive?: string; glow?: number; opacity?: number;
  rotation?: Point; metal?: number;
}> = ({pos,size,color,emissive='#000000',glow=0,opacity=1,rotation=[0,0,0],metal=.5}) => (
  <mesh position={pos} rotation={rotation} castShadow receiveShadow>
    <boxGeometry args={size}/>
    <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={glow}
      metalness={metal} roughness={.29} transparent={opacity<1} opacity={opacity}/>
  </mesh>
);

const CameraMove: React.FC<{frame:number}> = ({frame}) => {
  const {camera}=useThree();
  useLayoutEffect(()=>{
    // Small cinematic orbit; positions depend solely on Remotion's frame.
    const t=frame/FPS, sweep=smooth((frame-15)/85);
    camera.position.set(-1.3+sweep*1.4+Math.sin(t*.35)*.48,
      15.4-Math.sin(t*.24)*.65,24.0-Math.cos(t*.27)*.5);
    camera.lookAt(0,.1,.75);
    camera.updateProjectionMatrix();
  },[camera,frame]);
  return null;
};

const Board:React.FC<{center:number;gpu:boolean;frame:number}>=({center,gpu,frame})=>{
  const appearance=smooth((frame-(gpu?27:13))/49);
  const tint=gpu?GPU:CPU;
  return <group position={[center,0,0]} scale={[1,Math.max(.003,appearance),1]}>
    <Block pos={[0,-.59,0]} size={[8.8,.52,7.7]} color="#061521" metal={.7}/>
    <Block pos={[0,-.27,0]} size={[8.65,.16,7.55]} color="#1b3546" metal={.8}/>
    <Block pos={[0,-.17,0]} size={[8.18,.08,7.06]} color={gpu?'#092c3d':'#3a261b'} metal={.6}/>
    {[-1,1].map(side=><React.Fragment key={side}>
      <Block pos={[side*4.2,-.22,0]} size={[.075,.08,7.18]} color={tint} emissive={tint} glow={1.8}/>
      <Block pos={[0,-.22,side*3.48]} size={[8.4,.08,.075]} color={tint} emissive={tint} glow={1.6}/>
    </React.Fragment>)}
    {/* Physical gold connector pins and layered edge of each package. */}
    {Array.from({length:15},(_,i)=>{
      const x=(i-7)*.53;
      return <React.Fragment key={i}>
        <Block pos={[x,-.54,-3.92]} size={[.22,.17,.35]} color="#b59554" emissive="#704516" glow={.4}/>
        <Block pos={[x,-.54,3.92]} size={[.22,.17,.35]} color="#b59554" emissive="#704516" glow={.4}/>
      </React.Fragment>;
    })}
    {Array.from({length:13},(_,i)=>{
      const z=(i-6)*.48;
      return <React.Fragment key={'pin'+i}>
        <Block pos={[-4.51,-.53,z]} size={[.35,.15,.2]} color="#b59554"/>
        <Block pos={[4.51,-.53,z]} size={[.35,.15,.2]} color="#b59554"/>
      </React.Fragment>;
    })}
    {/* Fine circuit traces illuminate the data paths. */}
    {Array.from({length:9},(_,i)=><React.Fragment key={'trace'+i}>
      <Block pos={[(i-4)*.83,-.105,0]} size={[.026,.012,6.65]}
        color={tint} emissive={tint} glow={.55} opacity={.66}/>
      <Block pos={[0,-.102,(i-4)*.72]} size={[7.5,.012,.026]}
        color={tint} emissive={tint} glow={.23} opacity={.42}/>
    </React.Fragment>)}
  </group>;
};

const CpuCore:React.FC<{index:number;frame:number}>=({index,frame})=>{
  const cx=boardCenters[0]+(index%2===0?-1.67:1.67);
  const z=index<2?-1.65:1.24;
  const on=cpuActive(frame,index);
  const phase=stageAt(frame);
  const color=phase==='branch'?cpuColors[index]:CPU;
  const throb=.42+.55*pulse(frame,index);
  const glow=on?1.8+throb*1.8:.28;
  const arrival=smooth((frame-38-index*6)/35);
  return <group position={[cx,0,z]} scale={[1,Math.max(.001,arrival),1]}>
    <Block pos={[0,.07,0]} size={[2.65,.24,2.25]} color="#262d3a" metal={.84}/>
    <Block pos={[0,.27,0]} size={[2.28,.22,2]} color="#5c4c3f" emissive="#8e582a" glow={.23}/>
    <Block pos={[0,.57,0]} size={[1.83,.46,1.69]} color={on?'#c8893e':'#66543f'} emissive={color} glow={glow}/>
    <Block pos={[0,.823,0]} size={[1.59,.035,1.44]} color={color} emissive={color}
      glow={on?2.2:1.1} opacity={on ? .76 : .5}/>
    {/* Independent out-of-order/control and close cache blocks per CPU core. */}
    {Array.from({length:5},(_,i)=><Block key={i}
      pos={[-.62+i*.31,.88,-.42]} size={[.16,.075,.35]}
      color={on?'#fff0d5':'#e6b87d'} emissive={color} glow={on?2.7:.7}/>)}
    {Array.from({length:3},(_,i)=><Block key={'c'+i}
      pos={[-.48+i*.46,.89,.43]} size={[.32,.065,.31]}
      color="#283944" emissive={color} glow={on?1.4:.3}/>)}
    {/* Pulse rises from the active core in three-dimensional space. */}
    {on&&<mesh position={[0,1.2+.35*throb,0]}>
      <octahedronGeometry args={[.16+.1*throb,0]}/>
      <meshBasicMaterial color={color} transparent opacity={.9}/>
    </mesh>}
  </group>;
};

const GpuLanes:React.FC<{frame:number}>=({frame})=>{
  const stage=stageAt(frame);
  const ready=smooth((frame-48)/43);
  return <group scale={[1,Math.max(.001,ready),1]}>
    {Array.from({length:GPU_LANES},(_,index)=>{
      const col=index%10,row=Math.floor(index/10);
      const x=boardCenters[1]+(col-4.5)*.745;
      const z=(row-3.5)*.77;
      const active=laneActive(frame,index);
      const c=stage==='branch'?branchColors[laneBranch(index)]:GPU;
      const power=active?1.1+2.3*pulse(frame,index):.17;
      const top=active?'#cffefe':'#164e64';
      return <group key={index} position={[x,0,z]}>
        <Block pos={[0,.09,0]} size={[.6,.23,.6]} color="#164051" metal={.78}/>
        <Block pos={[0,.275,0]} size={[.53,.20,.54]} color={top} emissive={c} glow={power} metal={.28}/>
        <Block pos={[0,.391,0]} size={[.32,.025,.34]} color={c} emissive={c}
          glow={active?2.5:.16} opacity={active ? .92 : .5}/>
        {active&&<mesh position={[0,.54+.13*pulse(frame,index),0]}>
          <octahedronGeometry args={[.078,0]}/>
          <meshBasicMaterial color={c}/>
        </mesh>}
      </group>;
    })}
  </group>;
};

const CacheBank:React.FC<{frame:number}>=({frame})=><group>
  {/* Control logic and a wide shared cache are unmistakably larger than GPU lanes. */}
  <Block pos={[-5.2,.1,-3.03]} size={[6.5,.32,.43]} color="#ad783f" emissive={CPU} glow={.36}/>
  {Array.from({length:12},(_,i)=><Block key={i}
    pos={[-8.15+i*.54,.285,-3.03]} size={[.39,.04,.21]}
    color="#ecb675" emissive={CPU} glow={.6+.45*pulse(frame,i)}/>)}
  <Block pos={[-5.2,.08,3.05]} size={[6.5,.3,.4]} color="#504536" emissive={CPU} glow={.28}/>
  {Array.from({length:8},(_,i)=><Block key={i}
    pos={[-7.93+i*.77,.28,3.05]} size={[.55,.07,.22]}
    color="#9d9572" emissive={CPU} glow={.28}/>)}
  {/* GPU dispatch controller, shared instruction feed for 80 arithmetic lanes. */}
  <Block pos={[5.2,.13,-3.03]} size={[7.4,.4,.32]} color="#167282" emissive={GPU} glow={.65}/>
  {Array.from({length:10},(_,i)=><Block key={i}
    pos={[1.85+i*.745,.36,-3.03]} size={[.35,.07,.18]}
    color="#a0ffff" emissive={GPU} glow={.75+.5*pulse(frame,i)}/>)}
</group>;

const Traffic:React.FC<{frame:number;gpu:boolean}>=({frame,gpu})=>{
  const stage=stageAt(frame);
  if(stage==='reveal'||stage==='compare')return null;
  const center=gpu?boardCenters[1]:boardCenters[0], count=gpu?30:12;
  const interval=gpu?0.053:.15,period=gpu?45:86;
  return <group>{Array.from({length:count},(_,i)=>{
    const travel=((frame-106)*.025+i*interval)%1;
    const x=center+(gpu?((i%10)-4.5)*.74:((i%4)-1.5)*1.11);
    const z=-3.5+7.0*travel;
    const branch=stage==='branch';
    const c=branch?(gpu?branchColors[i%2]:cpuColors[i%4]):(gpu?GPU:CPU);
    const active=gpu?laneActive(frame,i%80):cpuActive(frame,i%4);
    const height=gpu?.88:1.5;
    const size=gpu?.085:.17;
    const opacity=smooth((frame-93)/18)*(1-smooth((frame-(branch?493:280))/16));
    return <mesh key={i} position={[x,height+Math.sin((frame+i*17)/period)*.13,z]}
      rotation={[frame*.014,frame*.024,0]}>
      <octahedronGeometry args={[size,0]}/>
      <meshBasicMaterial color={active?c:'#345165'} transparent opacity={opacity*(active?.98:.26)}/>
    </mesh>;
  })}</group>;
};

const Results:React.FC<{frame:number;gpu:boolean}>=({frame,gpu})=>{
  const center=gpu?boardCenters[1]:boardCenters[0];
  const kind=gpu?'gpu':'cpu';
  const stage=stageAt(frame);
  // 40 physical result-pixels illuminate as the same batch is completed.
  const resultFrame=stage==='compare'?514:frame;
  return <group>
    <Block pos={[center,-.48,4.99]} size={[6.75,.19,2.55]} color="#091624"/>
    {Array.from({length:OUTPUT_TILES},(_,i)=>{
      const x=center+((i%8)-3.5)*.78;
      const z=4.1+Math.floor(i/8)*.43;
      const lit=tileDone(resultFrame,i,kind);
      const tint=gpu?GPU:CPU;
      const c=lit?(stage==='branch'||stage==='compare'?
        (gpu?branchColors[i%2]:cpuColors[i%4]):tint):'#173342';
      return <Block key={i} pos={[x,-.25,z]} size={[.67,.12,.32]}
        color={lit?c:'#17303c'} emissive={c} glow={lit?1.05:.08} metal={.34}/>;
    })}
  </group>;
};

const Atmosphere:React.FC<{frame:number}>=({frame})=><group>
  <mesh rotation={[-Math.PI/2,0,0]} position={[0,-1.12,0]} receiveShadow>
    <planeGeometry args={[200,200]}/>
    <meshStandardMaterial color="#07121d" roughness={.77} metalness={.2}/>
  </mesh>
  {Array.from({length:27},(_,i)=>{
    const x=(i-13)*1.4;
    return <Block key={i} pos={[x,-1.09,0]} size={[.012,.011,55]}
      color="#16354a" emissive="#1d5161" glow={.16}/>;
  })}
  {Array.from({length:24},(_,i)=><Block key={i}
    pos={[0,-1.087,(i-12)*1.25]} size={[46,.012,.012]}
    color="#16354a" emissive="#1d5161" glow={.16}/>)}
  {Array.from({length:46},(_,i)=>{
    const x=((i*37)%43-21)*.61;
    const z=((i*19)%39-19)*.71;
    const y=.25+Math.sin(i*7.1+frame*.022)*.38;
    return <mesh key={'dust'+i} position={[x,y,z]}>
      <sphereGeometry args={[.013+(i%3)*.008,4,4]}/>
      <meshBasicMaterial color={i%2===0?CPU:GPU} transparent opacity={.15+.3*pulse(frame,i)}/>
    </mesh>;
  })}
</group>;

const World:React.FC<{frame:number}>=({frame})=><>
  <CameraMove frame={frame}/>
  <ambientLight intensity={1.3}/>
  <directionalLight position={[-4,13,10]} intensity={2.5} color="#c9e5ff"/>
  <pointLight position={[-5,6,2]} color="#ffb35c" intensity={105} distance={18}/>
  <pointLight position={[5,6,2]} color="#48e8ff" intensity={92} distance={18}/>
  <Atmosphere frame={frame}/>
  <Board center={boardCenters[0]} gpu={false} frame={frame}/>
  <Board center={boardCenters[1]} gpu frame={frame}/>
  <CacheBank frame={frame}/>
  {Array.from({length:CPU_CORES},(_,i)=><CpuCore key={i} index={i} frame={frame}/>)}
  <GpuLanes frame={frame}/>
  <Traffic frame={frame} gpu={false}/>
  <Traffic frame={frame} gpu/>
  <Results frame={frame} gpu={false}/>
  <Results frame={frame} gpu/>
</>;

const typography:React.CSSProperties={
  fontFamily:'Inter,"Noto Sans CJK SC","Microsoft YaHei","PingFang SC",system-ui,sans-serif',
  textShadow:'0 2px 15px #061019',
};
const Overlay:React.FC<{frame:number}>=({frame})=>{
  const stage=stageAt(frame);
  const uniform=uniformProgress(frame),branch=branchProgress(frame);
  const actual=stage==='branch'||stage==='compare'?branch:uniform;
  const percent=(p:number)=>Math.round(clamp(p)*100);
  const copy={
    reveal:['兩種不同的運算架構','少量強核心','大量平行運算單元'],
    uniform:['同一道指令，讓大量資料同時通過','4 個核心 · 分批處理','80 條通道 · 同步處理'],
    branch:['工作各走各的路，情況反過來了','4 個獨立控制流','分歧通道 · 分組輪流'],
    compare:['不是誰取代誰，而是分工不同','複雜邏輯 · 低延遲','規則運算 · 高吞吐'],
  }[stage];
  const opening=smooth((frame-3)/30);
  return <div style={{position:'absolute',inset:0,pointerEvents:'none',color:'#eaf9fd',...typography}}>
    <div style={{position:'absolute',left:66,top:40,opacity:opening}}>
      <div style={{fontSize:15,fontWeight:800,letterSpacing:4,color:'#89a8bd'}}>COMPUTE / ARCHITECTURE</div>
      <div style={{marginTop:9,fontSize:30,fontWeight:750,letterSpacing:1}}>{copy[0]}</div>
    </div>
    {(['cpu','gpu'] as const).map((kind,i)=><div key={kind}
      style={{position:'absolute',top:150,left:i?675:70,width:525,opacity:opening}}>
      <div style={{display:'flex',alignItems:'baseline',gap:18}}>
        <span style={{fontSize:64,lineHeight:'70px',fontWeight:900,letterSpacing:-3,
          color:i?GPU:CPU}}>{kind.toUpperCase()}</span>
        <span style={{fontSize:16,letterSpacing:1.1,color:'#d8e2ef'}}>{i?'大量小通道':'少量強核心'}</span>
      </div>
      <div style={{marginTop:9,letterSpacing:1.3,fontSize:16,color:'#c9d5df'}}>{copy[i+1]}</div>
    </div>)}
    {stage!=='reveal'&&<div style={{position:'absolute',bottom:43,left:65,right:65,
      display:'flex',alignItems:'center',gap:45}}>
      {(['cpu','gpu'] as const).map((kind,i)=><div key={kind} style={{flex:1}}>
        <div style={{display:'flex',justifyContent:'space-between',
          fontSize:13,letterSpacing:2,color:i?GPU:CPU,marginBottom:8}}>
          <span>OUTPUT / {kind.toUpperCase()}</span>
          <span data-testid={kind+'-completion'}>{percent(actual[kind])}%</span>
        </div>
        <div style={{height:5,background:'#315061',overflow:'hidden'}}>
          <div style={{height:'100%',width:percent(actual[kind])+'%',background:i?GPU:CPU,
            boxShadow:'0 0 18px currentColor'}}/>
        </div>
      </div>)}
    </div>}
    <div style={{position:'absolute',right:67,top:45,fontSize:11,letterSpacing:1.8,
      color:'#7e99ad'}}>3D / LIVE GEOMETRY · {DURATION/FPS}S</div>
    <div style={{position:'absolute',right:67,bottom:18,fontSize:10,letterSpacing:1,
      color:'#6f899a'}}>示意模型 · 非實測跑分</div>
  </div>;
};

export const CpuGpuScene:React.FC=()=>{
  const frame=useCurrentFrame();
  return <AbsoluteFill data-testid="cpu-gpu-native-scene"
    data-renderer="react-threejs-webgl"
    data-workload={stageAt(frame)}
    style={{background:'radial-gradient(ellipse at 49% 30%,#1b324b,#070f1c 70%)',overflow:'hidden'}}>
    <ThreeCanvas orthographic width={1280} height={720}
      camera={{position:[0,15,24],zoom:50,near:.1,far:200}}
      gl={{alpha:true,antialias:true,preserveDrawingBuffer:true}}
      style={{position:'absolute',inset:0,width:1280,height:720,background:'transparent'}}>
      <World frame={frame}/>
    </ThreeCanvas>
    <Overlay frame={frame}/>
  </AbsoluteFill>;
};
