import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {test} from 'node:test';
import {
  FPS,DURATION,PERIOD_SECONDS,PHYSICS_HZ,
  clockAtFrame,physicsAudit,TEETH,
  DRIVE_TORQUE,GRAVITY_OVER_LENGTH,CONTACT_RESTITUTION,
} from '../animations/pendulum-clock/web/src/clock-model.ts';
import {
  PITCH,PIVOT_Y,WHEEL_Y,WHEEL_PROFILE,palletWorld,worldAnchor,
  palletBase,forkWorld,toothOutline,FORK_RADIUS,
  WHEEL_RIM_INNER_RADIUS,WHEEL_TIP_RADIUS,
} from '../animations/pendulum-clock/web/src/escapement-geometry.ts';
import {
  WHEEL_PLANE_Z,PALLET_PLANE_Z,FORK_ARM_PLANE_Z,
  PALLET_ARM_WELD_Z,WHEEL_THICKNESS,PALLET_THICKNESS,
  zOverlap,wheelZRange,palletZRange,
  bearingZRange,spindleZRange,BEARING_DEPTH,
} from '../animations/pendulum-clock/web/src/escapement-axial.ts';
import {cameraAtFrame,SHOTS} from '../animations/pendulum-clock/web/src/camera-path.ts';

const sceneSource=()=>readFileSync(resolve(import.meta.dirname,
  '../animations/pendulum-clock/web/src/pendulum-clock.tsx'),'utf8');
const modelSource=()=>readFileSync(resolve(import.meta.dirname,
  '../animations/pendulum-clock/web/src/clock-model.ts'),'utf8');

