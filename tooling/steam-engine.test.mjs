import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {steamAtFrame,CRANK_X,CRANK_RADIUS,CONNECTING_ROD,
  PISTON_OFFSET,CYLINDER_LEFT,CYLINDER_RIGHT,DURATION} from
  '../animations/steam-engine/web/src/steam-model.ts';
import {governorAtFrame,GOVERNOR_START_FRAME,loadReliefAt,NOMINAL_ANGLE} from
  '../animations/steam-engine/web/src/governor-model.ts';
import {GOV_X,GOV_Z,GOV_PIVOT_Y,GOV_LIFT,THROTTLE_X,THROTTLE_Y,THROTTLE_Z,THROTTLE_LEFT,THROTTLE_RIGHT,
  INLET_PORT,EXHAUST_PORT,BOILER_TO_VALVE,VALVE_TO_CYLINDER,
  CYLINDER_TO_EXHAUST,throttleLinkage} from
  '../animations/steam-engine/web/src/steam-plumbing.ts';
import {pipeSections} from '../animations/steam-engine/web/src/pipe-path.ts';
import {cameraPose} from '../animations/steam-engine/web/src/camera-path.ts';
import {flowOpacity,flowProgress,visibleArrowCount} from '../animations/steam-engine/web/src/steam-flow.ts';

test('20-second runtime and crank / piston / connecting rod stay linked',()=>{
  assert.equal(DURATION,600);
  for(let frame=0;frame<DURATION;frame++){
    const s=steamAtFrame(frame);
    assert.ok(Number.isFinite(s.pistonX));
    assert.ok(Math.abs(Math.hypot(s.pinX-s.crossheadX,s.pinY)-CONNECTING_ROD)<1e-9);
    assert.ok(Math.abs((s.crossheadX-s.pistonX)-PISTON_OFFSET)<1e-9);
    assert.ok(Math.abs(Math.hypot(s.pinX-CRANK_X,s.pinY)-CRANK_RADIUS)<1e-9);
    assert.ok(s.pistonX>CYLINDER_LEFT && s.pistonX<CYLINDER_RIGHT-.20);
    assert.ok(s.cut>=0&&s.cut<=1);
    assert.ok(s.leftPressure>=0&&s.leftPressure<=1);
    assert.ok(s.rightPressure>=0&&s.rightPressure<=1);
    assert.ok(s.governor.throttle>=.14&&s.governor.throttle<=.85);
  }
});

test('knife exposes mechanics quickly, briefly holds, then clears before governor segment',()=>{
  assert.equal(steamAtFrame(12).cut,0);
  assert.ok(steamAtFrame(55).cut>.35&&steamAtFrame(55).cut<1);
  assert.equal(steamAtFrame(90).cut,1);
  assert.equal(steamAtFrame(110).cut,1);
  assert.notEqual(steamAtFrame(95).pistonX,steamAtFrame(110).pistonX);
  assert.ok(steamAtFrame(130).cut>0&&steamAtFrame(130).cut<1);
  assert.equal(steamAtFrame(151).cut,0);
});

test('governor driven by crank since frame 0, deterministic under seeking',()=>{
  assert.equal(GOVERNOR_START_FRAME,0);
  assert.equal(steamAtFrame(0).theta,governorAtFrame(0).theta);
  assert.notEqual(governorAtFrame(30).spindlePhase,governorAtFrame(0).spindlePhase);
  assert.deepEqual(governorAtFrame(235),governorAtFrame(235));
  assert.equal(loadReliefAt(6),0);
  assert.ok(loadReliefAt(8.5)>.9);
  assert.equal(loadReliefAt(13),0);
});

