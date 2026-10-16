import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {resolve} from 'node:path';
import {
  clockAtFrame, FPS, DURATION, TEETH, PERIOD_SECONDS, RELEASE_OFFSET,
} from '../animations/pendulum-clock/web/src/clock-model.ts';
import {cameraAtFrame, CAMERA_KEYS} from '../animations/pendulum-clock/web/src/camera-path.ts';

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


test('one actual 3D camera circles the unit from front to rear and back',()=>{
  assert.ok(CAMERA_KEYS.length>=8,'camera needs a multi-stage directed journey');
  const start=cameraAtFrame(0);
  const side=cameraAtFrame(11*FPS);
  const back=cameraAtFrame(23*FPS);
  const macro=cameraAtFrame(31*FPS);
  const frontAgain=cameraAtFrame(50*FPS);
  assert.ok(start.position[2]>18,'front establishing shot');
  assert.ok(side.position[0]>8,'clear right side revealing depth');
  assert.ok(back.position[2]<-6,'orbit must SHOW rear face of wheel');
  assert.ok(macro.position[2]<-5,'rear macro rather than 2D crop');
  assert.ok(frontAgain.position[2]>9,'return to front seconds hand');
  assert.ok(Math.hypot(...macro.position)<Math.hypot(...start.position)*.5,
    'closeup must physically move camera towards the gear');
  assert.deepEqual(cameraAtFrame(60*FPS).position,start.position,
    '60s seamless mechanical timeline may repeat without camera teleport');
});

test('camera is smooth at every frame and seeking is deterministic',()=>{
  let prev=cameraAtFrame(0);
  for(let i=1;i<60*FPS;i++){
    const pose=cameraAtFrame(i);
    assert.deepEqual(pose,cameraAtFrame(i));
    for(const n of [...pose.position,...pose.target,pose.fov])
      assert.ok(Number.isFinite(n),'nonfinite camera value');
    const move=Math.hypot(...pose.position.map((x,k)=>x-prev.position[k]));
    assert.ok(move<.22,'camera jerks at frame '+i+': '+move);
    prev=pose;
  }
});

test('all front, rear, and dial parts stay in one ThreeCanvas',()=>{
  const src=readFileSync(resolve(import.meta.dirname,
    '../animations/pendulum-clock/web/src/pendulum-clock.tsx'),'utf8');
  assert.equal((src.match(/<ThreeCanvas/g)||[]).length,1,'one 3D world');
  assert.match(src,/<CinematicCamera frame={frame}/);
  assert.match(src,/<Chassis\/>/);
  assert.match(src,/<Pendulum angle={state.pendulumAngle}\/>/);
  assert.match(src,/<EscapeWheel angle={state.wheelAngle}\/>/);
  assert.match(src,/<Anchor angle={state.anchorAngle}/);
  assert.match(src,/<Dial angle={state.secondHandAngle}\/>/);
  assert.doesNotMatch(src,/artwork|backgroundImage:|linear-gradient|grid-template|<svg/i);
});
