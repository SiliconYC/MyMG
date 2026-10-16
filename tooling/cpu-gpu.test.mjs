import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {
  DURATION,FPS,TASKS,TASK_CUBE_SIZE,CPU_CORES,GPU_LANES,
  stageAt,cameraAt,jobProgress,taskAt,taskOpacity,taskScale,
  taskPositions,completedCount,workingCount,corePosition,
} from '../animations/cpu-gpu/web/src/model.ts';

test('the very first task starts moving at frame zero, and explains a real +1 job',()=>{
  assert.equal(FPS,30);assert.equal(DURATION,480);assert.equal(TASKS,16);
  assert.equal(CPU_CORES,4);assert.equal(GPU_LANES,16);
  assert.equal(stageAt(0),'task');
  assert.equal(stageAt(69),'task');
  assert.equal(stageAt(70),'cpu');
  assert.equal(stageAt(330),'gpu');
  assert.equal(stageAt(420),'compare');
  assert.equal(taskAt(0,'cpu',0).phase,'waiting');
  assert.equal(taskAt(8,'cpu',0).phase,'entering');
  assert.equal(taskAt(24,'cpu',0).phase,'processing');
  assert.equal(taskAt(50,'cpu',0).phase,'leaving');
  assert.equal(taskAt(64,'cpu',0).phase,'done');
  assert.ok(taskAt(34,'cpu',0).dyed>.5);
  assert.equal(taskAt(55,'cpu',0).dyed,1);
  assert.equal(completedCount(64,'cpu'),1);
  assert.equal(completedCount(80,'cpu'),1,
    'introduced blue result must remain visible, not disappear at CPU chapter');
  const p0=taskAt(0,'cpu',0).point;
  const p8=taskAt(8,'cpu',0).point;
  assert.ok(p8[0]>p0[0]+.2,'intro must have actual movement before frame 8');
  assert.equal(taskOpacity(0,'cpu',1),0);
  assert.equal(taskOpacity(78,'cpu',1),1);
  assert.ok(taskScale(0,'cpu',0)>taskScale(80,'cpu',0),
    'first cube is temporarily enlarged for visual explanation');
});

test('CPU continues through 15 remaining jobs in batches; GPU processes 16 in parallel',()=>{
  assert.equal(workingCount(90,'cpu'),3);
  assert.equal(completedCount(108,'cpu'),4);
  assert.equal(completedCount(146,'cpu'),8);
  assert.equal(completedCount(184,'cpu'),12);
  assert.equal(completedCount(222,'cpu'),16);
  assert.equal(workingCount(340,'gpu'),16);
  assert.equal(completedCount(357,'gpu'),16);
  assert.equal(completedCount(420,'gpu'),16);
  const cpuA=taskPositions('cpu',0).output,cpuB=taskPositions('cpu',4).output;
  const gpuA=taskPositions('gpu',0).output,gpuB=taskPositions('gpu',1).output;
  assert.ok(cpuB[0]-cpuA[0]>TASK_CUBE_SIZE+.15);
  assert.ok(gpuB[0]-gpuA[0]>TASK_CUBE_SIZE+.15);
  const source=taskPositions('cpu',0).input;
  const work=taskPositions('cpu',0).processor;
  const target=taskPositions('cpu',0).output;
  assert.ok(source[0]<work[0]&&work[0]<target[0]);
  assert.ok(corePosition('cpu',0)[1]<.4,
    'processing cube must descend into actual die top rather than float above it');
  assert.equal(corePosition('cpu',0)[0],corePosition('cpu',2)[0]);
  assert.notEqual(corePosition('cpu',0)[0],corePosition('cpu',1)[0]);
  assert.ok(corePosition('gpu',0)[0]<corePosition('gpu',1)[0]);
  for(let frame=1;frame<DURATION;frame++)
    for(const kind of ['cpu','gpu']){
      assert.ok(completedCount(frame,kind)>=completedCount(frame-1,kind));
      for(let index=0;index<TASKS;index++)
        assert.ok(jobProgress(frame,kind,index)>=jobProgress(frame-1,kind,index),
          'task must never reset at frame '+frame);
    }
});

test('one smoothly panning camera keeps whole packages visible',()=>{
  assert.equal(cameraAt(0).focusX,-8.4);
  assert.equal(cameraAt(190).focusX,-8.4);
  assert.equal(cameraAt(350).focusX,8.4);
  assert.ok(Math.abs(cameraAt(479).focusX)<.00001);
  for(let frame=0;frame<DURATION;frame++){
    const c=cameraAt(frame);
    assert.ok(c.zoom>=40&&c.zoom<=67);
    assert.ok(720/c.zoom>10.5);
    if(frame){
      const last=cameraAt(frame-1);
      assert.ok(Math.abs(c.focusX-last.focusX)<.5);
      assert.ok(Math.abs(c.zoom-last.zoom)<.6);
    }
  }
});

test('the top is a solid silicon slab with flush cores and no false cut-away lid',()=>{
  const root=resolve(import.meta.dirname,'..');
  const read=p=>readFileSync(resolve(root,p),'utf8');
  const src=read('animations/cpu-gpu/web/src/cpu-gpu.tsx');
  const cat=read('apps/portal/src/catalog.ts');
  assert.match(src,/ThreeCanvas/);
  assert.match(src,/useCurrentFrame/);
  assert.match(src,/data-renderer="react-threejs-webgl"/);
  assert.match(src,/data-chip-design="complete-silicon-top"/);
  assert.match(src,/data-intro-task-progress/);
  assert.match(src,/data-intro-task-dyed/);
  assert.match(src,/<Package kind=\{kind\}/);
  assert.match(src,/<CpuDie frame=\{frame\}/);
  assert.match(src,/<GpuDie frame=\{frame\}/);
  assert.match(src,/size=\{\[5\.53,\.30,5\.53\]\}/,
    'central die must be a continuous, solid block');
  assert.match(src,/size=\{\[5\.37,\.028,5\.37\]\}/,
    'continuous top surface must cover die');
  assert.match(src,/taskOpacity\(frame,kind,index\)/);
  assert.match(src,/每筆數據加 1/);
  assert.doesNotMatch(src,/const Lid:|<Lid |lidOpening|lidScale|const Intro:|const appear=smooth/);
  assert.doesNotMatch(src,/<video|\.mp4|<img|VideoTexture|ImageBitmap|ProgressBar|<Chart/);
  assert.equal([...src.matchAll(/<span>/g)].length,1,'one focused task explanation');
  assert.match(cat,/id: 'cpu-gpu'/);
  assert.match(cat,/durationInFrames: 480/);
  assert.match(read('apps/studio/src/root.tsx'),/projects\.map/);
});
