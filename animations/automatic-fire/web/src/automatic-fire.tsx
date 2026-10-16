import React, {useLayoutEffect, useMemo} from 'react';
import {AbsoluteFill,useCurrentFrame} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {useThree} from '@react-three/fiber';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import * as THREE from 'three';
import {cameraAt,captionAt,cycleAt,type CycleFrame,type Point} from './automatic-model';

type XY=[number,number];
const BODY='#58636a';
const DARK='#38464f';
const RUBBER='#282d34';
const EDGE='#9aa5a9';
const RAIL='#c3c8c5';
const ACTION='#63a4a4';
const COPPER='#c58a50';
const BRASS='#e8b66f';
const CHARCOAL='#1f2e37';

/** Artist-modelled silhouette, not measured mechanical components. */
const Silhouette:React.FC<{
  outline:XY[];holes?:XY[][];depth:number;z:number;color:string;
  opacity?:number;metal?:number;shiftZ?:number;
}>=({outline,holes=[],depth,z,color,opacity=1,metal=.46,shiftZ=0})=>{
  const geometry=useMemo(()=>{
    const shape=new THREE.Shape();
    outline.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));
    shape.closePath();
    holes.forEach(h=>{
      const cut=new THREE.Path();
      h.forEach(([x,y],i)=>i?cut.lineTo(x,y):cut.moveTo(x,y));
      cut.closePath();shape.holes.push(cut);
    });
    const geo=new THREE.ExtrudeGeometry(shape,{
      depth,steps:1,bevelEnabled:true,bevelSize:.055,bevelThickness:.04,
      bevelSegments:3,curveSegments:10,
    });
    geo.computeVertexNormals();return geo;
  },[JSON.stringify(outline),JSON.stringify(holes),depth]);
  return <mesh geometry={geometry} position={[0,0,z-depth/2+shiftZ]}
    castShadow receiveShadow>
    <meshStandardMaterial color={color} metalness={metal} roughness={.38}
      transparent={opacity<.999} opacity={opacity} depthWrite={opacity>.92}/>
  </mesh>;
};

const Rounded:React.FC<{
  pos:Point;size:Point;color:string;radius?:number;
  metal?:number;opacity?:number;emissive?:string;
}>=({pos,size,color,radius=.10,metal=.55,opacity=1,emissive='#000000'})=>{
  const geometry=useMemo(()=>new RoundedBoxGeometry(...size,3,
    Math.min(radius, ...size.map(x=>x*.18))),[...size,radius]);
  return <mesh position={pos} geometry={geometry} castShadow receiveShadow>
    <meshStandardMaterial color={color} metalness={metal} roughness={.38}
      emissive={emissive} emissiveIntensity={emissive==='#000000'?0:.12}
      transparent={opacity<.999} opacity={opacity} depthWrite={opacity>.94}/>
  </mesh>;
};
const Barrel:React.FC<{
  x:number;y:number;z:number;length:number;radius:number;color:string;
  opacity?:number;
}>=({x,y,z,length,radius,color,opacity=1})=>
  <mesh position={[x,y,z]} rotation={[0,0,-Math.PI/2]} castShadow>
    <cylinderGeometry args={[radius,radius,length,40]}/>
    <meshStandardMaterial color={color} metalness={.67} roughness={.34}
      transparent={opacity<1} opacity={opacity}/>
  </mesh>;
const Ring:React.FC<{x:number;y:number;z:number;r:number;tube:number;color:string}>=
  ({x,y,z,r,tube,color})=><mesh position={[x,y,z]} rotation={[0,Math.PI/2,0]}>
    <torusGeometry args={[r,tube,10,48]}/>
    <meshStandardMaterial color={color} metalness={.7} roughness={.32}/>
  </mesh>;

/** Symbolic cartridge; its sizes/trajectory are not related to any calibre. */
const Round:React.FC<{pos:Point;angle?:Point;scale?:number;spent?:boolean}>=
({pos,angle=[0,0,0],scale=1,spent=false})=>
  <group position={pos} rotation={angle} scale={scale}>
    <Barrel x={-.05} y={0} z={0} length={.70} radius={.115} color={BRASS}/>
    <Ring x={-.40} y={0} z={0} r={.115} tube={.020} color={COPPER}/>
    {!spent&&<mesh position={[.41,0,0]} rotation={[0,0,-Math.PI/2]}>
      <coneGeometry args={[.113,.30,32]}/>
      <meshStandardMaterial color="#c1aaa0" metalness={.65} roughness={.33}/>
    </mesh>}
  </group>;

