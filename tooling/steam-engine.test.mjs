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
  assert.match(src,/\[\[2\.52,4\.95,\-\.75\]/);
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