test('gravity, wheel torque and contact impulses are integrated at fixed steps',()=>{
  assert.equal(PERIOD_SECONDS,2);
  assert.equal(PHYSICS_HZ%FPS,0);
  assert.equal(TEETH,30);
  assert.ok(DRIVE_TORQUE>0);
  assert.ok(GRAVITY_OVER_LENGTH>0);
  assert.ok(CONTACT_RESTITUTION>=0&&CONTACT_RESTITUTION<1);
  const src=modelSource();
  assert.match(src,/GRAVITY_OVER_LENGTH\*Math.sin\(s.p\)/);
  assert.match(src,/DRIVE_TORQUE\/WHEEL_INERTIA/);
  assert.match(src,/polygonOverlap\(/);
  assert.match(src,/contactJacobians\(/);
  assert.match(src,/const impulse=-\(1\+CONTACT_RESTITUTION\)\*rel\/inv/);
  assert.doesNotMatch(src,/smoothstep|RELEASE_OFFSET|Math.cos\(Math.PI\*seconds\)|rawBeat/);
});

test('the actual wheel has real teeth and its solid area leaves clearance for fork arms',()=>{
  assert.equal(WHEEL_PROFILE.length,6);
  assert.ok(WHEEL_RIM_INNER_RADIUS>1.2);
  assert.ok(WHEEL_RIM_INNER_RADIUS<1.29);
  assert.ok(WHEEL_TIP_RADIUS>1.5);
  for(let tooth=0;tooth<TEETH;tooth++){
    const polygon=toothOutline(tooth);
    assert.equal(polygon.length,6);
    assert.ok(polygon.every(p=>p.every(Number.isFinite)));
  }
  const src=sceneSource();
  assert.match(src,/for\(const \[s,r\] of WHEEL_PROFILE\)/);
  assert.match(src,/hole.absarc\(0,0,WHEEL_RIM_INNER_RADIUS/);
  assert.match(src,/palletOutline\(side\)/);
  assert.match(src,/makePalletGeometry/);
  assert.doesNotMatch(src,/makeSlimPallet|ContactHighlights|<boxGeometry|<video|<img|\.mp4/);
});

test('fork rods and pallet shoes are one rigid body on the same gear plane',()=>{
  assert.equal(FORK_ARM_PLANE_Z,PALLET_ARM_WELD_Z);
  assert.equal(FORK_ARM_PLANE_Z,WHEEL_PLANE_Z);
  assert.equal(PALLET_PLANE_Z,WHEEL_PLANE_Z);
  assert.ok(zOverlap(wheelZRange,palletZRange)>=PALLET_THICKNESS-1e-10);
  const src=sceneSource();
  assert.match(src,/b=\{\[\.\.\.palletLocalBase\(pose.side\),PALLET_ARM_WELD_Z\]\}/);
  assert.match(src,/radius=\{FORK_RADIUS\}/);
  assert.match(src,/<PendulumAnchorCoupling\/>/);
  assert.match(src,/rotation=\{\[0,0,-state.pendulumAngle\]\}/);
  assert.equal((src.match(/<ThreeCanvas/g)||[]).length,1);
  for(const side of ['entry','exit']){
    const base=palletBase(side);
    const points=forkWorld(side,.06);
    const worldBase=worldAnchor(base,.06);
    assert.equal(points.length,4);
    assert.ok(Math.hypot(points[1][0]-worldBase[0],points[1][1]-worldBase[1])<FORK_RADIUS+.001);
    const shoe=palletWorld(side,.06);
    assert.ok(shoe.length>=12,'Graham lock face needs multiple arc segments');
  }
});

test('clock frames are reproducible under arbitrary seeking',()=>{
  const times=[0,4,99,300,9,900,1799,600,30,1799];
  const states=times.map(clockAtFrame);
  for(let i=times.length-1;i>=0;i--)
    assert.deepEqual(clockAtFrame(times[i]),states[i]);
  assert.equal(clockAtFrame(0).pendulumAngle,.145);
  for(let k=0;k<DURATION;k+=13){
    const s=clockAtFrame(k);
    assert.equal(s.anchorAngle,s.pendulumAngle);
    assert.equal(s.wheelAngle,s.secondHandAngle);
    assert.ok([s.wheelAngle,s.wheelVelocity,s.pendulumAngle,s.pendulumVelocity,
      s.maxPenetration,s.contactImpulse].every(Number.isFinite));
    assert.ok(s.contactImpulse>=0);
  }
});

test('full 60 s independent collision audit: physical impacts, nonpenetration and no arm/rim crossing',()=>{
  const audit=physicsAudit();
  console.log('CLOCK_PHYSICS_AUDIT '+JSON.stringify(audit));
  console.log('CLOCK_SAMPLES '+JSON.stringify([0,12,24,30,48,60,90,120,180,300,600,1200,1799].map(
    frame=>{const p=clockAtFrame(frame);return {t:p.seconds,w:p.wheelAngle,a:p.pendulumAngle,
      wv:p.wheelVelocity,av:p.pendulumVelocity,contact:p.contactCount,
      lock:p.lock,impact:p.contactImpulse,clearance:p.armClearance};})));
  assert.equal(audit.samples,DURATION+1);
  assert.ok(audit.impacts>0,
    'wheel and pallets are not actually colliding: reject non-physical animation');
  assert.ok(audit.wheelTravel>PITCH,
    'driven wheel must physically advance through multiple real teeth, not remain stalled');
  assert.ok(audit.maxPenetration<.04,
    'solver permitted deep tooth/pallet interpenetration');
  assert.ok(audit.minArmClearance>-.02,
    'fork arm intersects the solid outer swept wheel tooth region');
  assert.ok(Number.isFinite(audit.maxSpeed));
});

test('rear journal is a genuine bored sleeve around one rotating wheel spindle',()=>{
  assert.ok(zOverlap(bearingZRange,spindleZRange)>=BEARING_DEPTH-1e-10);
  assert.ok(WHEEL_THICKNESS>PALLET_THICKNESS);
  assert.match(sceneSource(),/ring.holes.push\(bore\)/);
  assert.match(sceneSource(),/data-wheel-bearing-running-clearance=/);
});

test('camera still has fixed long contact close-up and smooth orbital transitions',()=>{
  assert.equal(SHOTS[0].start,0);
  assert.equal(SHOTS.at(-1).end,60);
  const a=cameraAtFrame(24*FPS),b=cameraAtFrame(36*FPS);
  assert.equal(a.chapter,'contact');
  assert.deepEqual(a.position,b.position);
  assert.deepEqual(a.target,b.target);
  for(let n=1;n<SHOTS.length;n++){
    assert.equal(SHOTS[n-1].end,SHOTS[n].start);
    assert.deepEqual(SHOTS[n-1].positionTo,SHOTS[n].positionFrom);
  }
});
