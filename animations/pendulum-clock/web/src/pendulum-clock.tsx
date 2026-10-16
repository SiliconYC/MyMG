import React, {useMemo} from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import * as THREE from 'three';
import {clockAtFrame, TEETH} from './clock-model';

type Position = [number, number, number];
const pos = (x: number, y: number, z = 0): Position => [x - 640, 360 - y, z];

const GOLD = '#cc9e5a';
const GOLD_LIGHT = '#f2d295';
const STEEL = '#adc5c8';
const INK = '#203540';
const RED = '#db775e';

/** All the moving mechanism parts are real Three.js geometry, not SVG paths/video. */
const Bar: React.FC<{
  x1: number; y1: number; x2: number; y2: number;
  width: number; depth?: number; color: string; z?: number;
}> = ({x1,y1,x2,y2,width,depth=6,color,z=0}) => {
  const dx=x2-x1,dy=y2-y1;
  return <mesh position={[(x1+x2)/2,(y1+y2)/2,z]}
    rotation={[0,0,Math.atan2(dy,dx)]}>
    <boxGeometry args={[Math.hypot(dx,dy),width,depth]}/>
    <meshStandardMaterial color={color} metalness={0.8} roughness={0.3}/>
  </mesh>;
};
const ScreenBar: React.FC<{
  x1: number; y1: number; x2: number; y2: number;
  width: number; color: string; z?: number;
}> = ({x1,y1,x2,y2,width,color,z=0}) =>
  <Bar x1={x1-640} y1={360-y1} x2={x2-640} y2={360-y2}
    width={width} color={color} z={z}/>;

const Plate:React.FC<{x:number;y:number;r:number;depth?:number;color:string;z?:number}> =
({x,y,r,depth=6,color,z=0})=>
  <mesh position={pos(x,y,z)} rotation={[Math.PI/2,0,0]}>
    <cylinderGeometry args={[r,r,depth,64]}/>
    <meshStandardMaterial color={color} metalness={0.83} roughness={0.32}/>
  </mesh>;

const Ring:React.FC<{x:number;y:number;r:number;tube:number;color:string;z?:number}> =
({x,y,r,tube,color,z=0})=>
  <mesh position={pos(x,y,z)}>
    <torusGeometry args={[r,tube,12,120]}/>
    <meshStandardMaterial color={color} metalness={0.78} roughness={0.33}/>
  </mesh>;

/** 30 individually cut ratchet teeth on a brass annulus with a circular bore. */
function makeEscapeWheel(): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  const pitch = 2*Math.PI/TEETH;
  for(let k=0;k<TEETH;k++){
    const a = k*pitch;
    for(const [offset,r] of [[0,91],[0.18,98],[0.27,113],[0.41,112],[0.68,95],[0.92,91]]){
      const angle=a+offset*pitch;
      const x=Math.sin(angle)*r, y=Math.cos(angle)*r;
      if(k===0&&offset===0)shape.moveTo(x,y);else shape.lineTo(x,y);
    }
  }
  shape.closePath();
  const bore = new THREE.Path();
  bore.absarc(0,0,59,0,2*Math.PI,true);
  shape.holes.push(bore);
  return new THREE.ExtrudeGeometry(shape,{
    steps:1,depth:7,bevelEnabled:true,bevelThickness:1.2,
    bevelSize:1,bevelSegments:2,curveSegments:20
  });
}

const EscapeWheel: React.FC<{angle:number}> = ({angle}) => {
  const geometry=useMemo(makeEscapeWheel,[]);
  return <group position={pos(419,365,2)} rotation={[0,0,-angle]}>
    <mesh geometry={geometry}>
      <meshStandardMaterial color={GOLD} metalness={0.92} roughness={0.23}
        side={THREE.DoubleSide}/>
    </mesh>
    {Array.from({length:6},(_,k)=>{
      const a=k*Math.PI/3;
      return <Bar key={k} x1={Math.sin(a)*26} y1={Math.cos(a)*26}
        x2={Math.sin(a)*83} y2={Math.cos(a)*83}
        width={11} depth={9} color={GOLD_LIGHT} z={4}/>;
    })}
    <mesh position={[0,0,6]} rotation={[Math.PI/2,0,0]}>
      <cylinderGeometry args={[31,31,9,48]}/>
      <meshStandardMaterial color="#647e85" metalness={0.89} roughness={0.28}/>
    </mesh>
    <mesh position={[0,0,13]} rotation={[Math.PI/2,0,0]}>
      <cylinderGeometry args={[9,9,4,32]}/>
      <meshStandardMaterial color="#f1cc89" metalness={0.85} roughness={0.3}/>
    </mesh>
    <mesh position={[0,0,18]}>
      <sphereGeometry args={[3,12,12]}/>
      <meshStandardMaterial color="#fff5d5" emissive="#957046" emissiveIntensity={0.3}/>
    </mesh>
  </group>;
};

