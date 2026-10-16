import React, {useLayoutEffect, useMemo} from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {clockAtFrame, TEETH, type ClockState} from './clock-model';
import {palletPose, palletLocalBase, palletOutline,
  contactDistance, type PalletPose} from './escapement-contact';
import {WHEEL_PROFILE, PITCH, WHEEL_Y, PIVOT_Y} from './escapement-geometry';
import {cameraAtFrame, type Vec3} from './camera-path';

/**
 * ONE spatially coherent mechanism. The camera starts at the FRONT of the
 * dial, passes the SIDE (revealing the z-axis gaps), inspects the REAR
 * escapement, and returns to the front. Nothing is a 2D projected substitute.
 *
 * Layout, back -> front along z:
 *   pendulum and steel chassis  z=-0.98
 *   anchor and pallets         z=-0.34
 *   escapement and steel axle  z=0
 *   dial support / dial        z=1.65..2.15
 *   red seconds hand           z=2.37
 *
 * Every moving part and every camera pose is computed only from frame.
 * The model remains the same object throughout; there are no scene swaps.
 */

const METAL = '#536367';
const DARK = '#283c43';
const BRASS = '#b78d4f';
const GOLD = '#ddba78';
const STEEL = '#a9b9b7';
const PORCELAIN = '#f2eee3';
const SECOND = '#bc604c';

type AxleProps={position:Vec3;radius:number;depth:number;color:string};
const Axle:React.FC<AxleProps>=({position,radius,depth,color})=>
  <mesh position={[...position]} rotation={[Math.PI/2,0,0]} castShadow receiveShadow>
    <cylinderGeometry args={[radius,radius,depth,40]}/>
    <meshStandardMaterial color={color} metalness={.69} roughness={.28}/>
  </mesh>;

const Ring:React.FC<{position:Vec3;radius:number;tube:number;color:string}>=
({position,radius,tube,color})=>
  <mesh position={[...position]} castShadow>
    <torusGeometry args={[radius,tube,12,96]}/>
    <meshStandardMaterial color={color} metalness={.66} roughness={.32}/>
  </mesh>;

/** A true round metal rod placed between arbitrary 3D endpoints. */
const Rod:React.FC<{a:Vec3;b:Vec3;radius:number;color:string}>=
({a,b,radius,color})=>{
  const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b);
  const axis=new THREE.Vector3().subVectors(to,from);
  const mid=from.add(to).multiplyScalar(.5);
  const quat=new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0,1,0),axis.clone().normalize());
  return <mesh position={[mid.x,mid.y,mid.z]} quaternion={[quat.x,quat.y,quat.z,quat.w]}
    castShadow receiveShadow>
    <cylinderGeometry args={[radius,radius,axis.length(),12]}/>
    <meshStandardMaterial color={color} metalness={.77} roughness={.28}/>
  </mesh>;
};

/** Single extruded escape wheel: exact 30-tooth profile shared with solver.
 * The point at pitch fraction .25 is the collision tooth tip.
 * Sharp tips are intentional; no cosmetic bevel hides a contact error.
 */
function makeEscapeWheel():THREE.ExtrudeGeometry {
  const shape=new THREE.Shape();
  for(let k=0;k<TEETH;k++){
    for(const [fraction,radius] of WHEEL_PROFILE){
      const angle=(k+fraction)*PITCH;
      const x=Math.sin(angle)*radius,y=Math.cos(angle)*radius;
      if(k===0&&fraction===0)shape.moveTo(x,y);
      else shape.lineTo(x,y);
    }
  }
  shape.closePath();
  const hole=new THREE.Path();
  hole.absarc(0,0,.55,0,Math.PI*2,true);
  shape.holes.push(hole);
  const geo=new THREE.ExtrudeGeometry(shape,{
    depth:.16,steps:1,bevelEnabled:false,
  });
  geo.translate(0,0,-.09);
  return geo;
}

const EscapeWheel:React.FC<{angle:number}>=({angle})=>{
  const geom=useMemo(makeEscapeWheel,[]);
  useLayoutEffect(()=>()=>geom.dispose(),[geom]);
  return <group position={[0,WHEEL_Y,0]} rotation={[0,0,-angle]}>
    <mesh geometry={geom} castShadow receiveShadow>
      <meshStandardMaterial color={BRASS} metalness={.78} roughness={.26}
        side={THREE.DoubleSide}/>
    </mesh>
    {Array.from({length:6},(_,i)=>{
      const a=i*Math.PI/3;
      return <Rod key={i}
        a={[.27*Math.sin(a),.27*Math.cos(a),.09]}
        b={[1.28*Math.sin(a),1.28*Math.cos(a),.09]}
        radius={.067} color={GOLD}/>;
    })}
    <Axle position={[0,0,.13]} radius={.32} depth={.24} color={METAL}/>
    <Axle position={[0,0,.29]} radius={.125} depth={.17} color={GOLD}/>
    <Ring position={[0,0,.245]} radius={.36} tube={.027} color={GOLD}/>
  </group>;
};

