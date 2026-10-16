/** Browser QA: deterministic transport, actual WebGL and HBM keyframe image evidence. */
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from 'playwright';

const site = process.env.MYMG_QA_URL ?? 'http://127.0.0.1:4173/MyMG/';
const out = resolve(process.env.MYMG_QA_OUTPUT ?? '../../output/qa-portal');
const requireWebgl = process.env.MYMG_QA_REQUIRE_WEBGL !== '0';
await mkdir(out, {recursive: true});
const errors = [];
const browser = await chromium.launch({headless: true, args: [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--disable-dev-shm-usage', '--no-sandbox',
]});
const page = await browser.newPage({viewport: {width:1440,height:900},deviceScaleFactor:1});
page.on('pageerror', error=>errors.push('pageerror: '+error.message));
page.on('console', message=>{if(message.type()==='error') errors.push('console: '+message.text());});

const shell = page.getByTestId('player-shell');
const readFrame = async () => Number(await page.getByTestId('frame-readout').textContent());
const seek = async (frame) => {
  const slider = page.getByTestId('frame-slider');
  await slider.evaluate((el, next)=>{
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
    setter.call(el,String(next));
    el.dispatchEvent(new Event('input',{bubbles:true}));
    el.dispatchEvent(new Event('change',{bubbles:true}));
  },frame);
  await page.waitForFunction(target=>Number(document.querySelector('[data-testid="frame-readout"]')?.textContent)===target,frame);
  await page.waitForTimeout(200);
};

// Decode the real screenshot in a 2D canvas, downsample, and read RGB.
// No dependency on transient WebGL drawing buffers or unverified snapshots.
const measure = async png => page.evaluate(async b64=>{
  const img = new Image();
  img.src='data:image/png;base64,'+b64;
  await img.decode();
  const canvas=document.createElement('canvas');canvas.width=160;canvas.height=90;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(img,0,0,160,90);
  const data=ctx.getImageData(0,0,160,90).data;
  const samples=[];let colored=0;
  for(let y=0;y<90;y++)for(let x=0;x<160;x++){
    const k=(y*160+x)*4, r=data[k],g=data[k+1],b=data[k+2];
    samples.push(r,g,b);
    // Only the center of the scene; captions alone cannot satisfy this.
    if(x>30 && x<135 && y>20 && y<75 &&
      (Math.abs(r-241)>35 || Math.abs(g-238)>35 || Math.abs(b-232)>35)) colored++;
  }
  return {samples,colored};
},png.toString('base64'));

const difference=(a,b)=>{
  assert.equal(a.samples.length,b.samples.length);
  let changed=0;
  for(let i=0;i<a.samples.length;i+=3){
    if(Math.abs(a.samples[i]-b.samples[i])+
       Math.abs(a.samples[i+1]-b.samples[i+1])+
       Math.abs(a.samples[i+2]-b.samples[i+2])>48) changed++;
  }
  return changed/(a.samples.length/3);
};
try{
  await page.goto(site,{waitUntil:'networkidle',timeout:60_000});
  await page.getByRole('heading',{name:'作品目录'}).waitFor();
  assert.ok(await page.locator('[data-testid^="project-"]').count()>=1);
  await page.screenshot({path:resolve(out,'portal-desktop.png'),fullPage:true});
  await page.getByTestId('project-hbm').click();
  await page.getByTestId('project-player-page').waitFor();
  assert.equal(new URL(page.url()).hash,'#/hbm');
  assert.equal(await readFrame(),0);
  const canvas=page.locator('canvas').first();
  if(requireWebgl){
    await canvas.waitFor({timeout:30_000});
    const gl=await canvas.evaluate(el=>{
      const context=el.getContext('webgl2')||el.getContext('webgl');
      return {width:el.width,height:el.height,
        valid:!!context && !context.isContextLost(),
        version:context?.getParameter(context.VERSION)??null};
    });
    assert.ok(gl.valid && gl.width>0 && gl.height>0,'Actual active WebGL context required');
    await writeFile(resolve(out,'webgl.json'),JSON.stringify(gl,null,2));
  }
  await page.getByTestId('play-toggle').click();
  await page.waitForFunction(()=>Number(document.querySelector('[data-testid="frame-readout"]')?.textContent)>0,
    null,{timeout:6_000});
  await page.getByTestId('play-toggle').click();
  const paused=await readFrame();
  await page.waitForTimeout(350);
  assert.equal(await readFrame(),paused,'Pause must freeze playback frame');
  await seek(20);
  await page.getByRole('button',{name:'前进一帧'}).click();
  assert.equal(await readFrame(),21);
  await page.getByRole('button',{name:'后退一帧'}).click();
  assert.equal(await readFrame(),20);
  const metrics={site,webglRequired:requireWebgl,frames:{},changes:{}};
  const keyframes=[0,30,60,90,120,149], captures=new Map();
  for(const frame of keyframes){
    await seek(frame);
    const png=await shell.screenshot({path:resolve(out,'hbm-frame-'+frame+'.png')});
    if(requireWebgl){
      const value=await measure(png);
      assert.ok(value.colored>140,'Scene has too few non-background center pixels at '+frame);
      metrics.frames[frame]={colored:value.colored};
      captures.set(frame,value);
    }
  }
  if(requireWebgl){
    for(const [before,after] of [[0,30],[30,60],[60,90],[90,120],[120,149]]){
      metrics.changes[before+'-'+after]=difference(captures.get(before),captures.get(after));
    }
    // All four HBM layers arrive by frame ~74: later frames should be stable.
    for(const pair of ['0-30','30-60','60-90']){
      assert.ok(metrics.changes[pair]>0.0005,'Missing HBM animation change: '+pair);
    }
    for(const pair of ['90-120','120-149']){
      assert.ok(metrics.changes[pair]<0.03,'Unexpected motion after HBM settles: '+pair);
    }
  }
  await writeFile(resolve(out,'metrics.json'),JSON.stringify(metrics,null,2));
  await page.reload({waitUntil:'networkidle'});
  await page.getByTestId('project-player-page').waitFor();
  assert.equal(new URL(page.url()).hash,'#/hbm');
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:resolve(out,'hbm-mobile.png'),fullPage:true});
  // WebGL shader warnings are kept as evidence but uncaught errors always fail.
  assert.equal(errors.filter(x=>x.startsWith('pageerror:')).length,0,errors.join('\n'));
  await writeFile(resolve(out,'browser-console.log'),errors.join('\n')+'\n');
  console.log('Browser QA passed: transport, routing, WebGL '+requireWebgl+', 6 frames, pixels, mobile; '+site);
}catch(error){
  errors.push('TEST FAILURE: '+(error?.stack??String(error)));
  await writeFile(resolve(out,'qa-failure.log'),errors.join('\n')+'\n');
  try{await page.screenshot({path:resolve(out,'qa-failure.png'),fullPage:true});}catch{}
  throw error;
}finally{await browser.close();}