const Pendulum:React.FC<{angle:number}> = ({angle}) =>
  <group position={pos(419,195,-16)} rotation={[0,0,-angle]}>
    <Bar x1={0} y1={-10} x2={0} y2={-389}
      width={8} depth={9} color={STEEL}/>
    <mesh position={[0,-387,0]} scale={[1,1.08,.42]}>
      <sphereGeometry args={[45,64,36]}/>
      <meshStandardMaterial color="#d2a35e" metalness={0.87} roughness={0.22}/>
    </mesh>
    <mesh position={[-13,-373,19]} scale={[1.5,2.9,.36]}>
      <sphereGeometry args={[8,20,20]}/>
      <meshStandardMaterial color="#fce6ae" metalness={0.4} roughness={0.25}/>
    </mesh>
  </group>;

const Anchor:React.FC<{angle:number;locked:'entry'|'exit';releasing:boolean}> =
({angle,locked,releasing}) =>
  <group position={pos(419,195,23)} rotation={[0,0,-angle]}>
    {/* Upper V-bar alternately catches two teeth. */}
    <Bar x1={0} y1={-2} x2={-90} y2={-91} width={15} depth={11} color={STEEL}/>
    <Bar x1={0} y1={-2} x2={90} y2={-91} width={15} depth={11} color={STEEL}/>
    {([-1,1] as const).map(side=>{
      const selected=(side===-1&&locked==='entry')||(side===1&&locked==='exit');
      return <group key={side} position={[side*89,-90,7]}
        rotation={[0,0,side*.48]}>
        <mesh>
          <boxGeometry args={[17,34,11]}/>
          <meshStandardMaterial color={selected?GOLD_LIGHT:'#b5c9cc'}
            emissive={selected?(releasing?'#de764a':'#574024'):'#000000'}
            emissiveIntensity={selected?0.27:0}
            metalness={0.9} roughness={0.2}/>
        </mesh>
      </group>;
    })}
    <mesh position={[0,0,12]} rotation={[Math.PI/2,0,0]}>
      <cylinderGeometry args={[17,17,10,48]}/>
      <meshStandardMaterial color={GOLD_LIGHT} metalness={0.85} roughness={0.29}/>
    </mesh>
    <mesh position={[0,0,20]} rotation={[Math.PI/2,0,0]}>
      <cylinderGeometry args={[6,6,5,32]}/>
      <meshStandardMaterial color="#324950" metalness={0.8} roughness={0.36}/>
    </mesh>
  </group>;

