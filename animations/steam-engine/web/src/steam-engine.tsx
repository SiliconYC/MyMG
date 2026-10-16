import React, {useEffect, useMemo} from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {
  steamAtFrame, CYLINDER_LEFT, CYLINDER_RIGHT, CYLINDER_OUTER_RADIUS,
  CYLINDER_INNER_RADIUS, CRANK_X, CRANK_RADIUS, type SteamFrame,
} from './steam-model';

const R = CYLINDER_OUTER_RADIUS;
const INNER = CYLINDER_INNER_RADIUS;
const BODY_X = (CYLINDER_LEFT + CYLINDER_RIGHT) / 2;
const BODY_LENGTH = CYLINDER_RIGHT - CYLINDER_LEFT;
type V3 = [number, number, number];

function ClipRenderer(): null {
  const {gl} = useThree();
  useEffect(() => {
    gl.localClippingEnabled = true;
    return () => { gl.localClippingEnabled = false; };
  }, [gl]);
  return null;
}

const Rod: React.FC<{
  from: V3; to: V3; radius: number; color: string; metallic?: number;
}> = ({from, to, radius, color, metallic = 0.6}) => {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const middle = a.clone().add(b).multiplyScalar(.5);
  const direction = b.clone().sub(a);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0), direction.clone().normalize()
  );
  return <mesh position={middle} quaternion={quaternion} castShadow>
    <cylinderGeometry args={[radius, radius, direction.length(), 14]}/>
    <meshStandardMaterial color={color} metalness={metallic} roughness={.29}/>
  </mesh>;
};

const Pipe: React.FC<{points: V3[]; color: string; radius?: number}> =
  ({points, color, radius = .08}) => {
    const curve = useMemo(() =>
      new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), [points]);
    return <mesh castShadow>
      <tubeGeometry args={[curve, 56, radius, 10, false]}/>
      <meshStandardMaterial color={color} metalness={.72} roughness={.24}/>
    </mesh>;
  };

