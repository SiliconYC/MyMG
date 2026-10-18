/** Real WebGL QA of the recoil clock, including touching contacts and rewind. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from 'playwright';
const site=process.env.MYMG_QA_URL??'http://127.0.0.1:4173/MyMG/';
const out=resolve(process.env.MYMG_QA_OUTPUT??'../../output/qa-clock');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.MYMG_QA_BROWSER,args:[
  '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
  '--no-sandbox','--disable-dev-shm-usage',
]});
const page=await browser.newPage({viewport:{width:1530,height:940}});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
const scene=page.getByTestId('pendulum-clock-scene');
const read=()=>scene.evaluate(el=>{
  const number=name=>Number(el.getAttribute('data-'+name));
  return {beats:number('beats'),wheel:number('wheel-angle'),hand:number('second-hand-angle'),
    pendulum:number('pendulum-angle'),anchor:number('anchor-angle'),velocity:number('wheel-velocity'),
    impulse:number('contact-impulse'),tooth:number('contact-tooth'),contact:el.getAttribute('data-contact-side'),
    interference:el.getAttribute('data-solid-interference'),
    entryGap:number('entry-contact-distance'),exitGap:number('exit-contact-distance'),
    wheelPlane:number('wheel-plane-z'),palletPlane:number('pallet-plane-z'),
    chapter:el.getAttribute('data-camera-chapter'),x:number('camera-x'),z:number('camera-z'),
    residual:number('energy-residual'),work:number('drive-work'),solver:el.getAttribute('data-solver')};
});
const seek=async frame=>{
  await page.getByTestId('frame-slider').evaluate((el,value)=>{
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,String(value));
    el.dispatchEvent(new Event('input',{bubbles:true}));
    el.dispatchEvent(new Event('change',{bubbles:true}));
  },frame);
  await page.waitForFunction(value=>Number(document.querySelector('[data-testid="frame-readout"]')?.textContent)===value,frame,{timeout:60000});
};
try{
  await page.goto(new URL('#/pendulum-clock',site).href,{waitUntil:'networkidle',timeout:60000});
  await scene.waitFor({timeout:30000});
  assert.equal(await page.locator('video,img').count(),0);
  const canvas=scene.locator('canvas').first();await canvas.waitFor();
  assert.ok(await canvas.evaluate(el=>{
    const gl=el.getContext('webgl2')||el.getContext('webgl');
    return !!gl&&!gl.isContextLost()&&el.width>0&&el.height>0;
  }),'real, working WebGL canvas');
  const initial=await read();
  assert.equal(initial.solver,'unilateral-recoil-1920hz');
  const coldStart=Date.now();await seek(1799);const coldSeekMs=Date.now()-coldStart;
  assert.ok(coldSeekMs<3000,`cold end-of-minute seek blocked for ${coldSeekMs}ms`);
  await seek(0);assert.deepEqual(await read(),initial);
  const samples={},contacts=new Set();let recoil=false,forward=false;
  const frames=[0,6,12,19,24,30,42,48,53,60,90,204,360,672,690,720,732,750,762,780,1110,1440,1799];
  for(const frame of frames){
    await seek(frame);const s=await read();samples[frame]=s;
    assert.equal(s.interference,'false',`solid interference at ${frame}`);
    assert.equal(s.pendulum,s.anchor);
    assert.ok(Math.abs(s.hand-(s.wheel-initial.wheel))<3e-7,'same shaft displacement');
    assert.equal(s.wheelPlane,s.palletPlane);
    contacts.add(s.contact);recoil||=s.velocity<-.01;forward||=s.velocity>.01;
    if(s.contact!=='free'){
      assert.ok((s.contact==='entry'?s.entryGap:s.exitGap)<.00019,`real contact at ${frame}`);
      assert.ok(s.tooth>=0&&s.tooth<30);
    }
    if([0,204,360,720,732,750,762,780,1110,1440].includes(frame)){
      await page.waitForTimeout(100);
      await scene.screenshot({path:resolve(out,`clock-frame-${frame}.png`)});
    }
  }
  assert.ok(contacts.has('entry')&&contacts.has('exit'),'both physical working faces');
  assert.ok(recoil&&forward,'resolved forward and reverse wheel motion');
  assert.ok(samples[1799].beats>=58&&samples[1799].beats<=63);
  assert.ok(Math.abs(samples[1799].residual)<samples[1799].work*.04);
  assert.ok(samples[0].z>0&&samples[360].z<0);
  assert.equal(samples[720].x,samples[1110].x);assert.equal(samples[720].z,samples[1110].z);
  await seek(732);assert.deepEqual(await read(),samples[732],'rewind reproduces physical state');
  await seek(0);await page.getByTestId('play-toggle').click();
  await page.waitForFunction(()=>Number(document.querySelector('[data-testid="frame-readout"]')?.textContent)>6);
  await page.getByTestId('play-toggle').click();
  const frozen=await page.getByTestId('frame-readout').textContent();
  await page.waitForTimeout(250);assert.equal(await page.getByTestId('frame-readout').textContent(),frozen);
  await page.setViewportSize({width:390,height:844});await seek(732);
  await page.screenshot({path:resolve(out,'clock-mobile.png'),fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile has no horizontal overflow');
  assert.deepEqual(errors,[]);
  await writeFile(resolve(out,'clock-qa.json'),JSON.stringify({site,coldSeekMs,samples,errors},null,2));
  console.log(`PASS: WebGL recoil clock; actual contact/recoil, cold seek ${coldSeekMs}ms, deterministic rewind, common shaft, play/pause and mobile`);
}catch(e){
  await writeFile(resolve(out,'clock-error.log'),(e.stack??String(e))+'\n'+errors.join('\n'));
  try{await page.screenshot({path:resolve(out,'clock-failure.png'),fullPage:true})}catch{}
  throw e;
}finally{await browser.close()}
