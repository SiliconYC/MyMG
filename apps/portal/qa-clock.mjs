/** Real Chromium/WebGL QA. The mechanical state is physics-driven: don't
 * make assertions about pre-scripted beat timestamps or wheel rotations.
 */
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
const read=()=>scene.evaluate(el=>{
  const num=name=>Number(el.getAttribute('data-'+name));
  return {
    physics:el.getAttribute('data-physics'),
    pendulum:num('pendulum-angle'),anchor:num('anchor-angle'),
    wheel:num('wheel-angle'),hand:num('second-hand-angle'),
    wheelVelocity:num('wheel-velocity'),
    pendulumVelocity:num('pendulum-velocity'),
    impulse:num('contact-impulse'),contacts:num('contact-count'),
    penetration:num('max-penetration'),
    armClearance:num('arm-clearance'),
    jammed:el.getAttribute('data-jammed')==='true',
    wheelPlane:num('wheel-plane-z'),palletPlane:num('pallet-plane-z'),
    forkPlane:num('fork-arm-plane-z'),
    bearing:num('wheel-bearing-axial-overlap'),
    side:el.getAttribute('data-contact-side'),
    chapter:el.getAttribute('data-camera-chapter'),
    cameraZ:num('camera-z'),cameraX:num('camera-x'),
  };
});
try{
  await page.goto(new URL('#/pendulum-clock',site).href,{waitUntil:'networkidle',timeout:60000});
  await scene.waitFor({timeout:30000});
  assert.equal(await page.locator('video,img').count(),0);
  const canvas=scene.locator('canvas').first();
  await canvas.waitFor({timeout:30000});
  assert.ok(await canvas.evaluate(el=>{
    const gl=el.getContext('webgl2')||el.getContext('webgl');
    return !!gl&&!gl.isContextLost()&&el.width>0&&el.height>0;
  }), 'working Three.js canvas required');

  const samples=[];
  for(const [frame,filename] of [
    [0,'clock-front.png'],[204,'clock-side.png'],
    [360,'clock-rear.png'],[732,'clock-contact-entry.png'],
    [762,'clock-contact-next.png'],[1110,'clock-contact-later.png'],
    [1440,'clock-second-hand.png'],[1799,'clock-end.png'],
  ]){
    await seek(frame);
    await page.waitForTimeout(100);
    const state=await read();
    samples.push({frame,...state});
    assert.equal(state.physics,'rigid-contact');
    assert.equal(state.pendulum,state.anchor);
    assert.equal(state.wheel,state.hand);
    assert.equal(state.wheelPlane,state.palletPlane);
    assert.equal(state.wheelPlane,state.forkPlane,
      'whole V fork must lie in the same working plane as the gear');
    assert.ok(state.bearing>=.22-1e-5);
    assert.ok(state.penetration<.04);
    assert.ok(Object.values(state).every(v=>typeof v!=='number'||Number.isFinite(v)));
    await scene.screenshot({path:resolve(out,filename)});
  }
  assert.ok(samples[1].cameraX>2,'side view must genuinely reveal 3D depth');
  assert.ok(samples[2].cameraZ< -6);
  assert.ok(samples[3].cameraZ< -3);
  assert.ok(samples.at(-1).wheel>samples[0].wheel+.1,
    'escape wheel must move under contact-driven mechanics');
  const old=await scene.screenshot();
  await seek(0);
  await seek(762);
  assert.deepEqual(await read(),samples[4],
    'frame seeking cannot change deterministic physical outcomes');
  assert.ok(!old.equals(await scene.screenshot()));
  await page.getByTestId('play-toggle').click();
  await page.waitForFunction(()=>Number(
    document.querySelector('[data-testid="frame-readout"]')?.textContent)>765);
  await page.getByTestId('play-toggle').click();
  const frozen=await page.getByTestId('frame-readout').textContent();
  await page.waitForTimeout(250);
  assert.equal(await page.getByTestId('frame-readout').textContent(),frozen);
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:resolve(out,'clock-mobile.png'),fullPage:true});
  assert.deepEqual(errors,[]);
  await writeFile(resolve(out,'clock-qa.json'),JSON.stringify({site,samples},null,2));
  console.log('PASS: clock WebGL rigid contact + gravity + torque + shared mesh/collider + frame seek');
}catch(e){
  await writeFile(resolve(out,'clock-error.log'),(e.stack??String(e))+'\n'+errors.join('\n'));
  try{await page.screenshot({path:resolve(out,'clock-failure.png'),fullPage:true})}catch{}
  throw e;
}finally{await browser.close()}
