import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {
  DURATION,FPS,CPU_CORES,GPU_LANES,
  stageAt,cameraAt,cpuActivity,gpuActivity,cpuActiveCount,gpuActiveCount,
} from '../animations/cpu-gpu/web/src/model.ts';

test('three calm camera beats with deterministic timing',()=>{
  assert.equal(FPS,30);
  assert.equal(DURATION,450);
  assert.equal(CPU_CORES,4);
  assert.equal(GPU_LANES,64);
  assert.equal(stageAt(0),'cpu');
  assert.equal(stageAt(200),'gpu');
  assert.equal(stageAt(350),'compare');
  assert.equal(cameraAt(70).focusX,-5.4);
  assert.equal(cameraAt(210).focusX,5.4);
  assert.ok(Math.abs(cameraAt(350).focusX)<.0001);
  assert.ok(cameraAt(70).zoom>cameraAt(350).zoom);
});

test('CPU cores take different turns; GPU lanes operate in one synchronous wave',()=>{
  assert.ok(cpuActivity(70,2)>.5);
  assert.equal(cpuActiveCount(70),1);
  assert.equal(gpuActiveCount(70),0);
  assert.equal(gpuActiveCount(200),64);
  assert.equal(gpuActiveCount(185),0);
  assert.equal(gpuActivity(200),gpuActivity(200));
  assert.equal(cpuActiveCount(350),1);
  assert.ok(gpuActivity(350)>0);
});

test('native geometry with almost no in-frame text; no old dashboard',()=>{
  const root=resolve(import.meta.dirname,'..');
  const read=p=>readFileSync(resolve(root,p),'utf8');
  const src=read('animations/cpu-gpu/web/src/cpu-gpu.tsx');
  const catalog=read('apps/portal/src/catalog.ts');
  assert.match(src,/ThreeCanvas/);
  assert.match(src,/useCurrentFrame/);
  assert.match(src,/data-renderer="react-threejs-webgl"/);
  assert.doesNotMatch(src,/<video|\.mp4|<img|VideoTexture|ImageBitmap|ProgressBar|<Chart/);
  const labels=[...src.matchAll(/<span\s+style=/g)];
  assert.equal(labels.length,4,'only CPU/GPU overlay labels, no informational cards');
  assert.match(catalog,/id: 'cpu-gpu'/);
  assert.match(catalog,/durationInFrames: 450/);
  assert.match(read('apps/studio/src/root.tsx'),/projects\.map/);
});
