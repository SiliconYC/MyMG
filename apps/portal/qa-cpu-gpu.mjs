/** Visual minimalism and real browser 3D validation; no screenshot/video masquerade. */
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
    return !!gl && !gl.isContextLost() && el.width>=100 && el.height>=100;
  }),'must use a working, original Three.js WebGL canvas');
  for(const [frame,beat,labels] of [
    [70,'cpu',['CPU']],
    [200,'gpu',['GPU']],
    [350,'compare',['CPU','GPU']],
  ]){
    await seek(frame);
    assert.equal(await marker.getAttribute('data-workload'),beat);
    const shown=await marker.locator('span').allTextContents();
    assert.deepEqual(shown,labels,'No subtitle paragraphs or HUD clutter in the animation');
    const shot=await marker.screenshot({path:resolve(out,'cpu-gpu-minimal-'+frame+'.png')});
    assert.ok(shot.byteLength>5000,'Expected a real, populated 3D scene at '+frame);
    const cpu=Number(await marker.getAttribute('data-cpu-active'));
    const gpu=Number(await marker.getAttribute('data-gpu-active'));
    if(frame===70)assert.ok(cpu<=1 && gpu===0,'CPU is observed alone');
    if(frame===200)assert.equal(gpu,64,'GPU wave is synchronized');
  }
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
  await page.waitForTimeout(290);
  assert.equal(await readFrame(),frozen);
  await page.goto(new URL('#/cpu-gpu',site).href,{waitUntil:'networkidle'});
  await marker.waitFor();
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:resolve(out,'cpu-gpu-minimal-mobile.png'),fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('CPU/GPU minimal 3D verified: clean label-only scene, three shots, live WebGL, mobile and frame controls.');
}catch(error){
  await writeFile(resolve(out,'cpu-gpu-failure.log'),(error?.stack??String(error))+'\n'+errors.join('\n'));
  try{await page.screenshot({path:resolve(out,'cpu-gpu-failure.png'),fullPage:true});}catch{}
  throw error;
}finally{await browser.close();}
