import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {steamAtFrame,CRANK_X,CRANK_RADIUS,CONNECTING_ROD,
  PISTON_OFFSET,CYLINDER_LEFT,CYLINDER_RIGHT,DURATION} from
  '../animations/steam-engine/web/src/steam-model.ts';
import {governorAtFrame,GOVERNOR_START_FRAME,loadReliefAt,NOMINAL_ANGLE} from
  '../animations/steam-engine/web/src/governor-model.ts';

test('14-second runtime and crank / piston / connecting rod stay linked',()=>{
  assert.equal(DURATION,420);
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
  assert.ok(loadReliefAt(7)>.9);
  assert.equal(loadReliefAt(9),0);
});

test('unloading raises speed, balls lift sleeve, throttle closes, and governor recovers',()=>{
  const neutral=governorAtFrame(190);
  const rise=governorAtFrame(220);
  const peak=governorAtFrame(240);
  const recovered=governorAtFrame(350);
  assert.ok(rise.relativeSpeed>neutral.relativeSpeed+.20);
  assert.ok(rise.angle>neutral.angle+.15);
  assert.ok(peak.sleeveY>neutral.sleeveY+.35);
  assert.ok(peak.throttle<neutral.throttle-.3);
  assert.ok(recovered.relativeSpeed<peak.relativeSpeed-.20);
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
    assert.ok(sample.angle>=.2 && sample.angle<=1.15);
  }
  assert.ok(Math.abs(neutral.angle-NOMINAL_ANGLE)<.001);
});

test('steam piston and governor spindle use shared integrated crank phase',()=>{
  const a=steamAtFrame(224),b=steamAtFrame(225);
  assert.ok(Math.abs(b.theta-a.theta-b.governor.omega/30)<.005);
  assert.notEqual(a.pistonX,b.pistonX);
  assert.notEqual(a.governor.spindlePhase,b.governor.spindlePhase);
});

test('scene places governor beside flywheel and valve inline in feed, never isolated',()=>{
  const src=readFileSync(new URL('../animations/steam-engine/web/src/steam-engine.tsx',import.meta.url),'utf8');
  assert.match(src,/const GOV_X = 1\.72/);
  assert.match(src,/const THROTTLE_X = \.12/);
  assert.match(src,/const GovernorDrive/);
  assert.match(src,/const valveLinkEnd/);
  assert.match(src,/const GovernorThrottle/);
  assert.match(src,/\[\[2\.52,5\.50,\-\.75\]/);
  assert.doesNotMatch(src,/const GOV_X = 4\.82/);
  assert.doesNotMatch(src,/18\.2\)\/2\.1/);
});

test('steam delivery and exhaust are connected and teaching text is 3D-anchored',()=>{
  const src=readFileSync(new URL('../animations/steam-engine/web/src/steam-engine.tsx',import.meta.url),'utf8');
  assert.match(src,/\[right,THROTTLE_Y,THROTTLE_Z\]/);
  assert.match(src,/\[left,THROTTLE_Y,THROTTLE_Z\]/);
  assert.match(src,/cylinderGeometry args=\{\[\.175,\.175,\.56/);
  assert.match(src,/\[\-.38, 3\.12, \-.13\]/);
  assert.match(src,/const projectOnCanvas/);
  assert.match(src,/const TeachingCallout/);
  assert.match(src,/data-anchor-x/);
  assert.match(src,/cameraPose\(s\.time\)/);
  assert.match(src,/cameraPose\(t\)/);
  assert.doesNotMatch(src,/title:'转快，重锤张开'/);
});

import {pipeSections} from '../animations/steam-engine/web/src/pipe-path.ts';
import {cameraPose} from '../animations/steam-engine/web/src/camera-path.ts';

test('every steam inlet and exhaust elbow is tangent-connected without gaps',()=>{
  const paths=[
    [[2.52,5.50,-.75],[2.52,3.48,-.75],[2.20,2.81,-.53],
      [1.48,2.33,-.28],[.40,2.33,-.28]],
    [[-.16,2.33,-.28],[-1.86,2.33,-.28],[-2.12,2.44,-.10],
      [-2.12,2.08,-.10],[-1.65,1.86,-.10],[-1.65,1.62,-.10]],
    [[-1.16,1.65,-.13],[-1.16,2.13,-.13],[-.45,2.17,-.13],
      [-.38,2.43,-.13],[-.38,3.12,-.13]],
  ];
  for(const points of paths){
    const sections=pipeSections(points,.25);
    assert.deepEqual(sections[0].start,points[0]);
    assert.deepEqual(sections.at(-1).end,points.at(-1));
    assert.ok(sections.some(s=>s.kind==='elbow'));
    for(let i=1;i<sections.length;i++){
      assert.deepEqual(sections[i-1].end,sections[i].start,
        'Tube segments must share exactly identical 3D joint vertices');
    }
    for(const section of sections){
      assert.ok(Math.hypot(...section.start.map((x,i)=>x-section.end[i]))>0);
      if(section.kind==='elbow'){
        const entering=section.control.map((x,i)=>x-section.start[i]);
        const leaving=section.end.map((x,i)=>x-section.control[i]);
        assert.ok(Math.hypot(...entering)>0);
        assert.ok(Math.hypot(...leaving)>0);
      }
    }
  }
});

test('governor stands in front of intake pipe, supported by a longer axle and bed',()=>{
  const src=readFileSync(new URL('../animations/steam-engine/web/src/steam-engine.tsx',import.meta.url),'utf8');
  assert.match(src,/const GOV_Z = 1\.20/);
  assert.match(src,/from=\{\[CRANK_X, 0, -1\.02\]\} to=\{\[CRANK_X, 0, 1\.48\]\}/);
  assert.match(src,/boxGeometry args=\{\[8\.90, \.20, 3\.70\]\}/);
  assert.doesNotMatch(src,/new THREE\.CatmullRomCurve3/);
  assert.match(src,/new THREE\.CurvePath<THREE\.Vector3>/);
  assert.match(src,/new THREE\.QuadraticBezierCurve3/);
  // In this camera's forward (+z) direction, the flyweights stay well
  // ahead of the main steam pipes, including while spinning outward.
  assert.ok(1.20-.88 > -.28+.12);
});

test('camera genuinely orbits in yaw AND pitch, rather than translating alone',()=>{
  const start=cameraPose(.25),cylinder=cameraPose(2.1);
  const governor=cameraPose(6.1),valve=cameraPose(9.8);
  const degrees=(x)=>x*180/Math.PI;
  assert.ok(degrees(Math.abs(governor.azimuth-start.azimuth))>45);
  assert.ok(degrees(Math.abs(governor.elevation-start.elevation))>7);
  assert.ok(degrees(Math.abs(valve.azimuth-governor.azimuth))>12);
  assert.ok(degrees(Math.abs(cylinder.azimuth-start.azimuth))>9);
  for(const t of [0,2,5,6,8,10,13.8]){
    const pose=cameraPose(t);
    const distance=Math.hypot(...pose.eye.map((x,i)=>x-pose.target[i]));
    assert.ok(distance>11&&distance<15);
    assert.ok(pose.zoom>=85&&pose.zoom<=132);
    assert.deepEqual(cameraPose(t),pose);
  }
});
