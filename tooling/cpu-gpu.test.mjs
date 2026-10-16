import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {
  DURATION,FPS,TASKS,TASK_CUBE_SIZE,CPU_CORES,GPU_LANES,
  GENERIC_X,CENTER,CHIP_HALF,GRID_STEP,INPUT_X,
  stageAt,cameraAt,jobProgress,taskAt,taskPositions,
  completedCount,workingCount,corePosition,exampleAt,flowAt,
} from '../animations/cpu-gpu/web/src/model.ts';

test('neutral computation is independent of CPU/GPU and happens above an exposed tile',()=>{
  assert.equal(FPS,30);
  assert.equal(DURATION,420);
  assert.equal(TASKS,16);
  assert.equal(CPU_CORES,4);
  assert.equal(GPU_LANES,16);
  assert.equal(stageAt(0),'task');
  assert.equal(stageAt(70),'task');
  assert.equal(stageAt(125),'cpu');
  assert.equal(stageAt(280),'gpu');
  assert.equal(stageAt(380),'compare');
  assert.equal(exampleAt(0).phase,'waiting');
  assert.equal(exampleAt(8).phase,'entering');
  assert.equal(exampleAt(24).phase,'processing');
  assert.equal(exampleAt(48).phase,'leaving');
  assert.equal(exampleAt(60).phase,'done');
  assert.ok(exampleAt(8).point[0]>exampleAt(0).point[0]+.1);
  assert.ok(exampleAt(30).dyed>.2);
  assert.equal(exampleAt(60).dyed,1);
  assert.equal(exampleAt(100).phase,'done');
  assert.ok(Math.abs(exampleAt(100).point[1]-.16)<1e-9);
  assert.ok(exampleAt(35).point[1]-.20*(
    1-exampleAt(35).coreScale)/.59>.12,
    'generic task should be above opaque tile, not submerged in a box');
  assert.equal(completedCount(80,'cpu'),0);
  assert.equal(completedCount(80,'gpu'),0);
  assert.ok(CENTER.cpu-GENERIC_X>9);
  assert.ok(CENTER.cpu+INPUT_X-GENERIC_X>1280/(2*cameraAt(0).zoom)+.8);
});

test('one function describes both generic and processor task motion',()=>{
  const first=exampleAt(30);
  const generic=flowAt(.5,[-2.55,.16,0],[0,.43,0],[2.55,.16,0]);
  assert.deepEqual(first,generic);
  const source=taskPositions('cpu',0);
  const cpuMid=taskAt(117,'cpu',0);
  const same=flowAt(.5,source.input,source.processor,source.output);
  assert.deepEqual(cpuMid,same);
  assert.equal(taskAt(117,'cpu',0).phase,'processing');
  assert.ok(corePosition('cpu',0)[0]!==corePosition('cpu',1)[0]);
  assert.ok(corePosition('gpu',0)[0]<corePosition('gpu',1)[0]);
});

test('CPU batches four and GPU processes sixteen simultaneously without resetting',()=>{
  assert.equal(workingCount(110,'cpu'),4);
  assert.equal(completedCount(133,'cpu'),4);
  assert.equal(completedCount(167,'cpu'),8);
  assert.equal(completedCount(201,'cpu'),12);
  assert.equal(completedCount(235,'cpu'),16);
  assert.equal(workingCount(293,'gpu'),16);
  assert.equal(completedCount(322,'gpu'),16);
  assert.equal(completedCount(419,'cpu'),16);
  assert.equal(completedCount(419,'gpu'),16);
  for(let frame=1;frame<DURATION;frame++){
    for(const kind of ['cpu','gpu']){
      assert.ok(completedCount(frame,kind)>=completedCount(frame-1,kind));
      for(let i=0;i<TASKS;i++)
        assert.ok(jobProgress(frame,kind,i)>=jobProgress(frame-1,kind,i));
    }
  }
});

test('both 4×4 queues/results remain distinctly separated from chips',()=>{
  for(const kind of ['cpu','gpu']){
    const firstIn=taskPositions(kind,0).input;
    const firstOut=taskPositions(kind,0).output;
    const lastIn=taskPositions(kind,15).input;
    const lastOut=taskPositions(kind,15).output;
    assert.ok(firstIn[0]<-CHIP_HALF-1.7);
    assert.ok(firstOut[0]>CHIP_HALF+1.7);
    assert.ok(lastIn[0]<-CHIP_HALF-1.5);
    assert.ok(lastOut[0]>CHIP_HALF+3.8);
    assert.ok(lastOut[0]-firstOut[0]>2*GRID_STEP);
    assert.equal(firstIn[1],.10);
    assert.equal(firstOut[1],.10);
    const items=Array.from({length:TASKS},(_,i)=>taskPositions(kind,i));
    assert.equal(new Set(items.map(x=>x.input.join(','))).size,16);
    assert.equal(new Set(items.map(x=>x.output.join(','))).size,16);
    for(let i=0;i<TASKS;i++){
      const completed=taskAt(419,kind,i);
      assert.equal(completed.phase,'done');
      for(let axis=0;axis<3;axis++)
        assert.ok(Math.abs(completed.point[axis]-items[i].output[axis])<1e-9);
      assert.equal(completed.dyed,1);
    }
  }
  assert.ok(TASK_CUBE_SIZE<GRID_STEP);
});

