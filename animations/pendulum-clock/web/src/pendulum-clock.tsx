import React, {useLayoutEffect, useMemo} from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {clockAtFrame, TEETH, type ClockState} from './clock-model';
import {palletPose, palletLocalTip, palletLocalBase, palletOrientation,
  contactDistance, type PalletPose} from './escapement-contact';
import {cameraAtFrame, type Vec3} from './camera-path';
import {WHEEL_PLANE_Z, WHEEL_THICKNESS, PALLET_PLANE_Z,
  PALLET_THICKNESS, PALLET_ARM_WELD_Z, FORK_ARM_PLANE_Z,
  WHEEL_SPINDLE_RADIUS, WHEEL_SPINDLE_REAR_Z, WHEEL_SPINDLE_FRONT_Z,
  BEARING_CENTER_Z, BEARING_DEPTH, BEARING_INNER_RADIUS,
  BEARING_OUTER_RADIUS, bearingZRange, spindleZRange, zOverlap}
  from './escapement-axial';

/**
 * ONE spatially coherent mechanism. The camera starts at the FRONT of the
 * dial, passes the SIDE (revealing the z-axis gaps), inspects the REAR
 * escapement, and returns to the front. Nothing is a 2D projected substitute.
 *
 * Layout, back -> front along z:
 *   pendulum and steel chassis  z=-0.98
 *   both fork arms             z=-0.02 throughout (no axial slope)
 *   BOTH pallets and wheel    same z=-0.02 working plane
 *   rotating escape spindle   z=-0.55..0.16 through the rear bearing
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

/** One solid round shaft, with small rounded end edges.
 * The coplanar fork rods meet its axis at z=-.02; the pendulum stem is
 * behind them at z=-.91. The same shaft spans BOTH with >.04 penetration
 * past their centre lines: no extra offset linkage or additional collar.
 */
const COUPLING_CENTER_Z=-.465;
const COUPLING_LENGTH=1.03;      // -0.98..+0.05; 0.07 past BOTH rod axes
const COUPLING_RADIUS=.085;
const COUPLING_FILLET=.022;

/** Revolved quarter-circles yield real rounded metal, not a flat cylinder
 * with a decorative torus or several disconnected capped cylinders.
 */
function makeCouplingGeometry():THREE.LatheGeometry {
  const half=COUPLING_LENGTH/2;
  const r=COUPLING_RADIUS;
  const f=COUPLING_FILLET;
  const steps=8;
  const profile:THREE.Vector2[]=[
    new THREE.Vector2(0,-half),
    new THREE.Vector2(r-f,-half),
  ];
  for(let i=1;i<=steps;i++){
    const t=i/steps*Math.PI/2;
    profile.push(new THREE.Vector2(
      r-f+f*Math.sin(t),-half+f*(1-Math.cos(t))));
  }
  profile.push(new THREE.Vector2(r,half-f));
  for(let i=1;i<=steps;i++){
    const t=i/steps*Math.PI/2;
    profile.push(new THREE.Vector2(
      r-f+f*Math.cos(t),half-f+f*Math.sin(t)));
  }
  profile.push(new THREE.Vector2(0,half));
  return new THREE.LatheGeometry(profile,64);
}

const PendulumAnchorCoupling:React.FC=()=>{
  const geometry=useMemo(makeCouplingGeometry,[]);
  useLayoutEffect(()=>()=>geometry.dispose(),[geometry]);
  return <mesh geometry={geometry}
    position={[0,0,COUPLING_CENTER_Z]} rotation={[Math.PI/2,0,0]}
    castShadow receiveShadow>
    <meshStandardMaterial color={STEEL} metalness={.77} roughness={.28}/>
  </mesh>;
};

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

/** Single, watertight bevelled 30-tooth wheel: depth is real geometry. */
function makeEscapeWheel():THREE.ExtrudeGeometry {
  const shape=new THREE.Shape();
  const step=2*Math.PI/TEETH;
  for(let k=0;k<TEETH;k++){
    const base=k*step;
    for(const [s,r] of [[0,1.29],[.19,1.31],[.34,1.53],[.43,1.55],[.69,1.32],[.93,1.29]]){
      const a=base+s*step;
      const x=Math.sin(a)*r,y=Math.cos(a)*r;
      if(k===0&&s===0)shape.moveTo(x,y);else shape.lineTo(x,y);
    }
  }
  shape.closePath();
  const hole=new THREE.Path();
  hole.absarc(0,0,.55,0,Math.PI*2,true);
  shape.holes.push(hole);
  const geo=new THREE.ExtrudeGeometry(shape,{
    depth:WHEEL_THICKNESS,steps:1,bevelEnabled:true,bevelSize:.018,
    bevelThickness:.012,bevelSegments:2,curveSegments:48,
  });
  geo.translate(0,0,WHEEL_PLANE_Z-WHEEL_THICKNESS/2);
  return geo;
}

