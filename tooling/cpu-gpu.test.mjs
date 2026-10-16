import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {
  DURATION,ORIGINAL_FRAMES,FPS,TASKS,TASK_CUBE_SIZE,CPU_CORES,GPU_LANES,
  CENTER,CHIP_HALF,GRID_STEP,INPUT_X,SHAPES,
  stageAt,cameraAt,jobProgress,taskAt,taskPositions,
  PERSPECTIVE_FOV,CAMERA_FRAMING_MARGIN,perspectiveDistance,
  completedCount,workingCount,corePosition,shapeAt,flowAt,
  mixedTaskAt,mixedCompletedCount,mixedWorkingCount,mixedIdleLanes,
  MIXED_CPU_FIRST,MIXED_GPU_FIRST_PATH,
} from '../animations/cpu-gpu/web/src/model.ts';

test('timeline starts at CPU: 96 introductory frames removed, both workloads retained',()=>{
  assert.equal(FPS,30);
  assert.equal(DURATION,744);
  assert.equal(ORIGINAL_FRAMES,324);
  assert.equal(TASKS,16);
  assert.equal(CPU_CORES,4);
  assert.equal(GPU_LANES,16);
  assert.equal(stageAt(0),'cpu');
  assert.equal(stageAt(14),'cpu');
  assert.equal(stageAt(174),'cpu');
  assert.equal(stageAt(175),'gpu');
  assert.equal(stageAt(249),'gpu');
  assert.equal(stageAt(250),'compare');
  assert.equal(stageAt(323),'compare');
  assert.equal(stageAt(324),'mixed-intro');
  assert.equal(stageAt(388),'mixed-intro');
  assert.equal(stageAt(389),'mixed-cpu');
  assert.equal(stageAt(549),'mixed-gpu');
  assert.equal(stageAt(688),'mixed-gpu');
  assert.equal(stageAt(689),'mixed-compare');
  assert.equal(stageAt(743),'mixed-compare');
  assert.equal(cameraAt(0).focusX,CENTER.cpu);
  assert.equal(cameraAt(324).focusX,cameraAt(323).focusX);
  assert.deepEqual(cameraAt(324),cameraAt(323));
});

test('original 16 identical jobs still show CPU four-batch versus GPU all-at-once',()=>{
  assert.equal(completedCount(0,'cpu'),0);
  assert.equal(workingCount(14,'cpu'),4);
  for(const [f,n] of [[37,4],[71,8],[105,12],[139,16]])
    assert.equal(completedCount(f,'cpu'),n,'CPU frame '+f);
  assert.equal(completedCount(183,'gpu'),0);
  assert.equal(workingCount(197,'gpu'),16);
  assert.equal(completedCount(226,'gpu'),16);
  assert.equal(completedCount(323,'cpu'),16);
  assert.equal(completedCount(323,'gpu'),16);
  for(let f=0;f<ORIGINAL_FRAMES;f++){
    for(const kind of ['cpu','gpu']){
      assert.ok(completedCount(f,kind)<=16);
      for(let i=0;i<TASKS;i++){
        assert.ok(jobProgress(f,kind,i)>=0);
        assert.ok(jobProgress(f,kind,i)<=1);
      }
    }
  }
});

test('geometry and motion rules remain physically separated from result pads',()=>{
  for(const kind of ['cpu','gpu']){
    const items=Array.from({length:16},(_,i)=>taskPositions(kind,i));
    assert.equal(new Set(items.map(x=>x.input.join(','))).size,16);
    assert.equal(new Set(items.map(x=>x.output.join(','))).size,16);
    for(let i=0;i<TASKS;i++){
      const {input,processor,output}=items[i];
      assert.ok(input[0]<-CHIP_HALF-1.5);
      assert.ok(output[0]>CHIP_HALF+1.5);
      assert.equal(input[1],.10);
      assert.equal(output[1],.10);
      assert.deepEqual(flowAt(0,input,processor,output).point,input);
      for(const at of [flowAt(1,input,processor,output),taskAt(323,kind,i)]){
        for(let axis=0;axis<3;axis++)
          assert.ok(Math.abs(at.point[axis]-output[axis])<1e-9);
      }
    }
  }
  assert.ok(TASK_CUBE_SIZE<GRID_STEP);
  assert.ok(INPUT_X<0);
  assert.notDeepEqual(corePosition('cpu',0),corePosition('cpu',1));
});

