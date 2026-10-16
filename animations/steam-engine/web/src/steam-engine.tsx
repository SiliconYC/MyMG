import React, {useEffect, useMemo} from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {pipeSections} from './pipe-path.ts';
import {
  GOV_X,GOV_Z,GOV_LIFT,GOV_PIVOT_Y,GOV_ARM,THROTTLE_X,THROTTLE_Y,THROTTLE_Z,
  THROTTLE_LEFT,THROTTLE_RIGHT,INLET_PORT,EXHAUST_PORT,
  BOILER_TO_VALVE,VALVE_TO_CYLINDER,CYLINDER_TO_EXHAUST,throttleLinkage,
} from './steam-plumbing.ts';
import {cameraPose} from './camera-path.ts';
import {BELT_LENGTH,DRIVE_BELT_RADIUS,DRIVE_BELT_Z,DRIVE_CRANK_X,DRIVE_GOV_X,
  DRIVE_SUPPORT_Y,BEVEL_APEX,BEVEL_INPUT_RADIUS,BEVEL_OUTPUT_RADIUS,
  BEVEL_INPUT_LENGTH,BEVEL_OUTPUT_LENGTH,beltTravelAt
} from './governor-drive-model.ts';
import {flowOpacity, flowProgress, visibleArrowCount} from './steam-flow.ts';
import {
  steamAtFrame, CYLINDER_LEFT, CYLINDER_RIGHT, CYLINDER_OUTER_RADIUS,
  CYLINDER_INNER_RADIUS, CRANK_X, CRANK_RADIUS, smoothstep, type SteamFrame,
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

/** Real translucent Three.js tubes and frame-indexed arrows inside their bores.
 * No screen-space stickers, video, images or ad hoc straight-only arrows.
 * Arrow coordinates and tangents come from the SAME continuous pipe curve. */
const Pipe: React.FC<{
  points: V3[]; color:string; radius?:number; s:SteamFrame; arrowColor:string; flowId:number;
}> = ({points,color,radius=.08,s,arrowColor,flowId}) => {
  const curve=useMemo(()=>{
    const path=new THREE.CurvePath<THREE.Vector3>();
    for(const segment of pipeSections(points,.25)){
      const a=new THREE.Vector3(...segment.start), b=new THREE.Vector3(...segment.end);
      if(segment.kind==='elbow' && segment.control)
        path.add(new THREE.QuadraticBezierCurve3(a,new THREE.Vector3(...segment.control),b));
      else path.add(new THREE.LineCurve3(a,b));
    }
    return path;
  },[points]);
  const alpha=flowOpacity(s.cut);
  const count=visibleArrowCount(s.cut);
  return <group>
    <mesh castShadow={s.cut<.02}>
      <tubeGeometry args={[curve,Math.max(96,points.length*28),radius,14,false]}/>
      <meshStandardMaterial color={color} metalness={.66} roughness={.26}
        transparent={s.cut>.01} opacity={alpha} depthWrite={s.cut<.01}/>
    </mesh>
    {Array.from({length:count},(_,i)=>{
      const u=flowProgress(s.time,i,4,s.governor.relativeSpeed,flowId);
      const tangent=curve.getTangentAt(u).normalize();
      const orientation=new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0,1,0),tangent
      );
      const p=curve.getPointAt(u);
      return <group key={i} position={p} quaternion={orientation}>
        <mesh position={[0,-.043,0]}>
          <cylinderGeometry args={[.014,.014,.083,8]}/>
          <meshBasicMaterial color={arrowColor} transparent
            opacity={s.cut*.86} depthWrite={false}/>
        </mesh>
        <mesh position={[0,.047,0]}>
          <coneGeometry args={[.046,.079,10]}/>
          <meshBasicMaterial color={arrowColor} transparent
            opacity={s.cut*.93} depthWrite={false}/>
        </mesh>
      </group>;
    })}
  </group>;
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
        <meshBasicMaterial color={p.left === (s.motion === 'right') ? '#ffbd70' : '#69d9e4'} transparent
          opacity={Math.min(.9, .4 + .5 * p.pressure)} depthWrite={false}/>
      </mesh>
    )}
  </group>;
};

