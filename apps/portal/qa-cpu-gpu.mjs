/** Real Chromium/WebGL proof for CPU/GPU #22; no video substitution. */
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
const percent=async kind=>Number((await page.getByTestId(kind+'-completion').textContent()).replace('%',''));
try{
  await page.goto(new URL('#/',site).href,{waitUntil:'networkidle'});
  await page.getByTestId('project-cpu-gpu').waitFor();
  await page.screenshot({path:resolve(out,'cpu-gpu-in-catalog.png'),fullPage:true});
  await page.getByTestId('project-cpu-gpu').click();
  assert.equal(new URL(page.url()).hash,'#/cpu-gpu');
  await page.getByTestId('cpu-gpu-native-scene').waitFor();
  assert.equal(await page.locator('video').count(),0);
  assert.equal(await page.getByTestId('player-shell').locator('img').count(),0);
  const marker=page.getByTestId('cpu-gpu-native-scene');
  assert.equal(await marker.getAttribute('data-renderer'),'react-threejs-webgl');
  const canvas=marker.locator('canvas').first();
  await canvas.waitFor();
  const webgl=await canvas.evaluate(el=>{
    const gl=el.getContext('webgl2')||el.getContext('webgl');
    return !!gl&&!gl.isContextLost()&&el.width>100&&el.height>100;
  });
  assert.equal(webgl,true,'CPU/GPU needs an actual live Three.js WebGL context');
  for(const [frame,stage] of [[60,'reveal'],[140,'uniform'],[401,'branch'],[540,'compare']]){
    await seek(frame);
    assert.equal(await marker.getAttribute('data-workload'),stage);
    const png=await marker.screenshot({path:resolve(out,'cpu-gpu-frame-'+frame+'.png')});
    assert.ok(png.byteLength>12000,'Nontrivial 3D screenshot required at '+frame);
    if(frame===140)assert.ok(await percent('gpu')>await percent('cpu')*3,
      'Same instruction should expose GPU throughput');
    if(frame===401)assert.ok(await percent('cpu')>await percent('gpu'),
      'Different branches should expose independent CPU control flows');
  }
  await seek(200);
  await page.getByRole('button',{name:'前进一帧'}).click();
  assert.equal(await readFrame(),201);
  await page.getByRole('button',{name:'后退一帧'}).click();
  assert.equal(await readFrame(),200);
  await page.getByTestId('play-toggle').click();
  await page.waitForFunction(()=>Number(document.querySelector('[data-testid="frame-readout"]')?.textContent)>205,
    null,{timeout:10000});
  await page.getByTestId('play-toggle').click();
  await page.waitForTimeout(160);
  const frozen=await readFrame();
  await page.waitForTimeout(270);
  assert.equal(await readFrame(),frozen,'Paused 3D geometry freezes exactly');
  await page.goto(new URL('#/cpu-gpu',site).href,{waitUntil:'networkidle'});
  await marker.waitFor();
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:resolve(out,'cpu-gpu-mobile.png'),fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('CPU/GPU #22 Chromium GPU QA: PASS, 4 keyframes, playback, direct Pages route, mobile.');
}catch(err){
  await writeFile(resolve(out,'cpu-gpu-failure.log'),(err?.stack??String(err))+'\n'+errors.join('\n'));
  try{await page.screenshot({path:resolve(out,'cpu-gpu-failure.png'),fullPage:true});}catch{}
  throw err;
}finally{await browser.close();}