test('cinematic real-3D orbital camera with a fast, eased CPU→GPU transition',()=>{
  assert.equal(cameraAt(0).focusX,GENERIC_X);
  assert.ok(Math.abs(cameraAt(100).focusX-CENTER.cpu)<1e-9);
  assert.ok(Math.abs(cameraAt(269).focusX-CENTER.gpu)<1e-9);
  assert.ok(Math.abs(cameraAt(419).focusX)<1e-9);
  assert.ok(Math.abs(cameraAt(237).focusX-CENTER.cpu)<1e-9);
  assert.ok(Math.abs(cameraAt(266).focusX-CENTER.gpu)<1e-9);
  assert.ok(Math.abs(cameraAt(237).yaw-cameraAt(266).yaw)>.50,
    'a real 3D orbit must turn during CPU-to-GPU, not just pan');
  assert.ok(Math.abs(cameraAt(237).pitch-cameraAt(266).pitch)>.17,
    'must change camera elevation, not only translate/zoom');
  assert.ok(Math.abs(cameraAt(100).yaw-cameraAt(0).yaw)>.40);
  assert.ok(Math.abs(cameraAt(0).yaw-cameraAt(281).yaw)>.60);
  let maxDx=0,maxDyaw=0,maxDpitch=0;
  for(let f=1;f<DURATION;f++){
    const a=cameraAt(f-1),b=cameraAt(f);
    maxDx=Math.max(maxDx,Math.abs(b.focusX-a.focusX));
    maxDyaw=Math.max(maxDyaw,Math.abs(b.yaw-a.yaw));
    maxDpitch=Math.max(maxDpitch,Math.abs(b.pitch-a.pitch));
    assert.ok(Math.abs(b.focusX-a.focusX)<1.4,'camera teleported at '+f);
    assert.ok(Math.abs(b.zoom-a.zoom)<1.5,'camera zoom snapped at '+f);
    assert.ok(Math.abs(b.yaw-a.yaw)<.08,'camera yaw snapped at '+f);
    assert.ok(Math.abs(b.pitch-a.pitch)<.02,'camera elevation snapped at '+f);
    assert.ok(b.zoom>=35&&b.zoom<=80);
    assert.ok(720/b.zoom>9);
  }
  assert.ok(maxDx>.6,'camera move still too uniform/slow');
  assert.ok(maxDyaw>.02,'rotation does not visibly move');
  assert.ok(maxDpitch>.005,'pitch does not visibly move');
  assert.ok(1280/cameraAt(419).zoom>36);
});

test('WebGL neutral cell is opaque and shares physical task motion with the cores',()=>{
  const root=resolve(import.meta.dirname,'..');
  const read=p=>readFileSync(resolve(root,p),'utf8');
  const scene=read('animations/cpu-gpu/web/src/cpu-gpu.tsx');
  const catalog=read('apps/portal/src/catalog.ts');
  assert.match(scene,/<GenericArithmeticUnit frame=\{frame\}/);
  assert.match(scene,/exampleAt\(frame\)/);
  assert.match(scene,/coreScale/);
  assert.doesNotMatch(scene,/size=\{\[1\.96,\.71,1\.96\]\}|opacity=\{\.68\}/,
    'original translucent box submerged tasks');
  assert.match(scene,/<JobStations\/>/);
  assert.match(scene,/data-renderer="react-threejs-webgl"/);
  assert.match(scene,/data-camera-yaw/);
  assert.match(scene,/data-camera-pitch/);
  assert.match(scene,/Math\.sin\(yaw\)/);
  assert.match(scene,/Math\.sin\(pitch\)/);
  assert.match(scene,/ThreeCanvas/);
  assert.match(scene,/useCurrentFrame/);
  assert.doesNotMatch(scene,/<video|\.mp4|<img|VideoTexture|ImageBitmap|ProgressBar|<Chart/);
  assert.equal([...scene.matchAll(/<span>/g)].length,1);
  assert.match(catalog,/id: 'cpu-gpu'/);
  assert.match(catalog,/durationInFrames: 420/);
  assert.match(read('apps/studio/src/root.tsx'),/projects\.map/);
});
