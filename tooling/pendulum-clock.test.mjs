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
  palletLocalBase, palletWorldBase, palletOrientation, PALLET_BASE_HEIGHT} from '../animations/pendulum-clock/web/src/escapement-contact.ts';

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

test('real wheel teeth meet the rigid fork on each escapement threshold',()=>{
  const p=flankAt(-4,0);
  const near=Math.hypot(p.point[0]-p.start[0],p.point[1]-p.start[1]);
  assert.ok(near>.08&&near<.19);
  for(let beat=0;beat<59;beat++){
    const s=clockAtFrame(frame(beat+.4));
    const active=s.lock;
    const passive=active==='entry'?'exit':'entry';
    assert.ok(palletPose(active,s).engaged,
      'outgoing pallet holds the wheel until oscillator reaches the threshold');
    assert.ok(contactDistance(active,s)<.02,
      'rigid pallet must physically reach its tooth flank at threshold '+beat);
    assert.ok(!palletPose(passive,s).engaged);
    const halfway=clockAtFrame(frame(beat+.8));
    const catching=halfway.lock;
    assert.ok(palletPose(catching,halfway).engaged);
    assert.ok(contactDistance(catching,halfway)<.06,
      'arc-shaped wedge follows tooth flank during lock');
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
  assert.equal(PENDULUM_AMPLITUDE,.145);
});

test('fork rods terminate at shoe BASE not tooth-catching nose',()=>{
  const src=readFileSync(resolve(import.meta.dirname,
    '../animations/pendulum-clock/web/src/pendulum-clock.tsx'),'utf8');
  assert.match(src,/b=\{\[\.\.\.palletLocalBase\(pose\.side\),PALLET_ARM_WELD_Z\]\}/,
    'connecting rod should end at pallet base');
  assert.doesNotMatch(src,/b=\{\[\.\.\.palletLocalTip\(pose\.side\),-\.13\]\}/,
    'old bug: rod attached to sharp tooth tip');
  for(const side of ['entry','exit']){
    const tip=palletLocalTip(side),base=palletLocalBase(side);
    const length=Math.hypot(base[0]-tip[0],base[1]-tip[1]);
    assert.ok(Math.abs(length-PALLET_BASE_HEIGHT)<1e-12);
    assert.ok(Math.hypot(...base)<Math.hypot(...tip)-.18,
      'shoe base must point back to the main anchor pivot');
    assert.ok(Math.abs(palletOrientation(side))>.6);
    for(const n of [0,7,13,27,42]){
      const state=clockAtFrame(n);
      const rotated=palletWorldBase(side,state.pendulumAngle);
      const pose=palletPose(side,state);
      assert.ok(Math.hypot(rotated[0]-pose.mounting[0],
        rotated[1]-pose.mounting[1])<1e-11);
      assert.ok(Math.abs(Math.hypot(rotated[0],rotated[1]-PIVOT_Y)-
        Math.hypot(...base))<1e-11);
    }
  }
});

test('both working pallets swap lock without jamming each other',()=>{
  assert.ok(PENDULUM_AMPLITUDE>.14,
    'pendulum and fork need visibly wider swing to clear tooth shoulders');
  for(let beat=0;beat<59;beat++){
    const incoming=clockAtFrame(frame(beat+.4));
    const active=incoming.lock;
    const other=active==='entry'?'exit':'entry';
    assert.ok(contactDistance(active,incoming)<.02,
      'working flank must have contact at the release threshold');
    assert.ok(contactDistance(other,incoming)>.075,
      'inactive flank must be clearly withdrawn, not simultaneously jammed');
    const after=clockAtFrame(frame(beat+.8));
    const catching=after.lock;
    const escaping=catching==='entry'?'exit':'entry';
    assert.ok(contactDistance(catching,after)<.06,
      'catching shoe is near the next tooth');
    assert.ok(contactDistance(escaping,after)>.07,
      'released shoe must clear the opposing flank by at least 0.07');
  }
});

test('one shared swinging fork exchanges locking pallets while wheel steps',()=>{
  const before=clockAtFrame(frame(.40));
  const early=clockAtFrame(frame(.43));
  const mid=clockAtFrame(frame(.50));
  const late=clockAtFrame(frame(.60));
  const after=clockAtFrame(frame(.70));
  assert.ok(palletPose('entry',before).engaged);
  assert.ok(palletPose('entry',early).engaged);
  assert.ok(!palletPose('entry',mid).engaged);
  assert.ok(!palletPose('exit',mid).engaged);
  assert.ok(palletPose('exit',late).engaged);
  assert.ok(palletPose('exit',after).engaged);
  assert.ok(contactDistance('exit',after)<.06);
  assert.ok(before.wheelAngle<mid.wheelAngle);
  assert.ok(mid.wheelAngle<after.wheelAngle);
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

test('all front, rear, and dial parts stay in one ThreeCanvas',()=>{
  const src=readFileSync(resolve(import.meta.dirname,
    '../animations/pendulum-clock/web/src/pendulum-clock.tsx'),'utf8');
  assert.equal((src.match(/<ThreeCanvas/g)||[]).length,1,'one 3D world');
  assert.match(src,/<CinematicCamera frame={frame}/);
  assert.match(src,/<MinimalSupports\/>/);
  assert.doesNotMatch(src,/const Chassis|<Chassis\/>/);
  assert.match(src,/makeSlimPallet/);
  assert.match(src,/contactDistance/);
  assert.match(src,/palletPose/);
  assert.match(src,/<PalletTooth/);
  assert.doesNotMatch(src,/<boxGeometry/);
  assert.match(src,/data-camera-mode={shot.mode}/);
  assert.match(src,/<Pendulum\/>/);
  assert.match(src,/rotation=\{\[0,0,-state.pendulumAngle\]\}/);
  assert.match(src,/ONE pivot, ONE angle/);
  assert.match(src,/<EscapeWheel angle={state.wheelAngle}\/>/);
  assert.match(src,/<Anchor state={state}/);
  assert.doesNotMatch(src,/rotation=\{\[0,0,-state.anchorAngle\]\}/);
  assert.match(src,/<Dial angle={state.secondHandAngle}\/>/);
  assert.doesNotMatch(src,/artwork|backgroundImage:|linear-gradient|grid-template|<svg/i);
});

test('one filleted cylindrical shaft embeds both connected rod endpoints',()=>{
  const src=readFileSync(resolve(import.meta.dirname,
    '../animations/pendulum-clock/web/src/pendulum-clock.tsx'),'utf8');
  const anchor=src.split('const Anchor:')[1].split('/** Highlight only')[0];
  const pendulum=src.split('const Pendulum:')[1].split('/** A fixed cylindrical JOURNAL SLEEVE')[0];
  const coupling=src.split('function makeCouplingGeometry()')[1]
    .split('const Ring:')[0];
  const movingJoint=src.split('ONE pivot, ONE angle')[1].split('<ContactHighlights')[0];
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
  assert.match(pendulum,/a=\{\[0,0,0\]\} b=\{\[0,-6\.28,0\]\}/);
  assert.match(anchor,/a=\{\[0,0,FORK_ARM_PLANE_Z\]\}/,
    'both fork arms begin at the shaft axis in the same plane as the wheel');
});

test('visible pallet shoes and escapement wheel occupy the same axial contact plane',()=>{
  assert.equal(PALLET_PLANE_Z,WHEEL_PLANE_Z,
    'working face centers may not be offset along the shaft axis');
  assert.equal(PALLET_ARM_WELD_Z,PALLET_PLANE_Z,
    'fork arm end is embedded inside its pallet instead of stopping behind it');
  assert.ok(zOverlap(wheelZRange,palletZRange)>=PALLET_THICKNESS-1e-10,
    'the full axial extent of both pallet shoes must overlap wheel teeth');
  assert.ok(wheelZRange[0]<=palletZRange[0] &&
    wheelZRange[1]>=palletZRange[1]);
  assert.equal(WHEEL_THICKNESS,.18);
  assert.equal(PALLET_THICKNESS,.12);
  const scene=readFileSync(resolve(import.meta.dirname,
    '../animations/pendulum-clock/web/src/pendulum-clock.tsx'),'utf8');
  assert.match(scene,/depth:WHEEL_THICKNESS/);
  assert.match(scene,/geo.translate\(0,0,WHEEL_PLANE_Z-WHEEL_THICKNESS\/2\)/);
  assert.match(scene,/depth:PALLET_THICKNESS/);
  assert.match(scene,/geometry.translate\(0,0,-PALLET_THICKNESS\/2\)/);
  assert.match(scene,/position=\{\[\.\.\.palletLocalTip\(pose.side\),PALLET_PLANE_Z\]\}/);
  assert.match(scene,/b=\{\[\.\.\.palletLocalBase\(pose.side\),PALLET_ARM_WELD_Z\]\}/);
});

test('both full fork arms stay flat in the escapement wheel working plane',()=>{
  assert.equal(FORK_ARM_PLANE_Z,WHEEL_PLANE_Z,
    'fork rod root must not be set back behind the wheel');
  assert.equal(FORK_ARM_PLANE_Z,PALLET_PLANE_Z,
    'fork rod root and pallet shoe must share the same working plane');
  assert.equal(FORK_ARM_PLANE_Z,PALLET_ARM_WELD_Z,
    'fork rod must have zero axial slope between root and pallet base');
  const rodRadius=.036;
  const armZRange=[FORK_ARM_PLANE_Z-rodRadius,FORK_ARM_PLANE_Z+rodRadius];
  assert.ok(wheelZRange[0]<=armZRange[0] &&
    wheelZRange[1]>=armZRange[1],
    'entire fork arm thickness must fit inside wheel tooth thickness');
  const src=readFileSync(resolve(import.meta.dirname,
    '../animations/pendulum-clock/web/src/pendulum-clock.tsx'),'utf8');
  const fork=src.split('const Anchor:')[1].split('/** Highlight only')[0];
  assert.match(fork,/a=\\{\\[0,0,FORK_ARM_PLANE_Z\\]\\}/,
    'both fork roots must be at the wheel plane, never z=-.33');
  assert.match(fork,/b=\\{\\[\\.\\.\\.palletLocalBase\\(pose.side\\),PALLET_ARM_WELD_Z\\]\\}/);
  assert.doesNotMatch(fork,/a=\\{\\[0,0,-\\.33\\]\\}/);
  const coupling=src.match(/const COUPLING_CENTER_Z=(-?[\\d.]+);[\\s\\S]*?const COUPLING_LENGTH=([\\d.]+);/);
  assert.ok(coupling,'a single extended common shaft is required');
  const centre=Number(coupling[1]),half=Number(coupling[2])/2;
  assert.ok(centre+half>FORK_ARM_PLANE_Z+.04,
    'shared shaft must extend past flat fork rods, not just meet the ends');
  assert.ok(centre-half<-.91-.04,
    'same cylinder must still embed the rear pendulum stem');
  for(const sec of [0,.2,.45,.8,1.4,24.5,59.6]){
    const a=clockAtFrame(Math.round(sec*FPS)).pendulumAngle;
    const c=Math.cos(a),sin=Math.sin(a);
    for(const side of ['entry','exit']){
      const base=palletLocalBase(side);
      const localStart=[0,0,FORK_ARM_PLANE_Z];
      const localEnd=[base[0],base[1],PALLET_ARM_WELD_Z];
      const rotateZ=([x,y,z])=>[x*c+y*sin,-x*sin+y*c,z];
      const [,,rootZ]=rotateZ(localStart);
      const [,,palletZ]=rotateZ(localEnd);
      assert.equal(rootZ,palletZ,
        `arm ${side} tilts out of working plane at ${sec}s`);
      assert.equal(rootZ,WHEEL_PLANE_Z);
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
