import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {cameraAt,cycleAt,captionAt,DURATION,FPS,START,CYCLE,END} from
  '../animations/automatic-fire/web/src/automatic-model.ts';

test('720 deterministic frames: four automatic visual cycles with one held trigger',()=>{
  assert.equal(FPS,30);assert.equal(DURATION,720);
  assert.equal(END-START,4*CYCLE);
  for(let f=0;f<DURATION;f++){
    const s=cycleAt(f),c=cameraAt(f);
    assert.ok([s.trigger,s.shell,s.recoil,s.feed,s.flash,...c.position,...c.target]
      .every(Number.isFinite), 'finite at '+f);
    assert.ok(s.shell>=0&&s.shell<=1);
    assert.ok(s.trigger>=0&&s.trigger<=1);
    assert.ok(s.feed>=0&&s.feed<=1);
    assert.ok(s.recoil>=0&&s.recoil<=1.63);
  }
  assert.ok(cycleAt(139).trigger>.9);
  for(let i=0;i<4;i++){
    const start=START+i*CYCLE;
    assert.equal(cycleAt(start+4).cycleIndex,i);
    assert.ok(cycleAt(start+46).recoil>1.4);
    assert.ok(cycleAt(start+96).recoil<.3);
    assert.ok(cycleAt(start+46).ejection>=0);
    assert.ok(cycleAt(start+92).feed>.9);
    assert.ok(cycleAt(start+4).trigger>.9);
  }
  assert.equal(cycleAt(END+12).active,false);
});
test('camera travels significantly, returns to opening shot without discontinuity',()=>{
  const a=cameraAt(0),b=cameraAt(380),end=cameraAt(719);
  assert.ok(Math.hypot(...a.position.map((x,i)=>x-b.position[i]))>9);
  assert.deepEqual(a,end);
  assert.ok(Math.hypot(...cameraAt(719).position.map((x,i)=>x-cameraAt(718).position[i]))<.01);
  assert.ok(captionAt(192).text.length>0);
  assert.equal(captionAt(100).text,'');
});
test('native original Three scene, shared portal catalog, no media substitutions',()=>{
  const root=resolve(import.meta.dirname,'..');
  const source=readFileSync(resolve(root,'animations/automatic-fire/web/src/automatic-fire.tsx'),'utf8');
  const catalog=readFileSync(resolve(root,'apps/portal/src/catalog.ts'),'utf8');
  assert.match(source,/ThreeCanvas/);
  assert.match(source,/useCurrentFrame/);
  assert.match(source,/useThree/);
  assert.match(source,/data-renderer="react-threejs-webgl"/);
  assert.doesNotMatch(source,/<video|\.mp4|<img|VideoTexture|<image/i);
  assert.match(catalog,/id: 'automatic-fire'/);
  assert.match(catalog,/component: AutomaticFireScene/);
});
