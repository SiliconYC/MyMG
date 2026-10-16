import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {
  cameraAt,cycleAt,captionAt,DURATION,FPS,START,CYCLE,COUNT,END,
} from '../animations/automatic-fire/web/src/automatic-model.ts';

test('a continuous held trigger drives four distinct, complete visual cycles',()=>{
  assert.equal(FPS,30);
  assert.equal(DURATION,720);
  assert.equal(COUNT,4);
  assert.equal(END-START,4*CYCLE);
  for(let f=0;f<DURATION;f++){
    const s=cycleAt(f),c=cameraAt(f);
    assert.ok([...c.position,...c.target,c.zoom,s.trigger,s.shell,
      s.recoil,s.reveal,s.feed,s.flash].every(Number.isFinite),String(f));
    assert.ok(s.recoil>=0&&s.recoil<=1.38);
    assert.ok(s.reveal>=0&&s.reveal<=1);
    assert.ok(s.shell>=0&&s.shell<=1);
    assert.ok(s.trigger>=0&&s.trigger<=1);
  }
  assert.equal(cycleAt(100).active,false);
  assert.ok(cycleAt(110).reveal>0);
  assert.ok(cycleAt(170).trigger>.9);
  for(let i=0;i<COUNT;i++){
    const start=START+i*CYCLE;
    assert.equal(cycleAt(start+6).cycleIndex,i);
    assert.equal(cycleAt(start+6).active,true);
    assert.ok(cycleAt(start+39).recoil>1.25,'bolt retreats '+i);
    assert.ok(cycleAt(start+87).recoil<.05,'bolt returns '+i);
    assert.ok(cycleAt(start+87).feed>.95,'feeding done '+i);
    assert.ok(cycleAt(start+6).trigger>.9,'no repeated trigger press '+i);
    assert.ok(cycleAt(start+34).ejection>=0,'spent casing departs '+i);
  }
  assert.equal(cycleAt(END+5).active,false);
  assert.ok(cycleAt(689).shell>.8);
  assert.ok(cycleAt(700).trigger<.05);
});
test('real cinematography: broad hero, receiver closeup, tracked orbit, end match',()=>{
  const opening=cameraAt(0),close=cameraAt(350),end=cameraAt(DURATION-1);
  assert.deepEqual(end,opening);
  assert.ok(close.zoom>opening.zoom*1.75);
  assert.ok(Math.hypot(...opening.position.map((n,i)=>n-close.position[i]))>11);
  assert.ok(Math.abs(cameraAt(350).position[0]-cameraAt(440).position[0])>3);
  assert.ok(Math.hypot(...cameraAt(718).position.map((n,i)=>n-end.position[i]))<.01);
  assert.ok(captionAt(236).text.includes('槍機'));
  assert.equal(captionAt(110).text,'');
});
test('custom Three.js bevelled geometry, semantic parts and shared portal',()=>{
  const root=resolve(import.meta.dirname,'..');
  const src=readFileSync(resolve(root,'animations/automatic-fire/web/src/automatic-fire.tsx'),'utf8');
  const cat=readFileSync(resolve(root,'apps/portal/src/catalog.ts'),'utf8');
  for(const token of ['ThreeCanvas','useCurrentFrame','useThree','RoundedBoxGeometry',
    'ExtrudeGeometry','Buttstock','Handguard','Receiver','Spring','Internals','CameraDirector',
    'Silhouette','data-camera-zoom','data-plate'])
    assert.ok(src.includes(token),'missing '+token);
  assert.match(src,/data-renderer="react-threejs-webgl"/);
  assert.doesNotMatch(src,/<video|\.mp4|<img|<image|VideoTexture|ImageBitmap/i);
  assert.match(cat,/id: 'automatic-fire'/);
  assert.match(cat,/component: AutomaticFireScene/);
});