/** Each bronze pallet is one bent working shoe, not a floating triangle.
 * The radius of the polished locking face is EXACTLY the pivot-to-wheel
 * collision radius, with the anchor pivot as its center of curvature.
 * Entry and exit soles lie on opposite sides of the working arc.
 */
function makeDeadbeatPallet(side:'entry'|'exit'):THREE.ExtrudeGeometry {
  const points=palletOutline(side);
  const shape=new THREE.Shape();
  shape.moveTo(...points[0]);
  for(const p of points.slice(1))shape.lineTo(...p);
  shape.closePath();
  const geometry=new THREE.ExtrudeGeometry(shape,{
    depth:.14,steps:1,bevelEnabled:false,
  });
  geometry.translate(0,0,-.15);
  return geometry;
}
const PalletTooth:React.FC<{pose:PalletPose}>=({pose})=>{
  const geometry=useMemo(()=>makeDeadbeatPallet(pose.side),[pose.side]);
  useLayoutEffect(()=>()=>geometry.dispose(),[geometry]);
  return <mesh geometry={geometry} castShadow receiveShadow>
    <meshStandardMaterial color={pose.engaged?GOLD:STEEL}
      metalness={.77} roughness={.24} side={THREE.DoubleSide}/>
  </mesh>;
};

/** An anchor is an EXTENSION of the pendulum's own rigid shaft.
 * It has no independent rotation, time base, positional interpolation, or
 * animated piston. Geometry here is in PIVOT-LOCAL coordinates; the only
 * group rotation exists in EscapementPendulumAssembly below.
 */
const Anchor:React.FC<{state:ClockState}>=({state})=>{
  const entry=palletPose('entry',state),exit=palletPose('exit',state);
  return <group>
    {([entry,exit] as PalletPose[]).map(pose=>
      <group key={pose.side}>
        {/* The two arms weld at the BACK of each curved shoe. */}
        <Rod a={[0,0,-.25]} b={[...palletLocalBase(pose.side),-.12]}
          radius={.030} color={STEEL}/>
        <PalletTooth pose={pose}/>
      </group>
    )}
    <Axle position={[0,0,-.30]} radius={.125} depth={.18} color={DARK}/>
  </group>;
};

/** The tooth/pallet joint is physically present in the same Z plane:
 * no arbitrary glowing guide line masquerading as an engaged flank.
 */

/** One pendulum physically hangs from the same anchor pivot behind the wheel. */
const Pendulum:React.FC=()=>
  <group position={[0,0,-.91]}>
    <Rod a={[0,0,0]} b={[0,-6.28,0]} radius={.043} color={STEEL}/>
    <mesh position={[0,-6.28,0]} scale={[1,1.17,.34]} castShadow>
      <sphereGeometry args={[.55,48,32]}/>
      <meshStandardMaterial color={BRASS} metalness={.74} roughness={.23}/>
    </mesh>
  </group>;

/** Only the two axis bearings remain. No decorative chassis, cage or rails. */
const MinimalSupports:React.FC=()=> <group>
  <Axle position={[0,PIVOT_Y,-1.08]} radius={.22} depth={.20} color={METAL}/>
  <Axle position={[0,WHEEL_Y,-.42]} radius={.23} depth={.22} color={METAL}/>
</group>;

/** Porcelain seconds dial is ON THE SAME COAXIAL SHAFT as the escape wheel. */
const Dial:React.FC<{angle:number}>=({angle})=>{
  const dialY=WHEEL_Y;
  return <group position={[0,dialY,0]}>
    {/* The shaft crosses the real 3D gap from the wheel to the clock face. */}
    <Rod a={[0,0,.20]} b={[0,0,2.36]} radius={.073} color={BRASS}/>
    <Axle position={[0,0,1.75]} radius={1.78} depth={.20} color={BRASS}/>
    <Axle position={[0,0,1.88]} radius={1.68} depth={.09} color={PORCELAIN}/>
    <Ring position={[0,0,2.04]} radius={1.735} tube={.041} color={GOLD}/>
    <Ring position={[0,0,2.07]} radius={1.49} tube={.009} color="#b4a78e"/>
    {Array.from({length:60},(_,k)=>{
      const a=k*Math.PI/30, r0=k%5===0?1.32:1.40, r1=1.52;
      return <Rod key={k} a={[r0*Math.sin(a),r0*Math.cos(a),2.10]}
        b={[r1*Math.sin(a),r1*Math.cos(a),2.10]}
        radius={k%5===0?.021:.009} color={k%5===0?DARK:'#988c73'}/>;
    })}
    {/* No second independent model or off-axis display. */}
    <group position={[0,0,2.29]} rotation={[0,0,-angle]}>
      <Rod a={[0,-.32,0]} b={[0,1.31,0]} radius={.026} color={SECOND}/>
      <mesh position={[0,1.35,0]} rotation={[0,0,Math.PI]}>
        <coneGeometry args={[.073,.20,4]}/>
        <meshStandardMaterial color={SECOND} metalness={.47} roughness={.32}/>
      </mesh>
      <Axle position={[0,-.25,0]} radius={.073} depth={.08} color={SECOND}/>
    </group>
    <Axle position={[0,0,2.38]} radius={.09} depth={.12} color={BRASS}/>
  </group>;
};