const Dial: React.FC<{secondAngle:number;minuteAngle:number}> =
({secondAngle,minuteAngle})=>{
  const cx=987,cy=348;
  return <group>
    <Plate x={cx} y={cy} r={197} depth={14} color="#9d8059" z={0}/>
    <Plate x={cx} y={cy} r={187} depth={16} color={INK} z={9}/>
    <Plate x={cx} y={cy} r={170} depth={1.8} color="#253e49" z={19}/>
    <Ring x={cx} y={cy} r={181} tube={2.7} color={GOLD_LIGHT} z={23}/>
    <Ring x={cx} y={cy} r={158} tube={0.9} color="#819398" z={22}/>
    {Array.from({length:60},(_,index)=>{
      const a=index*Math.PI/30;
      const outer=174,inner=index%5===0?153:163;
      return <ScreenBar key={index}
        x1={cx+inner*Math.sin(a)} y1={cy- inner*Math.cos(a)}
        x2={cx+outer*Math.sin(a)} y2={cy-outer*Math.cos(a)}
        width={index%5===0?3:1.2} color={index%5===0?GOLD_LIGHT:'#849fa4'} z={24}/>;
    })}
    {/* The canonical hand shaft and escapement wheel share EXACTLY the same angle. */}
    <group position={pos(cx,cy,34)} rotation={[0,0,-(5.33+minuteAngle/12)]}>
      <Bar x1={0} y1={-18} x2={0} y2={87} width={11} depth={6} color={GOLD_LIGHT} z={0}/>
    </group>
    <group position={pos(cx,cy,38)} rotation={[0,0,-(Math.PI/3+minuteAngle)]}>
      <Bar x1={0} y1={-23} x2={0} y2={133} width={6} depth={5} color="#e8e2cd" z={0}/>
    </group>
    <group position={pos(cx,cy,44)} rotation={[0,0,-secondAngle]}>
      <Bar x1={0} y1={-29} x2={0} y2={147} width={2.9} depth={4} color={RED} z={0}/>
      <mesh position={[0,148,2]} rotation={[0,0,Math.PI]}>
        <coneGeometry args={[7,17,3]}/>
        <meshStandardMaterial color={RED} metalness={0.4} roughness={0.3}/>
      </mesh>
      <mesh position={[0,-24,0]}>
        <sphereGeometry args={[8,16,12]}/>
        <meshStandardMaterial color={RED} metalness={0.75} roughness={0.24}/>
      </mesh>
    </group>
    <Plate x={cx} y={cy} r={8} depth={6} color="#f4d49b" z={49}/>
  </group>;
};

const World:React.FC<{frame:number}>=({frame})=>{
  const clock=clockAtFrame(frame);
  return <ThreeCanvas width={1280} height={720} orthographic
    camera={{position:[0,0,900],zoom:1,near:.1,far:1500}}
    gl={{alpha:true,antialias:true,preserveDrawingBuffer:true}}
    style={{position:'absolute',inset:0,width:1280,height:720,background:'transparent'}}>
    <ambientLight intensity={1.65}/>
    <directionalLight position={[-200,300,700]} intensity={2.0} color="#fff0d1"/>
    <directionalLight position={[500,-200,300]} intensity={1.1} color="#96c8d0"/>
    {/* Stationary mounting bearings, arc marks and housing. */}
    <Ring x={419} y={365} r={128} tube={1.2} color="#5c7277" z={-22}/>
    <Plate x={419} y={195} r={29} depth={6} color="#546f78" z={-19}/>
    <Pendulum angle={clock.pendulumAngle}/>
    <EscapeWheel angle={clock.wheelAngle}/>
    <Anchor angle={clock.anchorAngle} locked={clock.lock} releasing={clock.releasing}/>
    <Dial secondAngle={clock.secondHandAngle} minuteAngle={clock.minuteHandAngle}/>
  </ThreeCanvas>;
};

const labelStyle:React.CSSProperties={
  color:'#97afaf',fontSize:13,letterSpacing:2,fontFamily:'Arial, sans-serif',
};
const Pill:React.FC<{left:number;top:number;label:string;active?:boolean}>=
({left,top,label,active})=><div style={{
  position:'absolute',left,top,background:active?'#cd9e5b22':'#ffffff0b',
  border:'1px solid '+(active?'#dbaf71':'#ffffff30'),
  color:active?'#f5cd88':'#8fa6ab',
  padding:'7px 11px',fontSize:12,letterSpacing:1,borderRadius:3,
}}>{label}</div>;

