/** Real browser QA for a concrete +1 workload and physically complete chip tops. */
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
  assert.equal(await marker.getAttribute('data-chip-design'),'complete-silicon-top',
    'chip must be a solid surface; not a cutaway package with missing top');
  assert.equal(await page.locator('video').count(),0);
  assert.equal(await marker.locator('img').count(),0);
  const canvas=marker.locator('canvas').first();
  await canvas.waitFor();
  assert.ok(await canvas.evaluate(el=>{
    const gl=el.getContext('webgl2')||el.getContext('webgl');
    return !!gl&&!gl.isContextLost()&&el.width>=100&&el.height>=100;
  }),'original Three.js WebGL context required');
  const photo=async(frame,stage,doneCpu,doneGpu,workingCpu,workingGpu)=>{
    await seek(frame);
    assert.equal(await marker.getAttribute('data-workload'),stage);
    assert.equal(Number(await marker.getAttribute('data-task-count')),16);
    assert.equal(Number(await marker.getAttribute('data-cpu-done')),doneCpu);
    assert.equal(Number(await marker.getAttribute('data-gpu-done')),doneGpu);
    assert.equal(Number(await marker.getAttribute('data-cpu-working')),workingCpu);
    assert.equal(Number(await marker.getAttribute('data-gpu-working')),workingGpu);
    const zoom=Number(await marker.getAttribute('data-camera-zoom'));
    assert.ok(zoom>=40&&zoom<=67&&720/zoom>10.5);
    assert.equal(await marker.locator('span').count(),1,'one annotation, no dashboard');
    const png=await marker.screenshot({path:resolve(out,'cpu-gpu-full-die-'+frame+'.png')});
    assert.ok(png.byteLength>6000,'empty WebGL frame at '+frame);
    return png;
  };

  const f0=await photo(0,'task',0,0,0,0);
  const caption=await marker.locator('span').textContent();
  assert.match(caption,/每筆數據加 1/);
  assert.match(caption,/白色待算/);
  assert.match(caption,/藍色代表完成/);
  const f8=await photo(8,'task',0,0,1,0);
  assert.ok(Buffer.compare(f0,f8)!==0,
    'intro is visually motionless: a real task must move in the first eight frames');
  assert.ok(Number(await marker.getAttribute('data-intro-task-progress'))>.1);
  await photo(34,'task',0,0,1,0);
  assert.ok(Number(await marker.getAttribute('data-intro-task-dyed'))>.5,
    'the actual input should visibly change color inside CPU');
  await photo(64,'task',1,0,0,0);
  await photo(72,'cpu',1,0,0,0);
  await photo(90,'cpu',1,0,3,0);
  await photo(146,'cpu',8,0,0,0);
  await photo(222,'cpu',16,0,0,0);
  await photo(340,'gpu',16,0,0,16);
  await photo(357,'gpu',16,16,0,0);
  await photo(420,'compare',16,16,0,0);
  await photo(475,'compare',16,16,0,0);

  for(const frame of [69,70,270,271,396,397,423,424]){
    await seek(frame);
    assert.equal(Number(await marker.getAttribute('data-cpu-done')),
      frame<64?0:frame<108?1:frame<146?4:frame<184?8:frame<222?12:16,
      'CPU outputs reset unexpectedly');
    const png=await marker.screenshot({path:resolve(out,'cpu-gpu-transition-'+frame+'.png')});
    assert.ok(png.byteLength>6000);
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
  const stopped=await readFrame();
  await page.waitForTimeout(300);
  assert.equal(await readFrame(),stopped);
  await page.goto(new URL('#/cpu-gpu',site).href,{waitUntil:'networkidle'});
  await marker.waitFor();
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:resolve(out,'cpu-gpu-full-die-mobile.png'),fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('CPU/GPU WebGL QA passed: moving +1 intro, solid die, 16 actual jobs, continuous camera, mobile.');
}catch(error){
  await writeFile(resolve(out,'cpu-gpu-failure.log'),(error?.stack??String(error))+'\n'+errors.join('\n'));
  try{await page.screenshot({path:resolve(out,'cpu-gpu-failure.png'),fullPage:true});}catch{}
  throw error;
}finally{await browser.close();}
