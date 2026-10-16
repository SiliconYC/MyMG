/** HBM #17: strict live React Three.js WebGL browser tests, zero video images. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from 'playwright';
const site=process.env.MYMG_QA_URL??'http://127.0.0.1:4173/MyMG/';
const out=resolve(process.env.MYMG_QA_OUTPUT??'../../output/qa-portal');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:[
  '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox',
  '--disable-dev-shm-usage'
]});
const page=await browser.newPage({viewport:{width:1600,height:950},deviceScaleFactor:1});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
const readFrame=async()=>Number(await page.getByTestId('frame-readout').textContent());
const seek=async target=>{
  const slider=page.getByTestId('frame-slider');
  await slider.evaluate((el,next)=>{
    const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
    setter.call(el,String(next));
    el.dispatchEvent(new Event('input',{bubbles:true}));
    el.dispatchEvent(new Event('change',{bubbles:true}));
  },target);
  await page.waitForFunction(x=>document.querySelector('[data-testid="frame-readout"]')?.textContent===String(x),target);
  await page.waitForTimeout(220);
};
const sample=async png=>page.evaluate(async b64=>{
  const im=new Image();im.src='data:image/png;base64,'+b64;await im.decode();
  const c=document.createElement('canvas');c.width=160;c.height=90;
  const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(im,0,0,160,90);
  const data=ctx.getImageData(0,0,160,90).data,arr=[];
  let nonBackground=0,uniques=new Set();
  for(let y=0;y<90;y++)for(let x=0;x<160;x++){
    const i=4*(y*160+x),r=data[i],g=data[i+1],b=data[i+2];
    arr.push(r,g,b);
    uniques.add((Math.round(r/12)<<16)|(Math.round(g/12)<<8)|Math.round(b/12));
    if(x>40&&x<155&&y>18&&y<85&&Math.abs(r-238)+Math.abs(g-232)+Math.abs(b-224)>105)nonBackground++;
  }
  return {arr,nonBackground,palette:uniques.size};
},png.toString('base64'));
const difference=(a,b)=>{
  let diff=0;
  for(let i=0;i<a.arr.length;i+=3){
    if(Math.abs(a.arr[i]-b.arr[i])+Math.abs(a.arr[i+1]-b.arr[i+1])+
       Math.abs(a.arr[i+2]-b.arr[i+2])>65)diff++;
  }
  return diff/(a.arr.length/3);
};
try{
  // Regression: ChatGPT and other apps append tracking parameters BEFORE #/.
  // The route and deployed bundle must be identical to the canonical homepage.
  const tracked = new URL(site);
  tracked.searchParams.set('utm_source','chatgpt.com');
  tracked.hash = '#/';
  await page.goto(tracked.href,{waitUntil:'networkidle',timeout:60000});
  await page.waitForFunction(()=>!location.search.includes('utm_source'),null,{timeout:10000});
  assert.equal(new URL(page.url()).pathname,new URL(site).pathname);
  assert.equal(new URL(page.url()).search,'');
  assert.equal(new URL(page.url()).hash,'#/');
  await page.getByTestId('project-hbm').click();
  await page.getByTestId('project-player-page').waitFor();
  assert.equal(new URL(page.url()).hash,'#/hbm');
  assert.equal(new URL(page.url()).search,'','Clicking HBM must stay on canonical URL');
  const trackedBuild=await page.getByTestId('build-id').textContent();
  const trackedScripts=await page.locator('script[type="module"]').evaluateAll(nodes=>nodes.map(n=>n.src));
  assert.ok(trackedBuild?.includes('BUILD') && trackedScripts.length>0);
  await page.goto(new URL('#/hbm',site).href,{waitUntil:'networkidle',timeout:60000});
  assert.equal(await page.getByTestId('build-id').textContent(),trackedBuild,
    'Tracked entry and clean direct entry must load same deployed build');
  assert.deepEqual(await page.locator('script[type="module"]').evaluateAll(nodes=>nodes.map(n=>n.src)),trackedScripts,
    'Tracked and canonical pages must load same JS bundle');
  assert.equal(await page.locator('video').count(),0,'MP4-based HBM playback is FORBIDDEN');
  assert.equal(await page.locator('img').count(),0,'No frame images inside native HBM player');
  await page.getByTestId('hbm-native-scene').waitFor();
  const marker=page.getByTestId('hbm-native-scene');
  assert.equal(await marker.getAttribute('data-renderer'),'react-threejs-webgl');
  const canvas=marker.locator('canvas').first();
  await canvas.waitFor({timeout:30000});
  const gl=await canvas.evaluate(el=>{
    const context=el.getContext('webgl2')||el.getContext('webgl');
    return {valid:!!context&&!context.isContextLost(),width:el.width,height:el.height,
      version:context?.getParameter(context.VERSION)};
  });
  assert.ok(gl.valid&&gl.width>0&&gl.height>0,'Active WebGL Three.js scene required');
  assert.equal(await readFrame(),0);
  // Force original composition to natural 1280x720 pixel dimensions for reference comparison.
  await page.getByTestId('player-shell').evaluate(el=>{el.style.width='1282px';el.style.maxWidth='none';});
  await page.waitForTimeout(180);
  const nativeSize=await page.getByTestId('hbm-native-scene').boundingBox();
  assert.ok(nativeSize && Math.abs(nativeSize.width-1280)<0.2 &&
    Math.abs(nativeSize.height-720)<0.2,
    `Need pixel-perfect reference dimensions, got ${JSON.stringify(nativeSize)}`);
  const frames=[0,30,67,129,165,224,273,316,344];
  const images=new Map(),statistics={site,gl,frames:{},changes:{}};
  for(const frame of frames){
    await seek(frame);
    const png=await page.getByTestId('hbm-native-scene').screenshot({path:resolve(out,`hbm-frame-${frame}.png`)});
    const v=await sample(png);
    if(frame>0)assert.ok(v.nonBackground>55&&v.palette>20,
      `HBM Three.js frame ${frame} looks blank: ${JSON.stringify(v)}`);
    statistics.frames[frame]={nonBackground:v.nonBackground,palette:v.palette};
    images.set(frame,v);
  }
  for(const [a,b]of [[0,67],[67,129],[129,165],[165,224],[224,273],[273,316]]){
    const d=difference(images.get(a),images.get(b));
    statistics.changes[`${a}-${b}`]=d;
    assert.ok(d>.002,`Missing 3D scene transition ${a}=>${b}`);
  }
  await seek(20);
  await page.getByRole('button',{name:'前进一帧'}).click();
  assert.equal(await readFrame(),21);
  await page.getByRole('button',{name:'后退一帧'}).click();
  assert.equal(await readFrame(),20);
  await seek(0);
  await page.getByTestId('play-toggle').click();
  await page.waitForFunction(()=>Number(document.querySelector('[data-testid="frame-readout"]')?.textContent)>4,null,{timeout:8000});
  await page.getByTestId('play-toggle').click();
  await page.waitForTimeout(200);
  const frozen=await readFrame();
  await page.waitForTimeout(380);
  assert.equal(await readFrame(),frozen,'Paused 3D scene must freeze');
  await page.reload({waitUntil:'networkidle'});
  await page.getByTestId('hbm-native-scene').waitFor();
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:resolve(out,'hbm-mobile.png'),fullPage:true});
  assert.deepEqual(errors,[]);
  await writeFile(resolve(out,'metrics.json'),JSON.stringify(statistics,null,2));
  console.log('PASS: genuine React Three.js WebGL 345-frame animation, 9 frames, transport, mobile, no MP4/video/images.');
}catch(error){
  await writeFile(resolve(out,'qa-failure.log'),(error?.stack??String(error))+'\n'+errors.join('\n'));
  try{await page.screenshot({path:resolve(out,'qa-failure.png'),fullPage:true});}catch{}
  throw error;
}finally{await browser.close();}
