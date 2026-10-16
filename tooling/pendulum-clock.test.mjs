import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {resolve} from 'node:path';
import {
  clockAtFrame, contactStats, FPS, DURATION, TEETH, PERIOD_SECONDS,
  PENDULUM_AMPLITUDE, PHYSICS_HZ, GRAVITY_OVER_LENGTH,
  DRIVE_ACCELERATION, PENDULUM_DRAG, IMPULSE_EFFICIENCY,
} from '../animations/pendulum-clock/web/src/clock-model.ts';
import {
  HALF_PITCH, PITCH, TIP_FRACTION, WHEEL_PROFILE, WHEEL_TIP_RADIUS,
  LOCK_RADIUS, LOCK_POLAR, LOCK_TOOTH_ANGLE, RELEASE_ANGLE,
  PALLET_RANGES, PALLET_BAND, faceContains, lockedSide, wheelTip,
  PIVOT_Y, WHEEL_Y, polar,
} from '../animations/pendulum-clock/web/src/escapement-geometry.ts';
import {
  contactDistance, palletPose, palletOutline, palletLocalBase,
  palletWorldBase, palletWorldTip, palletLocalTip, workingToothIndex,
  workingTooth, palletFaceWorld,
} from '../animations/pendulum-clock/web/src/escapement-contact.ts';
import {cameraAtFrame, SHOTS} from '../animations/pendulum-clock/web/src/camera-path.ts';

const at=t=>clockAtFrame(Math.round(t*FPS));
const near=(a,b,eps=1e-7)=>assert.ok(Math.abs(a-b)<=eps,
  `expected ${a} ~ ${b} (tolerance ${eps})`);
const dist=(p,q)=>Math.hypot(p[0]-q[0],p[1]-q[1]);

