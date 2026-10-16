import React, {useEffect, useMemo} from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
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
        <meshBasicMaterial color={p.left === (s.motion === 'right') ? '#ffbd70' : '#69d9e4'} transparent
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
        <meshStandardMaterial color={(i === 0) === (s.motion === 'right') ? '#d67d3a' : '#4eb9c9'}
          emissive={(i === 0) === (s.motion === 'right') ? '#9a3a14' : '#145a68'} emissiveIntensity={.38}/>
      </mesh>
    </group>)}
    <Pipe points={[[-2.12, 2.44, -.10], [-2.12, 2.08, -.10],
      [-1.65, 1.86, -.10], [-1.65, 1.62, -.10]]} color="#c88b4e" radius={.125}/>
    {/* Exhaust is one continuous riser, ending in a visibly open flanged vent. */}
    <Pipe points={[[-1.16, 1.65, -.13], [-1.16, 2.13, -.13],
      [-.45, 2.17, -.13], [-.38, 2.43, -.13], [-.38, 3.12, -.13]]}
      color="#5d9eb1" radius={.108}/>
    <mesh position={[-.38, 3.12, -.13]} rotation={[Math.PI/2,0,0]}>
      <torusGeometry args={[.116,.043,12,32]}/>
      <meshStandardMaterial color="#a4c7d0" metalness={.75} roughness={.29}/>
    </mesh>
  </group>;
};