test('unloading raises speed, balls lift sleeve, throttle closes, and governor recovers',()=>{
  const neutral=governorAtFrame(225);
  const rise=governorAtFrame(270);
  const peak=governorAtFrame(360);
  const recovered=governorAtFrame(510);
  assert.ok(rise.relativeSpeed>neutral.relativeSpeed+.40);
  assert.ok(peak.relativeSpeed>neutral.relativeSpeed+.64,
    'overspeed should be visually obvious, not a tiny wobble');
  assert.ok(rise.angle>neutral.angle+.35);
  assert.ok(peak.sleeveY>neutral.sleeveY+.70,
    'collar rise must be readable in a close-up');
  assert.ok(peak.throttle<neutral.throttle-.38);
  assert.ok(recovered.relativeSpeed<peak.relativeSpeed-.64);
  assert.ok(Math.abs(recovered.relativeSpeed-1)<.03);
  assert.ok(Math.abs(recovered.throttle-neutral.throttle)<.04);
  // Two equal upper and lower arms meet the ball and slide collar exactly.
  for(const sample of [neutral,rise,peak,recovered]){
    const radial=.88*Math.sin(sample.angle);
    const ballHeight=2.73-.88*Math.cos(sample.angle);
    const upper=Math.hypot(radial,2.73-ballHeight);
    const lower=Math.hypot(radial,ballHeight-sample.sleeveY);
    assert.ok(Math.abs(upper-.88)<1e-9);
    assert.ok(Math.abs(lower-.88)<1e-9);
    assert.ok(sample.angle>=.2 && sample.angle<=1.23);
  }
  assert.ok(Math.abs(neutral.angle-NOMINAL_ANGLE)<.001);
});

test('steam piston and governor spindle use shared integrated crank phase',()=>{
  const a=steamAtFrame(315),b=steamAtFrame(316);
  assert.ok(Math.abs(b.theta-a.theta-b.governor.omega/30)<.005);
  assert.notEqual(a.pistonX,b.pistonX);
  assert.notEqual(a.governor.spindlePhase,b.governor.spindlePhase);
});

test('bare cylinder has exactly two embedded side ports and no valve chest',()=>{
  const src=readFileSync(new URL('../animations/steam-engine/web/src/steam-engine.tsx',import.meta.url),'utf8');
  assert.match(src,/const CylinderPorts/);
  assert.match(src,/<CylinderPorts s=\{s\}\/>/);
  assert.doesNotMatch(src,/ValveAssembly|spoolX|valveLinkEnd|rockerAngle/);
  assert.match(src,/const GovernorThrottle/);
  assert.match(src,/const GovernorDrive/);
  for(const p of [INLET_PORT,EXHAUST_PORT]){
    assert.ok(p[0]>CYLINDER_LEFT&&p[0]<CYLINDER_RIGHT);
    assert.ok(Math.abs(Math.hypot(p[1],p[2])-1.10)<.01,
      'port must physically enter the cylinder surface (no detached fitting)');
  }
  assert.deepEqual(VALVE_TO_CYLINDER.at(-1),INLET_PORT);
  assert.deepEqual(CYLINDER_TO_EXHAUST[0],EXHAUST_PORT);
  assert.deepEqual(BOILER_TO_VALVE.at(-1),[THROTTLE_RIGHT,THROTTLE_Y,THROTTLE_Z]);
  assert.deepEqual(VALVE_TO_CYLINDER[0],[THROTTLE_LEFT,THROTTLE_Y,THROTTLE_Z]);
});

test('intake, outlet and exhaust pipes use continuous tangent-connected elbows',()=>{
  for(const points of [BOILER_TO_VALVE,VALVE_TO_CYLINDER,CYLINDER_TO_EXHAUST]){
    const sections=pipeSections(points,.25);
    assert.deepEqual(sections[0].start,points[0]);
    assert.deepEqual(sections.at(-1).end,points.at(-1));
    assert.ok(sections.some(s=>s.kind==='elbow'));
    for(let i=1;i<sections.length;i++){
      assert.deepEqual(sections[i-1].end,sections[i].start,
        'pipe joints must share EXACTLY matching 3D endpoints');
    }
    for(const part of sections){
      assert.ok(Math.hypot(...part.end.map((x,i)=>x-part.start[i]))>0);
    }
  }
});

