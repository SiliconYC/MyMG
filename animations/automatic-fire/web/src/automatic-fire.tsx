import React, {useLayoutEffect, useMemo} from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {cameraAt,captionAt,cycleAt,type CycleFrame,type Point} from './automatic-model';

/**
 * Deliberately abstract firearm: illustrates the cycling principle, not a
 * real mechanism, construction plan, selector modification or physical scale.
 * One hero model / one caption / one moving camera; nothing else competes.
 */
const GRAPHITE='#42545f';
const EDGE='#8797a0';
const BRASS='#e0ad69';
const ICE='#8abcc3';
const METAL='#b0bec5';

const Beam: React.FC<{a:Point;b:Point;r:number;color:string}>=({a,b,r,color})=>{
  const v1=new THREE.Vector3(...a),v2=new THREE.Vector3(...b);
  const displacement=v2.clone().sub(v1);
  const middle=v1.clone().add(v2).multiplyScalar(.5);
  const q=new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0,1,0),displacement.clone().normalize());
  return <mesh position={middle} quaternion={q}>
    <cylinderGeometry args={[r,r,displacement.length(),14]}/>
    <meshStandardMaterial color={color} roughness={.32} metalness={.79}/>
  </mesh>;
};

const Cartridge:React.FC<{position:Point;rotation?:Point;scale?:number}>=
  ({position,rotation=[0,0,0],scale=1})=><group position={position}
    rotation={rotation} scale={scale}>
    <mesh rotation={[0,0,-Math.PI/2]}>
      <cylinderGeometry args={[.125,.125,.65,24]}/>
      <meshStandardMaterial color={BRASS} metalness={.84} roughness={.24}/>
    </mesh>
    <mesh position={[.40,0,0]} rotation={[0,0,-Math.PI/2]}>
      <coneGeometry args={[.125,.18,24]}/>
      <meshStandardMaterial color="#f0d4a0" metalness={.65} roughness={.32}/>
    </mesh>
  </group>;

const Coil:React.FC<{recoil:number}>=({recoil})=>{
  const geometry=useMemo(()=>{
    const start=-3.16,end=-1.28-recoil;
    const vertices:THREE.Vector3[]=[];
    for(let i=0;i<=240;i++){
      const t=i/240,angle=t*Math.PI*2*13;
      vertices.push(new THREE.Vector3(
        start+(end-start)*t,
        .245*Math.cos(angle),
        .245*Math.sin(angle),
      ));
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(vertices),240,.044,7,false);
  },[recoil]);
  return <mesh geometry={geometry}>
    <meshStandardMaterial color={ICE} metalness={.72} roughness={.29}/>
  </mesh>;
};

const Housing:React.FC<{opacity:number}>=({opacity})=><group>
  <mesh position={[-.64,.05,0]} castShadow>
    <boxGeometry args={[6.12,1.30,1.26]}/>
    <meshStandardMaterial color={GRAPHITE} metalness={.69} roughness={.32}
      transparent opacity={opacity} depthWrite={opacity>.9}/>
  </mesh>
  {/* Two very slim fixed rails preserve a readable silhouette after the hull fades. */}
  {[-.58,.58].map(z=><mesh key={z} position={[-.68,-.54,z]}>
    <boxGeometry args={[6.02,.09,.08]}/>
    <meshStandardMaterial color={EDGE} metalness={.85} roughness={.26}/>
  </mesh>)}
  <mesh position={[-.63,.75,-.02]}>
    <boxGeometry args={[6.10,.14,1.18]}/>
    <meshStandardMaterial color={GRAPHITE} metalness={.73} roughness={.33}
      transparent opacity={.16+.84*opacity} depthWrite={false}/>
  </mesh>
  <mesh position={[-4.43,-.26,-.05]} rotation={[0,0,.23]}>
    <boxGeometry args={[1.45,.52,.72]}/>
    <meshStandardMaterial color="#344550" roughness={.43} metalness={.57}/>
  </mesh>
  {/* Reduced silhouette: barrel, guard and magazine are instantly recognizable. */}
  <mesh position={[3.85,.12,0]} rotation={[0,0,Math.PI/2]}>
    <cylinderGeometry args={[.31,.31,3.48,36]}/>
    <meshStandardMaterial color="#526671" metalness={.78} roughness={.32}/>
  </mesh>
  <mesh position={[5.58,.12,0]} rotation={[0,Math.PI/2,0]}>
    <torusGeometry args={[.27,.065,12,32]}/>
    <meshStandardMaterial color={METAL} metalness={.79} roughness={.25}/>
  </mesh>
  <mesh position={[-.83,-1.69,-.08]} rotation={[0,0,-.12]}>
    <boxGeometry args={[1.14,2.20,.76]}/>
    <meshStandardMaterial color="#4e626a" metalness={.7} roughness={.4}/>
  </mesh>
  <mesh position={[.30,-1.20,-.04]} rotation={[0,0,.12]}>
    <boxGeometry args={[.50,1.46,.62]}/>
    <meshStandardMaterial color="#3b4c55" metalness={.69} roughness={.40}/>
  </mesh>
  <mesh position={[.10,-.95,.50]} rotation={[0,0,.08]}>
    <torusGeometry args={[.47,.057,9,40,Math.PI]}/>
    <meshStandardMaterial color={EDGE} metalness={.81} roughness={.33}/>
  </mesh>
</group>;