/** Displacement of the spring stays tied to the actual moving bolt. */
const Spring:React.FC<{recoil:number}>=({recoil})=>{
  const geometry=useMemo(()=>{
    const points:THREE.Vector3[]=[];
    for(let i=0;i<=190;i++){
      const u=i/190,a=u*Math.PI*2*10;
      points.push(new THREE.Vector3(-.5+u,.16*Math.cos(a),.16*Math.sin(a)));
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),190,.035,7,false);
  },[]);
  const back=-2.31;
  const front=-.91-recoil;
  const length=Math.max(.20,front-back);
  return <group position={[(back+front)/2,.91,.02]} scale={[length,1,1]}>
    <mesh geometry={geometry}>
      <meshStandardMaterial color="#acb9b7" metalness={.79} roughness={.27}/>
    </mesh>
  </group>;
};

const Buttstock:React.FC=()=>{
  const frame:XY[]=[
    [-6.04,1.05],[-5.63,1.33],[-4.94,1.33],[-3.58,1.13],
    [-2.55,1.15],[-2.53,.32],[-3.85,.26],[-4.96,-.34],
    [-5.89,-.31],[-6.06,.10],
  ];
  const opening:XY[]=[
    [-4.99,.12],[-4.43,.55],[-3.67,.89],[-4.90,.91],
  ];
  return <group>
    <Silhouette outline={frame} holes={[opening]} depth={.55} z={-.05} color={DARK}/>
    <Silhouette outline={[[-6.22,-.44],[-5.90,-.44],[-5.90,1.43],[-6.22,1.42]]}
      depth={.70} z={-.05} color={RUBBER} metal={.10}/>
    <Rounded pos={[-2.61,.72,0]} size={[.34,.82,.62]} color={EDGE}/>
    <Rounded pos={[-5.53,.12,.18]} size={[.50,.15,.29]} color={EDGE} radius={.055}/>
  </group>;
};

const Handguard:React.FC=()=>{
  const guard:XY[]=[[1.66,.28],[4.45,.26],[4.65,.42],[4.65,1.19],
    [4.32,1.43],[1.74,1.43],[1.54,1.18]];
  return <group>
    <Barrel x={3.96} y={.84} z={0} length={4.70} radius={.225} color={CHARCOAL}/>
    <Barrel x={5.16} y={.84} z={0} length={2.03} radius={.255} color={EDGE}/>
    <Ring x={6.20} y={.84} z={0} r={.24} tube={.065} color={DARK}/>
    <Silhouette outline={guard} depth={.74} z={-.03} color={BODY}/>
    <Silhouette outline={[[1.70,1.30],[4.46,1.30],[4.40,1.45],[1.80,1.45]]}
      depth={.78} z={-.03} color={DARK}/>
    {[2.11,2.78,3.45,4.12].map(x=><Rounded key={x} pos={[x,.86,.389]}
      size={[.42,.115,.045]} radius={.025} color={CHARCOAL} metal={.25}/>)}
    <Rounded pos={[4.43,.87,.0]} size={[.24,1.04,.88]} color={DARK}/>
    <Barrel x={4.56} y={.84} z={0} length={.25} radius={.27} color={RAIL}/>
    {/* Two functional-looking landmarks only: no excess rivets or diagram labels. */}
    <Rounded pos={[4.35,1.66,0]} size={[.20,.38,.19]} color={DARK} radius={.035}/>
  </group>;
};

const Furniture:React.FC=()=>{
  const mag:XY[]=[[-.04,.05],[.94,.05],[1.07,-.56],[1.23,-2.85],
    [.43,-2.96],[-.22,-2.37],[-.38,-1.44]];
  const grip:XY[]=[[-2.01,-.10],[-1.07,-.16],[-1.28,-.68],[-1.69,-2.31],
    [-2.43,-2.20],[-2.47,-1.84]];
  const guardCurve=useMemo(()=>{
    const points:THREE.Vector3[]=[[-1.56,-.37,.46],[-1.48,-.95,.46],
      [-1.13,-1.06,.46],[-.56,-1.00,.46],[-.33,-.31,.46]]
      .map(v=>new THREE.Vector3(v[0],v[1],v[2]));
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),32,.056,8,false);
  },[]);
  return <group>
    <Silhouette outline={mag} depth={.69} z={-.08} color={BODY} metal={.40}/>
    <Rounded pos={[.55,-2.81,.35]} size={[.89,.14,.69]} color={DARK}/>
    <Silhouette outline={grip} depth={.75} z={-.14} color={RUBBER} metal={.12}/>
    {[-.6,-.95,-1.3,-1.65].map((y,i)=><Rounded key={i}
      pos={[-1.95,y,.30]} size={[.40,.048,.055]} radius={.014}
      color="#6d767a" metal={.15}/>)}
    <mesh geometry={guardCurve}>
      <meshStandardMaterial color={DARK} metalness={.66} roughness={.37}/>
    </mesh>
  </group>;
};