test('the pendulum is integrated under gravity; not a separate cosine animation',()=>{
  assert.equal(PERIOD_SECONDS,2);
  assert.equal(PHYSICS_HZ/FPS,20);
  near(GRAVITY_OVER_LENGTH,Math.PI*Math.PI);
  assert.ok(DRIVE_ACCELERATION>0 && PENDULUM_DRAG>0);
  assert.ok(IMPULSE_EFFICIENCY>0 && IMPULSE_EFFICIENCY<1);
  near(at(0).pendulumAngle,PENDULUM_AMPLITUDE);
  near(at(0).pendulumVelocity,0);
  assert.ok(at(.5).pendulumVelocity<-.4);
  assert.ok(at(1).pendulumAngle<-.13);
  assert.ok(at(1.5).pendulumVelocity>.4);
  assert.ok(at(2).pendulumAngle>.13);
  const src=readFileSync(resolve(import.meta.dirname,
    '../animations/pendulum-clock/web/src/clock-model.ts'),'utf8');
  assert.match(src,/Math\.sin\(s\.a\)/,'gravity must act on the pendulum');
  assert.match(src,/s\.wv\+=/,'wheel must accelerate from force/torque');
  assert.match(src,/faceContains\(/,'locking depends on the physical arc');
  assert.doesNotMatch(src,/smoothstep|Math\.cos\(Math\.PI\s*\*\s*seconds\)/);
});

test('60 impacts: one per second, 30 teeth, half-pitch rotation per beat',()=>{
  const stats=contactStats();
  assert.equal(TEETH,30);
  assert.equal(stats.impacts,60);
  assert.ok(stats.first>.55 && stats.first<.65);
  assert.ok(stats.last>59.55 && stats.last<59.8);
  assert.equal(at(.3).beats,0);
  assert.equal(at(.53).beats,0);
  assert.equal(at(.7).beats,1);
  assert.equal(at(1.7).beats,2);
  assert.equal(at(59.9).beats,60);
  near(at(59.9).wheelAngle,2*Math.PI);
  near(HALF_PITCH,Math.PI/30);
  assert.equal(at(60).secondHandAngle,at(60).wheelAngle);
  for(let n=0;n<=60;n++){
    const state=at(n===0?0:Math.min(59.9,n-.3));
    assert.equal(state.beats,n);
    near(state.wheelAngle,n*HALF_PITCH,1e-8);
  }
});

test('the drive torque cannot turn a wheel when its tip meets the finite shoe arc',()=>{
  let prev=clockAtFrame(0),locked=0,released=0;
  for(let f=1;f<DURATION;f++){
    const state=clockAtFrame(f);
    assert.ok(state.wheelAngle+1e-10>=prev.wheelAngle,
      'wheel reversed at frame '+f);
    assert.equal(state.anchorAngle,state.pendulumAngle,
      'one axle, no independent anchor motor');
    assert.equal(state.secondHandAngle,state.wheelAngle);
    assert.equal(state.lock,lockedSide(state.beats));
    if(!state.releasing){
      locked++;
      near(state.wheelVelocity,0,1e-12);
      near(state.wheelAngle,state.beats*HALF_PITCH,2e-12);
      assert.ok(faceContains(state.lock,state.pendulumAngle),
        'lock must be geometrically supported at frame '+f);
      assert.ok(contactDistance(state.lock,state)<.000001,
        'the visible gear tooth must touch a real face at frame '+f);
    }else{
      released++;
      assert.ok(state.wheelVelocity>0,'drive wheel should coast while free');
      assert.ok(state.releaseProgress>=0 && state.releaseProgress<=1.001);
    }
    prev=state;
  }
  assert.ok(locked>1200,'deadbeat phase dominates the cycle');
  assert.ok(released>100,'genuine release phase exists');
});

test('real tooth tips and deadbeat locking faces share exactly one geometry',()=>{
  assert.equal(WHEEL_PROFILE.filter(x=>x[0]===TIP_FRACTION).length,1);
  assert.equal(WHEEL_PROFILE.find(x=>x[0]===TIP_FRACTION)[1],WHEEL_TIP_RADIUS);
  assert.ok(WHEEL_PROFILE[2][0]<TIP_FRACTION,
    'teeth should be swept-back, not meaningless rectangular triangles');
  const left=wheelTip(-4,0);
  const right=wheelTip(3,HALF_PITCH);
  near(left[0],-right[0],1e-12);
  near(left[1],right[1],1e-12);
  for(const p of [left,right]){
    near(Math.hypot(p[0],p[1]-PIVOT_Y),LOCK_RADIUS,1e-10);
    near(Math.abs(Math.atan2(p[0],PIVOT_Y-p[1])),LOCK_POLAR,1e-10);
  }
  near(LOCK_TOOTH_ANGLE,Math.PI/4);
  for(const side of ['entry','exit']){
    const [lo,hi]=PALLET_RANGES[side];
    assert.ok(lo<hi);
    assert.ok(hi-lo>.11 && hi-lo<.14);
    near(Math.abs(side==='entry'?lo+LOCK_POLAR:hi-LOCK_POLAR),
      RELEASE_ANGLE);
    const points=palletOutline(side);
    assert.ok(points.length>=40);
    for(const p of points)assert.ok(p.every(Number.isFinite));
    for(const p of [points[0],points[20]])
      near(Math.hypot(...p),LOCK_RADIUS,1e-9);
    const base=palletLocalBase(side);
    assert.ok(Math.abs(Math.hypot(...base)-LOCK_RADIUS)<=PALLET_BAND+1e-10);
    assert.ok(dist(base,palletLocalTip(side))>.07);
  }
});

test('every locked frame has exactly one rigidly connected pallet and tip contact',()=>{
  const angles=[0,.145,-.145,.033,-.033];
  for(const side of ['entry','exit']){
    const base=palletLocalBase(side),tip=palletLocalTip(side);
    for(const angle of angles){
      const rotated=(p)=>{
        const c=Math.cos(-angle),s=Math.sin(-angle);
        return [p[0]*c-p[1]*s,p[0]*s+p[1]*c+PIVOT_Y];
      };
      near(dist(palletWorldBase(side,angle),rotated(base)),0,1e-12);
      near(dist(palletWorldTip(side,angle),rotated(tip)),0,1e-12);
      near(dist(palletWorldBase(side,angle),palletWorldTip(side,angle)),
        dist(base,tip),1e-12);
    }
  }
  for(let f=0;f<DURATION;f++){
    const s=clockAtFrame(f);
    const poses=['entry','exit'].map(side=>palletPose(side,s));
    assert.ok(poses.filter(p=>p.engaged).length<2,'both shoe faces cannot lock');
    if(!s.releasing){
      const p=poses.find(p=>p.engaged);
      assert.ok(p,'a stopped wheel must be visibly in contact');
      assert.ok(p.gap<1e-6);
      const tooth=workingTooth(p.side,s.wheelAngle);
      near(dist(tooth,p.tooth),0,1e-12);
      assert.equal(p.toothIndex,workingToothIndex(p.side,s.wheelAngle));
      const a=palletFaceWorld(p.side,0,s.pendulumAngle);
      const b=palletFaceWorld(p.side,1,s.pendulumAngle);
      near(dist(a,p.faceStart),0,1e-12);
      near(dist(b,p.faceEnd),0,1e-12);
    }
  }
});

test('seeking any frame is deterministic and shaft angular velocity changes only on impact',()=>{
  const order=[0,1799,20,771,300,1799,40,20,60,960];
  const first=order.map(clockAtFrame);
  for(let n=order.length-1;n>=0;n--)
    assert.deepEqual(clockAtFrame(order[n]),first[n]);
  assert.ok(first.every(s=>Number.isFinite(s.pendulumVelocity)&&
    Number.isFinite(s.wheelVelocity)));
  assert.ok(at(30).pendulumAngle!==at(0).pendulumAngle);
});

test('one clean WebGL scene; no fake screen overlays or animated proxy parts',()=>{
  const src=readFileSync(resolve(import.meta.dirname,
    '../animations/pendulum-clock/web/src/pendulum-clock.tsx'),'utf8');
  const catalog=readFileSync(resolve(import.meta.dirname,
    '../apps/portal/src/catalog.ts'),'utf8');
  assert.equal((src.match(/<ThreeCanvas/g)||[]).length,1);
  assert.match(src,/data-simulation="gravity-torque-rigid-contact"/);
  assert.match(src,/makeDeadbeatPallet/);
  assert.match(src,/palletOutline\(side\)/);
  assert.match(src,/WHEEL_PROFILE/);
  assert.match(src,/rotation=\{\[0,0,-state\.pendulumAngle\]\}/);
  assert.match(src,/<EscapeWheel angle=\{state\.wheelAngle\}/);
  assert.match(src,/<Pendulum\/>/);
  assert.match(src,/<Dial angle=\{state\.secondHandAngle\}/);
  assert.match(src,/b=\{\[\.\.\.palletLocalBase\(pose\.side\),-\.12\]\}/);
  assert.doesNotMatch(src,/makeSlimPallet|ContactHighlights|<boxGeometry|<video|<img|\.mp4|\.gif|\.webm|Date\.now|setInterval/i);
  assert.match(catalog,/id: 'pendulum-clock'/);
  assert.match(catalog,/component: PendulumClockScene/);
});

test('all camera moves are continuous and include a sustained stationary contact closeup',()=>{
  assert.equal(SHOTS[0].start,0);
  assert.equal(SHOTS.at(-1).end,60);
  let observe=0,travel=0;
  for(let i=0;i<SHOTS.length;i++){
    const shot=SHOTS[i];
    assert.ok(shot.end>shot.start);
    if(shot.mode==='observe')observe+=shot.end-shot.start;
    else travel+=shot.end-shot.start;
    if(i){
      const p=SHOTS[i-1];
      assert.equal(p.end,shot.start);
      assert.deepEqual(p.positionTo,shot.positionFrom);
      assert.deepEqual(p.targetTo,shot.targetFrom);
      assert.equal(p.fovTo,shot.fovFrom);
    }
  }
  assert.ok(observe>travel*2);
  const f=cameraAtFrame(24*FPS),g=cameraAtFrame(36*FPS);
  assert.equal(f.chapter,'contact');
  assert.deepEqual(f.position,g.position);
  assert.deepEqual(f.target,g.target);
  assert.ok(f.position[2]<-3);
  assert.ok(cameraAtFrame(48*FPS).position[2]>10);
  let prev=cameraAtFrame(0);
  for(let i=1;i<DURATION;i++){
    const cur=cameraAtFrame(i);
    assert.deepEqual(cur,cameraAtFrame(i));
    assert.ok(Math.hypot(...cur.position.map((x,k)=>x-prev.position[k]))<1.25);
    prev=cur;
  }
  assert.deepEqual(cameraAtFrame(60*FPS).position,cameraAtFrame(0).position);
});
