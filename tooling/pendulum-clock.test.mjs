import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {resolve} from 'node:path';
import {
  clockAtFrame, FPS, DURATION, TEETH, PERIOD_SECONDS, RELEASE_OFFSET,
  PENDULUM_AMPLITUDE, RELEASE_START_ANGLE, RELEASE_END_ANGLE,
} from '../animations/pendulum-clock/web/src/clock-model.ts';
import {cameraAtFrame, SHOTS} from '../animations/pendulum-clock/web/src/camera-path.ts';
import {palletPose, palletLocalTip, palletWorldTip, contactDistance,
  flankAt, PITCH, PALLET_CLEARANCE, PIVOT_Y,
  palletLocalBase, palletWorldBase, WHEEL_SCALE, WHEEL_Y,
  OUTER_RADIUS, ROOT_RADIUS, WHEEL_PROFILE,
  anchorLocalOutline, anchorWheelInterference, anchorWheelClearance,
  armHeel, ARM_LENGTH, armCenterlineLength, clawWorkingDirection,
  palletLocalOutline, palletWheelInterference, forkWheelClearance} from '../animations/pendulum-clock/web/src/escapement-contact.ts';

import {
  WHEEL_PLANE_Z,WHEEL_THICKNESS,PALLET_PLANE_Z,PALLET_THICKNESS,
  PALLET_ARM_WELD_Z,FORK_ARM_PLANE_Z,WHEEL_SPINDLE_RADIUS,WHEEL_SPINDLE_REAR_Z,
  WHEEL_SPINDLE_FRONT_Z,BEARING_CENTER_Z,BEARING_DEPTH,
  BEARING_INNER_RADIUS,BEARING_OUTER_RADIUS,
  wheelZRange,palletZRange,bearingZRange,spindleZRange,zOverlap,
} from '../animations/pendulum-clock/web/src/escapement-axial.ts';

const frame=(seconds)=>Math.round(seconds*FPS);

test('a two-second pendulum reverses at its endpoints and returns exactly',()=>{
  const a=clockAtFrame(0),mid=clockAtFrame(FPS),end=clockAtFrame(2*FPS);
  assert.equal(PERIOD_SECONDS,2);
  assert.ok(Math.abs(a.pendulumAngle+mid.pendulumAngle)<1e-10);
  assert.ok(Math.abs(end.pendulumAngle-a.pendulumAngle)<1e-10);
});

test('one beat every second, alternating entry and exit pallet',()=>{
  assert.equal(clockAtFrame(0).beats,0);
  assert.equal(clockAtFrame(frame(.3)).beats,0);
  assert.equal(clockAtFrame(frame(.7)).beats,1);
  assert.equal(clockAtFrame(frame(1.3)).beats,1);
  assert.equal(clockAtFrame(frame(1.7)).beats,2);
  assert.equal(clockAtFrame(frame(2.7)).beats,3);
  assert.equal(clockAtFrame(frame(.3)).lock,'entry');
  assert.equal(clockAtFrame(frame(.7)).lock,'exit');
  assert.equal(clockAtFrame(frame(1.7)).lock,'entry');
  assert.equal(TEETH,30);
  assert.equal(RELEASE_OFFSET,.42);
});

test('escape wheel and second hand advance half a tooth per beat',()=>{
  const radPerBeat=2*Math.PI/(2*TEETH);
  for(let beat=0;beat<60;beat++){
    const state=clockAtFrame(frame(beat+.8));
    assert.equal(state.beats,beat+1);
    assert.ok(Math.abs(state.wheelAngle-radPerBeat*(beat+1))<1e-9);
    assert.equal(state.wheelAngle,state.secondHandAngle);
  }
  assert.ok(Math.abs(clockAtFrame(frame(59.8)).wheelAngle-2*Math.PI)<1e-9);
});

