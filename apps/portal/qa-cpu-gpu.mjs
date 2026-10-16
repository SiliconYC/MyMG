/** Browser proof: literal task movement, four CPU waves vs one GPU wave. */
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
  await page.waitForFunction(x=>document.querySelector('[data-testid="frame-readout"]')?.textContent===String(x),target);
  await page.waitForTimeout(180);
};
try{
  await page.goto(new URL('#/',site).href,{waitUntil:'networkidle'});
  await page.getByTestId('project-cpu-gpu').waitFor();
  await page.getByTestId('project-cpu-gpu').click();
  assert.equal(new URL(page.url()).hash,'#/cpu-gpu');
  const marker=page.getByTestId('cpu-gpu-native-scene');
  await marker.waitFor();
  assert.equal(await marker.getAttribute('data-renderer'),'react-threejs-webgl');
  assert.equal(await page.locator('video').count(),0);
  assert.equal(await marker.locator('img').count(),0);
  const canvas=marker.locator('canvas').first();
  await canvas.waitFor();
  assert.ok(await canvas.evaluate(el=>{
    const gl=el.getContext('webgl2')||el.getContext('webgl');
    return !!gl&&!gl.isContextLost()&&el.width>=100&&el.height>=100;
  }),'genuine Three.js WebGL context required');
  const shot=async(frame,stage,doneCpu,doneGpu,workingCpu,workingGpu)=>{
    await seek(frame);
    assert.equal(await marker.getAttribute('data-workload'),stage);
    assert.equal(Number(await marker.getAttribute('data-task-count')),16);
    assert.equal(Number(await marker.getAttribute('data-cpu-done')),doneCpu);
    assert.equal(Number(await marker.getAttribute('data-gpu-done')),doneGpu);
    assert.equal(Number(await marker.getAttribute('data-cpu-working')),workingCpu);
    assert.equal(Number(await marker.getAttribute('data-gpu-working')),workingGpu);
    assert.equal(await marker.locator('span').count(),1,
      'Only one caption — no visual dashboard');
    const png=await marker.screenshot({path:resolve(out,'cpu-gpu-tasks-'+frame+'.png')});
    assert.ok(png.byteLength>6000,'Expected populated 3D screenshot at '+frame);
  };
  await shot(40,'task',0,0,0,0);
  await shot(140,'cpu',0,0,4,0);
  await shot(164,'cpu',4,0,0,0);
  await shot(280,'cpu',16,0,0,0);
  await shot(352,'gpu',16,0,0,16);
  await shot(380,'gpu',16,16,0,0);
  await shot(430,'compare',0,0,0,0);
  await shot(530,'compare',4,16,4,0);
  await seek(200);
  await page.getByRole('button',{name:'前进一帧'}).click();
  assert.equal(await readFrame(),201);
  await page.getByRole('button',{name:'后退一帧'}).click();
  assert.equal(await readFrame(),200);
  await page.getByTestId('play-toggle').click();
  await page.waitForFunction(()=>Number(document.querySelector('[data-testid="frame-readout"]')?.textContent)>204,
    null,{timeout:10000});
  await page.getByTestId('play-toggle').click();
  await page.waitForTimeout(160);
  const frozen=await readFrame();
  await page.waitForTimeout(300);
  assert.equal(await readFrame(),frozen);
  await page.goto(new URL('#/cpu-gpu',site).href,{waitUntil:'networkidle'});
  await marker.waitFor();
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:resolve(out,'cpu-gpu-task-flow-mobile.png'),fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('CPU/GPU task-flow WebGL QA passed: source, working cores, dyed output, replay, player, mobile.');
}catch(error){
  await writeFile(resolve(out,'cpu-gpu-failure.log'),(error?.stack??String(error))+'\n'+errors.join('\n'));
  try{await page.screenshot({path:resolve(out,'cpu-gpu-failure.png'),fullPage:true});}catch{}
  throw error;
}finally{await browser.close();}
