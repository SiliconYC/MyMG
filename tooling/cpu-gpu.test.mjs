import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {
  DURATION,ORIGINAL_FRAMES,FPS,TASKS,TASK_CUBE_SIZE,CPU_CORES,GPU_LANES,
  GENERIC_X,CENTER,CHIP_HALF,GRID_STEP,INPUT_X,
  stageAt,cameraAt,jobProgress,taskAt,taskPositions,
  PERSPECTIVE_FOV,CAMERA_FRAMING_MARGIN,perspectiveDistance,
  completedCount,workingCount,corePosition,exampleAt,flowAt,
  SHAPES,shapeAt,shapeIndex,mixedTaskAt,mixedCompletedCount,
  mixedWorkingCount,mixedIdleLanes,MIXED_CPU_FIRST,MIXED_GPU_FIRST_PATH,
} from '../animations/cpu-gpu/web/src/model.ts';

test('neutral computation is independent of CPU/GPU and happens above an exposed tile',()=>{
  assert.equal(FPS,30);
  assert.equal(ORIGINAL_FRAMES,420);
  assert.equal(DURATION,840);
  assert.equal(TASKS,16);
  assert.equal(CPU_CORES,4);
  assert.equal(GPU_LANES,16);
  assert.equal(stageAt(0),'task');
  assert.equal(stageAt(70),'task');
  assert.equal(stageAt(125),'cpu');
  assert.equal(stageAt(280),'gpu');
  assert.equal(stageAt(380),'compare');
  assert.equal(stageAt(419),'compare');
  assert.equal(stageAt(420),'mixed-intro');
  assert.equal(stageAt(510),'mixed-cpu');
  assert.equal(stageAt(690),'mixed-gpu');
  assert.equal(stageAt(839),'mixed-compare');
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
    assert.ok(720*CAMERA_FRAMING_MARGIN/b.zoom>=9,
      'perspective center-plane framing must contain the core');
    assert.ok(b.distance>10&&b.distance<65,'dolly must stay clear of geometry');
    assert.ok(Math.abs(b.distance-perspectiveDistance(b.zoom))<1e-9);
    assert.ok(Math.abs(b.distance-a.distance)<1.9,'perspective dolly snapped');
  }
  assert.ok(maxDx>.6,'camera move still too uniform/slow');
  assert.ok(maxDyaw>.02,'rotation does not visibly move');
  assert.ok(maxDpitch>.005,'pitch does not visibly move');
  assert.ok(1280/cameraAt(419).zoom>36);
});


/** Independent perspective projection, with the target on y=targetY, z=0.
 * Normalized screen coordinates have visible bounds [-1,+1].
 */
const project=(point,c)=>{
  const x=point[0]-c.focusX,y=point[1]-c.targetY,z=point[2];
  const sinYaw=Math.sin(c.yaw),cosYaw=Math.cos(c.yaw);
  const sinPitch=Math.sin(c.pitch),cosPitch=Math.cos(c.pitch);
  const depth=c.distance-(x*cosPitch*sinYaw+y*sinPitch+z*cosPitch*cosYaw);
  assert.ok(depth>1,'camera must not cross geometry');
  const slope=Math.tan(PERSPECTIVE_FOV*Math.PI/360);
  return {
    x:(x*cosYaw-z*sinYaw)/(depth*slope*1280/720),
    y:(-x*sinYaw*sinPitch+y*cosPitch-z*cosYaw*sinPitch)/(depth*slope),
    depth,
  };
};