/** Only the outer metal envelope is clipped; mechanics and fluids are never clipped. */
const CylinderShell: React.FC<{plane: THREE.Plane; s: SteamFrame}> = ({plane, s}) => {
  const sectionVisible = s.cut > .02 && s.cutZ < R && s.cutZ > -INNER;
  const outerY = Math.sqrt(Math.max(0, R * R - s.cutZ * s.cutZ));
  const innerY = Math.sqrt(Math.max(0, INNER * INNER - s.cutZ * s.cutZ));
  const lipThickness = Math.max(.019, outerY - innerY);
  return <group>
    <mesh position={[BODY_X, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
      <cylinderGeometry args={[R, R, BODY_LENGTH, 72, 1, true]}/>
      <meshStandardMaterial color="#657789" metalness={.81} roughness={.29}
        side={THREE.DoubleSide} clippingPlanes={[plane]}/>
    </mesh>
    <mesh position={[BODY_X, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[INNER, INNER, BODY_LENGTH, 72, 1, true]}/>
      <meshStandardMaterial color="#b4a58c" metalness={.75} roughness={.4}
        side={THREE.DoubleSide} clippingPlanes={[plane]}/>
    </mesh>
    <mesh position={[CYLINDER_LEFT - .06, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[R, R, .12, 72]}/>
      <meshStandardMaterial color="#71808a" metalness={.78} roughness={.34}
        clippingPlanes={[plane]}/>
    </mesh>
    <mesh position={[CYLINDER_RIGHT + .025, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
      <ringGeometry args={[.23, R, 72]}/>
      <meshStandardMaterial color="#97a3a7" metalness={.8} roughness={.3}
        side={THREE.DoubleSide} clippingPlanes={[plane]}/>
    </mesh>
    {[CYLINDER_LEFT + .08, CYLINDER_RIGHT - .08].map(x =>
      <mesh key={x} position={[x, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[R + .015, .10, 12, 72]}/>
        <meshStandardMaterial color="#a0aab0" metalness={.82} roughness={.27}
          clippingPlanes={[plane]}/>
      </mesh>
    )}
    {Array.from({length: 8}, (_, i) => {
      const a = i * Math.PI / 4;
      return <group key={i}>
        <Rod from={[CYLINDER_LEFT - .05, 1.155 * Math.cos(a), 1.155 * Math.sin(a)]}
          to={[CYLINDER_RIGHT, 1.155 * Math.cos(a), 1.155 * Math.sin(a)]}
          radius={.032} color="#9aa4aa"/>
      </group>;
    })}
    {/* Explicitly render the solid metal thickness intersected by the knife plane. */}
    {sectionVisible && [-1, 1].map(sign =>
      <mesh key={sign} position={[BODY_X, sign * (outerY + innerY) / 2, s.cutZ]}>
        <boxGeometry args={[BODY_LENGTH, lipThickness, .027]}/>
        <meshStandardMaterial color="#f7bd6b" emissive="#a45421"
          emissiveIntensity={.35} metalness={.75} roughness={.3}/>
      </mesh>
    )}
    {sectionVisible && <mesh position={[BODY_X, 0, s.cutZ]}>
      <boxGeometry args={[BODY_LENGTH, .007, .012]}/>
      <meshBasicMaterial color="#ffdba1" transparent opacity={.20}/>
    </mesh>}
  </group>;
};

const PressureChamber: React.FC<{
  start: number; end: number; color: string; pressure: number;
}> = ({start, end, color, pressure}) => {
  const length = Math.max(.001, end - start);
  return <group>
    <mesh position={[(start + end) / 2, 0, 0]}
      rotation={[0, 0, Math.PI / 2]} scale={[1, length, 1]}>
      <cylinderGeometry args={[INNER - .035, INNER - .035, 1, 48, 1, false]}/>
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={.21}
        transparent opacity={.10 + .15 * pressure}
        depthWrite={false} side={THREE.DoubleSide}/>
    </mesh>
    <mesh position={[(start + end) / 2, 0, 0]}
      rotation={[0, 0, Math.PI / 2]} scale={[1, length, 1]}>
      <cylinderGeometry args={[INNER - .019, INNER - .019, 1, 48, 1, true]}/>
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={.25}
        transparent opacity={.10 + .13 * pressure}
        depthWrite={false} side={THREE.DoubleSide}/>
    </mesh>
  </group>;
};

const SteamParticles: React.FC<{s: SteamFrame}> = ({s}) => {
  // Deterministic particles: seeking or pausing gives the identical position.
  const dots = Array.from({length: 38}, (_, i) => {
    const left = i < 19;
    const start = left ? CYLINDER_LEFT + .19 : s.pistonX + .20;
    const end = left ? s.pistonX - .20 : CYLINDER_RIGHT - .12;
    const fraction = ((s.time * (left ? 1.4 : -1.2) + i * .173) % 1 + 1) % 1;
    const angle = i * 2.39996 + s.time * .55;
    const rr = .30 + (i % 5) * .105;
    const x = start + Math.max(.0, end - start) * fraction;
    const y = Math.cos(angle) * rr;
    const z = Math.sin(angle) * rr;
    const pressure = left ? s.leftPressure : s.rightPressure;
    return {x, y, z, pressure, left};
  });
  return <group>
    {dots.map((p, i) =>
      <mesh key={i} position={[p.x, p.y, p.z]} scale={.024 + p.pressure * .018}>
        <sphereGeometry args={[1, 8, 6]}/>
        <meshBasicMaterial color={p.left ? '#ffbd70' : '#69d9e4'} transparent
          opacity={Math.min(.9, .4 + .5 * p.pressure)} depthWrite={false}/>
      </mesh>
    )}
  </group>;
};

const ValveAssembly: React.FC<{s: SteamFrame; plane: THREE.Plane}> = ({s, plane}) => {
  const spoolX = -1.65 + .53 * Math.cos(s.theta + Math.PI / 2);
  return <group>
    <mesh position={[-1.65, 1.37, 0]} castShadow>
      <boxGeometry args={[2.28, .70, .92]}/>
      <meshStandardMaterial color="#516c7e" metalness={.78} roughness={.29}
        clippingPlanes={[plane]}/>
    </mesh>
    <mesh position={[-1.65, 1.37, -.02]}>
      <boxGeometry args={[1.94, .38, .60]}/>
      <meshStandardMaterial color="#293a48" metalness={.55} roughness={.3}/>
    </mesh>
    <Rod from={[-2.64, 1.36, 0]} to={[-.63, 1.36, 0]}
      radius={.072} color="#d7ac62"/>
    <mesh position={[spoolX, 1.36, 0]}>
      <boxGeometry args={[.63, .33, .46]}/>
      <meshStandardMaterial color="#f2b85b" metalness={.82} roughness={.21}/>
    </mesh>
    {[-2.53, -.77].map((x, i) => <group key={i}>
      <mesh position={[x, 1.02, -.26]}>
        <boxGeometry args={[.20, .45, .21]}/>
        <meshStandardMaterial color={i === 0 ? '#d67d3a' : '#4eb9c9'}
          emissive={i === 0 ? '#9a3a14' : '#145a68'} emissiveIntensity={.38}/>
      </mesh>
    </group>)}
    <Pipe points={[[-2.12, 2.44, -.10], [-2.12, 2.08, -.10],
      [-1.65, 1.86, -.10], [-1.65, 1.62, -.10]]} color="#c88b4e" radius={.125}/>
    <Pipe points={[[-1.16, 1.65, -.13], [-1.16, 2.13, -.13],
      [-.45, 2.17, -.13], [-.38, 2.43, -.13]]} color="#5d9eb1" radius={.108}/>
    <mesh position={[-2.12, 2.43, -.10]}>
      <sphereGeometry args={[.16, 16, 12]}/>
      <meshStandardMaterial color="#f2ab5d" emissive="#e37824" emissiveIntensity={.9}/>
    </mesh>
    <mesh position={[-.38, 2.43, -.13]}>
      <sphereGeometry args={[.14, 16, 12]}/>
      <meshStandardMaterial color="#7ecad7" emissive="#2a8294" emissiveIntensity={.8}/>
    </mesh>
  </group>;
};

const Flywheel: React.FC<{s: SteamFrame}> = ({s}) => {
  return <group>
    <Rod from={[CRANK_X, 0, -.75]} to={[CRANK_X, 0, 1.12]}
      radius={.13} color="#b5b8b0"/>
    <group position={[CRANK_X, 0, .17]} rotation={[0, 0, s.theta]}>
      <mesh castShadow>
        <torusGeometry args={[1.06, .145, 18, 76]}/>
        <meshStandardMaterial color="#d99c52" metalness={.82} roughness={.30}/>
      </mesh>
      <mesh>
        <torusGeometry args={[.89, .033, 10, 72]}/>
        <meshStandardMaterial color="#f5cb82" metalness={.7} roughness={.33}/>
      </mesh>
      {Array.from({length: 8}, (_, i) => {
        const a = i * Math.PI / 4;
        return <Rod key={i} from={[.13 * Math.cos(a), .13 * Math.sin(a), 0]}
          to={[.96 * Math.cos(a), .96 * Math.sin(a), 0]} radius={.07}
          color="#c99458"/>;
      })}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[.28, .28, .24, 28]}/>
        <meshStandardMaterial color="#c1c5c8" metalness={.89} roughness={.26}/>
      </mesh>
      <mesh position={[CRANK_RADIUS, 0, .52]}>
        <cylinderGeometry args={[.16, .16, .20, 24]}/>
        <meshStandardMaterial color="#f2b758" metalness={.78} roughness={.28}/>
      </mesh>
    </group>
    <mesh position={[CRANK_X, -1.35, -.37]}>
      <boxGeometry args={[1.22, .19, .90]}/>
      <meshStandardMaterial color="#455562" metalness={.55} roughness={.55}/>
    </mesh>
    {[CRANK_X - .42, CRANK_X + .42].map(x=>
      <mesh key={x} position={[x, -1.07, -.39]}>
        <boxGeometry args={[.28, .57, .48]}/>
        <meshStandardMaterial color="#566572" metalness={.66} roughness={.44}/>
      </mesh>
    )}
  </group>;
};

const EngineMechanics: React.FC<{s: SteamFrame}> = ({s}) => <group>
  <PressureChamber start={CYLINDER_LEFT + .07} end={s.pistonX - .15}
    color="#ef924d" pressure={s.leftPressure}/>
  <PressureChamber start={s.pistonX + .15} end={CYLINDER_RIGHT - .08}
    color="#67c3db" pressure={s.rightPressure}/>
  <SteamParticles s={s}/>
  {/* Piston runs inside the bore and remains visible after the hull is cut. */}
  <mesh position={[s.pistonX, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
    <cylinderGeometry args={[.923, .923, .30, 64]}/>
    <meshStandardMaterial color="#d2b987" metalness={.82} roughness={.30}/>
  </mesh>
  <mesh position={[s.pistonX, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
    <torusGeometry args={[.87, .045, 10, 64]}/>
    <meshStandardMaterial color="#4d5b5d" metalness={.7} roughness={.36}/>
  </mesh>
  <Rod from={[s.pistonX, 0, .08]} to={[s.crossheadX, 0, .08]}
    radius={.115} color="#bcc8d0"/>
  <mesh position={[s.crossheadX, 0, .30]}>
    <boxGeometry args={[.32, .42, .55]}/>
    <meshStandardMaterial color="#85bec1" metalness={.7} roughness={.26}/>
  </mesh>
  <Rod from={[s.crossheadX, 0, .49]} to={[s.pinX, s.pinY, .49]}
    radius={.117} color="#dc9953"/>
  <mesh position={[s.crossheadX, 0, .52]} rotation={[Math.PI / 2, 0, 0]}>
    <cylinderGeometry args={[.17, .17, .18, 24]}/>
    <meshStandardMaterial color="#eac989" metalness={.79} roughness={.28}/>
  </mesh>
  <mesh position={[s.pinX, s.pinY, .58]} rotation={[Math.PI / 2, 0, 0]}>
    <cylinderGeometry args={[.19, .19, .23, 26]}/>
    <meshStandardMaterial color="#e7be76" metalness={.8} roughness={.26}/>
  </mesh>
  {[-.33, .33].map(y=>
    <mesh key={y} position={[.58, y, .12]}>
      <boxGeometry args={[2.55, .09, .25]}/>
      <meshStandardMaterial color="#81939f" metalness={.72} roughness={.36}/>
    </mesh>
  )}
  <Flywheel s={s}/>
</group>;

const Pedestals: React.FC = () => <group>
  {[-2.65, -.55].map(x =>
    <group key={x}>
      <mesh position={[x, -1.28, 0]}>
        <boxGeometry args={[.78, .36, 1.56]}/>
        <meshStandardMaterial color="#566675" metalness={.59} roughness={.44}/>
      </mesh>
      <mesh position={[x, -1.52, 0]}>
        <boxGeometry args={[1.12, .16, 1.94]}/>
        <meshStandardMaterial color="#384957" metalness={.65} roughness={.48}/>
      </mesh>
    </group>
  )}
  <mesh position={[.20, -1.59, -.35]}>
    <boxGeometry args={[8.90, .20, 2.0]}/>
    <meshStandardMaterial color="#334756" metalness={.54} roughness={.59}/>
  </mesh>
  <mesh position={[.2, -1.75, 0]} rotation={[-Math.PI / 2, 0, 0]}>
    <planeGeometry args={[13, 8]}/>
    <meshStandardMaterial color="#122333" roughness={.89}/>
  </mesh>
  <gridHelper args={[13, 26, '#344755', '#213442']} position={[.2, -1.745, 0]}/>
</group>;

const World: React.FC<{s: SteamFrame}> = ({s}) => {
  const clipPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, -1), 1.42), []);
  clipPlane.constant = s.cutZ;
  return <>
    <ClipRenderer/>
    <ambientLight intensity={1.25}/>
    <hemisphereLight args={['#d7edff', '#1c2638', 2.2]}/>
    <directionalLight position={[-4, 8, 11]} intensity={2.7} color="#fff0d8"/>
    <directionalLight position={[6, 3, -8]} intensity={1.4} color="#78c2dd"/>
    <pointLight position={[-2.5, 3.6, 3.0]} intensity={2.4} distance={12} color="#f8af66"/>
    <group position={[0, -.28, 0]}>
      <Pedestals/>
      <EngineMechanics s={s}/>
      <CylinderShell plane={clipPlane} s={s}/>
      <ValveAssembly s={s} plane={clipPlane}/>
    </group>
  </>;
};

const labelStyle: React.CSSProperties = {
  fontSize: 16, fontWeight: 650, letterSpacing: 1, color: '#b9cbd6',
  background: 'rgba(11,26,39,.82)', padding: '7px 12px',
  border: '1px solid #526777', borderRadius: 4,
};
const overlayFont: React.CSSProperties = {
  fontFamily: '"Noto Sans CJK SC","Microsoft YaHei","PingFang SC",system-ui,sans-serif',
};
const Overlay: React.FC<{s: SteamFrame}> = ({s}) => {
  const mode = s.cut < .02 ? '封闭机体' : s.cut > .98 ? '深入剖面' : '剖切平面推进';
  return <div aria-hidden="true" style={{
    ...overlayFont, position:'absolute', inset:0, pointerEvents:'none',
    background:'linear-gradient(90deg, rgba(9,22,34,.72) 0%, transparent 40%)',
    color:'#ecf4f7',
  }}>
    <div style={{position:'absolute',top:33,left:46,fontSize:15,color:'#edae76',
      letterSpacing:3,fontWeight:800}}>MYMG / ENGINEERING SERIES — 001</div>
    <div style={{position:'absolute',top:63,left:43,fontSize:47,fontWeight:850,
      letterSpacing:2,textShadow:'0 3px 22px #05121c'}}>蒸汽机的心脏</div>
    <div style={{position:'absolute',top:131,left:46,fontSize:17,
      color:'#bed0d8'}}>双作用气缸 · 活塞 · 连杆曲轴 · 飞轮</div>
    <div style={{position:'absolute',right:40,top:39,textAlign:'right'}}>
      <div style={{fontSize:13,color:'#e7ac73',letterSpacing:2}}>3D SECTION VIEW</div>
      <div style={{fontSize:25,fontWeight:780,marginTop:8}}>{mode}</div>
      <div style={{fontSize:13,color:'#98b2c2',marginTop:4}}>真实裁切平面 / 连续机械运动</div>
    </div>
    <div style={{position:'absolute',left:52,bottom:145,display:'flex',gap:10}}>
      <span style={{...labelStyle,color:'#ffc07d',borderColor:'#9a684a'}}>● 高压蒸汽</span>
      <span style={{...labelStyle,color:'#83d3e4',borderColor:'#477c8a'}}>● 排汽 / 低压侧</span>
    </div>
    <div style={{position:'absolute',left:52,bottom:43,width:390}}>
      <div style={{display:'flex',justifyContent:'space-between',fontSize:14,
        color:'#c8d7dd',marginBottom:9}}><span>气缸剖切深度</span>
        <span style={{color:'#ffd197',fontVariantNumeric:'tabular-nums'}}>
          {Math.round(s.cut*100)}%</span></div>
      <div style={{height:9,background:'#2f475a',borderRadius:8,overflow:'hidden'}}>
        <div style={{height:'100%',width:(s.cut*100)+'%',background:'#eeaa66',
          borderRadius:8}}/>
      </div>
      <div style={{fontSize:13,color:'#95aabb',marginTop:13}}>
        {s.motion === 'right' ? '活塞向右：左腔进汽做功' : '活塞向左：右腔进汽做功'}
      </div>
    </div>
    <div style={{position:'absolute',right:41,bottom:34,textAlign:'right',
      fontSize:13,color:'#9cb6c6',letterSpacing:1}}>
      <div>SLIDER–CRANK / LIVE WEBGL</div>
      <div style={{fontSize:16,color:'#e7c39b',marginTop:7}}>
        {(s.time).toFixed(1)}s　/　18.0s
      </div>
    </div>
    <div style={{position:'absolute',right:44,bottom:149,fontSize:13,
      color:'#b6c9d3',lineHeight:1.8,textAlign:'right'}}>
      橙色管线：锅炉送入蒸汽<br/>蓝色管线：乏汽排出<br/>动力来自压差，并非在气缸内燃烧
    </div>
  </div>;
};

export const SteamEngineScene: React.FC = () => {
  const frame = useCurrentFrame();
  const s = steamAtFrame(frame);
  return <AbsoluteFill data-testid="steam-engine-scene"
    data-renderer="react-threejs-webgl"
    data-cut-progress={s.cut.toFixed(4)}
    data-piston-x={s.pistonX.toFixed(4)}
    data-crank-angle={s.theta.toFixed(4)}
    style={{background:'radial-gradient(ellipse at 54% 48%,#213d50 0%,#0e1e2d 67%,#08111d 100%)',
      overflow:'hidden'}}>
    <ThreeCanvas width={1280} height={720} orthographic
      camera={{position:[6.6, 4.0, 13],zoom:86,near:.1,far:100}}
      gl={{antialias:true,alpha:true,preserveDrawingBuffer:true}}
      style={{position:'absolute',inset:0,width:1280,height:720,background:'transparent'}}>
      <World s={s}/>
    </ThreeCanvas>
    <Overlay s={s}/>
  </AbsoluteFill>;
};
