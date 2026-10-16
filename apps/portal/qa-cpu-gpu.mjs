/** Real Chromium/SwiftShader WebGL acceptance of both CPU/GPU workloads. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from 'playwright';

const site=process.env.MYMG_QA_URL??'http://127.0.0.1:4173/MyMG/';
const out=resolve(process.env.MYMG_QA_OUTPUT??'../../output/qa-cpu-gpu');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:[
  '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
  '--no-sandbox','--disable-dev-shm-usage'
]});
const page=await browser.newPage({viewport:{width:1600,height:970}});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
const readFrame=async()=>Number(await page.getByTestId('frame-readout').textContent());
const seek=async target=>{
  await page.getByTestId('frame-slider').evaluate((el,next)=>{
    const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
    setter.call(el,String(next));
    el.dispatchEvent(new Event('input',{bubbles:true}));
    el.dispatchEvent(new Event('change',{bubbles:true}));
  },target);
  await page.waitForFunction(target=>
    document.querySelector('[data-testid="frame-readout"]')?.textContent===String(target),target);
  await page.waitForTimeout(150);
};
try{
  await page.goto(new URL('#/',site).href,{waitUntil:'networkidle'});
  await page.getByTestId('project-cpu-gpu').click();
  assert.equal(new URL(page.url()).hash,'#/cpu-gpu');
  const scene=page.getByTestId('cpu-gpu-native-scene');
  await scene.waitFor();
  assert.equal(await scene.getAttribute('data-renderer'),'react-threejs-webgl');
  assert.equal(await scene.getAttribute('data-camera-projection'),'perspective');
  assert.equal(Number(await scene.getAttribute('data-camera-fov')),38);
  assert.equal(await page.locator('video').count(),0);
  assert.equal(await scene.locator('img').count(),0);
  const slider=page.getByTestId('frame-slider');
  assert.equal(Number(await slider.getAttribute('max')),743);
  const canvas=scene.locator('canvas').first();
  await canvas.waitFor();
  assert.ok(await canvas.evaluate(el=>{
    const gl=el.getContext('webgl2')||el.getContext('webgl');
    return !!gl&&!gl.isContextLost()&&el.width>100&&el.height>100;
  }),'must render original Three.js WebGL, not video or static images');
  const num=async key=>Number(await scene.getAttribute(key));
  const screenshot=async(frame,file='cpu-gpu-'+frame+'.png')=>{
    await seek(frame);
    assert.equal(await scene.getByTestId('cpu-gpu-caption').count(),1);
    assert.ok(await num('data-camera-zoom')>=35);
    assert.ok(await num('data-camera-distance')>10);
    const png=await scene.screenshot({path:resolve(out,file)});
    assert.ok(png.byteLength>6000,'blank WebGL scene at frame '+frame);
    return png;
  };

  // Act I: the first rendered frame is ALREADY CPU; no generic single tile.
  const cpuIntro=await screenshot(0);
  assert.equal(await scene.getAttribute('data-workload'),'cpu');
  assert.match(await scene.getByTestId('cpu-gpu-caption').textContent(),/CPU/);
  assert.doesNotMatch(await scene.getByTestId('cpu-gpu-caption').textContent(),/獨立計算單元|輸入 \+1/);
  const title=page.getByTestId('cpu-gpu-story-title');
  assert.equal(await scene.getAttribute('data-story-beat'),'round-one');
  assert.equal(await title.getAttribute('data-layout'),'chapter');
  await screenshot(22,'cpu-gpu-round-one-opening.png');
  assert.match(await title.textContent(),/第一轮/);
  assert.match(await title.textContent(),/16 个相同任务/);
  assert.ok(await title.evaluate(el=>Number(getComputedStyle(el).opacity))>.98);
  assert.equal(await num('data-original-task-meshes'),32);
  assert.equal(await num('data-mixed-task-meshes'),0);
  assert.equal(await num('data-cpu-done'),0);
  assert.equal(await num('data-gpu-done'),0);

  const original=async(f,stage,cpuDone,gpuDone,cpuWork,gpuWork)=>{
    const png=await screenshot(f);
    assert.equal(await scene.getAttribute('data-workload'),stage);
    assert.equal(await num('data-original-task-meshes'),32);
    assert.equal(await num('data-mixed-task-meshes'),0);
    assert.equal(await num('data-task-count'),16);
    assert.equal(await num('data-cpu-done'),cpuDone);
    assert.equal(await num('data-gpu-done'),gpuDone);
    assert.equal(await num('data-cpu-working'),cpuWork);
    assert.equal(await num('data-gpu-working'),gpuWork);
    return png;
  };
  const cpuWork=await original(14,'cpu',0,0,4,0);
  assert.notDeepEqual(cpuIntro,cpuWork,'CPU must visibly process from the start');
  await original(37,'cpu',4,0,0,0);
  await original(71,'cpu',8,0,0,0);
  await original(139,'cpu',16,0,0,0);

  const before=await screenshot(141,'fast-cpu-gpu-start.png');
  const from={yaw:await num('data-camera-yaw'),pitch:await num('data-camera-pitch')};
  const middle=await screenshot(155,'fast-cpu-gpu-middle.png');
  const after=await screenshot(170,'fast-cpu-gpu-end.png');
  const to={yaw:await num('data-camera-yaw'),pitch:await num('data-camera-pitch')};
  assert.ok(Math.abs(from.yaw-to.yaw)>.50);
  assert.ok(Math.abs(from.pitch-to.pitch)>.17);
  assert.ok(Buffer.compare(before,middle)!==0&&Buffer.compare(middle,after)!==0,
    'the perspective camera must actually orbit');

  await original(197,'gpu',16,0,0,16);
  await original(226,'gpu',16,16,0,0);
  await original(274,'compare',16,16,0,0);
  assert.equal(await scene.getAttribute('data-story-beat'),'none');
  const gpuVictory=await original(292,'compare',16,16,0,0);
  assert.equal(await scene.getAttribute('data-story-beat'),'gpu-wins');
  assert.equal(await title.getAttribute('data-beat'),'gpu-wins');
  assert.equal(await title.getAttribute('data-layout'),'verdict');
  assert.equal(await title.evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)',
    'winner must not be boxed over the 3D model');
  assert.match(await title.textContent(),/第一轮/);
  assert.match(await title.textContent(),/GPU\s*胜出/);
  assert.ok(await title.evaluate(el=>Number(getComputedStyle(el).opacity))>.98,
    'GPU winner must be visibly legible, not only a DOM label');
  const priorLastVisible=await original(309,'compare',16,16,0,0);
  const priorGone=await original(323,'compare',16,16,0,0);
  assert.notDeepEqual(priorLastVisible,priorGone,
    'old 16+16 results should fade out BEFORE the next scene');
  const previousCamera={
    zoom:await num('data-camera-zoom'),
    yaw:await num('data-camera-yaw'),
    pitch:await num('data-camera-pitch'),
    distance:await num('data-camera-distance'),
  };

  // Act II: all 32 old TaskCube meshes have been unmounted, not just hidden.
  const mixed=async(f,stage,cpuDone,gpuDone,cpuWork,gpuWork,idle)=>{
    const png=await screenshot(f,'cpu-gpu-mixed-'+f+'.png');
    assert.equal(await scene.getAttribute('data-workload'),stage);
    assert.equal(await num('data-original-task-meshes'),0,
      'old blue cubes must not still be in the second workload');
    assert.equal(await num('data-mixed-task-meshes'),32,
      'only the new 4-shape tasks may be mounted');
    assert.equal(await num('data-mixed-task-count'),16);
    assert.equal(await num('data-mixed-cpu-done'),cpuDone);
    assert.equal(await num('data-mixed-gpu-done'),gpuDone);
    assert.equal(await num('data-mixed-cpu-working'),cpuWork);
    assert.equal(await num('data-mixed-gpu-working'),gpuWork);
    if(idle!==undefined)assert.equal(await num('data-mixed-gpu-idle'),idle);
    return png;
  };
  await mixed(324,'mixed-intro',0,0,0,0,0);
  assert.equal(await scene.getAttribute('data-story-beat'),'round-two');
  assert.equal(await title.getAttribute('data-beat'),'round-two');
  assert.equal(await title.getAttribute('data-layout'),'chapter');
  assert.match(await title.textContent(),/第二轮/);
  assert.match(await title.textContent(),/16 个混合任务/);
  assert.equal(await num('data-camera-zoom'),previousCamera.zoom);
  assert.equal(await num('data-camera-yaw'),previousCamera.yaw);
  assert.equal(await num('data-camera-pitch'),previousCamera.pitch);
  assert.equal(await num('data-camera-distance'),previousCamera.distance);

  await mixed(333,'mixed-intro',0,0,0,0,0);
  const veil=page.getByTestId('cpu-gpu-round-wipe');
  assert.equal(await veil.getAttribute('data-active'),'true');
  assert.ok(await num('data-handover-opacity')>.8);
  await mixed(342,'mixed-intro',0,0,0,0,0);
  assert.match(await title.textContent(),/形状不同 · 分支各异/);
  assert.ok(await title.evaluate(el=>Number(getComputedStyle(el).opacity))>.98,
    'round-two intertitle must appear while mixed shapes arrive');
  assert.equal(await num('data-original-task-meshes'),0);
  const shapes=await mixed(364,'mixed-intro',0,0,0,0,0);
  assert.ok(Buffer.compare(priorGone,shapes)!==0,
    'new mixed shapes must actually appear after clean old-result removal');
  await mixed(429,'mixed-cpu',0,0,4,0,0);
  await mixed(441,'mixed-cpu',4,0,0,0,0);
  await mixed(489,'mixed-cpu',12,0,0,0,0);
  await mixed(513,'mixed-cpu',16,0,0,0,0);
  await mixed(564,'mixed-gpu',16,0,0,0,0);
  await mixed(583,'mixed-gpu',16,0,0,4,12);
  await mixed(605,'mixed-gpu',16,4,0,0,12);
  await mixed(630,'mixed-gpu',16,8,0,0,8);
  await mixed(655,'mixed-gpu',16,12,0,0,4);
  await mixed(680,'mixed-gpu',16,16,0,0,0);
  await mixed(699,'mixed-compare',16,16,0,0,0);
  assert.equal(await scene.getAttribute('data-story-beat'),'none');
  const cpuVictory=await mixed(722,'mixed-compare',16,16,0,0,0);
  assert.equal(await scene.getAttribute('data-story-beat'),'cpu-wins');
  assert.equal(await title.getAttribute('data-beat'),'cpu-wins');
  assert.equal(await title.getAttribute('data-layout'),'verdict');
  assert.match(await title.textContent(),/第二轮/);
  assert.match(await title.textContent(),/CPU\s*胜出/);
  assert.ok(await title.evaluate(el=>Number(getComputedStyle(el).opacity))>.98,
    'CPU winner must remain visible during final two-chip shot');
  assert.notDeepEqual(gpuVictory,cpuVictory);
  await mixed(743,'mixed-compare',16,16,0,0,0);

  for(const f of [1,13,22,45,54,55,56,140,141,155,170,174,175,249,250,
    274,280,292,300,309,315,319,320,322,323,324,325,328,335,348,364,375,376,379,380,
    388,389,519,548,549,561,580,581,688,689,700,712,732,743]){
    await seek(f);
    assert.equal(await num('data-original-task-meshes'),f<324?32:0,
      'legacy geometry leaked at '+f);
    assert.equal(await num('data-mixed-task-meshes'),f>=324?32:0);
    const image=await scene.screenshot({path:resolve(out,'cpu-gpu-boundary-'+f+'.png')});
    assert.ok(image.byteLength>6000);
  }

  await seek(104);
  await page.getByRole('button',{name:'前进一帧'}).click();
  assert.equal(await readFrame(),105);
  await page.getByRole('button',{name:'后退一帧'}).click();
  assert.equal(await readFrame(),104);
  await page.getByTestId('play-toggle').click();
  await page.waitForFunction(()=>
    Number(document.querySelector('[data-testid="frame-readout"]')?.textContent)>108,
    null,{timeout:10000});
  await page.getByTestId('play-toggle').click();
  await page.waitForTimeout(160);
  const frozen=await readFrame();
  await page.waitForTimeout(300);
  assert.equal(await readFrame(),frozen);
  await page.goto(new URL('#/cpu-gpu',site).href,{waitUntil:'networkidle'});
  await scene.waitFor();
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:resolve(out,'cpu-gpu-mobile.png'),fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('CPU/GPU native WebGL verified: GPU victory, visible round-two wipe, CPU victory, clear meshes, perspective and mobile');
}catch(error){
  await writeFile(resolve(out,'cpu-gpu-failure.log'),(error?.stack??String(error))+'\n'+errors.join('\n'));
  try{await page.screenshot({path:resolve(out,'cpu-gpu-failure.png'),fullPage:true});}catch{}
  throw error;
}finally{await browser.close();}
