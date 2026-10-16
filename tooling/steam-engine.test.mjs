import assert from 'node:assert/strict';
import {test} from 'node:test';
import {
  steamAtFrame, CRANK_X, CRANK_RADIUS, CONNECTING_ROD, PISTON_OFFSET,
  CYLINDER_LEFT, CYLINDER_RIGHT, DURATION,
} from '../animations/steam-engine/web/src/steam-model.ts';

test('every frame respects closed-form crank / connecting-rod geometry', () => {
  for (let frame=0; frame<DURATION; frame++) {
    const s=steamAtFrame(frame);
    assert.ok(Number.isFinite(s.pistonX));
    const distance=Math.hypot(s.pinX-s.crossheadX,s.pinY);
    assert.ok(Math.abs(distance-CONNECTING_ROD)<1e-9);
    assert.ok(Math.abs((s.crossheadX-s.pistonX)-PISTON_OFFSET)<1e-9);
    assert.ok(Math.abs(Math.hypot(s.pinX-CRANK_X,s.pinY)-CRANK_RADIUS)<1e-9);
    assert.ok(s.pistonX>.0+CYLINDER_LEFT && s.pistonX<CYLINDER_RIGHT-.20);
    assert.ok(s.cut>=0&&s.cut<=1);
    assert.ok(s.leftPressure>=0&&s.leftPressure<=1);
    assert.ok(s.rightPressure>=0&&s.rightPressure<=1);
  }
});

test('moving clip approaches, holds during moving piston, and retracts', () => {
  assert.equal(steamAtFrame(20).cut,0);
  assert.ok(steamAtFrame(95).cut>.35);
  assert.equal(steamAtFrame(170).cut,1);
  assert.equal(steamAtFrame(320).cut,1);
  assert.notEqual(steamAtFrame(170).pistonX,steamAtFrame(190).pistonX);
  assert.notEqual(steamAtFrame(170).theta,steamAtFrame(190).theta);
  assert.ok(steamAtFrame(400).cut>0 && steamAtFrame(400).cut<1);
  assert.equal(steamAtFrame(500).cut,0);
});

import {governorAtFrame, GOVERNOR_START_FRAME, loadReliefAt} from
  '../animations/steam-engine/web/src/governor-model.ts';

test('governor starts seamlessly and is frame-deterministic', () => {
  assert.equal(GOVERNOR_START_FRAME,540);
  assert.equal(steamAtFrame(540).theta,governorAtFrame(540).theta);
  assert.ok(Math.abs(steamAtFrame(541).theta-steamAtFrame(540).theta)<.15);
  assert.notEqual(governorAtFrame(10).spindlePhase,governorAtFrame(30).spindlePhase);
  assert.deepEqual(governorAtFrame(690),governorAtFrame(690));
  assert.equal(loadReliefAt(19),0);
  assert.ok(loadReliefAt(22)>.95);
  assert.equal(loadReliefAt(25),0);
});

test('load perturbation drives real negative feedback and recovery', () => {
  const idle=governorAtFrame(600);
  const rise=governorAtFrame(660);
  const response=governorAtFrame(680);
  const final=governorAtFrame(870);
  assert.ok(rise.relativeSpeed>idle.relativeSpeed+.20,
    'removing load must increase rotor angular velocity');
  assert.ok(rise.angle>idle.angle+.15,
    'centrifugal balls must open when speed rises');
  assert.ok(response.sleeveY>idle.sleeveY+.20,
    'upper and lower linkage must lift the sleeve');
  assert.ok(response.throttle<idle.throttle-.22,
    'lifted sleeve must close the steam admission valve');
  assert.ok(final.relativeSpeed<rise.relativeSpeed-.18,
    'steam restriction must reduce overspeed');
  assert.ok(Math.abs(final.relativeSpeed-1)<.04,
    'speed must settle toward the nominal value');
  assert.ok(Math.abs(final.throttle-idle.throttle)<.06,
    'valve must return toward its operating point');
});

test('governor angular speed drives BOTH crank/piston and governor rotation', () => {
  const a=steamAtFrame(654);
  const b=steamAtFrame(655);
  const fast=steamAtFrame(680);
  const recovered=steamAtFrame(870);
  assert.ok(Math.abs((b.theta-a.theta)-b.governor.omega/30)<.003);
  assert.ok(fast.governor.relativeSpeed>recovered.governor.relativeSpeed);
  assert.ok(fast.leftPressure <= 1.5 && fast.rightPressure <= 1.5);
  assert.notEqual(fast.governor.spindlePhase,recovered.governor.spindlePhase);
  assert.notEqual(fast.pistonX, recovered.pistonX);
});