test('16 mixed shapes evenly represent four divergent paths',()=>{
  assert.deepEqual(SHAPES,['cube','sphere','tetrahedron','cylinder']);
  assert.equal(MIXED_CPU_FIRST,419);
  assert.equal(MIXED_GPU_FIRST_PATH,581);
  for(const shape of SHAPES){
    assert.equal(Array.from({length:16},(_,i)=>shapeAt(i))
      .filter(s=>s===shape).length,4);
  }
  for(let core=0;core<4;core++){
    const variants=Array.from({length:4},(_,round)=>shapeAt(round*4+core));
    assert.equal(new Set(variants).size,4);
  }
  assert.equal(mixedCompletedCount(418,'cpu'),0);
  assert.equal(mixedWorkingCount(429,'cpu'),4);
  for(const [f,n] of [[441,4],[465,8],[489,12],[513,16]])
    assert.equal(mixedCompletedCount(f,'cpu'),n);
  assert.equal(mixedCompletedCount(554,'gpu'),0);
  assert.equal(mixedWorkingCount(583,'gpu'),4);
  assert.equal(mixedIdleLanes(583),12);
  for(const [f,n] of [[605,4],[630,8],[655,12],[680,16]])
    assert.equal(mixedCompletedCount(f,'gpu'),n);
  assert.equal(mixedIdleLanes(607),8);
  assert.equal(mixedIdleLanes(631),4);
  assert.equal(mixedIdleLanes(681),0);
  for(let f=324;f<DURATION;f++){
    assert.ok(mixedWorkingCount(f,'gpu')<=4);
    if(f>324){
      for(const kind of ['cpu','gpu']){
        assert.ok(mixedCompletedCount(f,kind)>=mixedCompletedCount(f-1,kind));
      }
    }
  }
});

const project=(p,c)=>{
  const x=p[0]-c.focusX,y=p[1]-c.targetY,z=p[2];
  const cy=Math.cos(c.yaw),sy=Math.sin(c.yaw);
  const cp=Math.cos(c.pitch),sp=Math.sin(c.pitch);
  const depth=c.distance-(x*cp*sy+y*sp+z*cp*cy);
  assert.ok(depth>2);
  const slope=Math.tan(PERSPECTIVE_FOV*Math.PI/360);
  return [(x*cy-z*sy)/(depth*slope*1280/720),
    (-x*sy*sp+y*cp-z*cy*sp)/(depth*slope)];
};

test('38-degree perspective keeps first CPU, second GPU and all transitions in frame',()=>{
  assert.equal(PERSPECTIVE_FOV,38);
  assert.ok(CAMERA_FRAMING_MARGIN>1.2);
  const shots=[
    [0,[-16.6,.2]],[14,[-16.6,.2]],[73,[-16.6,.2]],[139,[-16.6,.2]],
    [170,[.2,16.9]],[197,[.2,16.9]],[226,[.2,16.9]],
    [281,[-16.6,16.9]],[323,[-16.6,16.9]],[324,[-16.6,16.9]],
    [389,[-16.6,.2]],[429,[-16.6,.2]],[513,[-16.6,.2]],
    [564,[.2,16.9]],[583,[.2,16.9]],[655,[.2,16.9]],
    [732,[-16.6,16.9]],[743,[-16.6,16.9]],
  ];
  for(const [f,limits] of shots){
    const c=cameraAt(f);
    for(const x of limits)for(const y of [-.8,.95])for(const z of [-3.4,3.4]){
      const [px,py]=project([x,y,z],c);
      assert.ok(Math.abs(px)<.97,'x frame '+f+': '+px);
      assert.ok(Math.abs(py)<.97,'y frame '+f+': '+py);
    }
  }
  for(let f=1;f<DURATION;f++){
    const a=cameraAt(f-1),b=cameraAt(f);
    assert.ok(Math.abs(b.focusX-a.focusX)<1.4,'pan jump '+f);
    assert.ok(Math.abs(b.yaw-a.yaw)<.08,'yaw jump '+f);
    assert.ok(Math.abs(b.pitch-a.pitch)<.02,'pitch jump '+f);
    assert.ok(Math.abs(b.zoom-a.zoom)<1.5,'zoom jump '+f);
    assert.ok(Math.abs(b.distance-perspectiveDistance(b.zoom))<1e-9);
  }
});

test('the entire previous workload is UNMOUNTED before second-shape rendering',()=>{
  const root=resolve(import.meta.dirname,'..');
  const source=readFileSync(resolve(root,'animations/cpu-gpu/web/src/cpu-gpu.tsx'),'utf8');
  const catalog=readFileSync(resolve(root,'apps/portal/src/catalog.ts'),'utf8');
  assert.doesNotMatch(source,/GenericArithmeticUnit|data-example-|GENERIC_X|exampleAt/);
  assert.doesNotMatch(source,/<video|\.mp4|<img|THREE\.OrthographicCamera/);
  assert.match(source,/frame<ORIGINAL_FRAMES&&Array\.from\(\{length:TASKS\}/);
  assert.match(source,/frame>=ORIGINAL_FRAMES&&Array\.from\(\{length:TASKS\}/);
  assert.match(source,/data-original-task-meshes/);
  assert.match(source,/data-mixed-task-meshes/);
  assert.match(source,/frame-\(ORIGINAL_FRAMES-14\)/);
  assert.match(source,/<sphereGeometry/);
  assert.match(source,/<tetrahedronGeometry/);
  assert.match(source,/<cylinderGeometry/);
  assert.match(source,/THREE\.PerspectiveCamera/);
  assert.match(catalog,/id: 'cpu-gpu'/);
  assert.match(catalog,/durationInFrames: 744/);
  assert.match(readFileSync(resolve(root,'apps/studio/src/root.tsx'),'utf8'),/projects\.map/);
});
