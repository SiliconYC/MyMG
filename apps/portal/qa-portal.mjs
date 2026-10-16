/** Full canonical Mustard-03 browser QA, not the old WebGL smoke-test. */
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from 'playwright';

const site=process.env.MYMG_QA_URL??'http://127.0.0.1:4173/MyMG/';
const out=resolve(process.env.MYMG_QA_OUTPUT??'../../output/qa-portal');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
const errors=[];
page.on('pageerror',error=>errors.push('pageerror: '+error.message));
page.on('response',res=>{if(res.status()>=400 && res.url().includes('/media/'))errors.push('media HTTP '+res.status()+': '+res.url());});
const video=page.getByTestId('hbm-master-video');
const readFrame=async()=>Number(await page.getByTestId('frame-readout').textContent());
const seek=async target=>{
  const slider=page.getByTestId('frame-slider');
  await slider.evaluate((el,next)=>{
    const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
    setter.call(el,String(next));
    el.dispatchEvent(new Event('input',{bubbles:true}));
    el.dispatchEvent(new Event('change',{bubbles:true}));
  },target);
  await page.waitForFunction(frame=>Number(document.querySelector('[data-testid="frame-readout"]')?.textContent)===frame,target);
  await page.waitForFunction(frame=>{
    const v=document.querySelector('[data-testid="hbm-master-video"]');
    return v && v.readyState>=2 && Math.abs(v.currentTime-frame/30)<0.03 && !v.seeking;
  },target,{timeout:20000});
};
const metrics={site,canonical:'make_mustard03.py',frames:{},differences:{}};
const visual=async buffer=>page.evaluate(async base64=>{
  const img=new Image();
  img.src='data:image/png;base64,'+base64;
  await img.decode();
  const c=document.createElement('canvas');c.width=160;c.height=90;
  const ctx=c.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(img,0,0,c.width,c.height);
  const pixels=ctx.getImageData(0,0,c.width,c.height).data;
  const samples=[];
  let contrast=0;
  for(let y=0;y<90;y++)for(let x=0;x<160;x++){
    const i=(y*160+x)*4;
    const r=pixels[i],g=pixels[i+1],b=pixels[i+2];
    samples.push(r,g,b);
    if(x>20 && x<140 && y>15 && y<85 && (Math.abs(r-238)+Math.abs(g-232)+Math.abs(b-224))>90)contrast++;
  }
  return {samples,contrast};
},buffer.toString('base64'));
const difference=(a,b)=>{
  let changed=0;
  for(let i=0;i<a.samples.length;i+=3){
    if(Math.abs(a.samples[i]-b.samples[i])+Math.abs(a.samples[i+1]-b.samples[i+1])+
       Math.abs(a.samples[i+2]-b.samples[i+2])>48)changed++;
  }
  return changed/(a.samples.length/3);
};
try{
  await page.goto(site,{waitUntil:'networkidle',timeout:60000});
  await page.getByRole('heading',{name:'作品目录'}).waitFor();
  await page.screenshot({path:resolve(out,'portal-desktop.png'),fullPage:true});
  await page.getByTestId('project-hbm').click();
  await page.getByTestId('project-player-page').waitFor();
  assert.equal(new URL(page.url()).hash,'#/hbm');
  await video.waitFor();
  await page.waitForFunction(()=>{
    const v=document.querySelector('[data-testid="hbm-master-video"]');
    return v && v.readyState>=2 && v.videoWidth===1280 && v.videoHeight===720;
  },null,{timeout:60000});
  const media=await video.evaluate(v=>({
    width:v.videoWidth,height:v.videoHeight,duration:v.duration,
    readyState:v.readyState,seekable:v.seekable.length,
    error:v.error?.message??null,source:v.currentSrc
  }));
  assert.equal(media.width,1280);
  assert.equal(media.height,720);
  assert.ok(Math.abs(media.duration-11.5)<0.07,JSON.stringify(media));
  assert.ok(media.seekable>0,'Video must support seeking');
  assert.equal(media.error,null);
  assert.ok(media.source.endsWith('/media/hbm-mustard03.mp4'));
  metrics.media=media;
  assert.equal(await readFrame(),0);

  const captures=new Map();
  const keyframes=[0,30,67,129,165,224,273,316,344];
  for(const frame of keyframes){
    await seek(frame);
    const screenshot=await page.getByTestId('player-shell').screenshot({path:resolve(out,'hbm-frame-'+frame+'.png')});
    const measured=await visual(screenshot);
    if(frame>0)assert.ok(measured.contrast>100,'Blank/undecoded frame '+frame);
    captures.set(frame,measured);
    metrics.frames[frame]={contrast:measured.contrast};
  }
  for(const [a,b] of [[0,67],[67,129],[129,165],[165,224],[224,273],[273,316]]){
    const d=difference(captures.get(a),captures.get(b));
    metrics.differences[a+'-'+b]=d;
    assert.ok(d>0.005,'Missing distinct Mustard-03 scene imagery '+a+'→'+b);
  }
  await seek(20);
  await page.getByRole('button',{name:'前进一帧'}).click();
  assert.equal(await readFrame(),21);
  await page.getByRole('button',{name:'后退一帧'}).click();
  assert.equal(await readFrame(),20);
  await seek(0);
  await page.getByTestId('play-toggle').click();
  await page.waitForFunction(()=>Number(document.querySelector('[data-testid="frame-readout"]')?.textContent)>4,
    null,{timeout:8000});
  await page.getByTestId('play-toggle').click();
  await page.waitForTimeout(150);
  const paused=await readFrame();
  await page.waitForTimeout(450);
  assert.equal(await readFrame(),paused,'Paused film must remain frozen');
  await page.reload({waitUntil:'networkidle',timeout:60000});
  await page.getByTestId('project-player-page').waitFor();
  assert.equal(new URL(page.url()).hash,'#/hbm');
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:resolve(out,'hbm-mobile.png'),fullPage:true});
  assert.deepEqual(errors,[]);
  await writeFile(resolve(out,'metrics.json'),JSON.stringify(metrics,null,2));
  console.log('HBM canonical film QA PASSED: real MP4 decode, 345 frame timeline, nine pixel captures, controls, mobile.');
}catch(error){
  await writeFile(resolve(out,'qa-failure.log'),(error?.stack??String(error))+'\n'+errors.join('\n'));
  try{await page.screenshot({path:resolve(out,'qa-failure.png'),fullPage:true});}catch{}
  throw error;
}finally{await browser.close();}