export const PendulumClockScene:React.FC=()=>{
  const frame=useCurrentFrame();
  const clock=clockAtFrame(frame);
  const phase=clock.releasing?'释 放':'锁 止';
  return <AbsoluteFill data-testid="pendulum-clock-scene" data-renderer="react-threejs-webgl"
    data-beats={clock.beats} data-lock={clock.lock}
    data-wheel-angle={clock.wheelAngle.toFixed(7)}
    data-second-hand-angle={clock.secondHandAngle.toFixed(7)}
    style={{
      background:'radial-gradient(ellipse at 34% 48%,#243d49 0%,#102631 56%,#071721 100%)',
      color:'#f0e4d0',overflow:'hidden',
      fontFamily:'Inter,"Noto Sans SC","Microsoft YaHei",sans-serif',
    }}>
    {/* Graphic frame and subtle technical engraving. */}
    <div style={{position:'absolute',inset:0,opacity:.11,backgroundImage:
      'linear-gradient(#bdd2c5 1px,transparent 1px),linear-gradient(90deg,#bdd2c5 1px,transparent 1px)',
      backgroundSize:'40px 40px'}}/>
    <div style={{position:'absolute',left:46,top:45,fontSize:14,letterSpacing:5,
      color:'#d5a864'}}>M Y M G　/　M E C H A N I S M S</div>
    <div style={{position:'absolute',left:46,top:88,fontSize:37,fontWeight:750,
      letterSpacing:2}}>机械摆钟的心跳</div>
    <div style={{position:'absolute',left:48,top:145,...labelStyle}}>
      ANCHOR ESCAPEMENT · 30 TOOTH · 60 BEATS / MINUTE
    </div>
    <div style={{position:'absolute',left:730,top:75,height:570,width:1,
      background:'linear-gradient(transparent,#68818b,transparent)',opacity:.52}}/>
    <World frame={frame}/>
    {/* Dial numerals are DOM text; seconds hand and gear train remain Three meshes. */}
    {[12,3,6,9].map((n,i)=>{
      const a=i*Math.PI/2, cx=987+136*Math.sin(a),cy=348-136*Math.cos(a);
      return <span key={n} style={{position:'absolute',left:cx-20,top:cy-13,
        width:40,textAlign:'center',fontSize:23,fontFamily:'Georgia,serif',
        color:'#ead8ac',pointerEvents:'none'}}>{n}</span>;
    })}
    <div style={{position:'absolute',top:291,left:897,width:180,textAlign:'center',
      fontSize:12,letterSpacing:4,color:'#d4b179'}}>REGULATOR</div>
    <div style={{position:'absolute',top:391,left:888,width:198,textAlign:'center',
      fontSize:10,letterSpacing:2.2,color:'#9fb9bd'}}>PRECISION · CLOCKWORK</div>
    <div style={{position:'absolute',left:777,top:100,...labelStyle,
      color:'#b5c7c7'}}>秒针 · 每次解锁前进一格</div>
    <div style={{position:'absolute',left:777,top:574,...labelStyle}}>
      60 次半摆 = 60 秒 = 擒纵轮一整圈
    </div>
    <div style={{position:'absolute',left:55,top:329,...labelStyle}}>
      30 齿擒纵轮
    </div>
    <div style={{position:'absolute',left:56,top:354,width:210,height:1,
      background:'#be9858',opacity:.45}}/>
    <div style={{position:'absolute',left:521,top:199,...labelStyle}}>擒纵叉</div>
    <div style={{position:'absolute',left:540,top:225,width:77,height:1,
      background:'#be9858',opacity:.5}}/>
    <div style={{position:'absolute',left:520,top:554,...labelStyle}}>钟摆</div>
    <Pill left={56} top={416} label={'入端擒纵瓦  /  '+
      (clock.lock==='entry'?'● 咬合':'○ 放行')} active={clock.lock==='entry'}/>
    <Pill left={56} top={461} label={'出端擒纵瓦  /  '+
      (clock.lock==='exit'?'● 咬合':'○ 放行')} active={clock.lock==='exit'}/>
    <div style={{position:'absolute',left:56,bottom:45,right:56,height:1,
      background:'#7d9598',opacity:.45}}/>
    <div style={{position:'absolute',left:58,bottom:15,...labelStyle,letterSpacing:1}}>
      摆动 → 交替解锁 → 擒纵轮步进 → 秒针跳动
    </div>
    <div style={{position:'absolute',left:775,bottom:45,display:'flex',
      alignItems:'baseline',gap:16}}>
      <span style={{fontSize:58,fontWeight:700,color:'#f4c586',
        fontVariantNumeric:'tabular-nums'}}>{String(Math.min(clock.beats,60)).padStart(2,'0')}</span>
      <span style={{fontSize:15,color:'#a8bdbf'}}>节拍</span>
      <span style={{fontSize:18,color:'#eac58d',marginLeft:32}}>{phase}</span>
      <span style={{fontSize:13,color:'#b4c4c6'}}>{clock.lock==='entry'?'左瓦锁定':'右瓦锁定'}</span>
    </div>
    <div data-testid="clock-kinematic-readout" style={{position:'absolute',right:55,bottom:15,
      ...labelStyle,letterSpacing:.6}}>
      {clock.wheelAngle*180/Math.PI < 10?'0':''}{(clock.wheelAngle*180/Math.PI).toFixed(1)}° / 360°
    </div>
  </AbsoluteFill>;
};
