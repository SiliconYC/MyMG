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
  for (const f of [10,55,90,105,130,160,190,225,255,305,360,405,480,570]) {
    await seek(f);
    samples[f]=await observe();
    if([55,90,160].includes(f)) await page.getByTestId('steam-engine-scene').screenshot({path:resolve(out,'steam-'+f+'.png')});
  }
  assert.equal(samples[10].cut,0);
  assert.ok(samples[55].cut>.30 && samples[55].cut<.95);
  assert.equal(samples[90].cut,1);
  assert.equal(samples[105].cut,1);
  assert.notEqual(samples[90].piston,samples[105].piston);
  assert.notEqual(samples[90].angle,samples[105].angle);
  assert.ok(samples[130].cut>0 && samples[130].cut<1);
  assert.equal(samples[160].cut,0);
  // Less is more: only one fleeting chapter title, never persistent technical HUD.
  const chapter=page.getByTestId('steam-stage-caption');
  for(const [n,title] of [[20,'蒸汽机'],[60,'气缸剖面']]){
    await seek(n);
    assert.equal(await chapter.count(),1,'Only one unobtrusive chapter title is allowed');
    assert.equal(await chapter.textContent(),title);
  }
  for(const n of [110,595]){
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
    zoom:Number(el.getAttribute('data-camera-zoom')),
  }));
  const govFrames={};
  for (const n of [150,190,225,255,270,305,360,405,480,555]) {
    await seek(n);
    govFrames[n]=await sampleGovernor();
    if([225,305,360,480].includes(n)) await page.getByTestId('steam-engine-scene').screenshot({
      path:resolve(out,'governor-'+n+'.png'),
    });
  }
  assert.ok(govFrames[150].camera>.01 && govFrames[190].camera>.99,
    'the initial pan must finish early');
  assert.ok(govFrames[225].zoom>185 && govFrames[225].zoom<195,
    'governor must stay substantially closer during teaching');
  assert.ok(govFrames[305].speed>govFrames[225].speed+.52,
    'overspeed must be a large, obvious visual change');
  assert.ok(govFrames[305].angle>govFrames[225].angle+.42,
    'flyballs must open substantially');
  assert.ok(govFrames[360].sleeve>govFrames[225].sleeve+.70,
    'collar height needs substantial visible travel');
  assert.ok(govFrames[360].throttle<govFrames[225].throttle-.38);
  assert.ok(Math.abs(govFrames[480].speed-1)<.04,
    'negative feedback returns speed toward nominal');
  assert.ok(govFrames[480].throttle>govFrames[360].throttle+.38);
  // Long on-screen teaching beats: every label lasts long enough to read.
  // Timings are guaranteed by deterministic 30 fps frame seeking.
  await seek(285);
  assert.equal(await page.getByTestId('steam-callout').getAttribute('data-callout-part'),'balls');
  await seek(330);
  assert.equal(await page.getByTestId('steam-callout').getAttribute('data-callout-part'),'sleeve');
  const placement=await page.getByTestId('steam-engine-scene').evaluate(el=>({
    governor:Number(el.getAttribute('data-governor-x')),
    throttle:Number(el.getAttribute('data-throttle-x')),
  }));
  assert.ok(placement.governor>0&&placement.governor<3,
    'governor must be positioned above and next to the flywheel, not off on the right');
  assert.ok(placement.throttle<placement.governor,
    'intake throttle must lie upstream toward the steam chest');
  // Real geometry depth: balls and drive are IN FRONT of the steam supply.
  const layout=await page.getByTestId('steam-engine-scene').evaluate(el=>({
    governorZ:Number(el.getAttribute('data-governor-z')),
    pipeZ:Number(el.getAttribute('data-pipe-z')),
  }));
  assert.ok(layout.governorZ-layout.pipeZ>1.0,
    'flyballs must be mounted in front of the inlet pipe, not hidden behind it');
  const orbits={};
  for(const n of [15,72,165,185,426]){
    await seek(n);
    orbits[n]=await page.getByTestId('steam-engine-scene').evaluate(el=>({
      yaw:Number(el.getAttribute('data-camera-azimuth')),
      pitch:Number(el.getAttribute('data-camera-elevation')),
    }));
    if([185,426].includes(n)) await page.getByTestId('steam-engine-scene').screenshot({
      path:resolve(out,'orbit-'+n+'.png'),
    });
  }
  const toDeg=r=>r*180/Math.PI;
  assert.ok(toDeg(Math.abs(orbits[185].yaw-orbits[15].yaw))>45,
    'camera must orbit 45+ degrees around the governor, not just pan sideways');
  assert.ok(toDeg(Math.abs(orbits[185].pitch-orbits[15].pitch))>7,
    'camera must change elevation as well as azimuth');
  assert.ok(toDeg(Math.abs(orbits[426].yaw-orbits[185].yaw))>12,
    'second orbit should reveal the inlet throttle from another angle');
  // The viewer is guided to five meaningful REAL 3D parts, one at a time.
  const beats=[
    [179,'belt','皮带'],
    [258,'balls','重锤'],
    [334,'sleeve','套筒'],
    [426,'valve','节流阀'],
    [531,'flywheel','稳定'],
  ];
  const callout=page.getByTestId('steam-callout');
  for(const [n,part,keyword] of beats){
    await seek(n);
    assert.equal(await chapter.count(),0,'No chapter title may crowd the annotation');
    assert.equal(await callout.count(),1,'Exactly one callout at each teaching beat');
    assert.equal(await callout.getAttribute('data-callout-part'),part);
    assert.match(await callout.textContent(),new RegExp(keyword));
    const dot=await callout.evaluate(el=>({
      x:Number(el.getAttribute('data-anchor-x')),
      y:Number(el.getAttribute('data-anchor-y')),
      paths:el.querySelectorAll('svg path').length,
      dots:el.querySelectorAll('svg circle').length,
    }));
    assert.ok(dot.x>0 && dot.x<1280 && dot.y>0 && dot.y<720,
      'Leader endpoint out of frame: '+part+' '+JSON.stringify(dot));
    assert.equal(dot.paths,1);
    assert.equal(dot.dots,2);
    if(['balls','sleeve','valve'].includes(part)) await page.getByTestId('steam-engine-scene').screenshot({
      path:resolve(out,'annotated-'+part+'.png'),
    });
  }
  await seek(258);
  const stationaryAnchor={
    x:await callout.getAttribute('data-anchor-x'),
    y:await callout.getAttribute('data-anchor-y'),
  };
  await seek(270);
  assert.equal(await callout.getAttribute('data-callout-part'),'balls');
  assert.equal(await callout.getAttribute('data-anchor-x'),stationaryAnchor.x,
    'NEVER attach a leader line to a rapidly spinning ball');
  assert.equal(await callout.getAttribute('data-anchor-y'),stationaryAnchor.y,
    'The leader must stay on the stationary governor bearing');
  for(const n of [110,595]){
    await seek(n);
    assert.equal(await callout.count(),0,'No permanent HUD after explanation ends, frame '+n);
  }
  await seek(100);
  await page.getByTestId('play-toggle').click();
  await page.waitForFunction(()=>Number(document.querySelector('[data-testid="frame-readout"]')
    ?.textContent)>111,null,{timeout:8000});
  await page.getByTestId('play-toggle').click();
  await page.waitForTimeout(100);
  const stopped=await frame();
  await page.waitForTimeout(300);
  assert.equal(await frame(),stopped);
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:resolve(out,'steam-mobile.png'),fullPage:true});
  assert.deepEqual(errors,[]);
  await writeFile(resolve(out,'metrics.json'),JSON.stringify(samples,null,2));
  console.log('PASS: bright chest, separated pipes, steady governor leaders, 20s close-up and overspeed feedback.');
} catch(e) {
  await writeFile(resolve(out,'failure.log'),(e.stack??String(e))+'\n'+errors.join('\n'));
  try{await page.screenshot({path:resolve(out,'failure.png'),fullPage:true});}catch{}
  throw e;
} finally {await browser.close();}