test('locked intervals are stationary; release intervals rotate monotonically',()=>{
  const before=clockAtFrame(frame(.2));
  const lock=clockAtFrame(frame(.8));
  const still=clockAtFrame(frame(1.2));
  assert.equal(before.wheelAngle,0);
  assert.equal(lock.wheelAngle,still.wheelAngle);
  let last=-1;
  for(let k=0;k<DURATION;k++){
    const value=clockAtFrame(k).wheelAngle;
    assert.ok(value>=last-1e-10,'no unsupported reverse motion at '+k);
    last=value;
  }
  const first=clockAtFrame(frame(.45));
  const next=clockAtFrame(frame(.55));
  assert.equal(first.releasing,true);
  assert.equal(next.releasing,true);
  assert.ok(first.wheelAngle<next.wheelAngle);
});

test('random seeking and replay yield identical geometry state',()=>{
  const samples=[0,12,19,32,90,761,1120,1799];
  const original=samples.map(clockAtFrame);
  samples.reverse().map(clockAtFrame);
  assert.deepEqual(samples.reverse().map(clockAtFrame),original);
});

test('the new scene uses ThreeCanvas, shares the mechanism model and has no media cheats',()=>{
  const src=readFileSync(resolve(import.meta.dirname,
    '../animations/pendulum-clock/web/src/pendulum-clock.tsx'),'utf8');
  const catalog=readFileSync(resolve(import.meta.dirname,
    '../apps/portal/src/catalog.ts'),'utf8');
  assert.match(src,/<ThreeCanvas/);
  assert.match(src,/clockAtFrame\(frame\)/);
  assert.match(src,/makeEscapeWheel/);
  assert.match(src,/data-testid="pendulum-clock-scene"/);
  assert.doesNotMatch(src,/<video|<img|\.mp4|\.webm|\.gif|Date\.now|setInterval/i);
  assert.match(catalog,/id: 'pendulum-clock'/);
  assert.match(catalog,/component: PendulumClockScene/);
});


test('camera concentrates screen time on explicit observation positions',()=>{
  const hold=SHOTS.filter(s=>s.mode==='observe')
    .reduce((sum,s)=>sum+s.end-s.start,0);
  const travel=SHOTS.filter(s=>s.mode==='travel')
    .reduce((sum,s)=>sum+s.end-s.start,0);
  assert.ok(hold>travel*2,'close-up observation needs to dominate transitions');
  assert.ok(SHOTS.every(s=>s.end>s.start),'all shots have positive durations');
  assert.equal(SHOTS[0].start,0);
  assert.equal(SHOTS.at(-1).end,60);
  for(let i=1;i<SHOTS.length;i++){
    const previous=SHOTS[i-1],current=SHOTS[i];
    assert.equal(previous.end,current.start,'no timeline gaps');
    assert.deepEqual(previous.positionTo,current.positionFrom,'no camera teleport');
    assert.deepEqual(previous.targetTo,current.targetFrom,'no target teleport');
    assert.equal(previous.fovTo,current.fovFrom,'no fov snap');
  }
});

test('calm storyboard keeps a single legible two-pallet macro for twenty seconds',()=>{
  const front=cameraAtFrame(0);
  const back=cameraAtFrame(12*FPS);
  const first=cameraAtFrame(24*FPS);
  const second=cameraAtFrame(36*FPS);
  const proof=cameraAtFrame(48*FPS);
  assert.equal(front.chapter,'front');
  assert.equal(back.chapter,'rear');
  assert.equal(first.chapter,'contact');
  assert.equal(second.chapter,'contact');
  assert.equal(first.mode,'observe');
  assert.deepEqual(first.position,second.position,'NO moving between the pallets');
  assert.deepEqual(first.target,second.target,'both contacts fit one fixed composition');
  assert.ok(first.position[2]<-3,'contact camera is actually behind the wheel');
  assert.ok(first.position[0]===0,'contact shot centered: no frantic side angle');
  assert.ok(Math.hypot(...first.position)<Math.hypot(...front.position)*.5);
  assert.equal(proof.chapter,'proof');
  assert.ok(proof.position[2]>10);
  assert.deepEqual(cameraAtFrame(60*FPS).position,front.position);
});