const Receiver:React.FC<{s:CycleFrame}>=({s})=>{
  const lower:XY[]=[[-2.70,.08],[-2.65,1.48],[-1.72,1.59],
    [1.55,1.56],[1.86,1.24],[1.86,.36],[1.31,.02]];
  // Open three-dimensional cavity: without a real hole, the bolt was invisible.
  const window:XY[]=[[-2.22,.46],[1.20,.46],[1.31,.56],
    [1.31,1.33],[-2.22,1.33]];
  const side:XY[]=[[-2.62,.31],[-2.62,1.46],[-1.7,1.53],
    [1.43,1.50],[1.76,1.23],[1.76,.38],[1.18,.31]];
  return <group>
    <Silhouette outline={lower} holes={[window]} depth={1.03} z={-.12} color={DARK}/>
    {/* The machined opening remains exposed when the removable outer plate moves. */}
    <Rounded pos={[-.19,.91,-.43]} size={[3.51,.75,.08]}
      color="#142c32" radius={.13} metal={.45}/>
    <Rounded pos={[-.22,1.43,.40]} size={[3.84,.11,.31]} color={EDGE} radius={.035}/>
    <Rounded pos={[-.27,.34,.41]} size={[3.79,.11,.29]} color={EDGE} radius={.035}/>
    <Rounded pos={[1.60,.91,.42]} size={[.29,.92,.31]} color={RAIL}/>
    <Rounded pos={[-2.45,.91,.41]} size={[.22,.93,.32]} color={EDGE}/>
    {/* The removable solid side cover actually clears the sightline.
        Moving only toward the camera failed in orthographic projection. */}
    <group position={[.18*s.reveal,8.8*s.reveal,.38*s.reveal]}>
      <Silhouette outline={side} depth={.14} z={1.06} color={BODY}
        metal={.53} opacity={s.shell}/>
    </group>
    <Rounded pos={[-1.6,1.64,-.1]} size={[1.56,.14,.56]} color={DARK} radius={.04}/>
    {[-1.75,-1.48,-1.21,-.94].map(x=><Rounded key={x}
      pos={[x,1.75,-.1]} size={[.11,.10,.52]} color={EDGE} radius={.023}/>)}
    <Rounded pos={[.45,1.69,-.1]} size={[.74,.15,.37]} color={EDGE} radius={.04}/>
  </group>;
};

