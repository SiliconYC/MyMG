import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {
  DURATION,FPS,TASKS,TASK_CUBE_SIZE,CPU_CORES,GPU_LANES,
  GENERIC_X,CENTER,CHIP_HALF,GRID_STEP,INPUT_X,
  stageAt,cameraAt,jobProgress,taskAt,taskPositions,
  completedCount,workingCount,corePosition,exampleAt,
} from '../animations/cpu-gpu/web/src/model.ts';

test('a standalone generic arithmetic unit exists BEFORE any CPU/GPU story',()=>{
  assert.equal(FPS,30);
  assert.equal(DURATION,480);
  assert.equal(TASKS,16);
  assert.equal(CPU_CORES,4);
  assert.equal(GPU_LANES,16);
  assert.equal(stageAt(0),'task');
  assert.equal(stageAt(70),'task');
  assert.equal(stageAt(125),'cpu');
  assert.equal(stageAt(330),'gpu');
  assert.equal(stageAt(450),'compare');
  assert.equal(exampleAt(0).phase,'waiting');
  assert.equal(exampleAt(8).phase,'entering');
  assert.equal(exampleAt(24).phase,'processing');
  assert.equal(exampleAt(48).phase,'leaving');
  assert.equal(exampleAt(60).phase,'done');
  assert.ok(exampleAt(8).point[0]>exampleAt(0).point[0]+.1);
  assert.ok(exampleAt(30).dyed>.2);
  assert.equal(exampleAt(60).dyed,1);
  assert.equal(exampleAt(100).phase,'done');
  assert.ok(Math.abs(exampleAt(100).point[1]-.16)<1e-9,
    'generic result cube must settle onto its finished pad');
  assert.equal(completedCount(80,'cpu'),0,'example is NOT a CPU task');
  assert.equal(completedCount(80,'gpu'),0,'example is NOT a GPU task');
  assert.ok(CENTER.cpu-GENERIC_X>9,'intro must not be geometrically inside CPU');
  assert.ok(CENTER.cpu+INPUT_X-GENERIC_X>1280/(2*cameraAt(0).zoom)+.8,
    'first frame must show only neutral calculator, not the CPU input grid');
});

test('CPU batches 4; GPU runs 16 in parallel; all results persist',()=>{
  assert.equal(workingCount(135,'cpu'),4);
  assert.equal(completedCount(155,'cpu'),4);
  assert.equal(completedCount(189,'cpu'),8);
  assert.equal(completedCount(223,'cpu'),12);
  assert.equal(completedCount(257,'cpu'),16);
  assert.equal(workingCount(340,'gpu'),16);
  assert.equal(completedCount(368,'gpu'),16);
  assert.equal(completedCount(470,'cpu'),16);
  assert.equal(completedCount(470,'gpu'),16);
  for(let frame=1;frame<DURATION;frame++){
    for(const kind of ['cpu','gpu']){
      assert.ok(completedCount(frame,kind)>=completedCount(frame-1,kind));
      for(let i=0;i<TASKS;i++)
        assert.ok(jobProgress(frame,kind,i)>=jobProgress(frame-1,kind,i));
    }
  }
});

test('both 4x4 input AND output grids stand distinctly outside silicon',()=>{
  for(const kind of ['cpu','gpu']){
    const firstIn=taskPositions(kind,0).input;
    const firstOut=taskPositions(kind,0).output;
    const lastIn=taskPositions(kind,15).input;
    const lastOut=taskPositions(kind,15).output;
    assert.ok(firstIn[0]<-CHIP_HALF-1.7,'inbox too near chip');
    assert.ok(firstOut[0]>CHIP_HALF+1.7,'results too near chip');
    assert.ok(lastIn[0]<-CHIP_HALF-1.5,'last input still on chip');
    assert.ok(lastOut[0]>CHIP_HALF+3.8,'last output still on chip');
    assert.ok(lastOut[0]-firstOut[0]>2*GRID_STEP);
    assert.equal(firstIn[1],.10,'input cubes should rest on input mat');
    assert.equal(firstOut[1],.10,'blue results should rest on output mat');
    assert.ok(lastOut[2]-firstOut[2]>2*GRID_STEP);
    const points=Array.from({length:TASKS},(_,i)=>taskPositions(kind,i));
    assert.equal(new Set(points.map(p=>p.input.join(','))).size,16);
    assert.equal(new Set(points.map(p=>p.output.join(','))).size,16);
    for(const p of points){
      assert.ok(p.output[0]-p.processor[0]>3.5,
        'result must travel a clearly noticeable distance out of chip');
    }
    for(let i=0;i<TASKS;i++){
      const final=taskAt(470,kind,i);
      assert.equal(final.phase,'done');
      for(let axis=0;axis<3;axis++)
        assert.ok(Math.abs(final.point[axis]-points[i].output[axis])<1e-9);
      assert.equal(final.dyed,1);
    }
  }
  assert.ok(corePosition('cpu',0)[0]!==corePosition('cpu',1)[0]);
  assert.ok(corePosition('gpu',0)[0]<corePosition('gpu',1)[0]);
  assert.ok(TASK_CUBE_SIZE<GRID_STEP,'neighboring cubes must not touch');
});

test('a single camera travels from independent cell to CPU to GPU to comparison',()=>{
  assert.equal(cameraAt(0).focusX,GENERIC_X);
  assert.ok(Math.abs(cameraAt(125).focusX-CENTER.cpu)<1e-9);
  assert.ok(Math.abs(cameraAt(330).focusX-CENTER.gpu)<1e-9);
  assert.ok(Math.abs(cameraAt(470).focusX)<.00001);
  for(let frame=1;frame<DURATION;frame++){
    const before=cameraAt(frame-1),cam=cameraAt(frame);
    assert.ok(Math.abs(cam.focusX-before.focusX)<.5,'camera position cut at '+frame);
    assert.ok(Math.abs(cam.zoom-before.zoom)<.9,'camera zoom cut at '+frame);
    assert.ok(cam.zoom>=35&&cam.zoom<=70);
    assert.ok(720/cam.zoom>10.2);
  }
  // Final frame width fits both distant source/result arrays.
  assert.ok(1280/cameraAt(470).zoom>36);
});

test('a neutral visible computation unit plus outside trays, without a fake video',()=>{
  const root=resolve(import.meta.dirname,'..');
  const read=p=>readFileSync(resolve(root,p),'utf8');
  const scene=read('animations/cpu-gpu/web/src/cpu-gpu.tsx');
  const catalog=read('apps/portal/src/catalog.ts');
  assert.match(scene,/<GenericArithmeticUnit frame=\{frame\}/);
  assert.match(scene,/exampleAt\(frame\)/);
  assert.match(scene,/data-example-location/);
  assert.match(scene,/<JobStations\/>/);
  assert.match(scene,/size=\{\[2\.55,\.065,2\.70\]\}/);
  assert.match(scene,/data-renderer="react-threejs-webgl"/);
  assert.match(scene,/data-chip-design="complete-silicon-top"/);
  assert.match(scene,/ThreeCanvas/);
  assert.match(scene,/useCurrentFrame/);
  assert.doesNotMatch(scene,/<video|\.mp4|<img|VideoTexture|ImageBitmap|ProgressBar|<Chart/);
  assert.equal([...scene.matchAll(/<span>/g)].length,1);
  assert.match(catalog,/id: 'cpu-gpu'/);
  assert.match(catalog,/durationInFrames: 480/);
  assert.match(read('apps/studio/src/root.tsx'),/projects\.map/);
});