const Mechanism:React.FC<{s:CycleFrame}>=({s})=>{
  const x=-.50-s.recoil;
  const traveling=s.active && s.phase>.08 && s.phase<.30;
  const projectileX=1.60+3.65*Math.min(1,(s.phase-.08)/.22);
  const chamberRound=!s.active||s.phase<.09||s.phase>.94;
  const feedMoving=s.active&&s.phase>=.56&&s.phase<=.94;
  return <group>
    {/* Interior, deliberately oversized to make the movement legible. */}
    <Coil recoil={s.recoil}/>
    <mesh position={[-3.30,0,0]}>
      <boxGeometry args={[.12,.82,.86]}/>
      <meshStandardMaterial color={EDGE} roughness={.33} metalness={.80}/>
    </mesh>
    <group position={[x,0,0]}>
      <mesh castShadow>
        <boxGeometry args={[1.44,.69,.79]}/>
        <meshStandardMaterial color={ICE} metalness={.79} roughness={.29}/>
      </mesh>
      <mesh position={[.66,0,0]}>
        <boxGeometry args={[.18,.48,.53]}/>
        <meshStandardMaterial color={METAL} metalness={.8} roughness={.30}/>
      </mesh>
      <mesh position={[-.54,.37,0]}>
        <boxGeometry args={[.23,.15,.66]}/>
        <meshStandardMaterial color="#cbd5d7" metalness={.7} roughness={.35}/>
      </mesh>
    </group>
    {/* Conceptual chamber cartridge and a single fired projectile. */}
    {chamberRound&&<Cartridge position={[1.49,.05,.11]}/>}
    {feedMoving&&<Cartridge position={[
      -.67+2.16*s.feed,
      -1.02+1.07*s.feed,
      .34-.21*s.feed,
    ]} scale={.92}/>}
    {traveling&&<Cartridge position={[projectileX,.12,0]} scale={.65}/>}
    {s.ejection>=0&&<Cartridge
      position={[1.10+1.20*s.ejection, .36+2.24*s.ejection, .42+s.ejection*.27]}
      rotation={[0,.2+s.ejection*2,.25+s.ejection*2.5]} scale={.77}/>}
    {[0,1,2].map(i=><Cartridge key={i}
      position={[-1.06,-1.16-i*.40,.44]} scale={.70}/>)}
    {/* One held trigger; no detailed functional firing-control assembly. */}
    <group position={[.24,-.94,.61]} rotation={[0,0,-s.trigger*.30]}>
      <mesh position={[0,-.18,0]}>
        <boxGeometry args={[.095,.48,.09]}/>
        <meshStandardMaterial color={BRASS} metalness={.84} roughness={.30}/>
      </mesh>
    </group>
    {/* Small warm pulse, no particle fireworks. */}
    {s.flash>.01&&<mesh position={[5.90,.12,0]} scale={[1.8*s.flash,.65*s.flash,.65*s.flash]}>
      <sphereGeometry args={[.43,16,12]}/>
      <meshBasicMaterial color="#ffd2a0" transparent opacity={s.flash*.8}
        depthWrite={false}/>
    </mesh>}
  </group>;
};

const CameraRig:React.FC<{frame:number}>=({frame})=>{
  const {camera}=useThree();
  const pose=cameraAt(frame);
  useLayoutEffect(()=>{
    camera.position.set(...pose.position);
    camera.lookAt(...pose.target);
    camera.updateProjectionMatrix();
  },[camera,frame,pose.position[0],pose.position[1],pose.position[2],
    pose.target[0],pose.target[1],pose.target[2]]);
  return null;
};
const Sculpture:React.FC<{frame:number;s:CycleFrame}>=({frame,s})=><>
  <CameraRig frame={frame}/>
  <ambientLight intensity={1.45}/>
  <hemisphereLight args={['#e3edf0','#1b2630',2.0]}/>
  <directionalLight position={[-4,8,9]} intensity={3.1} color="#fff4df"/>
  <directionalLight position={[6,2,-7]} intensity={2} color="#90cbd3"/>
  <group position={[0,.18,0]}>
    <Mechanism s={s}/>
    <Housing opacity={s.shell}/>
  </group>
</>;

export const AutomaticFireScene:React.FC=()=>{
  const frame=useCurrentFrame();
  const state=cycleAt(frame);
  const caption=captionAt(frame);
  return <AbsoluteFill data-testid="automatic-fire-scene"
    data-renderer="react-threejs-webgl"
    data-cycle={state.cycleIndex}
    data-phase={state.phase.toFixed(5)}
    data-bolt={state.recoil.toFixed(5)}
    data-trigger={state.trigger.toFixed(5)}
    style={{background:'radial-gradient(ellipse at 50% 48%, #1d303b, #0c1620 72%, #080f17)',
      overflow:'hidden'}}>
    <ThreeCanvas width={1280} height={720}
      camera={{position:[8.0,3.6,12.7],fov:38,near:.1,far:100}}
      gl={{antialias:true,alpha:true,preserveDrawingBuffer:true}}
      style={{position:'absolute',inset:0,width:1280,height:720,background:'transparent'}}>
      <Sculpture frame={frame} s={state}/>
    </ThreeCanvas>
    {caption.opacity>0&&<div data-testid="automatic-chapter" aria-hidden="true"
      style={{position:'absolute',left:62,top:61,opacity:caption.opacity,
        fontFamily:'"Noto Sans CJK TC","PingFang TC","Microsoft JhengHei",sans-serif',
        fontSize:34,fontWeight:670,letterSpacing:2,color:'#f3eee6',
        textShadow:'0 3px 20px #07131dbb',pointerEvents:'none'}}>
      {caption.text}
    </div>}
  </AbsoluteFill>;
};
