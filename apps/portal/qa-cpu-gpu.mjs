/** Chromium/SwiftShader acceptance: no transparent enclosing compute cube,
 * real shared task motions, perspective dolly and fast yaw/pitch orbit.
 */
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
  const slider=page.getByTestId('frame-slider');
  await slider.evaluate((el,next)=>{
    const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
    set.call(el,String(next));
    el.dispatchEvent(new Event('input',{bubbles:true}));
    el.dispatchEvent(new Event('change',{bubbles:true}));
  },target);
  await page.waitForFunction(x=>
    document.querySelector('[data-testid="frame-readout"]')?.textContent===String(x),target);
  await page.waitForTimeout(170);
};
try{
  await page.goto(new URL('#/',site).href,{waitUntil:'networkidle'});
  await page.getByTestId('project-cpu-gpu').waitFor();
  await page.getByTestId('project-cpu-gpu').click();
  assert.equal(new URL(page.url()).hash,'#/cpu-gpu');
  const scene=page.getByTestId('cpu-gpu-native-scene');
  await scene.waitFor();
  assert.equal(await scene.getAttribute('data-renderer'),'react-threejs-webgl');
  assert.equal(await scene.getAttribute('data-chip-design'),'complete-silicon-top');
  assert.equal(await scene.getAttribute('data-camera-projection'),'perspective');
  assert.equal(Number(await scene.getAttribute('data-camera-fov')),38);
  assert.equal(await page.locator('video').count(),0);
  assert.equal(await scene.locator('img').count(),0);
  const canvas=scene.locator('canvas').first();
  await canvas.waitFor();
  assert.ok(await canvas.evaluate(el=>{
    const gl=el.getContext('webgl2')||el.getContext('webgl');
    return !!gl&&!gl.isContextLost()&&el.width>=100&&el.height>=100;
  }),'original Three.js WebGL context required');

  const number=async key=>Number(await scene.getAttribute(key));
  const image=async(frame,stage,cpu,gpu,cpuWork,gpuWork)=>{
    await seek(frame);
    assert.equal(await scene.getAttribute('data-workload'),stage);
    assert.equal(await number('data-task-count'),16);
    assert.equal(await number('data-cpu-done'),cpu);
    assert.equal(await number('data-gpu-done'),gpu);
    assert.equal(await number('data-cpu-working'),cpuWork);
    assert.equal(await number('data-gpu-working'),gpuWork);
    assert.equal(await scene.locator('span').count(),1);
    assert.ok(await number('data-camera-zoom')>=35);
    assert.ok(await number('data-camera-zoom')<=80);
    assert.ok(await number('data-camera-distance')>10);
    assert.ok(await number('data-camera-distance')<65);
    const png=await scene.screenshot({path:resolve(out,'cpu-gpu-orbit-'+frame+'.png')});
    assert.ok(png.byteLength>6000,'WebGL scene failed at frame '+frame);
    return png;
  };

  const start=await image(0,'task',0,0,0,0);
  const introText=await scene.locator('span').textContent();
  assert.match(introText,/獨立計算單元/);
  assert.match(introText,/白色輸入/);
  assert.match(introText,/藍色結果/);
  assert.doesNotMatch(introText,/CPU|GPU/);
  const exampleX=await number('data-example-location');
  assert.ok(Math.abs(exampleX-await number('data-cpu-location'))>9);
  const introDistance=await number('data-camera-distance');
  const introMid=await image(30,'task',0,0,0,0);
  assert.ok(Buffer.compare(start,introMid)!==0,'neutral arithmetic operation must animate');
  assert.ok(await number('data-example-dyed')>.2,'cube must change color ABOVE exposed tile');
  await image(60,'task',0,0,0,0);
  assert.equal(await number('data-example-progress'),1);
  assert.equal(await number('data-example-dyed'),1);

  // The CPU and GPU each receive the identical 16 jobs, not the generic sample.
  await image(110,'cpu',0,0,4,0);
  assert.ok(await number('data-camera-distance')>introDistance,
    'perspective move must pull back when framing all CPU job pads');
  await image(133,'cpu',4,0,0,0);
  await image(167,'cpu',8,0,0,0);
  await image(235,'cpu',16,0,0,0);

  // 29 frames = under one second CPU -> GPU, with visible 3D camera orbit.
  await seek(237);
  const from={yaw:await number('data-camera-yaw'),pitch:await number('data-camera-pitch')};
  const before=await scene.screenshot({path:resolve(out,'cpu-gpu-fast-orbit-start.png')});
  await seek(251);
  const middle=await scene.screenshot({path:resolve(out,'cpu-gpu-fast-orbit-mid.png')});
  await seek(266);
  const to={yaw:await number('data-camera-yaw'),pitch:await number('data-camera-pitch')};
  const after=await scene.screenshot({path:resolve(out,'cpu-gpu-fast-orbit-end.png')});
  assert.ok(Math.abs(from.yaw-to.yaw)>.50,'camera yaw must genuinely orbit during transition');
  assert.ok(Math.abs(from.pitch-to.pitch)>.17,'camera pitch must change during transition');
  assert.ok(Buffer.compare(before,middle)!==0&&Buffer.compare(middle,after)!==0,
    'fast transition needs visible intermediary 3D frames, not a static cut');
  await image(293,'gpu',16,0,0,16);
  await image(322,'gpu',16,16,0,0);
  await image(370,'compare',16,16,0,0);
  await image(419,'compare',16,16,0,0);
  assert.ok(await number('data-camera-distance')>introDistance*1.8,
    'final two-chip framing must come from a real 3D dolly, not orthographic zoom');

  for(const frame of [59,60,94,95,237,250,266,270,271,331,345,346,377]){
    await seek(frame);
    if(frame>=60)assert.equal(await number('data-example-progress'),1);
    const png=await scene.screenshot({path:resolve(out,'cpu-gpu-cut-boundary-'+frame+'.png')});
    assert.ok(png.byteLength>6000,'blank frame during camera motion');
  }

  await seek(200);
  await page.getByRole('button',{name:'前进一帧'}).click();
  assert.equal(await readFrame(),201);
  await page.getByRole('button',{name:'后退一帧'}).click();
  assert.equal(await readFrame(),200);
  await page.getByTestId('play-toggle').click();
  await page.waitForFunction(()=>
    Number(document.querySelector('[data-testid="frame-readout"]')?.textContent)>204,
    null,{timeout:10000});
  await page.getByTestId('play-toggle').click();
  await page.waitForTimeout(160);
  const frozen=await readFrame();
  await page.waitForTimeout(300);
  assert.equal(await readFrame(),frozen);
  await page.goto(new URL('#/cpu-gpu',site).href,{waitUntil:'networkidle'});
  await scene.waitFor();
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:resolve(out,'cpu-gpu-cinematic-mobile.png'),fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('CPU/GPU perspective WebGL verified: actual depth, 3D dolly, fast yaw/pitch orbit, mobile.');
}catch(error){
  await writeFile(resolve(out,'cpu-gpu-failure.log'),(error?.stack??String(error))+'\n'+errors.join('\n'));
  try{await page.screenshot({path:resolve(out,'cpu-gpu-failure.png'),fullPage:true});}catch{}
  throw error;
}finally{await browser.close();}
