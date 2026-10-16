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
