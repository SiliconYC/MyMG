import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {
  DURATION,FPS,TASKS,TASK_CUBE_SIZE,CPU_CORES,GPU_LANES,
  stageAt,cameraAt,jobProgress,taskAt,taskPositions,
  completedCount,workingCount,corePosition,lidOpening,lidScale,
} from '../animations/cpu-gpu/web/src/model.ts';

test('a single 16-second camera move never teleports, refocuses or over-zooms',()=>{
  assert.equal(FPS,30);assert.equal(DURATION,480);
  assert.equal(TASKS,16);assert.equal(CPU_CORES,4);assert.equal(GPU_LANES,16);
  assert.equal(stageAt(40),'task');
  assert.equal(stageAt(190),'cpu');
  assert.equal(stageAt(356),'gpu');
  assert.equal(stageAt(435),'compare');
  assert.equal(cameraAt(0).focusX,-8.4);
  assert.equal(cameraAt(190).focusX,-8.4);
  assert.equal(cameraAt(350).focusX,8.4);
  assert.ok(Math.abs(cameraAt(479).focusX)<.00001);
  // 720px / 67zoom >= 10.7 world units: chip side is only 6.55.
  for(let frame=0;frame<DURATION;frame++){
    const cam=cameraAt(frame);
    assert.ok(cam.zoom<=67 && cam.zoom>=40,'framing must contain the chip and lid');
    assert.ok(720/cam.zoom > 10.5,'top and bottom of package must fit');
    if(frame){
      const before=cameraAt(frame-1);
      assert.ok(Math.abs(cam.focusX-before.focusX)<.5,
        'a camera cut occurred at frame '+frame);
      assert.ok(Math.abs(cam.zoom-before.zoom)<.6,
        'a zoom cut occurred at frame '+frame);
    }
  }
});

test('silicon packages and raised lids remain continuous',()=>{
  assert.equal(corePosition('cpu',0)[0],corePosition('cpu',2)[0]);
  assert.notEqual(corePosition('cpu',0)[0],corePosition('cpu',1)[0]);
  assert.notEqual(corePosition('cpu',0)[2],corePosition('cpu',2)[2]);
  assert.ok(corePosition('gpu',0)[0]<corePosition('gpu',1)[0]);
  assert.equal(lidOpening(0,'cpu'),0);
  assert.ok(lidOpening(80,'cpu')>0&&lidOpening(80,'cpu')<1);
  assert.equal(lidOpening(101,'cpu'),1);
  assert.equal(lidOpening(291,'gpu'),0);
  assert.ok(lidOpening(314,'gpu')>0&&lidOpening(314,'gpu')<1);
  assert.equal(lidOpening(334,'gpu'),1);
  assert.equal(lidScale(120,'cpu'),0,'CPU metal lid must be gone when processing starts');
  assert.equal(lidScale(352,'gpu'),0,'GPU metal lid must be gone when processing starts');
  assert.ok(lidScale(79,'cpu')>0&&lidScale(79,'cpu')<1);
  for(let f=1;f<DURATION;f++)
    for(const kind of ['cpu','gpu'])
      assert.ok(lidOpening(f,kind)>=lidOpening(f-1,kind),
        'lid must never snap backwards');
});

test('each job flows source -> die -> result without reset at scene boundaries',()=>{
  const source=taskPositions('cpu',0).input;
  const processor=taskPositions('cpu',0).processor;
  const dest=taskPositions('cpu',0).output;
  assert.ok(source[0]<processor[0]&&processor[0]<dest[0]);
  assert.equal(taskAt(90,'cpu',0).phase,'waiting');
  assert.equal(taskAt(124,'cpu',0).phase,'entering');
  assert.equal(taskAt(135,'cpu',0).phase,'processing');
  assert.equal(taskAt(146,'cpu',0).phase,'leaving');
  assert.equal(taskAt(156,'cpu',0).phase,'done');
  assert.ok(taskAt(135,'cpu',0).dyed>.1);
  assert.equal(taskAt(156,'cpu',0).dyed,1);
  assert.ok(Math.abs(taskAt(90,'cpu',0).point[0]-source[0])<.01);
  assert.ok(Math.abs(taskAt(156,'cpu',0).point[0]-dest[0])<.01);
  const cpuA=taskPositions('cpu',0).output,cpuB=taskPositions('cpu',4).output;
  const gpuA=taskPositions('gpu',0).output,gpuB=taskPositions('gpu',1).output;
  assert.ok(cpuB[0]-cpuA[0]>TASK_CUBE_SIZE+.15);
  assert.ok(gpuB[0]-gpuA[0]>TASK_CUBE_SIZE+.15);
  assert.equal(workingCount(140,'cpu'),4);
  assert.equal(completedCount(164,'cpu'),4);
  assert.equal(completedCount(280,'cpu'),16);
  assert.equal(workingCount(352,'gpu'),16);
  assert.equal(completedCount(380,'gpu'),16);
  // Before this fix 424 instantly reset every task to gray/waiting.
  for(let f=1;f<DURATION;f++){
    for(const kind of ['cpu','gpu']){
      assert.ok(completedCount(f,kind)>=completedCount(f-1,kind),
        'completion counter fell at frame '+f+' for '+kind);
      for(let i=0;i<TASKS;i++)
        assert.ok(jobProgress(f,kind,i)>=jobProgress(f-1,kind,i),
          'task reset at frame '+f+' item '+i);
    }
  }
  assert.equal(completedCount(423,'gpu'),16);
  assert.equal(completedCount(424,'gpu'),16);
  assert.equal(completedCount(479,'cpu'),16);
  assert.equal(completedCount(479,'gpu'),16);
});

test('native scene stays mounted and does not pop, clear or use prerecorded media',()=>{
  const root=resolve(import.meta.dirname,'..');
  const read=p=>readFileSync(resolve(root,p),'utf8');
  const src=read('animations/cpu-gpu/web/src/cpu-gpu.tsx');
  const cat=read('apps/portal/src/catalog.ts');
  assert.match(src,/ThreeCanvas/);
  assert.match(src,/useCurrentFrame/);
  assert.match(src,/data-renderer="react-threejs-webgl"/);
  assert.match(src,/data-chip-design="package-with-exposed-silicon"/);
  assert.match(src,/data-camera-zoom/);
  assert.match(src,/data-cpu-lid-scale/);
  assert.match(src,/data-gpu-lid-scale/);
  assert.match(src,/scale=\{shrink\}/,'lid must physically clear the chip');
  assert.match(src,/<TaskCube/);
  assert.match(src,/<Package kind=\{kind\}/);
  assert.match(src,/<CpuDie frame=\{frame\}/);
  assert.match(src,/<GpuDie frame=\{frame\}/);
  assert.match(src,/<Lid kind=\{kind\}/);
  assert.doesNotMatch(src,/const appear=smooth|const Intro:React\.FC|if\(open>=\.998\)return null/,
    'chip, intro and lids must not suddenly appear or vanish');
  assert.doesNotMatch(src,/<video|\.mp4|<img|VideoTexture|ImageBitmap|ProgressBar|<Chart/);
  assert.equal([...src.matchAll(/<span>/g)].length,1);
  assert.match(cat,/id: 'cpu-gpu'/);
  assert.match(cat,/durationInFrames: 480/);
  assert.match(read('apps/studio/src/root.tsx'),/projects\.map/);
});