const EscapeWheel:React.FC<{angle:number}>=({angle})=>{
  const geom=useMemo(makeEscapeWheel,[]);
  useLayoutEffect(()=>()=>geom.dispose(),[geom]);
  return <group position={[0,.6,0]} rotation={[0,0,-angle]}>
    <mesh geometry={geom} castShadow receiveShadow>
      <meshStandardMaterial color={BRASS} metalness={.78} roughness={.26}
        side={THREE.DoubleSide}/>
    </mesh>
    {/* ONE rotating shaft: welded into the front wheel hub, passes through
        the wheel's center and the stationary hollow rear bearing. */}
    <Axle position={[0,0,(WHEEL_SPINDLE_REAR_Z+WHEEL_SPINDLE_FRONT_Z)/2]}
      radius={WHEEL_SPINDLE_RADIUS}
      depth={WHEEL_SPINDLE_FRONT_Z-WHEEL_SPINDLE_REAR_Z} color={BRASS}/>
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

/** Small, outward-pointing escapement shoe. The contact NOSE is (0,0).
 * Its wide BASE is at (0,.19), where the fork arm is welded; the former
 * mesh attached the arm to the nose, creating a visibly impossible joint.
 */
function makeSlimPallet():THREE.ExtrudeGeometry {
  const profile=new THREE.Shape();
  profile.moveTo(0,0);             // ONLY tooth-catching nose, never fork attachment
  profile.lineTo(.017,.027);       // locking land
  profile.lineTo(.023,.080);       // sloping impulse face
  profile.lineTo(.050,.19);        // broad mounting base
  profile.lineTo(-.050,.19);
  profile.lineTo(-.023,.075);
  profile.lineTo(-.010,.023);
  profile.closePath();
  const geometry=new THREE.ExtrudeGeometry(profile,{
    depth:PALLET_THICKNESS,steps:1,bevelEnabled:true,
    bevelSize:.004,bevelThickness:.006,bevelSegments:2,
  });
  geometry.translate(0,0,-PALLET_THICKNESS/2);
  return geometry;
}

const PalletTooth:React.FC<{pose:PalletPose}>=({pose})=>{
  const geometry=useMemo(makeSlimPallet,[]);
  useLayoutEffect(()=>()=>geometry.dispose(),[geometry]);
  return <group position={[...palletLocalTip(pose.side),PALLET_PLANE_Z]}
    rotation={[0,0,palletOrientation(pose.side)]}>
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial color={pose.engaged?GOLD:STEEL}
        metalness={.75} roughness={.24}
        emissive={pose.engaged?'#8b6033':'#000000'}
        emissiveIntensity={pose.engaged?0.12:0}/>
    </mesh>
    {/* The visible edge of the actual short locking face. */}
    <Rod a={[0,0,-PALLET_THICKNESS/2-.004]} b={[.017,.027,-PALLET_THICKNESS/2-.004]}
      radius={.008} color="#f3dbb0"/>
    {/* The angled impulse face is much longer than the locking land. */}
    <Rod a={[.017,.027,-PALLET_THICKNESS/2-.004]} b={[.023,.080,-PALLET_THICKNESS/2-.004]}
      radius={.008} color={BRASS}/>
  </group>;
};

/** An anchor is an EXTENSION of the pendulum's own rigid shaft.
 * It has no independent rotation, time base, positional interpolation, or
 * animated piston. Geometry here is in PIVOT-LOCAL coordinates; the only
 * group rotation exists in EscapementPendulumAssembly below.
 */
const Anchor:React.FC<{state:ClockState}>=({state})=>{
  const entry=palletPose('entry',state);
  const exit=palletPose('exit',state);
  return <group>
    {([entry,exit] as PalletPose[]).map(pose=>
      <group key={pose.side}>
        {/* Both ends are in the wheel XY plane, and seated INSIDE the
            central shaft / pallet base respectively. No Z-sloping arm. */}
        <Rod a={[0,0,FORK_ARM_PLANE_Z]}
          b={[...palletLocalBase(pose.side),PALLET_ARM_WELD_Z]}
          radius={.036} color={STEEL}/>
        <PalletTooth pose={pose}/>
      </group>
    )}
  </group>;
};

/** Highlight only the REAL rotating tooth flank, never fabricate a bridge. */
const ContactHighlights:React.FC<{state:ClockState;showDetail:boolean}>=
({state,showDetail})=>{
  if(!showDetail)return null;
  return <group>
    {(['entry','exit'] as const).map(side=>{
      const p=palletPose(side,state);
      return p.engaged?<Rod key={side}
        a={[p.flankStart[0],p.flankStart[1],-.155]}
        b={[p.flankEnd[0],p.flankEnd[1],-.155]}
        radius={.018} color="#fff0c4"/>:null;
    })}
  </group>;
};

/** One pendulum physically hangs from the same anchor pivot behind the wheel. */
const Pendulum:React.FC=()=>
  <group position={[0,0,-.91]}>
    <Rod a={[0,0,0]} b={[0,-6.28,0]} radius={.044} color={STEEL}/>
    <mesh position={[0,-6.28,0]} scale={[1,1.18,.33]} castShadow>
      <sphereGeometry args={[.55,48,32]}/>
      <meshStandardMaterial color={BRASS} metalness={.74} roughness={.22}/>
    </mesh>
  </group>;

/** A fixed cylindrical JOURNAL SLEEVE with a real central bore.
 * It must not be a solid floating plug: the rotating shaft runs through it
 * with a small radial running clearance.
 */
function makeWheelBearing():THREE.ExtrudeGeometry {
  const ring=new THREE.Shape();
  ring.absarc(0,0,BEARING_OUTER_RADIUS,0,Math.PI*2,false);
  const bore=new THREE.Path();
  bore.absarc(0,0,BEARING_INNER_RADIUS,0,Math.PI*2,true);
  ring.holes.push(bore);
  const geo=new THREE.ExtrudeGeometry(ring,{
    depth:BEARING_DEPTH,steps:1,bevelEnabled:false,curveSegments:64,
  });
  geo.translate(0,0,-BEARING_DEPTH/2);
  return geo;
}
const WheelBearing:React.FC=()=>{
  const geometry=useMemo(makeWheelBearing,[]);
  useLayoutEffect(()=>()=>geometry.dispose(),[geometry]);
  return <mesh geometry={geometry} position={[0,.60,BEARING_CENTER_Z]}
    castShadow receiveShadow>
    <meshStandardMaterial color={METAL} metalness={.69} roughness={.28}
      side={THREE.DoubleSide}/>
  </mesh>;
};
/** Other static supports are not part of this edit. */
const MinimalSupports:React.FC=()=> <group>
  <WheelBearing/>
</group>;

/** Porcelain seconds dial is ON THE SAME COAXIAL SHAFT as the escape wheel. */
const Dial:React.FC<{angle:number}>=({angle})=>{
  const dialY=.60;
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
  const shot=cameraAtFrame(frame);
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
      <group position={[0,2.56,0]} rotation={[0,0,-state.pendulumAngle]}>
        {/* One lathed cylindrical coupling; the rod ends are submerged
            inside it, with rounded shoulders on both exposed ends. */}
        <PendulumAnchorCoupling/>
        <Pendulum/>
        <Anchor state={state}/>
      </group>
      <ContactHighlights state={state}
        showDetail={shot.chapter==='contact'||shot.chapter==='rear'}/>
      <Dial angle={state.secondHandAngle}/>
    </group>
  </ThreeCanvas>;
};

const CAPTIONS={
  front:'秒针一步一走：先看看钟摆的节奏',
  rear:'两块小擒纵瓦，分别接住轮齿的斜面',
  contact:'轮齿被锁住 → 放行半齿 → 对侧重新锁住',
  proof:'每一次放行，秒针恰好前进一步',
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
    data-entry-contact-distance={contactDistance('entry',state).toFixed(5)}
    data-exit-contact-distance={contactDistance('exit',state).toFixed(5)}
    data-wheel-plane-z={WHEEL_PLANE_Z}
    data-pallet-plane-z={PALLET_PLANE_Z}
    data-wheel-bearing-axial-overlap={zOverlap(bearingZRange,spindleZRange).toFixed(5)}
    data-wheel-bearing-running-clearance={(BEARING_INNER_RADIUS-WHEEL_SPINDLE_RADIUS).toFixed(5)}
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
