/** Live WebGL visual-regression gate, not a file-size-only check. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from 'playwright';

const site=process.env.MYMG_QA_URL??'http://127.0.0.1:4173/MyMG/';
const out=resolve(process.env.MYMG_QA_OUTPUT??'../../output/qa-automatic-fire');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:[
  '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
  '--no-sandbox','--disable-dev-shm-usage',
]});
const page=await browser.newPage({viewport:{width:1540,height:940}});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
const seek=async frame=>{
  await page.getByTestId('frame-slider').evaluate((element,value)=>{
    const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
    setter.call(element,String(value));
    element.dispatchEvent(new Event('input',{bubbles:true}));
    element.dispatchEvent(new Event('change',{bubbles:true}));
  },frame);
  await page.waitForFunction(value=>
    document.querySelector('[data-testid="frame-readout"]')?.textContent===String(value),frame);
  await page.waitForTimeout(220);
};
const pixels=buffer=>page.evaluate(async encoded=>{
  const im=new Image();im.src='data:image/png;base64,'+encoded;await im.decode();
  const c=document.createElement('canvas');c.width=128;c.height=72;
  const ctx=c.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(im,0,0,128,72);
  const data=ctx.getImageData(0,0,128,72).data;
  let dark=0;
  const values=[];
  for(let y=7;y<67;y++)for(let x=5;x<123;x++){
    const i=(y*128+x)*4,r=data[i],g=data[i+1],b=data[i+2];
    if(r+g+b<510)dark++;
    values.push(r,g,b);
  }
  return {dark,values};
},buffer.toString('base64'));
const diff=(a,b)=>{
  let moved=0;
  for(let i=0;i<a.values.length;i+=3){
    if(Math.abs(a.values[i]-b.values[i])+Math.abs(a.values[i+1]-b.values[i+1])+
       Math.abs(a.values[i+2]-b.values[i+2])>90)moved++;
  }
  return moved/(a.values.length/3);
};
try{
  await page.goto(new URL('#/',site).href,{waitUntil:'networkidle'});
  await page.getByTestId('project-automatic-fire').click();
  assert.equal(new URL(page.url()).hash,'#/automatic-fire');
  const scene=page.getByTestId('automatic-fire-scene');
  await scene.waitFor();
  assert.equal(await scene.getAttribute('data-renderer'),'react-threejs-webgl');
  assert.equal(await scene.locator('video,img').count(),0);
  const canvas=scene.locator('canvas').first();
  await canvas.waitFor();
  assert.ok(await canvas.evaluate(el=>{
    const gl=el.getContext('webgl2')||el.getContext('webgl');
    return !!gl&&!gl.isContextLost()&&el.width>=500&&el.height>=250;
  }),'native WebGL');
  const shots={};
  for(const f of [14,80,156,213,247,300,340,431,520,577,649,710]){
    await seek(f);
    const image=await scene.screenshot({path:resolve(out,'cinematic-'+f+'.png')});
    assert.ok(image.byteLength>15000,'render size '+f);
    shots[f]={...await pixels(image),
      zoom:Number(await scene.getAttribute('data-camera-zoom')),
      reveal:Number(await scene.getAttribute('data-plate')),
      bolt:Number(await scene.getAttribute('data-bolt')),
      trigger:Number(await scene.getAttribute('data-trigger'))};
    assert.ok(shots[f].dark>100,'recognizable 3D silhouette '+f);
  }
  assert.ok(shots[156].zoom>shots[14].zoom*1.5,'meaningful dolly');
  assert.ok(shots[156].reveal>.7,'receiver cover opens');
  assert.ok(shots[247].trigger>.9&&shots[520].trigger>.9,'one held trigger');
  assert.ok(shots[247].bolt>shots[213].bolt+.4,'bolt retreats');
  assert.ok(shots[577].reveal>.8&&shots[710].reveal<.02,'side plate returns');
  for(const [a,b] of [[14,156],[156,247],[247,340],[340,520],[577,710]]){
    const delta=diff(shots[a],shots[b]);
    assert.ok(delta>.045,'scene changes substantially '+a+' -> '+b+': '+delta);
  }
  await seek(340);
  const first=await pixels(await scene.screenshot());
  await seek(520);await seek(340);
  const again=await pixels(await scene.screenshot());
  assert.deepEqual(first,again,'frame seeking is deterministic');
  await page.getByRole('button',{name:'前进一帧'}).click();
  assert.equal(Number(await page.getByTestId('frame-readout').textContent()),341);
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:resolve(out,'cinematic-mobile.png'),fullPage:true});
  assert.deepEqual(errors,[]);
  await writeFile(resolve(out,'metrics.json'),JSON.stringify(
    Object.fromEntries(Object.entries(shots).map(([k,v])=>[k,{
      dark:v.dark,zoom:v.zoom,reveal:v.reveal,bolt:v.bolt,trigger:v.trigger,
    }])),null,2));
  console.log('PASS #35: 12 real WebGL frames, nonblank silhouette, camera travel, cutaway, motion, deterministic seeking and mobile');
}finally{await browser.close();}
