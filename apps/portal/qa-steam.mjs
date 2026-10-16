/** Browser acceptance for issue #21: genuine moving cutaway, no video cheats. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from 'playwright';
const site=process.env.MYMG_QA_URL??'http://127.0.0.1:4173/MyMG/';
const out=resolve(process.env.MYMG_QA_OUTPUT??'../../output/qa-steam');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:[
  '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
  '--no-sandbox','--disable-dev-shm-usage'
]});
const page=await browser.newPage({viewport:{width:1450,height:900}});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
const frame=async()=>Number(await page.getByTestId('frame-readout').textContent());
const observe=async()=>page.getByTestId('steam-engine-scene').evaluate(el=>({
  cut:Number(el.getAttribute('data-cut-progress')),
  piston:Number(el.getAttribute('data-piston-x')),
  angle:Number(el.getAttribute('data-crank-angle')),
}));
const seek=async n=>{
  await page.getByTestId('frame-slider').evaluate((el,next)=>{
    const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
    setter.call(el,String(next));
    el.dispatchEvent(new Event('input',{bubbles:true}));
    el.dispatchEvent(new Event('change',{bubbles:true}));
  },n);
  await page.waitForFunction(target=>document.querySelector('[data-testid="frame-readout"]')
    ?.textContent===String(target),n);
  await page.waitForTimeout(130);
};
try {
  await page.goto(site,{waitUntil:'networkidle',timeout:60000});
  await page.getByTestId('project-steam-engine').click();
  assert.equal(new URL(page.url()).hash,'#/steam-engine');
  await page.getByTestId('steam-engine-scene').waitFor();
  assert.equal(await page.locator('video').count(),0);
  assert.equal(await page.getByTestId('steam-engine-scene').locator('img').count(),0);
  assert.equal(await page.getByTestId('steam-engine-scene').getAttribute('data-renderer'),
    'react-threejs-webgl');
  const canvas=page.getByTestId('steam-engine-scene').locator('canvas').first();
  await canvas.waitFor({timeout:30000});
  assert.ok(await canvas.evaluate(el=>{
    const gl=el.getContext('webgl2')||el.getContext('webgl');
    return !!gl&&!gl.isContextLost()&&el.width>0&&el.height>0;
  }),'WebGL drawing context required');
  const samples={};
  for (const f of [10,95,170,190,360,415,500]) {
    await seek(f);
    samples[f]=await observe();
    await page.getByTestId('steam-engine-scene').screenshot({path:resolve(out,'steam-'+f+'.png')});
  }
  assert.equal(samples[10].cut,0);
  assert.ok(samples[95].cut>.3 && samples[95].cut<.9);
  assert.equal(samples[170].cut,1);
  assert.equal(samples[190].cut,1);
  assert.notEqual(samples[170].piston,samples[190].piston,
    'Piston MUST keep moving while knife plane is held');
  assert.notEqual(samples[170].angle,samples[190].angle,
    'Flywheel MUST rotate while knife plane is held');
  assert.ok(samples[415].cut>0 && samples[415].cut<1);
  assert.equal(samples[500].cut,0);
  // Less is more: only one fleeting chapter title, never persistent technical HUD.
  const chapter=page.getByTestId('steam-stage-caption');
  for(const [n,title] of [[30,'蒸汽机'],[110,'剖开气缸'],
    [245,'蒸汽推动活塞'],[415,'往复变成旋转']]){
    await seek(n);
    assert.equal(await chapter.count(),1,'Only one unobtrusive chapter title is allowed');
    assert.equal(await chapter.textContent(),title);
  }
  for(const n of [170,190,360,500]){
    await seek(n);
    assert.equal(await chapter.count(),0,'Model must be alone on screen between chapters');
  }
  await page.getByTestId('steam-engine-scene').evaluate(root=>{
    const content=root.textContent||'';
    for(const forbidden of ['MYMG / ENGINEERING','3D SECTION VIEW','高压蒸汽',
      'SLIDER–CRANK','气缸剖切深度','18.0s']){
      if(content.includes(forbidden))throw new Error('Redundant HUD text: '+forbidden);
    }
  });
  // Governor is part of the SAME real-time 3D scene, not a second clip.
  const sampleGovernor=async()=>page.getByTestId('steam-engine-scene').evaluate(el=>({
    speed:Number(el.getAttribute('data-governor-speed')),
    angle:Number(el.getAttribute('data-governor-angle')),
    sleeve:Number(el.getAttribute('data-governor-sleeve')),
    throttle:Number(el.getAttribute('data-governor-throttle')),
    camera:Number(el.getAttribute('data-camera-shift')),
  }));
  const govFrames={};
  for (const n of [600,660,680,750,870]) {
    await seek(n);
    govFrames[n]=await sampleGovernor();
    await page.getByTestId('steam-engine-scene').screenshot({
      path:resolve(out,'governor-'+n+'.png'),
    });
  }
  assert.ok(govFrames[600].camera>.20 && govFrames[660].camera>.99,
    'camera must move closer to the governor, not remain static');
  assert.ok(govFrames[660].speed>govFrames[600].speed+.20);
  assert.ok(govFrames[660].angle>govFrames[600].angle+.15);
  assert.ok(govFrames[680].sleeve>govFrames[600].sleeve+.20);
  assert.ok(govFrames[680].throttle<govFrames[600].throttle-.22);
  assert.ok(Math.abs(govFrames[870].speed-1)<.04);
  assert.ok(govFrames[870].throttle>govFrames[680].throttle+.20);
  for (const [n,title] of [[580,'离心调速器'],
    [665,'转快，重锤张开'],[740,'节流，恢复转速']]) {
    await seek(n);
    assert.equal(await chapter.textContent(),title);
  }
  for (const n of [880,940]) {
    await seek(n);
    assert.equal(await chapter.count(),0,'No persistent annotation in final segment');
  }
  await seek(170);
  await page.getByTestId('play-toggle').click();
  await page.waitForFunction(()=>Number(document.querySelector('[data-testid="frame-readout"]')
    ?.textContent)>180,null,{timeout:8000});
  await page.getByTestId('play-toggle').click();
  await page.waitForTimeout(100);
  const stopped=await frame();
  await page.waitForTimeout(300);
  assert.equal(await frame(),stopped);
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:resolve(out,'steam-mobile.png'),fullPage:true});
  assert.deepEqual(errors,[]);
  await writeFile(resolve(out,'metrics.json'),JSON.stringify(samples,null,2));
  console.log('PASS: Steam WebGL 3D cutaway, moving slider crank, active held cut, scrub, pause, mobile.');
} catch(e) {
  await writeFile(resolve(out,'failure.log'),(e.stack??String(e))+'\n'+errors.join('\n'));
  try{await page.screenshot({path:resolve(out,'failure.png'),fullPage:true});}catch{}
  throw e;
} finally {await browser.close();}