test('perspective lens creates natural parallax and keeps hold shots fully framed',()=>{
  assert.equal(PERSPECTIVE_FOV,38);
  assert.ok(CAMERA_FRAMING_MARGIN>1.2);
  const intro=cameraAt(0),cpu=cameraAt(110),gpu=cameraAt(280),wide=cameraAt(419);
  assert.ok(intro.distance<cpu.distance&&cpu.distance<wide.distance);
  assert.ok(Math.abs(cpu.distance-gpu.distance)<.1);
  const near=project([CENTER.cpu,0,2],cpu);
  const far=project([CENTER.cpu,0,-2],cpu);
  assert.ok(near.depth<far.depth,'foreground really is closer');
  assert.ok(far.depth/near.depth>1.15,'near/far scale difference must be visible');

  // Cover die, both external job pads and their 4x4 task cubes.
  // Insets are deliberately tighter than the full [-1,+1] frustum.
  const shots=[
    ...[0,30,60].map(f=>[f,[[-29.6,-23.4]]]),
    ...[95,110,150,210,235,237].map(f=>[f,[[-16.6,.2]]]),
    ...[266,280,293,322,332].map(f=>[f,[[.2,16.9]]]),
    ...[377,419].map(f=>[f,[[-16.6,.2],[.2,16.9]]]),
  ];
  for(const [frame,ranges] of shots){
    const c=cameraAt(frame);
    for(const [left,right] of ranges){
      for(const x of [left,right]){
        for(const y of [-.75,.85]){
          for(const z of [-3.4,3.4]){
            const screen=project([x,y,z],c);
            assert.ok(Math.abs(screen.x)<.93,
              'perspective x clipping at frame '+frame+': '+screen.x);
            assert.ok(Math.abs(screen.y)<.93,
              'perspective y clipping at frame '+frame+': '+screen.y);
          }
        }
      }
    }
  }
});


test('Act I is 420 frames intact and Act II starts with the exact last camera',()=>{
  assert.deepEqual(cameraAt(420),cameraAt(419));
  assert.equal(stageAt(419),'compare');
  assert.equal(mixedCompletedCount(419,'cpu'),0);
  assert.equal(mixedCompletedCount(419,'gpu'),0);
  for(const f of [0,30,101,110,133,167,235,251,293,322,377,419]){
    assert.equal(mixedWorkingCount(f,'cpu'),0);
    assert.equal(mixedWorkingCount(f,'gpu'),0);
  }
  assert.equal(completedCount(419,'cpu'),16);
  assert.equal(completedCount(419,'gpu'),16);
  assert.equal(completedCount(839,'cpu'),16);
  assert.equal(completedCount(839,'gpu'),16);
});

test('four meshes are evenly mixed across 16 tasks and every CPU core rotates shapes',()=>{
  assert.deepEqual(SHAPES,['cube','sphere','tetrahedron','cylinder']);
  assert.equal(new Set(Array.from({length:16},(_,i)=>shapeAt(i))).size,4);
  for(const shape of SHAPES){
    assert.equal(Array.from({length:16},(_,i)=>shapeAt(i))
      .filter(s=>s===shape).length,4);
  }
  for(let core=0;core<4;core++){
    const byCore=Array.from({length:4},(_,round)=>shapeAt(round*4+core));
    assert.equal(new Set(byCore).size,4,'CPU core sees different branches every batch');
  }
  for(let i=0;i<16;i++){
    assert.ok(shapeIndex(i)>=0&&shapeIndex(i)<4);
    assert.deepEqual(mixedTaskAt(420,'cpu',i).point,taskPositions('cpu',i).input);
    assert.deepEqual(mixedTaskAt(420,'gpu',i).point,taskPositions('gpu',i).input);
  }
});

test('heterogeneous CPU executes four independent branches; divergent GPU masks lanes',()=>{
  assert.equal(MIXED_CPU_FIRST,515);
  assert.equal(MIXED_GPU_FIRST_PATH,677);
  assert.equal(mixedCompletedCount(514,'cpu'),0);
  assert.equal(mixedWorkingCount(525,'cpu'),4);
  for(const [f,count] of [[537,4],[561,8],[585,12],[609,16]])
    assert.equal(mixedCompletedCount(f,'cpu'),count,'CPU frame '+f);
  assert.equal(mixedCompletedCount(609,'gpu'),0);
  assert.equal(mixedWorkingCount(660,'gpu'),0);
  assert.equal(mixedWorkingCount(679,'gpu'),4);
  assert.equal(mixedIdleLanes(679),12);
  for(const [f,count] of [[701,4],[726,8],[751,12],[776,16]]){
    assert.equal(mixedCompletedCount(f,'gpu'),count,'GPU branch '+f);
  }
  assert.equal(mixedIdleLanes(703),8);
  assert.equal(mixedCompletedCount(839,'cpu'),16);
  assert.equal(mixedCompletedCount(839,'gpu'),16);
  let previousCpu=0,previousGpu=0;
  for(let f=420;f<DURATION;f++){
    const c=mixedCompletedCount(f,'cpu'),g=mixedCompletedCount(f,'gpu');
    assert.ok(c>=previousCpu&&g>=previousGpu,'mixed outputs cannot reverse time');
    previousCpu=c;previousGpu=g;
    assert.ok(mixedWorkingCount(f,'gpu')<=4,
      'in this 16-lane divergent cohort only one 4-lane path executes at a time');
  }
});

