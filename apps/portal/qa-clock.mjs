/** Browser QA for the new clock: real WebGL geometry and state-derived hand movement. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from 'playwright';

const site=process.env.MYMG_QA_URL??'http://127.0.0.1:4173/MyMG/';
const out=resolve(process.env.MYMG_QA_OUTPUT??'../../output/qa-clock');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:[
  '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
  '--no-sandbox','--disable-dev-shm-usage',
]});
const page=await browser.newPage({viewport:{width:1530,height:940}});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
const scene=page.getByTestId('pendulum-clock-scene');
const read=async()=>scene.evaluate(el=>({
  beats:Number(el.getAttribute('data-beats')),
  wheel:Number(el.getAttribute('data-wheel-angle')),
  hand:Number(el.getAttribute('data-second-hand-angle')),
  lock:el.getAttribute('data-lock'),
}));
const seek=async frame=>{
  await page.getByTestId('frame-slider').evaluate((el,value)=>{
    const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
    setter.call(el,String(value));
    el.dispatchEvent(new Event('input',{bubbles:true}));
    el.dispatchEvent(new Event('change',{bubbles:true}));
  },frame);
  await page.waitForFunction(value=>Number(
    document.querySelector('[data-testid="frame-readout"]')?.textContent)===value,frame);
};
try{
  await page.goto(new URL('#/pendulum-clock',site).href,{waitUntil:'networkidle',timeout:60000});
  await scene.waitFor({timeout:30000});
  assert.equal(await page.locator('video,img').count(),0,'Clock cannot use images or videos');
  const canvas=scene.locator('canvas').first();
  await canvas.waitFor({timeout:30000});
  const webgl=await canvas.evaluate(el=>{
    const gl=el.getContext('webgl2')||el.getContext('webgl');
    return !!gl && !gl.isContextLost() && el.width>0 && el.height>0;
  });
  assert.ok(webgl,'Working Three.js WebGL canvas required');
  const front=await scene.screenshot({path:resolve(out,'cinematic-front.png')});
  const camera=async()=>scene.evaluate(el=>({
    x:Number(el.getAttribute('data-camera-x')),
    z:Number(el.getAttribute('data-camera-z')),
    distance:Number(el.getAttribute('data-camera-distance')),
    chapter:el.getAttribute('data-camera-chapter')
  }));
  const startCamera=await camera();
  assert.ok(startCamera.z>18,'front hero camera must be positioned IN FRONT');
  await seek(11*30);
  const sideCamera=await camera();
  assert.ok(sideCamera.x>8,'camera must make an actual side orbit');
  await scene.screenshot({path:resolve(out,'cinematic-side.png')});
  await seek(23*30);
  const rearCamera=await camera();
  assert.ok(rearCamera.z< -6,'3D camera must pass BEHIND the escapement');
  assert.equal(rearCamera.chapter,'escapement');
  const rear=await scene.screenshot({path:resolve(out,'cinematic-rear.png')});
  assert.ok(!front.equals(rear),'front and rear views must be visually different');
  await seek(31*30);
  const macro=await camera();
  assert.ok(macro.distance < startCamera.distance*.5,
    'real camera dolly/zoom must move close to the anchor pallets');
  await scene.screenshot({path:resolve(out,'cinematic-tooth-closeup.png')});
  await seek(50*30);
  assert.ok((await camera()).z>9,'final dial reveal must come back to the front');
  await scene.screenshot({path:resolve(out,'cinematic-dial.png')});
  await seek(0);

  const frames=[0,10,16,24,30,44,53,60,90,600,1799];
  const states={};
  for(const frame of frames){
    await seek(frame);
    await page.waitForTimeout(110);
    states[frame]=await read();
    assert.equal(states[frame].hand,states[frame].wheel,'shared shaft angle at frame '+frame);
    if([0,16,30,44,53,90,1799].includes(frame)){
      await scene.screenshot({path:resolve(out,'clock-frame-'+frame+'.png')});
    }
  }
  assert.equal(states[0].beats,0);
  assert.equal(states[10].beats,0);
  assert.equal(states[16].beats,1);
  assert.equal(states[30].beats,1);
  assert.equal(states[53].beats,2);
  assert.equal(states[90].beats,3);
  assert.equal(states[1799].beats,60);
  assert.equal(states[0].lock,'entry');
  assert.equal(states[24].lock,'exit');
  assert.equal(states[53].lock,'entry');
  assert.equal(states[24].wheel,states[30].wheel,'wheel locked between beats');
  assert.ok(Math.abs(states[1799].wheel-2*Math.PI)<.000001);
  await seek(0);
  await page.getByTestId('play-toggle').click();
  await page.waitForFunction(()=>Number(
    document.querySelector('[data-testid="frame-readout"]')?.textContent)>6);
  await page.getByTestId('play-toggle').click();
  const frozen=await page.getByTestId('frame-readout').textContent();
  await page.waitForTimeout(250);
  assert.equal(await page.getByTestId('frame-readout').textContent(),frozen);
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:resolve(out,'clock-mobile.png'),fullPage:true});
  assert.deepEqual(errors,[]);
  await writeFile(resolve(out,'clock-qa.json'),JSON.stringify({site,states},null,2));
  console.log('PASS: clock WebGL; 30 teeth, alternating pallets, 60 beats, seconds hand, seek/pause, mobile and screenshots');
}catch(e){
  await writeFile(resolve(out,'clock-error.log'),(e.stack??String(e))+'\n'+errors.join('\n'));
  try{await page.screenshot({path:resolve(out,'clock-failure.png'),fullPage:true})}catch{}
  throw e;
}finally{await browser.close()}