test('pallets are rigid points on the pendulum shaft, not self-powered sliders',()=>{
  const rotate=(p,angle)=>[
    p[0]*Math.cos(angle)-p[1]*Math.sin(angle),
    p[0]*Math.sin(angle)+p[1]*Math.cos(angle),
  ];
  for(let frameNo=0;frameNo<DURATION;frameNo++){
    const state=clockAtFrame(frameNo);
    assert.equal(state.anchorAngle,state.pendulumAngle,
      'anchor and pendulum share exactly one pivot angle');
    for(const side of ['entry','exit']){
      const fixed=palletLocalTip(side);
      const swung=rotate(fixed,-state.pendulumAngle);
      const rendered=palletWorldTip(side,state.pendulumAngle);
      assert.ok(Math.abs(swung[0]-rendered[0])<1e-12);
      assert.ok(Math.abs(swung[1]+PIVOT_Y-rendered[1])<1e-12);
      assert.ok(Math.abs(Math.hypot(...fixed)-
        Math.hypot(rendered[0],rendered[1]-PIVOT_Y))<1e-10,
        'pallet arm may rotate, but its length must NEVER change');
    }
  }
});

test('one-piece anchor clears wheel without misrepresenting swept-contact distance',()=>{
  for(let i=0;i<DURATION;i++){
    const state=clockAtFrame(i);
    assert.equal(anchorWheelInterference(state),false,'anchor intersects wheel at frame '+i);
    assert.ok(anchorWheelClearance(state)>.027,
      'whole monolithic plate must clear the wheel and bevel margins at '+i);
  }
  assert.equal(TEETH,30);
  assert.ok(PITCH>0&&PALLET_CLEARANCE>0);
});

test('wheel progress is a function of oscillator crossing angles, not independent motion',()=>{
  const smooth=x=>{const u=Math.max(0,Math.min(1,x));return u*u*(3-2*u)};
  for(let beat=0;beat<59;beat++){
    for(const d of [.43,.47,.52,.57]){
      const state=clockAtFrame(frame(beat+d));
      const outgoing=state.pendulumAngle*(beat%2===0?1:-1);
      const derived=smooth((RELEASE_START_ANGLE-outgoing)/
        (RELEASE_START_ANGLE-RELEASE_END_ANGLE));
      assert.ok(Math.abs(state.releaseProgress-derived)<1e-12);
      assert.ok(Math.abs(state.wheelAngle-
        (beat+derived)*Math.PI/TEETH)<1e-12,
        'no second oscillator/motor controls the escapement wheel');
    }
  }
  assert.equal(PENDULUM_AMPLITUDE,.085);
});

test('mirror-equal arm centers and same-handed claw work faces',()=>{
  assert.deepEqual(armHeel('entry'),[-.69,-.47]);
  assert.deepEqual(armHeel('exit'),[.69,-.47]);
  assert.equal(armCenterlineLength('entry'),armCenterlineLength('exit'));
  assert.ok(Math.abs(ARM_LENGTH-Math.hypot(.69,.47))<1e-12);
  for(const side of ['entry','exit']){
    const base=palletLocalBase(side);
    assert.deepEqual(base,armHeel(side));
    assert.ok(palletLocalOutline(side).length>=6);
    for(const frameNo of [0,7,13,27,42]){
      const state=clockAtFrame(frameNo);
      const rotated=palletWorldBase(side,state.pendulumAngle);
      const pose=palletPose(side,state);
      assert.ok(Math.hypot(rotated[0]-pose.mounting[0],
        rotated[1]-pose.mounting[1])<1e-11);
    }
  }
  const a=clawWorkingDirection('entry'),b=clawWorkingDirection('exit');
  assert.ok(a[0]>.2&&b[0]>.2,'working tips both turn toward +X, not mirrored');
  assert.ok(a[1]>.2&&b[1]>.2,'both working faces slant toward +Y');
  assert.ok(a[0]*b[0]+a[1]*b[1]>.93,'both claw working faces point same way');
});

