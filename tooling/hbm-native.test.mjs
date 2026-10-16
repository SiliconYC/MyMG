import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {buildScene,cameraAt,modelTime,HBM_REFERENCE} from '../animations/hbm/web/src/mustard03-model.ts';
const root=resolve(import.meta.dirname,'..');
test('Mustard-03 native model tracks the exact Python 345-frame source clock',()=>{
  assert.equal(HBM_REFERENCE.FRAMES,345);
  assert.equal(HBM_REFERENCE.FPS,30);
  for(const [t,expected]of [[0,0],[2.25,1.5],[4.85,4.9],[7.45,8.25],[9.7,10.82],[11.5,11.12]]){
    assert.ok(Math.abs(modelTime(t)-expected)<1e-9,`wrong source clock at ${t}`);
  }
  assert.equal(modelTime(11.51),11.12);
});
test('Canonical 2:1 camera holds the original three exact lens positions',()=>{
  assert.deepEqual(cameraAt(2.7,false),HBM_REFERENCE.STUDIO);
  assert.deepEqual(cameraAt(6.8,false),HBM_REFERENCE.MACRO);
  assert.deepEqual(cameraAt(10.5,true),HBM_REFERENCE.WIDE);
});
test('All 345 frames produce deterministic live Three.js geometry; transitions have content',()=>{
  const counts=[0,30,67,129,165,224,273,316,344].map(f=>{
    const a=buildScene(f),b=buildScene(f);
    assert.deepEqual(a,b,`frame ${f} differs across calculations`);
    assert.ok(a.length>6,`incomplete frame ${f}`);
    assert.ok(a.some(p=>p.world?.length===4),`no original XYZ polygons on frame ${f}`);
    assert.ok(a.every(p=>Number.isFinite(p.opacity)&&p.opacity>0&&p.opacity<=1));
    assert.ok(a.every(p=>p.points.every(x=>Number.isFinite(x[0])&&Number.isFinite(x[1]))));
    return a.length;
  });
  assert.ok(new Set(counts).size>=4,`missing geometry stage changes: ${counts}`);
});
test('HBM runtime and Pages never load source MP4, video, or baked frame sequences',()=>{
  const portal=readFileSync(resolve(root,'apps/portal/src/portal.tsx'),'utf8');
  const native=readFileSync(resolve(root,'animations/hbm/web/src/mustard03-native.tsx'),'utf8');
  const model=readFileSync(resolve(root,'animations/hbm/web/src/mustard03-model.ts'),'utf8');
  const workflow=readFileSync(resolve(root,'.github/workflows/pages.yml'),'utf8');
  assert.doesNotMatch(portal,/<video|hbm-mustard03\\.mp4|hbm-python-original\\.mp4/);
  assert.doesNotMatch(native,/<video|\.mp4|\.png|\.jpg|VideoTexture/);
  assert.doesNotMatch(model,/\.mp4|\.png|\.jpg|VideoTexture/);
  assert.doesNotMatch(workflow,/render-hbm-master\.sh|ffmpeg|media\/hbm/);
  assert.match(native,/ThreeCanvas/);
  assert.match(native,/worldMode/);
});
