/** Visual regression in REAL Chromium/WebGL: independent +1 example,
 * genuine external 4x4 input/result stations, and continuous camera motion.
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
  await page.waitForTimeout(160);
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
  assert.equal(await page.locator('video').count(),0);
  assert.equal(await scene.locator('img').count(),0);
  const canvas=scene.locator('canvas').first();
  await canvas.waitFor();
  assert.ok(await canvas.evaluate(el=>{
    const gl=el.getContext('webgl2')||el.getContext('webgl');
    return !!gl&&!gl.isContextLost()&&el.width>=100&&el.height>=100;
  }),'live Three.js WebGL context required');
  const number=async attribute=>Number(await scene.getAttribute(attribute));
  const screenshot=async(frame,stage,cpu,gpu,cpuWork,gpuWork)=>{
    await seek(frame);
    assert.equal(await scene.getAttribute('data-workload'),stage);
    assert.equal(await number('data-task-count'),16);
    assert.equal(await number('data-cpu-done'),cpu);
    assert.equal(await number('data-gpu-done'),gpu);
    assert.equal(await number('data-cpu-working'),cpuWork);
    assert.equal(await number('data-gpu-working'),gpuWork);
    assert.equal(await scene.locator('span').count(),1);
    const zoom=await number('data-camera-zoom');
    assert.ok(zoom>=35&&zoom<=70);
    const png=await scene.screenshot({path:resolve(out,'cpu-gpu-independent-'+frame+'.png')});
    assert.ok(png.byteLength>6000,'blank scene at '+frame);
    return png;
  };
  const start=await screenshot(0,'task',0,0,0,0);
  const txt=await scene.locator('span').textContent();
  assert.match(txt,/獨立計算單元/);
  assert.match(txt,/白色輸入/);
  assert.match(txt,/藍色結果/);
  assert.doesNotMatch(txt,/CPU|GPU/,'general arithmetic lesson must not be branded CPU/GPU');
  const exampleX=await number('data-example-location');
  assert.ok(Math.abs(exampleX-await number('data-cpu-location'))>9);
  assert.ok(Math.abs(exampleX-await number('data-gpu-location'))>25);
  const moving=await screenshot(8,'task',0,0,0,0);
  assert.ok(Buffer.compare(start,moving)!==0,'first eight frames must move independent cube');
  assert.ok(await number('data-example-progress')>.12);
  await screenshot(30,'task',0,0,0,0);
  assert.ok(await number('data-example-dyed')>.2,'neutral arithmetic cell changes cube color');
  await screenshot(60,'task',0,0,0,0);
  assert.equal(await number('data-example-progress'),1);
  assert.equal(await number('data-example-dyed'),1);

  await screenshot(135,'cpu',0,0,4,0);
  await screenshot(155,'cpu',4,0,0,0);
  await screenshot(257,'cpu',16,0,0,0);
  await screenshot(340,'gpu',16,0,0,16);
  await screenshot(368,'gpu',16,16,0,0);
  await screenshot(450,'compare',16,16,0,0);
  await screenshot(479,'compare',16,16,0,0);

  for(const frame of [106,107,108,257,307,308,403,404,469]){
    await seek(frame);
    assert.equal(await number('data-example-progress'),1,
      'the general arithmetic demonstration cannot reset or vanish from time model');
    const png=await scene.screenshot({path:resolve(out,'cpu-gpu-boundary-'+frame+'.png')});
    assert.ok(png.byteLength>6000);
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
  await page.waitForTimeout(290);
  assert.equal(await readFrame(),frozen);
  await page.goto(new URL('#/cpu-gpu',site).href,{waitUntil:'networkidle'});
  await scene.waitFor();
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:resolve(out,'cpu-gpu-independent-mobile.png'),fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('CPU/GPU task story passed: independent cell, separate input/output 4x4, WebGL, mobile.');
}catch(error){
  await writeFile(resolve(out,'cpu-gpu-failure.log'),(error?.stack??String(error))+'\n'+errors.join('\n'));
  try{await page.screenshot({path:resolve(out,'cpu-gpu-failure.png'),fullPage:true});}catch{}
  throw error;
}finally{await browser.close();}