test('additional perspective orbit frames stay smooth and readable',()=>{
  const projectShot=(pt,c)=>{
    const x=pt[0]-c.focusX,y=pt[1]-c.targetY,z=pt[2];
    const cy=Math.cos(c.yaw),sy=Math.sin(c.yaw),
      cp=Math.cos(c.pitch),sp=Math.sin(c.pitch);
    const depth=c.distance-(x*cp*sy+y*sp+z*cp*cy);
    assert.ok(depth>2);
    const slope=Math.tan(PERSPECTIVE_FOV*Math.PI/360);
    return [
      (x*cy-z*sy)/(depth*slope*1280/720),
      (-x*sy*sp+y*cp-z*cy*sp)/(depth*slope),
    ];
  };
  for(const [frame,bounds] of [
    [420,[-16.6,16.9]],[485,[-16.6,.2]],[520,[-16.6,.2]],
    [600,[-16.6,.2]],[660,[.2,16.9]],[690,[.2,16.9]],
    [750,[.2,16.9]],[828,[-16.6,16.9]],[839,[-16.6,16.9]],
  ]){
    const c=cameraAt(frame);
    for(const x of bounds)for(const y of [-.8,.95])for(const z of [-3.4,3.4]){
      const [sx,sy]=projectShot([x,y,z],c);
      assert.ok(Math.abs(sx)<.96&&Math.abs(sy)<.96,
        'act-II task / chip clipped at '+frame+' projected '+sx+','+sy);
    }
  }
  for(let f=420;f<DURATION;f++){
    const a=cameraAt(f-1),b=cameraAt(f);
    assert.ok(Math.abs(b.focusX-a.focusX)<1.4,'act-II camera jumps at '+f);
    assert.ok(Math.abs(b.yaw-a.yaw)<.08);
    assert.ok(Math.abs(b.pitch-a.pitch)<.02);
    assert.ok(Math.abs(b.distance-a.distance)<1.9);
  }
});

test('WebGL neutral cell is opaque and shares physical task motion with the cores',()=>{
  const root=resolve(import.meta.dirname,'..');
  const read=p=>readFileSync(resolve(root,p),'utf8');
  const scene=read('animations/cpu-gpu/web/src/cpu-gpu.tsx');
  const catalog=read('apps/portal/src/catalog.ts');
  assert.match(scene,/<GenericArithmeticUnit frame=\{frame\}/);
  assert.match(scene,/MixedTask/);
  assert.match(scene,/<sphereGeometry/);
  assert.match(scene,/<tetrahedronGeometry/);
  assert.match(scene,/<cylinderGeometry/);
  assert.match(scene,/<boxGeometry/);
  assert.match(scene,/frame>=ORIGINAL_FRAMES/);
  assert.match(scene,/exampleAt\(frame\)/);
  assert.match(scene,/coreScale/);
  assert.doesNotMatch(scene,/size=\{\[1\.96,\.71,1\.96\]\}|opacity=\{\.68\}/,
    'original translucent box submerged tasks');
  assert.match(scene,/<JobStations\/>/);
  assert.match(scene,/data-renderer="react-threejs-webgl"/);
  assert.match(scene,/data-camera-yaw/);
  assert.match(scene,/data-camera-pitch/);
  assert.match(scene,/data-camera-projection="perspective"/);
  assert.match(scene,/data-camera-fov/);
  assert.match(scene,/data-camera-distance/);
  assert.ok(scene.includes('THREE.PerspectiveCamera'));
  assert.ok(!scene.includes('<ThreeCanvas orthographic') && !scene.includes('THREE.OrthographicCamera'));
  assert.match(scene,/Math\.sin\(yaw\)/);
  assert.match(scene,/Math\.sin\(pitch\)/);
  assert.match(scene,/ThreeCanvas/);
  assert.match(scene,/useCurrentFrame/);
  assert.doesNotMatch(scene,/<video|\.mp4|<img|VideoTexture|ImageBitmap|ProgressBar|<Chart/);
  assert.equal([...scene.matchAll(/<span>/g)].length,1);
  assert.match(catalog,/id: 'cpu-gpu'/);
  assert.match(catalog,/durationInFrames: 840/);
  assert.match(read('apps/studio/src/root.tsx'),/projects\.map/);
});
