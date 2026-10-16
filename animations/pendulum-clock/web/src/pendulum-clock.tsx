import React, {useLayoutEffect, useMemo} from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {clockAtFrame, TEETH} from './clock-model';
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
    depth:.18,steps:1,bevelEnabled:true,bevelSize:.018,
    bevelThickness:.012,bevelSegments:2,curveSegments:48,
  });
  geo.translate(0,0,-.11);
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

/** Paired, genuinely extruded escapement PALLETS, not rectangular proxy blocks.
 * Locking face (short near-radial land) and sloped impulse face have different
 * planar normals. Geometry is representative, not a manufactured Graham profile.
 * The tips extend into the 1.3-1.55 radius zone occupied by the escape teeth.
 */
function makePalletTooth(side:-1|1):THREE.ExtrudeGeometry {
  const p=new THREE.Shape();
  const contour:[number,number][]=[
    [-.17,.26],[.11,.25],[.19,.12],[.17,.015],
    [.07,-.12],[.04,-.295],[-.12,-.28],[-.145,-.08],
  ];
  contour.forEach(([x,y],i)=>{
    const xx=x*side;
    if(i===0)p.moveTo(xx,y);else p.lineTo(xx,y);
  });
  p.closePath();
  const g=new THREE.ExtrudeGeometry(p,{
    depth:.22,steps:1,bevelEnabled:true,
    bevelSize:.012,bevelThickness:.012,bevelSegments:2,
  });
  g.translate(0,0,-.11);
  return g;
}

const PalletTooth:React.FC<{side:-1|1;engaged:boolean;releasing:boolean}>=
({side,engaged,releasing})=>{
  const geometry=useMemo(()=>makePalletTooth(side),[side]);
  useLayoutEffect(()=>()=>geometry.dispose(),[geometry]);
  return <group>
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial color={engaged?GOLD:STEEL}
        roughness={.24} metalness={.82}
        emissive={engaged?(releasing?'#8a5425':'#4f381a'):'#000000'}
        emissiveIntensity={engaged ? 0.15 : 0}/>
    </mesh>
    {/* Fine 3D face inlays emphasize the two nonparallel working surfaces. */}
    <Rod a={[side*.19,.12,.131]} b={[side*.17,.015,.131]}
      radius={.015} color={BRASS}/>
    <Rod a={[side*.17,.015,.132]} b={[side*.07,-.12,.132]}
      radius={.014} color={engaged?'#f8daaa':GOLD}/>
  </group>;
};

const Anchor:React.FC<{angle:number;lock:'entry'|'exit';releasing:boolean}>=
({angle,lock,releasing})=>
  <group position={[0,2.56,-.33]} rotation={[0,0,-angle]}>
    <Rod a={[0,0,0]} b={[-1.13,-.94,0]} radius={.08} color={METAL}/>
    <Rod a={[0,0,0]} b={[1.13,-.94,0]} radius={.08} color={METAL}/>
    {([-1,1] as const).map(side=>
      <group key={side} position={[side*1.13,-.94,.27]}
        rotation={[0,0,side*.20]}>
        <PalletTooth side={side}
          engaged={(side===-1&&lock==='entry')||(side===1&&lock==='exit')}
          releasing={releasing}/>
      </group>
    )}
    <Axle position={[0,0,-.05]} radius={.20} depth={.23} color={DARK}/>
    <Axle position={[0,0,-.23]} radius={.09} depth={.14} color={GOLD}/>
  </group>;

/** One pendulum physically hangs from the same anchor pivot behind the wheel. */
const Pendulum:React.FC<{angle:number}>=({angle})=>
  <group position={[0,2.56,-.91]} rotation={[0,0,-angle]}>
    <Rod a={[0,-.12,0]} b={[0,-6.28,0]} radius={.044} color={STEEL}/>
    <Axle position={[0,-5.98,-.015]} radius={.14} depth={.18} color={METAL}/>
    <mesh position={[0,-6.28,0]} scale={[1,1.18,.33]} castShadow>
      <sphereGeometry args={[.55,48,32]}/>
      <meshStandardMaterial color={BRASS} metalness={.74} roughness={.22}/>
    </mesh>
    <mesh position={[-.16,-6.14,.18]} scale={[.5,1.8,.35]}>
      <sphereGeometry args={[.22,24,20]}/>
      <meshStandardMaterial color="#f4daa4" metalness={.58} roughness={.25}/>
    </mesh>
    <Axle position={[0,0,-.05]} radius={.17} depth={.20} color={METAL}/>
  </group>;

/** Only the two axis bearings remain. No decorative chassis, cage or rails. */
const MinimalSupports:React.FC=()=> <group>
  <Axle position={[0,2.56,-1.08]} radius={.22} depth={.20} color={METAL}/>
  <Axle position={[0,.60,-.42]} radius={.23} depth={.22} color={METAL}/>
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
  return <ThreeCanvas width={1280} height={720}
    camera={{position:[3.3,1.4,15],fov:33,near:.1,far:95}}
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
      <Pendulum angle={state.pendulumAngle}/>
      <EscapeWheel angle={state.wheelAngle}/>
      <Anchor angle={state.anchorAngle} lock={state.lock} releasing={state.releasing}/>
      <Dial angle={state.secondHandAngle}/>
    </group>
  </ThreeCanvas>;
};

const CAPTIONS={
  front:'钟摆往复摆动，秒针却只走一步',
  rear:'两块擒纵瓦交替卡住轮齿',
  entry:'入端擒纵瓦：锁止面挡住轮齿，再放行',
  exit:'出端擒纵瓦：接住下一齿，控制步进',
  proof:'每次解锁，轮轴与秒针一起前进',
} as const;

export const PendulumClockScene:React.FC=()=>{
  const frame=useCurrentFrame();
  const state=clockAtFrame(frame);
  const shot=cameraAtFrame(frame);
  return <AbsoluteFill
    data-testid="pendulum-clock-scene" data-renderer="react-threejs-webgl"
    data-beats={state.beats} data-lock={state.lock}
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