const Flywheel: React.FC<{s: SteamFrame}> = ({s}) => {
  return <group>
    <Rod from={[CRANK_X, 0, -1.02]} to={[CRANK_X, 0, 1.12]}
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
 * This governor is directly above and behind the flywheel bearing, not an
 * isolated object to the right of the engine. Same rear drive shaft drives
 * the belt pulley at the spindle foot; bevel gearing turns the vertical shaft.
 * A bell crank links the rising sleeve to the inline steam inlet butterfly.
 * Arrangement based on Watt flyball drawings (Smithsonian / Powerhouse).
 */
const GOV_X = 1.72;
const GOV_Z = -.87;
const GOV_PIVOT_Y = 2.73;
const GOV_ARM = .88;
const THROTTLE_X = .12;
const THROTTLE_Y = 2.33;
const THROTTLE_Z = -.28;
const governorValveAngle = (s:SteamFrame) => s.governor.throttle * Math.PI/2;
const valveLinkEnd = (s:SteamFrame):V3 => {
  const a=governorValveAngle(s);
  return [THROTTLE_X-.35*Math.sin(a),THROTTLE_Y,THROTTLE_Z-.35*Math.cos(a)];
};

const GovernorAssembly: React.FC<{s:SteamFrame}> = ({s}) => {
  const g=s.governor;
  const radial=GOV_ARM*Math.sin(g.angle);
  const ballY=GOV_PIVOT_Y-GOV_ARM*Math.cos(g.angle);
  const pivot:V3=[.90,1.48,GOV_Z];
  const rockerAngle=-.14+.55*(g.angle-.70);
  const input:V3=[pivot[0]+.44*Math.cos(rockerAngle),
    pivot[1]+.44*Math.sin(rockerAngle),GOV_Z];
  const output:V3=[pivot[0]-.36*Math.sin(rockerAngle),
    pivot[1]+.36*Math.cos(rockerAngle),GOV_Z];
  return <group>
    {/* Spindle stands on the engine bed immediately behind the flywheel. */}
    <mesh position={[GOV_X,-1.14,GOV_Z]}>
      <boxGeometry args={[.63,.22,.67]}/>
      <meshStandardMaterial color="#4a606d" metalness={.64} roughness={.43}/>
    </mesh>
    <Rod from={[GOV_X,-1.03,GOV_Z]} to={[GOV_X,2.84,GOV_Z]}
      radius={.068} color="#bfcace"/>
    {/* An actual rotating head and both balls turn on the same vertical axis. */}
    <group position={[GOV_X,0,GOV_Z]} rotation={[0,g.spindlePhase,0]}>
      <mesh position={[0,GOV_PIVOT_Y,0]}>
        <cylinderGeometry args={[.18,.18,.20,24]}/>
        <meshStandardMaterial color="#e5be82" metalness={.84} roughness={.26}/>
      </mesh>
      {[-1,1].map(sign=><group key={sign}>
        <Rod from={[0,GOV_PIVOT_Y,0]} to={[sign*radial,ballY,0]}
          radius={.052} color="#d9b47d"/>
        <Rod from={[sign*radial,ballY,0]} to={[0,g.sleeveY,0]}
          radius={.045} color="#bbc8cc"/>
        <mesh position={[sign*radial,ballY,0]} castShadow>
          <sphereGeometry args={[.18,32,24]}/>
          <meshStandardMaterial color="#d8a367" metalness={.80} roughness={.26}/>
        </mesh>
      </group>)}
    </group>
    <mesh position={[GOV_X,g.sleeveY,GOV_Z]}>
      <cylinderGeometry args={[.19,.19,.30,32]}/>
      <meshStandardMaterial color="#d1d7d5" metalness={.83} roughness={.27}/>
    </mesh>
    {/* The sleeve collar does not rotate with the shaft: the fork and rocker
        can lift the throttle while the flyball spindle is spinning. */}
    <mesh position={[GOV_X,g.sleeveY,GOV_Z]} rotation={[Math.PI/2,0,0]}>
      <torusGeometry args={[.205,.038,12,32]}/>
      <meshStandardMaterial color="#e4bc7e" metalness={.8} roughness={.25}/>
    </mesh>
    <Rod from={[GOV_X-.21,g.sleeveY,GOV_Z]} to={input}
      radius={.038} color="#c9d0d0"/>
    <Rod from={pivot} to={input} radius={.045} color="#d6b781"/>
    <Rod from={pivot} to={output} radius={.045} color="#d6b781"/>
    <mesh position={pivot}>
      <sphereGeometry args={[.095,18,12]}/>
      <meshStandardMaterial color="#e3b778" metalness={.82} roughness={.27}/>
    </mesh>
    <Rod from={output} to={valveLinkEnd(s)} radius={.038} color="#c5ced0"/>
  </group>;
};

/** The throttle is INLINE in the boiler-to-valve-chest steam supply pipe. */
const GovernorThrottle: React.FC<{s:SteamFrame}> = ({s}) => {
  const a=governorValveAngle(s);
  const left=THROTTLE_X-.28, right=THROTTLE_X+.28;
  return <group>
    {/* One uninterrupted steam path: boiler-side downcomer -> transparent
        valve chamber -> steam-chest inlet. Pipes reach BOTH chamber flanges. */}
    <Pipe points={[[2.52,4.95,-.75],[2.52,3.48,-.75],
      [2.20,2.81,-.53],[1.48,THROTTLE_Y,THROTTLE_Z],
      [right,THROTTLE_Y,THROTTLE_Z]]} color="#c68a57" radius={.12}/>
    <Pipe points={[[left,THROTTLE_Y,THROTTLE_Z],
      [-1.86,THROTTLE_Y,THROTTLE_Z],[-2.12,2.44,-.10]]}
      color="#c68a57" radius={.12}/>
    {/* The tube through the valve is transparent, NOT an omitted section.
        This makes the rotating butterfly readable without a broken pipe. */}
    <mesh position={[THROTTLE_X,THROTTLE_Y,THROTTLE_Z]}
      rotation={[0,0,Math.PI/2]}>
      <cylinderGeometry args={[.175,.175,.56,36,1,true]}/>
      <meshStandardMaterial color="#8faab1" metalness={.39} roughness={.27}
        transparent opacity={.28} side={THREE.DoubleSide} depthWrite={false}/>
    </mesh>
    {[left,right].map(x=>
      <mesh key={x} position={[x,THROTTLE_Y,THROTTLE_Z]}
        rotation={[0,Math.PI/2,0]}>
        <torusGeometry args={[.181,.061,12,40]}/>
        <meshStandardMaterial color="#bdc8ca" metalness={.83} roughness={.27}/>
      </mesh>
    )}
    {/* A visible butterfly disc remains inside a closed, fully connected body. */}
    <group position={[THROTTLE_X,THROTTLE_Y,THROTTLE_Z]}
      rotation={[0,a,0]}>
      <mesh>
        <boxGeometry args={[.045,.32,.32]}/>
        <meshStandardMaterial color="#e6b878" metalness={.79}
          roughness={.27} side={THREE.DoubleSide}/>
      </mesh>
      <Rod from={[0,0,0]} to={[0,0,-.35]}
        radius={.044} color="#dcc8a5"/>
    </group>
  </group>;
};

/** Compact belt drive on the engine's own axle; small right-angle gearbox. */
const GovernorDrive: React.FC<{s:SteamFrame}> = ({s}) => <group>
  {[CRANK_X,GOV_X].map(x=>
    <group key={x} position={[x,0,GOV_Z]} rotation={[0,0,s.theta]}>
      <mesh>
        <torusGeometry args={[.235,.061,14,40]}/>
        <meshStandardMaterial color="#bb9c6d" metalness={.77} roughness={.30}/>
      </mesh>
      <Rod from={[-.22,0,0]} to={[.22,0,0]}
        radius={.032} color="#ddbb80"/>
    </group>
  )}
  <Rod from={[GOV_X,.235,GOV_Z]} to={[CRANK_X,.235,GOV_Z]}
    radius={.025} color="#555966" metallic={.20}/>
  <Rod from={[GOV_X,-.235,GOV_Z]} to={[CRANK_X,-.235,GOV_Z]}
    radius={.025} color="#555966" metallic={.20}/>
  <mesh position={[GOV_X,0,GOV_Z]} rotation={[0,s.governor.spindlePhase,0]}>
    <coneGeometry args={[.19,.26,24]}/>
    <meshStandardMaterial color="#cfb488" metalness={.76} roughness={.29}/>
  </mesh>
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
</group>;

/** One shared camera track for WebGL and accurate 3D-anchored callouts. */
const cameraPose = (t:number) => {
  const inspect=smoothstep((t-.78)/.43);
  const governorView=smoothstep((t-4.80)/.53);
  const valveView=smoothstep((t-8.85)/.48);
  const eye:V3=[
    6.6-.7*inspect+.10*governorView,
    4.0-.35*inspect+.65*governorView,
    13-1.05*inspect-1.0*governorView,
  ];
  const target:V3=[
    -1.3*inspect+2.58*governorView-.14*valveView,
    .06+.12*inspect+.93*governorView+.13*valveView,
    -.22*governorView,
  ];
  return {eye,target,zoom:85+25*inspect+15*governorView+7*valveView};
};

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
      <ValveAssembly s={s} plane={clipPlane}/>
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
  {start:5.42,end:6.56,part:'belt',lines:['飞轮带动皮带','调速器跟着旋转']},
  {start:6.62,end:7.90,part:'balls',lines:['转速越快','两颗重锤甩得越开']},
  {start:7.94,end:9.13,part:'sleeve',lines:['重锤抬高套筒','连杆跟着移动']},
  {start:9.19,end:11.49,part:'valve',lines:['节流阀关小，进汽减少','飞轮逐渐慢下来']},
  {start:11.56,end:13.55,part:'flywheel',lines:['转速回到稳定','这就是负反馈']},
] as const;

type TeachingPart = typeof TEACHING_BEATS[number]['part'];
const anchoredPoint = (part:TeachingPart,s:SteamFrame):V3 => {
  if(part==='belt') return [(GOV_X+CRANK_X)/2,-.28,GOV_Z];
  if(part==='sleeve') return [GOV_X,s.governor.sleeveY-.28,GOV_Z];
  if(part==='valve') return [THROTTLE_X,THROTTLE_Y-.28,THROTTLE_Z];
  if(part==='flywheel') return [CRANK_X,-.28,.17];
  const radius=GOV_ARM*Math.sin(s.governor.angle);
  const phase=s.governor.spindlePhase;
  return [
    GOV_X+radius*Math.cos(phase),
    GOV_PIVOT_Y-GOV_ARM*Math.cos(s.governor.angle)-.28,
    GOV_Z+radius*Math.sin(phase),
  ];
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
    data-governor-angle={s.governor.angle.toFixed(4)}
    data-governor-sleeve={s.governor.sleeveY.toFixed(4)}
    data-governor-throttle={s.governor.throttle.toFixed(4)}
    data-camera-shift={smoothstep((s.time-4.80)/.53).toFixed(4)}
    data-governor-x={GOV_X.toFixed(2)}
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