test('flyball governor is raised directly over the brass throttle',()=>{
  assert.equal(GOV_X,THROTTLE_X);
  assert.equal(GOV_Z,THROTTLE_Z);
  assert.ok(GOV_PIVOT_Y>THROTTLE_Y+1.8);
  let stemLength=null;
  for(let frame=0;frame<600;frame++){
    const g=governorAtFrame(frame);
    const {collarPin,valvePin,gateBottom,gateTop,gateCenter}=throttleLinkage(g.sleeveY);
    assert.deepEqual([collarPin[0],collarPin[2]],[THROTTLE_X,THROTTLE_Z]);
    assert.deepEqual([valvePin[0],valvePin[2]],[THROTTLE_X,THROTTLE_Z]);
    assert.equal(collarPin[1],g.sleeveY+GOV_LIFT);
    assert.ok(Math.abs(gateTop[1]-gateBottom[1]-.70)<1e-12);
    assert.ok(Math.abs(gateCenter[1]-g.sleeveY-.32)<1e-12);
    const d=Math.hypot(...collarPin.map((v,i)=>v-valvePin[i]));
    if(stemLength===null)stemLength=d;
    assert.ok(Math.abs(d-stemLength)<1e-12,'straight stem may never telescope');
    const radial=.88*Math.sin(g.angle);
    const ballHeight=GOV_PIVOT_Y-.88*Math.cos(g.angle);
    assert.ok(Math.abs(Math.hypot(radial,ballHeight-(g.sleeveY+GOV_LIFT))-.88)<1e-9);
  }
  const normal=throttleLinkage(governorAtFrame(225).sleeveY);
  const high=throttleLinkage(governorAtFrame(360).sleeveY);
  assert.ok(normal.gateTop[1]<THROTTLE_Y-.02);
  assert.ok(high.gateBottom[1]<THROTTLE_Y-.12
    &&high.gateTop[1]>THROTTLE_Y+.12);
  assert.ok(high.gateCenter[1]>normal.gateCenter[1]+.70);
});

test('one stem replaces the former long side mechanism',()=>{
  const src=readFileSync(new URL('../animations/steam-engine/web/src/steam-engine.tsx',import.meta.url),'utf8');
  assert.match(src,/from=\{linkage\.collarPin\} to=\{linkage\.valvePin\}/);
  assert.match(src,/position=\{link\.gateCenter\}/);
  assert.doesNotMatch(src,/rockerAngle|valveLinkEnd|<ValveAssembly/);
  assert.doesNotMatch(src,/from=\{link\.valvePin\} to=\{link\.gateTop\}/);
  assert.match(src,/new THREE\.CurvePath<THREE\.Vector3>/);
  assert.match(src,/new THREE\.QuadraticBezierCurve3/);
});

test('brass and blue flow tubes both fade only while the cylinder is cut',()=>{
  for(let f=0;f<600;f++){
    const cut=steamAtFrame(f).cut;
    assert.ok(flowOpacity(cut)>=.31&&flowOpacity(cut)<=1);
    assert.equal(visibleArrowCount(cut),cut>.025?4:0);
    if(cut===0)assert.equal(flowOpacity(cut),1);
    if(cut===1)assert.ok(Math.abs(flowOpacity(cut)-.31)<1e-9);
  }
  assert.equal(visibleArrowCount(steamAtFrame(90).cut),4);
  assert.equal(visibleArrowCount(steamAtFrame(160).cut),0);
  const src=readFileSync(new URL('../animations/steam-engine/web/src/steam-engine.tsx',import.meta.url),'utf8');
  for(const path of ['BOILER_TO_VALVE','VALVE_TO_CYLINDER','CYLINDER_TO_EXHAUST']){
    assert.ok(src.includes('Pipe points={'+path+'}'));
  }
  assert.match(src,/curve\.getPointAt\(u\)/);
  assert.match(src,/curve\.getTangentAt\(u\)/);
  assert.match(src,/transparent=\{s\.cut>\.01\}/);
  assert.match(src,/data-visible-flow-arrows/);
});