test('both claw outlines are part of a continuous plate and never penetrate the wheel',()=>{
  assert.equal(anchorLocalOutline().length,22,'exact single stamped plate perimeter');
  for(let i=0;i<DURATION;i++){
    const state=clockAtFrame(i);
    for(const side of ['entry','exit']){
      assert.equal(palletWheelInterference(side,state),false);
      assert.ok(contactDistance(side,state)>.02);
    }
  }
});

test('shared rigid fork still swings between alternating nominal locking phases',()=>{
  const before=clockAtFrame(frame(.40));
  const mid=clockAtFrame(frame(.50));
  const after=clockAtFrame(frame(.70));
  assert.equal(before.lock,'entry');
  assert.equal(after.lock,'exit');
  assert.ok(before.wheelAngle<mid.wheelAngle&&mid.wheelAngle<after.wheelAngle);
  assert.ok(anchorWheelClearance(before)>.027);
  assert.ok(anchorWheelClearance(after)>.027);
});

test('camera moves smoothly within and across shots and is seek-deterministic',()=>{
  let prev=cameraAtFrame(0);
  for(let i=1;i<60*FPS;i++){
    const pose=cameraAtFrame(i);
    assert.deepEqual(pose,cameraAtFrame(i));
    for(const n of [...pose.position,...pose.target,pose.fov])
      assert.ok(Number.isFinite(n),'nonfinite camera value');
    const displacement=Math.hypot(...pose.position.map((x,k)=>x-prev.position[k]));
    assert.ok(displacement<1.25,'unexpected camera teleport at frame '+i+': '+displacement);
    prev=pose;
  }
});

