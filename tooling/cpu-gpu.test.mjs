import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {
  DURATION,FPS,TASKS,TASK_CUBE_SIZE,CPU_CORES,GPU_LANES,stageAt,cameraAt,jobProgress,
  taskAt,taskPositions,completedCount,workingCount,sampleAt,
} from '../animations/cpu-gpu/web/src/model.ts';

test('one concrete 16-task workload with a purposeful camera timeline',async()=>{
  assert.equal(FPS,30);assert.equal(DURATION,600);
  assert.equal(TASKS,16);assert.equal(CPU_CORES,4);assert.equal(GPU_LANES,16);
  assert.equal(stageAt(40),'task');
  assert.equal(stageAt(190),'cpu');
  assert.equal(stageAt(356),'gpu');
  assert.equal(stageAt(535),'compare');
  assert.equal(cameraAt(50).focusX,0);
  assert.equal(cameraAt(170).focusX,-6.5);
  assert.equal(cameraAt(365).focusX,6.5);
  assert.equal(cameraAt(475).focusX,0);
  assert.ok(cameraAt(540).zoom<cameraAt(170).zoom);
  assert.ok(sampleAt(15).dyed<sampleAt(61).dyed);
  const {corePosition,lidOpening}=await import('../animations/cpu-gpu/web/src/model.ts');
  assert.equal(corePosition('cpu',0)[0],corePosition('cpu',2)[0]);
  assert.notEqual(corePosition('cpu',0)[0],corePosition('cpu',1)[0]);
  assert.notEqual(corePosition('cpu',0)[2],corePosition('cpu',2)[2]);
  assert.ok(corePosition('gpu',0)[0]<corePosition('gpu',1)[0]);
  assert.equal(lidOpening(80,'cpu'),0);
  assert.equal(lidOpening(130,'cpu'),1);
  assert.equal(lidOpening(293,'gpu'),0);
  assert.equal(lidOpening(334,'gpu'),1);
});

test('every task has a physical source -> processor -> destination',()=>{
  const input=taskPositions('cpu',0).input;
  const work=taskPositions('cpu',0).processor;
  const out=taskPositions('cpu',0).output;
  assert.ok(input[0]<work[0]&&work[0]<out[0]);
  assert.equal(taskAt(90,'cpu',0).phase,'waiting');
  assert.equal(taskAt(134,'cpu',0).phase,'entering');
  assert.equal(taskAt(146,'cpu',0).phase,'processing');
  assert.equal(taskAt(154,'cpu',0).phase,'leaving');
  assert.equal(taskAt(165,'cpu',0).phase,'done');
  assert.ok(taskAt(146,'cpu',0).dyed>.1);
  const cpuA=taskPositions('cpu',0).output;
  const cpuB=taskPositions('cpu',4).output;
  assert.ok(cpuB[0]-cpuA[0]>TASK_CUBE_SIZE+.15,'output cubes must not merge into bars');
  const gpuA=taskPositions('gpu',0).output;
  const gpuB=taskPositions('gpu',1).output;
  assert.ok(gpuB[0]-gpuA[0]>TASK_CUBE_SIZE+.15,'GPU outputs must be individually readable');
  assert.equal(taskAt(165,'cpu',0).dyed,1);
  assert.ok(Math.abs(taskAt(90,'cpu',0).point[0]-input[0])<.01);
  assert.ok(Math.abs(taskAt(165,'cpu',0).point[0]-out[0])<.01);
});

test('CPU batches four; GPU handles all sixteen at once; comparison replays the same task count',()=>{
  assert.equal(workingCount(140,'cpu'),4);
  assert.equal(workingCount(140,'gpu'),0);
  assert.equal(completedCount(164,'cpu'),4);
  assert.equal(completedCount(280,'cpu'),16);
  assert.equal(workingCount(352,'gpu'),16);
  assert.equal(completedCount(380,'gpu'),16);
  assert.equal(completedCount(430,'cpu'),0);
  assert.equal(completedCount(430,'gpu'),0);
  assert.ok(jobProgress(530,'gpu',0)>jobProgress(530,'cpu',15));
  assert.equal(completedCount(530,'gpu'),16);
  assert.ok(completedCount(530,'cpu')<16);
  assert.equal(completedCount(599,'cpu'),16);
  assert.equal(completedCount(599,'gpu'),16);
});

test('native WebGL scene has actual moving input and output task cubes, no media',()=>{
  const root=resolve(import.meta.dirname,'..');
  const read=p=>readFileSync(resolve(root,p),'utf8');
  const src=read('animations/cpu-gpu/web/src/cpu-gpu.tsx');
  const cat=read('apps/portal/src/catalog.ts');
  assert.match(src,/ThreeCanvas/);
  assert.match(src,/useCurrentFrame/);
  assert.match(src,/data-renderer="react-threejs-webgl"/);
  assert.match(src,/<TaskCube/);
  assert.match(src,/<Package kind=\{kind\}/);
  assert.match(src,/<CpuDie frame=\{frame\}/);
  assert.match(src,/<GpuDie frame=\{frame\}/);
  assert.match(src,/<Lid kind=\{kind\}/);
  assert.match(src,/data-chip-design="package-with-exposed-silicon"/);
  assert.doesNotMatch(src,/pos=\{\[-2\.9,-\.453,0\]\}/,
    'old three conveyor plates must not return');
  assert.match(src,/taskAt\(frame,kind,index\)/);
  assert.match(src,/data-cpu-done/);
  assert.match(src,/data-gpu-done/);
  assert.doesNotMatch(src,/<video|\.mp4|<img|VideoTexture|ImageBitmap|ProgressBar|<Chart/);
  assert.equal([...src.matchAll(/<span>/g)].length,1,'one short caption at a time');
  assert.match(cat,/id: 'cpu-gpu'/);
  assert.match(cat,/durationInFrames: 600/);
  assert.match(read('apps/studio/src/root.tsx'),/projects\.map/);
});