const Internals:React.FC<{s:CycleFrame}>=({s})=>{
  const x=-.08-s.recoil;
  const feedVisible=s.active&&s.phase>=.55&&s.phase<.92;
  const fired=s.active&&s.phase>=.08&&s.phase<.28;
  const projectileX=1.4+4.8* Math.min(1,Math.max(0,(s.phase-.08)/.2));
  const impact=s.flash*.7;
  const brassShown=s.reveal>.20?Math.min(1,(s.reveal-.20)/.38):.01;
  return <group>
    <Spring recoil={s.recoil}/>
    <Rounded pos={[-2.38,.91,.36]} size={[.15,.71,.42]} color={RAIL}/>
    {/* The single turquoise mass is what the eye should follow. */}
    <group position={[x,.90,.53]}>
      <Rounded pos={[0,0,0]} size={[1.63,.59,.63]} color={ACTION} radius={.16}/>
      <Rounded pos={[.64,0,-.01]} size={[.18,.46,.46]} color={RAIL} radius={.035}/>
      <Rounded pos={[-.63,.33,-.05]} size={[.24,.16,.52]} color={EDGE} radius={.036}/>
      <Barrel x={-.14} y={0} z={.36} length={.87} radius={.082} color="#deebe6"/>
    </group>
    {/* A fixed, dark-lined abstract chamber. */}
    <Barrel x={1.46} y={.86} z={.06} length={1.0} radius={.19} color={CHARCOAL}/>
    <Ring x={1.04} y={.86} z={.05} r={.18} tube={.048} color={EDGE}/>
    {s.roundLoaded&&<Round pos={[1.18,.86,.52]} scale={.82}/>}
    {feedVisible&&<Round pos={[.20+.98*s.feed,-.35+1.21*s.feed,.63]}
      angle={[0,0,(1-s.feed)*-.16]} scale={.84}/>}
    {fired&&<Round pos={[projectileX,.86,.16]} scale={.43}/>}
    {s.ejection>=0&&<Round spent scale={.85} pos={[
      1.05+.85*s.ejection,
      1.15+1.74*s.ejection-.65*s.ejection*s.ejection,
      .90+1.70*s.ejection,
    ]} angle={[.28*s.ejection,1.8*s.ejection,2.1*s.ejection]}/>}
    {/* The magazine is given a narrow visual slot, not an exploded inventory. */}
    <group position={[-1.12,-.44,.55]} rotation={[0,0,s.trigger*.37]}>
      <Rounded pos={[0,-.26,0]} size={[.12,.58,.13]} radius={.05}
        color={s.trigger>.9?COPPER:EDGE}/>
    </group>
    {/* Restrained light cue at the abstract firing moment, not pyrotechnics. */}
    {impact>.002&&<mesh position={[1.48,.85,.44]} scale={.12+impact*.45}>
      <sphereGeometry args={[1,16,12]}/>
      <meshBasicMaterial color="#f4ae54" transparent opacity={impact*.64}
        depthWrite={false}/>
    </mesh>}
  </group>;
};

const CameraDirector:React.FC<{frame:number}>=({frame})=>{
  const {camera}=useThree();
  const {position,target,zoom}=cameraAt(frame);
  useLayoutEffect(()=>{
    camera.position.set(...position);
    camera.lookAt(...target);
    if(camera instanceof THREE.OrthographicCamera)camera.zoom=zoom;
    camera.updateProjectionMatrix();
  },[camera,frame]);
  return null;
};
const Machine:React.FC<{frame:number;s:CycleFrame}>=({frame,s})=><>
  <CameraDirector frame={frame}/>
  <ambientLight intensity={1.95}/>
  <hemisphereLight args={['#ffffff','#88939a',1.3]}/>
  <directionalLight position={[-4,7,11]} color="#ffecd6" intensity={2.65}/>
  <directionalLight position={[4,6,-8]} color="#b2d7df" intensity={2.20}/>
  <directionalLight position={[10,1,5]} color="#ffffff" intensity={.65}/>
  <group position={[0,.21,0]}>
    <Buttstock/>
    <Furniture/>
    <Handguard/>
    <Internals s={s}/>
    <Receiver s={s}/>
  </group>
</>;

export const AutomaticFireScene:React.FC=()=>{
  const frame=useCurrentFrame();
  const s=cycleAt(frame);
  const caption=captionAt(frame);
  const camera=cameraAt(frame);
  return <AbsoluteFill data-testid="automatic-fire-scene"
    data-renderer="react-threejs-webgl"
    data-cycle={s.cycleIndex}
    data-phase={s.phase.toFixed(5)}
    data-bolt={s.recoil.toFixed(5)}
    data-trigger={s.trigger.toFixed(5)}
    data-plate={s.reveal.toFixed(5)}
    data-camera-zoom={camera.zoom.toFixed(3)}
    style={{background:'radial-gradient(ellipse at 51% 45%, #f7f5ee 0%, #e8e5dc 62%, #dcdedc 100%)',
      overflow:'hidden',color:'#253b43'}}>
    <ThreeCanvas orthographic width={1280} height={720}
      camera={{position:[10.4,4.6,16.6],zoom:78,near:.1,far:120}}
      gl={{alpha:true,antialias:true,preserveDrawingBuffer:true}}
      style={{position:'absolute',inset:0,width:1280,height:720,background:'transparent'}}>
      <Machine frame={frame} s={s}/>
    </ThreeCanvas>
    {caption.opacity>.002&&<div data-testid="automatic-chapter" aria-hidden="true"
      style={{position:'absolute',top:48,left:62,
        opacity:caption.opacity,whiteSpace:'nowrap',pointerEvents:'none',
        fontFamily:'"Noto Sans CJK TC","PingFang TC",system-ui,sans-serif',
        fontSize:36,fontWeight:680,letterSpacing:.7,color:'#2b3e45'}}>
      {caption.text}
    </div>}
  </AbsoluteFill>;
};
