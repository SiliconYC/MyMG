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
  pendulum:Number(el.getAttribute('data-pendulum-angle')),
  anchor:Number(el.getAttribute('data-anchor-angle')),
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
  const camera=async()=>scene.evaluate(el=>({
    x:Number(el.getAttribute('data-camera-x')),
    z:Number(el.getAttribute('data-camera-z')),
    distance:Number(el.getAttribute('data-camera-distance')),
    chapter:el.getAttribute('data-camera-chapter'),
    mode:el.getAttribute('data-camera-mode'),
    side:el.getAttribute('data-contact-side'),
    interference:el.getAttribute('data-solid-interference'),
    leftGap:Number(el.getAttribute('data-entry-contact-distance')),
    rightGap:Number(el.getAttribute('data-exit-contact-distance')),
    wheelPlane:Number(el.getAttribute('data-wheel-plane-z')),
    palletPlane:Number(el.getAttribute('data-pallet-plane-z')),
    forkArmPlane:Number(el.getAttribute('data-fork-arm-plane-z')),
    shaftThroughBearing:Number(el.getAttribute('data-wheel-bearing-axial-overlap')),
    radialRunningClearance:Number(el.getAttribute('data-wheel-bearing-running-clearance')),
  }));
  const checkShot=async(time,chapter,mode,filename)=>{
    await seek(Math.round(time*30));
    await page.waitForTimeout(140);
    const current=await camera();
    assert.equal(current.chapter,chapter,'shot at '+time+' seconds');
    assert.equal(current.mode,mode,'shot mode at '+time+' seconds');
    const png=await scene.screenshot({path:resolve(out,filename)});
    return {current,png};
  };
  const front=await checkShot(0,'front','observe','clock-front.png');
  assert.ok(front.current.z>12);
  const orbit=await checkShot(6.4,'rear','travel','clock-short-orbit.png');
  assert.ok(orbit.current.x>2);
  const side=await checkShot(6.8,'rear','travel','clock-axial-side.png');
  assert.ok(side.current.x>5,'side shot must expose axial wheel/pallet relation');
  assert.equal(side.current.wheelPlane,side.current.palletPlane,
    'wheel teeth and both pallets must occupy the same 3D working plane');
  assert.equal(side.current.forkArmPlane,side.current.wheelPlane,
    'the ENTIRE fork arm must be coplanar with the wheel, not just its pallet tip');
  assert.ok(side.current.shaftThroughBearing>=.22-1e-5,
    'rear axle must cross the full bearing width, not float in free space');
  assert.ok(side.current.radialRunningClearance>.005 &&
    side.current.radialRunningClearance<.03,
    'support sleeve must have a small real radial running clearance');
  assert.equal(side.current.interference,'false','full pallet solids must not penetrate the wheel');
  const rear=await checkShot(12,'rear','observe','clock-rear.png');
  assert.ok(rear.current.z< -6);
  assert.ok(!front.png.equals(rear.png));
  const entry=await checkShot(24.4,'contact','observe','clock-entry-contact.png');
  const exit=await checkShot(25.4,'contact','observe','clock-exit-contact.png');
  assert.equal(entry.current.side,'entry');
  assert.equal(exit.current.side,'exit');
  assert.ok(entry.current.leftGap<.055,'entry wedge approaches tooth without solid overlap');
  assert.ok(exit.current.rightGap<.055,'exit wedge approaches tooth without solid overlap');
  assert.equal(entry.current.x,exit.current.x,'same macro camera for both contacts');
  assert.equal(entry.current.z,exit.current.z,'no frantic macro switch');
  assert.ok(!entry.png.equals(exit.png),'alternate lock has distinct visible frame');
  const hold=await checkShot(37,'contact','observe','clock-long-contact-hold.png');
  assert.equal(hold.current.z,entry.current.z,'hold is truly stationary');
  // A real rigid fork touches each flank when the pendulum approaches the
  // release threshold; avoid masking disagreement by pinning tips to teeth.
  await seek(12);
  const entryThreshold=await camera();
  assert.ok(entryThreshold.leftGap<.055,'entry tip remains close at 0.4s');
  await seek(42);
  const exitThreshold=await camera();
  assert.ok(exitThreshold.rightGap<.055,'exit tip remains close at 1.4s');

  const proof=await checkShot(48,'proof','observe','clock-second-hand.png');
  assert.ok(proof.current.z>10);
  await seek(0);

  const frames=[0,10,16,24,30,44,53,60,90,600,1799];
  const states={};
  for(const frame of frames){
    await seek(frame);
    await page.waitForTimeout(110);
    states[frame]=await read();
    assert.equal((await camera()).interference,'false','no shoe-wheel clipping at '+frame);
    assert.equal(states[frame].hand,states[frame].wheel,'shared shaft angle at frame '+frame);
    assert.equal(states[frame].pendulum,states[frame].anchor,
      'anchor MUST follow pendulum at frame '+frame);
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
