import {test} from 'node:test';
import assert from 'node:assert/strict';
import {arrival,cameraZoom,clamp01,easeOutCubic,smoothstep} from '../packages/mg/src/timing.ts';

test('pure bounded easing',()=>{
  assert.equal(clamp01(-5),0);
  assert.equal(clamp01(5),1);
  for(let n=0;n<=100;n++){
    const x=n/100;
    for(const y of [smoothstep(x),easeOutCubic(x)])assert.ok(y>=0&&y<=1);
  }
  assert.equal(easeOutCubic(.5),easeOutCubic(.5));
});
test('staggered arrivals become fully stationary',()=>{
  assert.equal(arrival(0,12,10),0);
  assert.equal(arrival(22,12,10),1);
  assert.equal(arrival(120,12,10),1);
  assert.ok(arrival(17,12,10)>0);
  assert.throws(()=>arrival(10,0,0));
});
test('camera holds still outside scheduled movement',()=>{
  assert.equal(cameraZoom(-100,30,50,65,110),65);
  assert.equal(cameraZoom(29,30,50,65,110),65);
  assert.equal(cameraZoom(50,30,50,65,110),110);
  assert.equal(cameraZoom(500,30,50,65,110),110);
  assert.throws(()=>cameraZoom(2,10,8,20,30));
});