test('real 3D arrows traverse true pipe paths with deterministic rhythmic phases',()=>{
  for(let id=0;id<3;id++){
    const points=[BOILER_TO_VALVE,VALVE_TO_CYLINDER,CYLINDER_TO_EXHAUST][id];
    const sections=pipeSections(points,.25);
    assert.deepEqual(sections[0].start,points[0]);
    assert.deepEqual(sections.at(-1).end,points.at(-1));
    for(let f=0;f<600;f++){
      const g=governorAtFrame(f),time=f/30;
      for(let i=0;i<4;i++){
        const phase=flowProgress(time,i,4,g.relativeSpeed,id);
        assert.ok(phase>=0&&phase<1);
        assert.equal(phase,flowProgress(time,i,4,g.relativeSpeed,id));
      }
    }
  }
  assert.notEqual(flowProgress(3,0,4,1,0),flowProgress(3.3,0,4,1,0));
  assert.notEqual(flowProgress(3,0,4,1,0),flowProgress(3,0,4,1,2));
});

test('camera genuinely orbits in yaw AND pitch, rather than translating alone',()=>{
  const start=cameraPose(.25),cylinder=cameraPose(2.1);
  const governor=cameraPose(8.5),valve=cameraPose(14.1);
  const degrees=(x)=>x*180/Math.PI;
  assert.ok(degrees(Math.abs(governor.azimuth-start.azimuth))>45);
  assert.ok(degrees(Math.abs(governor.elevation-start.elevation))>7);
  assert.ok(degrees(Math.abs(valve.azimuth-governor.azimuth))>12);
  assert.ok(degrees(Math.abs(cylinder.azimuth-start.azimuth))>9);
  for(const t of [0,2,5,6,8,10,13.8]){
    const pose=cameraPose(t);
    const distance=Math.hypot(...pose.eye.map((x,i)=>x-pose.target[i]));
    assert.ok(distance>11&&distance<15);
    assert.ok(pose.zoom>=85&&pose.zoom<=191);
    assert.deepEqual(cameraPose(t),pose);
  }
});

test('teaching callouts never chase spinning flyweights or flywheel spokes',()=>{
  const src=readFileSync(new URL('../animations/steam-engine/web/src/steam-engine.tsx',import.meta.url),'utf8');
  const anchors=src.slice(src.indexOf('const anchoredPoint ='),
    src.indexOf('const projectOnCanvas ='));
  assert.ok(anchors.length>200);
  assert.match(anchors,/part==='balls'\) return \[GOV_X,GOV_PIVOT_Y/);
  assert.match(anchors,/part==='sleeve'\) return \[GOV_X,2\.9/);
  assert.doesNotMatch(anchors,/spindlePhase|Math\.sin|Math\.cos|\.governor\.angle/);
  assert.match(src,/Math\.max\(\.08,radial\)/,
    'a subtle visible orbit trace must expose changing flyball radius');
});

test('single gate valve and two separated colored pipes are the only steam accessories',()=>{
  const src=readFileSync(new URL('../animations/steam-engine/web/src/steam-engine.tsx',import.meta.url),'utf8');
  assert.match(src,/Pipe points=\{BOILER_TO_VALVE\}/);
  assert.match(src,/Pipe points=\{VALVE_TO_CYLINDER\}/);
  assert.match(src,/Pipe points=\{CYLINDER_TO_EXHAUST\}/);
  assert.match(src,/color="#c68a57"/);
  assert.match(src,/color="#63aabb"/);
  assert.doesNotMatch(src,/color="#91aebb"|color="#a2bbc6"|ValveAssembly/);
});