test('render exactly ONE extruded anchor plate, not rods plus two shoe meshes',()=>{
  const src=readFileSync(resolve(import.meta.dirname,
    '../animations/pendulum-clock/web/src/pendulum-clock.tsx'),'utf8');
  assert.equal((src.match(/<ThreeCanvas/g)||[]).length,1);
  assert.match(src,/makeOnePieceAnchor/);
  assert.match(src,/anchorLocalOutline\(\)/);
  assert.match(src,/<Anchor\/>/);
  assert.match(src,/<Pendulum\/>/);
  assert.match(src,/<EscapeWheel angle={state.wheelAngle}\/>/);
  assert.match(src,/<Dial angle={state.secondHandAngle}\/>/);
  const anchor=src.split('const Anchor:')[1].split('/** One pendulum physically hangs')[0];
  assert.equal((anchor.match(/<mesh geometry=/g)||[]).length,1);
  assert.doesNotMatch(anchor,/<Rod |<PalletTooth|\.map\(/);
  assert.doesNotMatch(src,/makeSectorPallet|PalletTooth|ContactHighlights|emissiveIntensity|pose.engaged\?GOLD/);
  assert.doesNotMatch(src,/<img|<video|\.mp4/i);
});

test('one filleted cylindrical shaft embeds both connected rod endpoints',()=>{
  const src=readFileSync(resolve(import.meta.dirname,
    '../animations/pendulum-clock/web/src/pendulum-clock.tsx'),'utf8');
  const anchor=src.split('const Anchor:')[1].split('/** One pendulum physically hangs')[0];
  const pendulum=src.split('const Pendulum:')[1].split('/** A fixed cylindrical JOURNAL SLEEVE')[0];
  const coupling=src.split('function makeCouplingGeometry()')[1]
    .split('const Ring:')[0];
  const movingJoint=src.split('ONE pivot, ONE angle')[1].split('<Dial angle=')[0];
  const support=src.split('const MinimalSupports:')[1].split('const Dial:')[0];

  const getNumber=name=>{
    const match=src.match(new RegExp(`const ${name}=(-?[\\d.]+);`));
    assert.ok(match,`missing coupling dimension ${name}`);
    return Number(match[1]);
  };
  const centre=getNumber('COUPLING_CENTER_Z');
  const length=getNumber('COUPLING_LENGTH');
  const radius=getNumber('COUPLING_RADIUS');
  const fillet=getNumber('COUPLING_FILLET');
  const back=centre-length/2,front=centre+length/2;
  const pendulumStemZ=-.91,forkArmZ=FORK_ARM_PLANE_Z;
  assert.ok(back<pendulumStemZ-.04,
    'round coupling must extend beyond the pendulum rod by > 0.04');
  assert.ok(front>forkArmZ+.04,
    'round coupling must extend beyond the fork arms by > 0.04');
  assert.ok(radius>.044 && radius>.036,
    'rod centres must be swallowed by a wider coupling');
  assert.ok(fillet>.01 && fillet<radius*.4,
    'ends should be actually rounded without enormous ball-shaped bosses');
  assert.match(coupling,/new THREE.LatheGeometry\(profile,64\)/);
  assert.match(coupling,/const steps=8/);
  assert.match(coupling,/Math.sin\(t\)/);
  assert.match(coupling,/Math.cos\(t\)/);
  assert.equal((coupling.match(/<mesh geometry=/g)||[]).length,1,
    'one continuous mesh, not a stack of fake fillet rings');
  assert.equal((movingJoint.match(/<PendulumAnchorCoupling\/>/g)||[]).length,1);
  assert.doesNotMatch(movingJoint,/<Axle |<Ring /,
    'no old flush-ended axle or decorative collars at the joint');
  assert.doesNotMatch(anchor,/<Axle /);
  assert.doesNotMatch(pendulum,/<Axle /);
  assert.equal((support.match(/<WheelBearing\/>/g)||[]).length,1,
    'the wheel has exactly one fixed bearing sleeve');
  assert.doesNotMatch(support,/<Axle /,
    'the rear support must no longer be an opaque floating cylinder');
  assert.match(pendulum,/a=\{\[0,0,0\]\} b=\{\[0,-5\.55,0\]\}/);
  assert.match(anchor,/<mesh geometry=\{geometry\}/,
    'both fork arms must be extruded with the common hub as ONE plate');
});

test('one plate has same XY working plane and Z thickness as the wheel',()=>{
  assert.equal(PALLET_PLANE_Z,WHEEL_PLANE_Z);
  assert.equal(PALLET_ARM_WELD_Z,PALLET_PLANE_Z);
  assert.ok(zOverlap(wheelZRange,palletZRange)>=PALLET_THICKNESS-1e-10);
  assert.equal(WHEEL_THICKNESS,.18);
  assert.equal(PALLET_THICKNESS,.12);
  const src=readFileSync(resolve(import.meta.dirname,
    '../animations/pendulum-clock/web/src/pendulum-clock.tsx'),'utf8');
  assert.match(src,/depth:PALLET_THICKNESS/);
  assert.match(src,/geometry.translate\(0,0,PALLET_PLANE_Z-PALLET_THICKNESS\/2\)/);
  assert.match(src,/makeOnePieceAnchor\(\)/);
});

test('equal fork arm centerlines remain rigid and coplanar with wheel',()=>{
  assert.equal(FORK_ARM_PLANE_Z,WHEEL_PLANE_Z);
  assert.equal(FORK_ARM_PLANE_Z,PALLET_PLANE_Z);
  assert.equal(FORK_ARM_PLANE_Z,PALLET_ARM_WELD_Z);
  for(const sec of [0,.2,.45,.8,1.4,24.5,59.6]){
    const angle=clockAtFrame(Math.round(sec*FPS)).pendulumAngle;
    assert.ok(Number.isFinite(angle));
    for(const side of ['entry','exit']){
      const p=armHeel(side),z=PALLET_PLANE_Z;
      assert.equal(z,WHEEL_PLANE_Z);
      assert.ok(Math.abs(Math.hypot(p[0],p[1])-ARM_LENGTH)<1e-12);
    }
  }
});

test('bearing has a real rotating shaft through its entire bored sleeve',()=>{
  assert.ok(BEARING_OUTER_RADIUS>BEARING_INNER_RADIUS);
  assert.ok(BEARING_INNER_RADIUS>WHEEL_SPINDLE_RADIUS);
  assert.ok(BEARING_INNER_RADIUS-WHEEL_SPINDLE_RADIUS>.005);
  assert.ok(BEARING_INNER_RADIUS-WHEEL_SPINDLE_RADIUS<.03);
  assert.ok(zOverlap(bearingZRange,spindleZRange)>=BEARING_DEPTH-1e-10,
    'rotating shaft must pass all the way through the bearing');
  assert.ok(spindleZRange[1]>wheelZRange[1],
    'shaft must embed into the wheel hub');
  assert.ok(spindleZRange[0]<bearingZRange[0],
    'shaft must emerge from the back face of the bearing');
  assert.equal(spindleZRange[0],WHEEL_SPINDLE_REAR_Z);
  assert.equal(spindleZRange[1],WHEEL_SPINDLE_FRONT_Z);
  assert.ok(Math.abs((bearingZRange[0]+bearingZRange[1])/2-BEARING_CENTER_Z)<1e-12);
  const scene=readFileSync(resolve(import.meta.dirname,
    '../animations/pendulum-clock/web/src/pendulum-clock.tsx'),'utf8');
  assert.match(scene,/ring.holes.push\(bore\)/,
    'fixed support must be a drilled sleeve and not an overlapping solid cap');
  assert.match(scene,/bore.absarc\(0,0,BEARING_INNER_RADIUS/);
  assert.match(scene,/radius=\{WHEEL_SPINDLE_RADIUS\}/);
  assert.match(scene,/depth=\{WHEEL_SPINDLE_FRONT_Z-WHEEL_SPINDLE_REAR_Z\}/);
  assert.match(scene,/data-wheel-bearing-running-clearance=/);
  assert.doesNotMatch(scene,/<Axle position=\{\[0,\.60,-\.42\]\}/);
});

test('one-piece claw profile has equal arms but DIFFERENT claw noses',()=>{
  assert.equal(WHEEL_SCALE,.60);
  assert.equal(WHEEL_PROFILE.length,6);
  assert.ok(OUTER_RADIUS<1&&ROOT_RADIUS<OUTER_RADIUS);
  assert.ok(Math.abs(PIVOT_Y-WHEEL_Y-1.4*OUTER_RADIUS)<1e-12);
  const left=palletLocalOutline('entry'),right=palletLocalOutline('exit');
  assert.notDeepEqual(left.map(([x,y])=>[-x,y]),right,
    'teeth are handed, not reflect-mirror copies');
  assert.equal(armCenterlineLength('entry'),armCenterlineLength('exit'));
  const src=readFileSync(resolve(import.meta.dirname,
    '../animations/pendulum-clock/web/src/pendulum-clock.tsx'),'utf8');
  assert.match(src,/for\(const \[s,r\] of WHEEL_PROFILE\)/);
  assert.match(src,/makeOnePieceAnchor\(\)/);
  assert.match(src,/position=\{\[0,PIVOT_Y,0\]\}/);
});

test('both equal fork-arm centerlines remain outside the wheel envelope',()=>{
  for(let i=0;i<DURATION;i++){
    const state=clockAtFrame(i);
    for(const side of ['entry','exit']){
      const gap=forkWheelClearance(side,state);
      assert.ok(gap>.030,'shaft axis goes through wheel at frame '+i+' '+side);
    }
  }
});

test('all 1,800 frames: one stamped anchor plate has true solid clearance',()=>{
  let closest=Infinity;
  for(let i=0;i<DURATION;i++){
    const state=clockAtFrame(i);
    assert.equal(anchorWheelInterference(state),false,'wheel intersects anchor at '+i);
    closest=Math.min(closest,anchorWheelClearance(state));
  }
  assert.ok(closest>.027,'clearance must exceed bevel plus safety margin; found '+closest);
});

