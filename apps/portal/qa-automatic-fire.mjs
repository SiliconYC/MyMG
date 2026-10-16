/** Browser proof of native Three.js geometry, 3D camera progression and four cycles. */
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from 'playwright';

const site=process.env.MYMG_QA_URL??'http://127.0.0.1:4173/MyMG/';
const out=resolve(process.env.MYMG_QA_OUTPUT??'../../output/qa-automatic-fire');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:[
  '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
  '--no-sandbox','--disable-dev-shm-usage'
]});
const page=await browser.newPage({viewport:{width:1500,height:920}});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
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
  assert.equal(await canvas.evaluate(el=>{
    const gl=el.getContext('webgl2')||el.getContext('webgl');
    return !!gl&&!gl.isContextLost();
  }),true);
  const captures=[];
  for(const f of [15,125,212,270,380,490,612,695]){
    const slider=page.getByTestId('frame-slider');
    await slider.evaluate((el,n)=>{
      const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
      setter.call(el,String(n));
      el.dispatchEvent(new Event('input',{bubbles:true}));
      el.dispatchEvent(new Event('change',{bubbles:true}));
    },f);
    await page.waitForFunction(n=>document.querySelector('[data-testid="frame-readout"]')?.textContent===String(n),f);
    await page.waitForTimeout(140);
    const png=await scene.screenshot({path:resolve(out,'automatic-'+f+'.png')});
    assert.ok(png.byteLength>12000,'Non-empty render at '+f);
    captures.push(await scene.getAttribute('data-bolt'));
  }
  assert.notEqual(captures[2],captures[3],'Bolt must move within a firing cycle');
  await page.setViewportSize({width:390,height:820});
  await page.screenshot({path:resolve(out,'automatic-mobile.png'),fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('PASS: new automatic-cycle MG route, 8 native WebGL frames, moving bolt and mobile.');
}finally{await browser.close();}
