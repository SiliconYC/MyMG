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
  assert.match(src,/b=\{\[\.\.\.palletLocalBase\(pose\.side\),-\.13\]\}/,
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
    assert.ok(contactDistance(escaping,after)>.13,
      'released shoe is well away from the escapement tooth');
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
