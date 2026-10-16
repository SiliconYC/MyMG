import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {
  DURATION,FPS,CPU_CORES,GPU_LANES,OUTPUT_TILES,
  stageAt,uniformProgress,branchProgress,laneActive,laneBranch,cpuActive,tileDone,
} from '../animations/cpu-gpu/web/src/model.ts';

test('CPU/GPU deterministic 630-frame model preserves independent stages',()=>{
  assert.equal(DURATION,630);assert.equal(FPS,30);
  assert.equal(CPU_CORES,4);assert.equal(GPU_LANES,80);assert.equal(OUTPUT_TILES,40);
  assert.equal(stageAt(0),'reveal');
  assert.equal(stageAt(140),'uniform');
  assert.equal(stageAt(390),'branch');
  assert.equal(stageAt(570),'compare');
});

test('identical work reaches GPU outputs well ahead of CPU',()=>{
  assert.equal(uniformProgress(0).cpu,0);
  assert.equal(uniformProgress(0).gpu,0);
  assert.ok(uniformProgress(135).gpu>uniformProgress(135).cpu*3);
  assert.equal(uniformProgress(150).gpu,1);
  assert.ok(uniformProgress(150).cpu<.3);
  assert.equal(uniformProgress(290).cpu,1);
  assert.equal([...Array(40).keys()].filter(i=>tileDone(150,i,'gpu')).length,40);
  assert.ok([...Array(40).keys()].filter(i=>tileDone(150,i,'cpu')).length<12);
});

test('different branch paths occupy CPU cores independently but split GPU lanes',()=>{
  assert.equal(laneBranch(0),0);assert.equal(laneBranch(1),1);
  assert.equal([ ...Array(80).keys()].filter(i=>laneActive(354,i)).length,40);
  assert.ok([ ...Array(4).keys()].every(i=>cpuActive(354,i)));
  assert.ok(branchProgress(404).cpu>branchProgress(404).gpu);
  assert.equal(branchProgress(514).cpu,1);
  assert.equal(branchProgress(514).gpu,1);
});

test('CPU GPU is a native geometry scene registered in the one Studio catalog',()=>{
  const root=resolve(import.meta.dirname,'..');
  const read=p=>readFileSync(resolve(root,p),'utf8');
  const src=read('animations/cpu-gpu/web/src/cpu-gpu.tsx');
  const cat=read('apps/portal/src/catalog.ts');
  assert.match(src,/ThreeCanvas/);assert.match(src,/useCurrentFrame/);
  assert.match(src,/data-renderer="react-threejs-webgl"/);
  assert.doesNotMatch(src,/<video|\.mp4|<img|<image|VideoTexture|ImageBitmap/);
  assert.match(cat,/id: 'cpu-gpu'/);
  assert.match(cat,/component: CpuGpuScene/);
  assert.match(read('apps/studio/src/root.tsx'),/projects\.map/);
});