const CinematicCamera:React.FC<{frame:number}>=({frame})=>{
  const {camera}=useThree();
  const shot=cameraAtFrame(frame);
  useLayoutEffect(()=>{
    camera.position.set(...shot.position);
    camera.lookAt(...shot.target);
    if(camera instanceof THREE.PerspectiveCamera){
      camera.fov=shot.fov;
      camera.updateProjectionMatrix();
    }
    camera.updateMatrixWorld();
  },[camera,frame,shot.position[0],shot.position[1],shot.position[2],
    shot.target[0],shot.target[1],shot.target[2],shot.fov]);
  return null;
};

const Movement:React.FC<{frame:number}>=({frame})=>{
  const state=clockAtFrame(frame);
  return <ThreeCanvas width={1280} height={720}
    camera={{position:[0,1.2,14.5],fov:35,near:.1,far:95}}
    gl={{alpha:false,antialias:true,preserveDrawingBuffer:true}}
    style={{position:'absolute',inset:0,width:1280,height:720}}>
    <color attach="background" args={['#edece6']}/>
    <ambientLight intensity={1.5}/>
    <directionalLight position={[4,8,13]} intensity={2.6} color="#fff4de"/>
    <directionalLight position={[-7,5,-9]} intensity={2.7} color="#e5f0f2"/>
    <directionalLight position={[0,-5,8]} intensity={.8} color="#ffdda0"/>
    <CinematicCamera frame={frame}/>
    <group>
      <MinimalSupports/>
      <EscapeWheel angle={state.wheelAngle}/>
      {/* ONE pivot, ONE angle: pendulum rod, pendulum bob and both pallets
          form a single physically connected rotating Three.js assembly. */}
      <group position={[0,PIVOT_Y,0]} rotation={[0,0,-state.pendulumAngle]}>
        <Rod a={[0,0,-.91]} b={[0,0,-.33]}
          radius={.085} color={STEEL}/>
        <Pendulum/>
        <Anchor state={state}/>
      </group>
      <Dial angle={state.secondHandAngle}/>
    </group>
  </ThreeCanvas>;
};

const CAPTIONS={
  front:'秒针由同一根擒纵轮轴间歇带动',
  rear:'两块弧面擒纵瓦，轮齿真正交替锁止',
  contact:'重力使摆杆摆动；轮齿只在解除锁止后前进',
  proof:'一次接触放行半个齿距，六十次前进一整圈',
} as const;

export const PendulumClockScene:React.FC=()=>{
  const frame=useCurrentFrame();
  const state=clockAtFrame(frame);
  const shot=cameraAtFrame(frame);
  const entry=palletPose('entry',state);
  const exit=palletPose('exit',state);
  return <AbsoluteFill
    data-testid="pendulum-clock-scene" data-renderer="react-threejs-webgl"
    data-beats={state.beats} data-lock={state.lock}
    data-pendulum-angle={state.pendulumAngle.toFixed(7)}
    data-anchor-angle={state.anchorAngle.toFixed(7)}
    data-wheel-angle={state.wheelAngle.toFixed(7)}
    data-second-hand-angle={state.secondHandAngle.toFixed(7)}
    data-camera-x={shot.position[0].toFixed(4)}
    data-camera-z={shot.position[2].toFixed(4)}
    data-camera-distance={Math.hypot(
      shot.position[0]-shot.target[0],
      shot.position[1]-shot.target[1],
      shot.position[2]-shot.target[2]).toFixed(4)}
    data-camera-chapter={shot.chapter}
    data-camera-mode={shot.mode}
    data-contact-side={entry.engaged?'entry':exit.engaged?'exit':'free'}
    data-wheel-velocity={state.wheelVelocity.toFixed(6)}
    data-pendulum-velocity={state.pendulumVelocity.toFixed(6)}
    data-contact-impulse={state.contactEnergy.toFixed(8)}
    data-simulation="gravity-torque-rigid-contact"
    data-entry-contact-distance={contactDistance('entry',state).toFixed(5)}
    data-exit-contact-distance={contactDistance('exit',state).toFixed(5)}
    style={{overflow:'hidden',background:'#edece6',color:'#28383d',
      fontFamily:'"Noto Sans SC","Microsoft YaHei",sans-serif'}}>
    <Movement frame={frame}/>
    {/* Exactly one restrained chapter caption. No diagrams, cards, HUD or grid. */}
    <div style={{
      position:'absolute',left:62,bottom:51,pointerEvents:'none',
      fontSize:24,fontWeight:560,letterSpacing:1.1,color:'#34464c',
      textShadow:'0 1px 12px #edece6b8'
    }}>{CAPTIONS[shot.chapter]}</div>
    <div style={{
      position:'absolute',right:61,top:50,pointerEvents:'none',
      fontSize:12,letterSpacing:2.3,color:'#6b7576'
    }}>MYMG / ESCAPEMENT</div>
  </AbsoluteFill>;
};
