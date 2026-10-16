import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {resolve} from 'node:path';
import {
  clockAtFrame, FPS, DURATION, TEETH, PERIOD_SECONDS, RELEASE_OFFSET,
} from '../animations/pendulum-clock/web/src/clock-model.ts';
import {cameraAtFrame, SHOTS} from '../animations/pendulum-clock/web/src/camera-path.ts';
import {palletPose, contactDistance, flankAt, PITCH, PALLET_CLEARANCE} from '../animations/pendulum-clock/web/src/escapement-contact.ts';

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

test('pallet tips align with the SAME 30-tooth wheel flank polygon used by mesh',()=>{
  const p=flankAt(-4,0);
  const near=Math.hypot(p.point[0]-p.start[0],p.point[1]-p.start[1]);
  assert.ok(near>.08&&near<.19,'must contact sloping flank, not detached rim');
  assert.equal(TEETH,30);
  assert.ok(PITCH>0);
  for(let beat=0;beat<60;beat++){
    const s=clockAtFrame(frame(beat+.80));
    const active=s.lock;
    const passive=active==='entry'?'exit':'entry';
    const a=palletPose(active,s),b=palletPose(passive,s);
    assert.ok(a.engaged,'the catching pallet MUST be engaged on beat '+beat);
    assert.ok(contactDistance(active,s)<.012,
      'tip must touch actual tooth flank within 12mm normalized at beat '+beat);
    assert.ok(contactDistance(active,s)>=PALLET_CLEARANCE*.9);
    assert.ok(!b.engaged,'other pallet must let the next tooth move');
    assert.ok(contactDistance(passive,s)>.13,
      'inactive pallet must clear rotating gear');
  }
});

test('a release retracts the outgoing wedge, rotates wheel, and seats incoming wedge',()=>{
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
  assert.ok(contactDistance('exit',after)<.012);
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
  assert.match(src,/<Pendulum angle={state.pendulumAngle}\/>/);
  assert.match(src,/<EscapeWheel angle={state.wheelAngle}\/>/);
  assert.match(src,/<Anchor state={state}/);
  assert.match(src,/<Dial angle={state.secondHandAngle}\/>/);
  assert.doesNotMatch(src,/artwork|backgroundImage:|linear-gradient|grid-template|<svg/i);
});