/** The copper and blue tubes terminate INSIDE the cast cylinder wall, with
 * small matching metal collars. No long rectangular box sits on the cylinder. */
const CylinderPorts:React.FC<{s:SteamFrame}>=({s})=> <group>
  <Pipe points={CYLINDER_TO_EXHAUST} color="#63aabb" radius={.104}
    s={s} arrowColor="#b6f6ff" flowId={2}/>
  {[{point:INLET_PORT,color:'#c68a57'}, {point:EXHAUST_PORT,color:'#63aabb'}]
    .map(({point,color},i)=><mesh key={i} position={point} castShadow>
      <sphereGeometry args={[.145,24,16]}/>
      <meshStandardMaterial color={color} metalness={.76} roughness={.30}/>
    </mesh>)}
  <mesh position={CYLINDER_TO_EXHAUST.at(-1)!} rotation={[Math.PI/2,0,0]}>
    <torusGeometry args={[.116,.043,12,32]}/>
    <meshStandardMaterial color="#a4c7d0" metalness={.75} roughness={.29}/>
  </mesh>
</group>;

const Flywheel: React.FC<{s: SteamFrame}> = ({s}) => {
  return <group>
    <Rod from={[CRANK_X, 0, -1.02]} to={[CRANK_X, 0, 1.48]}
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
    color={s.motion === 'right' ? '#ef924d' : '#67c3db'} pressure={s.leftPressure}/>
  <PressureChamber start={s.pistonX + .15} end={CYLINDER_RIGHT - .08}
    color={s.motion === 'left' ? '#ef924d' : '#67c3db'} pressure={s.rightPressure}/>
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


/**
 * The flyballs and sliding collar remain on their driven spindle. A single
 * rigid yoke transfers the sleeve's vertical travel to the inlet gate.
 * Unlike the previous long free-floating bellcrank rods, its length is fixed.
 */
const GovernorAssembly: React.FC<{s:SteamFrame}> = ({s}) => {
  const g=s.governor;
  const radial=GOV_ARM*Math.sin(g.angle);
  const ballY=GOV_PIVOT_Y-GOV_ARM*Math.cos(g.angle);
  const linkage=throttleLinkage(g.sleeveY);
  const sleeveY=g.sleeveY+GOV_LIFT;
  return <group>
    {/* The vertical spindle itself is driven by the bevel gearbox below,
        and rotates together with the head and balls. The nonrotating sleeve
        continues to actuate the inline steam valve independently. */}
    <group position={[GOV_X,0,GOV_Z]} rotation={[0,g.spindlePhase,0]}>
      <Rod from={[0,.03,0]} to={[0,GOV_PIVOT_Y+.12,0]}
        radius={.060} color="#bfcace"/>
      {/* Short shaft key makes the origin of torque visible without a HUD. */}
      <Rod from={[.060,.43,0]} to={[.060,1.40,0]}
        radius={.018} color="#d3b280"/>
      <mesh position={[0,GOV_PIVOT_Y,0]}>
        <cylinderGeometry args={[.18,.18,.20,24]}/>
        <meshStandardMaterial color="#e5be82" metalness={.84} roughness={.26}/>
      </mesh>
      {[-1,1].map(sign=><group key={sign}>
        <Rod from={[0,GOV_PIVOT_Y,0]} to={[sign*radial,ballY,0]}
          radius={.052} color="#d9b47d"/>
        <Rod from={[sign*radial,ballY,0]} to={[0,sleeveY,0]}
          radius={.045} color="#bbc8cc"/>
        <mesh position={[sign*radial,ballY,0]} castShadow>
          <sphereGeometry args={[.18,32,24]}/>
          <meshStandardMaterial color="#d8a367" metalness={.80} roughness={.26}/>
        </mesh>
      </group>)}
    </group>
    <mesh position={[GOV_X,sleeveY,GOV_Z]}>
      <cylinderGeometry args={[.19,.19,.30,32]}/>
      <meshStandardMaterial color="#d1d7d5" metalness={.83} roughness={.27}/>
    </mesh>
    {/* One faint, nonrotating orbit trace: its radius expands with speed.
        It exposes the spread even when the two flyweights move too fast to
        track by eye; no new annotations or permanent HUD. */}
    <mesh position={[GOV_X,ballY,GOV_Z]} rotation={[Math.PI/2,0,0]}>
      <torusGeometry args={[Math.max(.08,radial),.013,8,96]}/>
      <meshBasicMaterial color="#d6b474" transparent opacity={.28}
        depthWrite={false}/>
    </mesh>
    {/* Sleeve is a non-rotating bearing, directly above the inlet gate. */}
    <mesh position={[GOV_X,sleeveY,GOV_Z]} rotation={[Math.PI/2,0,0]}>
      <torusGeometry args={[.205,.038,12,32]}/>
      <meshStandardMaterial color="#e4bc7e" metalness={.8} roughness={.25}/>
    </mesh>
    <Rod from={linkage.collarPin} to={linkage.valvePin}
      radius={.049} color="#c9d0d0"/>
  </group>;
};

/** Inline vertical sliding throttle: overspeed raises the solid metal gate
 * across the steam passage. The polished stem is pinned directly to the
 * sleeve yoke; there is no wrong-axis butterfly lever or floating rod. */
const GovernorThrottle:React.FC<{s:SteamFrame}>=({s})=>{
  const link=throttleLinkage(s.governor.sleeveY);
  return <group>
    <Pipe points={BOILER_TO_VALVE} color="#c68a57" radius={.12}
      s={s} arrowColor="#ffe3a0" flowId={0}/>
    <Pipe points={VALVE_TO_CYLINDER} color="#c68a57" radius={.12}
      s={s} arrowColor="#ffe3a0" flowId={1}/>
    {/* A restrained, slightly translucent cylindrical valve body spans both
        pipe ends. The flanges and pipe axes share exact coordinates. */}
    <mesh position={[THROTTLE_X,THROTTLE_Y,THROTTLE_Z]}
      rotation={[0,0,Math.PI/2]}>
      <cylinderGeometry args={[.184,.184,.56,36,1,true]}/>
      <meshStandardMaterial color="#90adb6" metalness={.39} roughness={.27}
        transparent opacity={.32} side={THREE.DoubleSide} depthWrite={false}/>
    </mesh>
    {[THROTTLE_LEFT,THROTTLE_RIGHT].map(x=>
      <mesh key={x} position={[x,THROTTLE_Y,THROTTLE_Z]}
        rotation={[0,Math.PI/2,0]}>
        <torusGeometry args={[.184,.058,12,36]}/>
        <meshStandardMaterial color="#bdc8ca" metalness={.83} roughness={.27}/>
      </mesh>
    )}
    {/* Round gland is fixed to the valve housing; the stem slides THROUGH it.
        A closed gate occupies the steam bore, open gate retracts below it. */}
    <mesh position={[THROTTLE_X,THROTTLE_Y-.27,THROTTLE_Z]}
      rotation={[Math.PI/2,0,0]}>
      <torusGeometry args={[.075,.030,10,28]}/>
      <meshStandardMaterial color="#b8c8c9" metalness={.75} roughness={.34}/>
    </mesh>
    <mesh position={link.gateCenter} castShadow>
      <boxGeometry args={[.075,.70,.31]}/>
      <meshStandardMaterial color="#e6b878" metalness={.78} roughness={.28}/>
    </mesh>
    {/* Short valve bonnet encloses the upward-running gate at overspeed. */}
    <mesh position={[THROTTLE_X,THROTTLE_Y+.29,THROTTLE_Z]}>
      <cylinderGeometry args={[.14,.14,.55,24,1,true]}/>
      <meshStandardMaterial color="#a0bac0" metalness={.49} roughness={.34}
        transparent opacity={.28} side={THREE.DoubleSide} depthWrite={false}/>
    </mesh>
  </group>;
};

/**
 * A *closed* belt runs from the flywheel's crankshaft pulley to a supported
 * horizontal layshaft. Two visible bevel gears turn that horizontal rotation
 * 90° into the spindle directly under the flyballs. No free-floating cone.
 */
const DrivePulley:React.FC<{x:number;theta:number}>=({x,theta})=>
  <group position={[x,0,DRIVE_BELT_Z]} rotation={[0,0,theta]}>
    <mesh rotation={[Math.PI/2,0,0]} castShadow>
      <cylinderGeometry args={[DRIVE_BELT_RADIUS,DRIVE_BELT_RADIUS,.13,40]}/>
      <meshStandardMaterial color="#bf9a65" metalness={.8} roughness={.30}/>
    </mesh>
    {[-.083,.083].map(z=><mesh key={z} position={[0,0,z]}>
      <torusGeometry args={[DRIVE_BELT_RADIUS,.035,10,40]}/>
      <meshStandardMaterial color="#dfc398" metalness={.81} roughness={.26}/>
    </mesh>)}
    <Rod from={[-.20,0,.095]} to={[.20,0,.095]}
      radius={.022} color="#f2d9a8"/>
  </group>;

const ClosedDriveBelt:React.FC<{theta:number}>=({theta})=>{
  const path=useMemo(()=>{
    const r=DRIVE_BELT_RADIUS,z=DRIVE_BELT_Z,k=.5522847498;
    const l=DRIVE_GOV_X,h=DRIVE_CRANK_X;
    const p=(x:number,y:number)=>new THREE.Vector3(x,y,z);
    const curve=new THREE.CurvePath<THREE.Vector3>();
    curve.add(new THREE.LineCurve3(p(h,r),p(l,r)));
    curve.add(new THREE.CubicBezierCurve3(
      p(l,r),p(l-k*r,r),p(l-r,k*r),p(l-r,0)));
    curve.add(new THREE.CubicBezierCurve3(
      p(l-r,0),p(l-r,-k*r),p(l-k*r,-r),p(l,-r)));
    curve.add(new THREE.LineCurve3(p(l,-r),p(h,-r)));
    curve.add(new THREE.CubicBezierCurve3(
      p(h,-r),p(h+k*r,-r),p(h+r,-k*r),p(h+r,0)));
    curve.add(new THREE.CubicBezierCurve3(
      p(h+r,0),p(h+r,k*r),p(h+k*r,r),p(h,r)));
    return curve;
  },[]);
  return <group>
    <mesh castShadow>
      <tubeGeometry args={[path,176,.029,8,true]}/>
      <meshStandardMaterial color="#393e46" metalness={.10} roughness={.68}/>
    </mesh>
    {/* Four restrained witness marks make belt motion obvious. Each mark
        advances at the exact crank pulley rim velocity r × crank angle. */}
    {Array.from({length:4},(_,i)=>
      <mesh key={i} position={path.getPointAt(beltTravelAt(theta,i,4)/BELT_LENGTH)}>
        <sphereGeometry args={[.048,12,8]}/>
        <meshStandardMaterial color="#deb881" metalness={.68} roughness={.34}/>
      </mesh>
    )}
  </group>;
};

const GovernorDrive:React.FC<{s:SteamFrame}>=({s})=><group>
  {/* The driver sits on the SAME flywheel axle; the driven pulley is
      locked to the rear layshaft (both rotate at crankshaft phase). */}
  <DrivePulley x={DRIVE_CRANK_X} theta={s.theta}/>
  <DrivePulley x={DRIVE_GOV_X} theta={s.theta}/>
  <ClosedDriveBelt theta={s.theta}/>
  <Rod from={[GOV_X,0,DRIVE_BELT_Z-.18]}
    to={[GOV_X,0,GOV_Z-.04]} radius={.060} color="#b8c5c8"/>
  {/* One unobtrusive frame-mounted bearing carries the layshaft instead
      of allowing the second wheel to hang in empty space. */}
  <Rod from={[GOV_X,DRIVE_SUPPORT_Y,DRIVE_BELT_Z-.15]}
    to={[GOV_X,-.08,DRIVE_BELT_Z-.15]}
    radius={.065} color="#5b7080"/>
  <mesh position={[GOV_X,0,DRIVE_BELT_Z-.15]}
    rotation={[Math.PI/2,0,0]}>
    <cylinderGeometry args={[.115,.115,.19,24]}/>
    <meshStandardMaterial color="#8da0a9" metalness={.74} roughness={.32}/>
  </mesh>
  {/* A perpendicular pair of pitch cones with the SAME geometric apex.
      Input 22 teeth / output 10 teeth gives the 11:5 spindle ratio. */}
  <group position={BEVEL_APEX} rotation={[0,0,s.theta]}>
    <mesh position={[0,0,-BEVEL_INPUT_LENGTH]} rotation={[Math.PI/2,0,0]}>
      <coneGeometry args={[BEVEL_INPUT_RADIUS,2*BEVEL_INPUT_LENGTH,44]}/>
      <meshStandardMaterial color="#cb985d" metalness={.78} roughness={.28}/>
    </mesh>
    <mesh position={[0,0,-2*BEVEL_INPUT_LENGTH]}>
      <torusGeometry args={[BEVEL_INPUT_RADIUS,.019,8,44]}/>
      <meshStandardMaterial color="#ead2a1" metalness={.82} roughness={.26}/>
    </mesh>
    {Array.from({length:11},(_,i)=>{
      const a=i*2*Math.PI/11;
      return <mesh key={i} position={[
        BEVEL_INPUT_RADIUS*Math.cos(a),BEVEL_INPUT_RADIUS*Math.sin(a),-2*BEVEL_INPUT_LENGTH
      ]} rotation={[0,0,a]}>
        <boxGeometry args={[.048,.033,.063]}/>
        <meshStandardMaterial color="#e7bf83" metalness={.75} roughness={.32}/>
      </mesh>;
    })}
  </group>
  <group position={BEVEL_APEX} rotation={[0,s.governor.spindlePhase,0]}>
    <mesh position={[0,BEVEL_OUTPUT_LENGTH,0]} rotation={[Math.PI,0,0]}>
      <coneGeometry args={[BEVEL_OUTPUT_RADIUS,2*BEVEL_OUTPUT_LENGTH,28]}/>
      <meshStandardMaterial color="#d7b47b" metalness={.81} roughness={.26}/>
    </mesh>
    <mesh position={[0,2*BEVEL_OUTPUT_LENGTH,0]} rotation={[Math.PI/2,0,0]}>
      <torusGeometry args={[BEVEL_OUTPUT_RADIUS,.021,8,32]}/>
      <meshStandardMaterial color="#f1d19a" metalness={.82} roughness={.28}/>
    </mesh>
    {Array.from({length:10},(_,i)=>{
      const a=i*2*Math.PI/10;
      return <mesh key={i} position={[
        BEVEL_OUTPUT_RADIUS*Math.cos(a),2*BEVEL_OUTPUT_LENGTH,
        BEVEL_OUTPUT_RADIUS*Math.sin(a)
      ]} rotation={[0,a,0]}>
        <boxGeometry args={[.031,.06,.025]}/>
        <meshStandardMaterial color="#edc68a" metalness={.80} roughness={.30}/>
      </mesh>;
    })}
  </group>
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
  <mesh position={[.20, -1.59, .20]}>
    <boxGeometry args={[8.90, .20, 3.70]}/>
    <meshStandardMaterial color="#334756" metalness={.54} roughness={.59}/>
  </mesh>
  <mesh position={[.2, -1.75, 0]} rotation={[-Math.PI / 2, 0, 0]}>
    <planeGeometry args={[13, 8]}/>
    <meshStandardMaterial color="#122333" roughness={.89}/>
  </mesh>
</group>;

/** Shared orbital camera and 3D leader-line projection are defined in camera-path.ts. */
const World: React.FC<{s: SteamFrame}> = ({s}) => {
  const camera=useThree(state=>state.camera);
  useEffect(()=>{
    const pose=cameraPose(s.time);
    camera.position.set(...pose.eye);
    camera.lookAt(...pose.target);
    if(camera instanceof THREE.OrthographicCamera){
      camera.zoom=pose.zoom;
      camera.updateProjectionMatrix();
    }
  },[camera,s.time]);
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
      <CylinderPorts s={s}/>
      <GovernorDrive s={s}/>
      <GovernorAssembly s={s}/>
      <GovernorThrottle s={s}/>
    </group>
  </>;
};

/** Storytelling comes from the machine. A single brief title, never a dashboard. */
const CHAPTERS = [
  {start:.15, end:1.02, title:'蒸汽机'},
  {start:1.34, end:2.85, title:'气缸剖面'},
  // The governor is taught with one spatial leader-line callout at a time.
] as const;

const ChapterTitle: React.FC<{frame:number}> = ({frame}) => {
  const seconds = frame / 30;
  const chapter = CHAPTERS.find(c => seconds >= c.start && seconds < c.end);
  if (!chapter) return null;
  const opacity = smoothstep((seconds - chapter.start)/.34)
    * (1 - smoothstep((seconds - chapter.end + .46)/.46));
  return <div data-testid="steam-stage-caption" aria-hidden="true" style={{
    position:'absolute', top:56, left:62, pointerEvents:'none',
    opacity, fontFamily:'"Noto Sans CJK SC","Microsoft YaHei","PingFang SC",system-ui,sans-serif',
    fontSize:36, fontWeight:750, letterSpacing:1.2, color:'#f2eee8',
    textShadow:'0 2px 19px rgba(8,21,33,.65)',
  }}>{chapter.title}</div>;
};

/**
 * Restrained in-frame annotations. Each short line points at a REAL moving
 * mechanism, using the same Three.js camera track as the rendered scene.
 * Only one card and one guide line are visible at any moment.
 */
const TEACHING_BEATS = [
  {start:5.42,end:7.23,part:'belt',lines:['曲轴带动闭合皮带','伞齿轮驱动重锤转动']},
  {start:7.26,end:10.73,part:'balls',lines:['转速升高','两颗重锤向外张开']},
  {start:10.77,end:13.31,part:'sleeve',lines:['重锤张开，套筒上升','进汽阀门被直接带动']},
  {start:13.35,end:16.26,part:'valve',lines:['节流阀片升起，进汽减少','发动机开始减速']},
  {start:16.30,end:19.72,part:'flywheel',lines:['转速降低后，重锤收回','系统自动恢复稳定']},
] as const;

type TeachingPart = typeof TEACHING_BEATS[number]['part'];
/**
 * Leader tips attach only to STATIONARY chassis, valve body, spindle bearings.
 * Never attach a leader to a rapidly orbiting flyball or flywheel spoke.
 * The actual opening is apparent from the balls and their expanding orbit ring.
 */
const anchoredPoint = (part:TeachingPart,_s:SteamFrame):V3 => {
  if(part==='belt') return [(DRIVE_GOV_X+DRIVE_CRANK_X)/2,-.28,DRIVE_BELT_Z];
  if(part==='balls') return [GOV_X,GOV_PIVOT_Y-.28,GOV_Z];
  if(part==='sleeve') return [GOV_X,2.9-.28,GOV_Z];
  if(part==='valve') return [THROTTLE_X,THROTTLE_Y-.28,THROTTLE_Z];
  return [CRANK_X,-.78,.17];
};
const projectOnCanvas = (t:number,point:V3) => {
  const pose=cameraPose(t);
  // Matches the 1280x720 orthographic frustum of <ThreeCanvas>.
  const camera=new THREE.OrthographicCamera(-640,640,360,-360,.1,100);
  camera.position.set(...pose.eye);
  camera.lookAt(...pose.target);
  camera.zoom=pose.zoom;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  const vector=new THREE.Vector3(...point).project(camera);
  return {x:(vector.x+1)*640,y:(1-vector.y)*360};
};

const TeachingCallout: React.FC<{s:SteamFrame}> = ({s}) => {
  const beat=TEACHING_BEATS.find(b=>s.time>=b.start&&s.time<b.end);
  if(!beat) return null;
  const point=projectOnCanvas(s.time,anchoredPoint(beat.part,s));
  const opacity=smoothstep((s.time-beat.start)/.18)
    *(1-smoothstep((s.time-beat.end+.18)/.18));
  return <div data-testid="steam-callout" data-callout-part={beat.part}
    data-anchor-x={point.x.toFixed(1)} data-anchor-y={point.y.toFixed(1)}
    aria-hidden="true" style={{position:'absolute',inset:0,
      opacity,pointerEvents:'none'}}>
    <svg width="1280" height="720" viewBox="0 0 1280 720"
      style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      <path d={`M 365 490 L 402 490 L ${(point.x-18).toFixed(1)} ${point.y.toFixed(1)} L ${point.x.toFixed(1)} ${point.y.toFixed(1)}`}
        stroke="#e9c189" strokeWidth="1.6" strokeLinecap="round"
        strokeLinejoin="round" fill="none" opacity=".90"/>
      <circle cx={point.x} cy={point.y} r="6.2" stroke="#ffdc9c"
        strokeWidth="1.5" fill="#152b38"/>
      <circle cx={point.x} cy={point.y} r="2.3" fill="#ffce84"/>
    </svg>
    <div style={{position:'absolute',left:55,top:436,width:310,
      boxSizing:'border-box',padding:'14px 12px 16px 18px',
      fontFamily:'"Noto Sans CJK SC","Microsoft YaHei","PingFang SC",system-ui,sans-serif',
      borderLeft:'3px solid #f2c17c',background:'rgba(12,27,38,.79)',
      borderRadius:'0 7px 7px 0',boxShadow:'0 7px 28px rgba(7,16,28,.18)',
      color:'#f3f0e8',fontSize:22,fontWeight:670,letterSpacing:.4,
      lineHeight:1.48}}>
      {beat.lines.map((line,i)=><div key={i}>{line}</div>)}
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
    data-governor-speed={s.governor.relativeSpeed.toFixed(4)}
    data-drive-source-angle={s.theta.toFixed(4)}
    data-drive-pulley-angle={s.theta.toFixed(4)}
    data-drive-gear-angle={s.governor.spindlePhase.toFixed(4)}
    data-drive-belt-travel={beltTravelAt(s.theta).toFixed(4)}
    data-governor-angle={s.governor.angle.toFixed(4)}
    data-governor-sleeve={s.governor.sleeveY.toFixed(4)}
    data-governor-throttle={s.governor.throttle.toFixed(4)}
    data-gate-y={throttleLinkage(s.governor.sleeveY).gateCenter[1].toFixed(4)}
    data-pipe-opacity={flowOpacity(s.cut).toFixed(4)}
    data-visible-flow-arrows={visibleArrowCount(s.cut)*3}
    data-flow-phase={flowProgress(s.time,0,4,s.governor.relativeSpeed,0).toFixed(4)}
    data-yoke-length={Math.hypot(
      ...throttleLinkage(s.governor.sleeveY).collarPin.map(
        (v,i)=>v-throttleLinkage(s.governor.sleeveY).valvePin[i]
      )
    ).toFixed(4)}
    data-camera-shift={smoothstep((s.time-4.80)/.53).toFixed(4)}
    data-governor-x={GOV_X.toFixed(2)}
    data-governor-z={GOV_Z.toFixed(2)}
    data-pipe-z={THROTTLE_Z.toFixed(2)}
    data-camera-zoom={cameraPose(s.time).zoom.toFixed(2)}
    data-camera-azimuth={cameraPose(s.time).azimuth.toFixed(5)}
    data-camera-elevation={cameraPose(s.time).elevation.toFixed(5)}
    data-throttle-x={THROTTLE_X.toFixed(2)}
    style={{background:'radial-gradient(ellipse at 54% 48%,#213d50 0%,#0e1e2d 67%,#08111d 100%)',
      overflow:'hidden'}}>
    <ThreeCanvas width={1280} height={720} orthographic
      camera={{position:[6.6, 4.0, 13],zoom:86,near:.1,far:100}}
      gl={{antialias:true,alpha:true,preserveDrawingBuffer:true}}
      style={{position:'absolute',inset:0,width:1280,height:720,background:'transparent'}}>
      <World s={s}/>
    </ThreeCanvas>
    <ChapterTitle frame={frame}/>
    <TeachingCallout s={s}/>
  </AbsoluteFill>;
};
