/** Pure React/Remotion browser QA, no GPU/WebGL requirement. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from 'playwright';
const site=process.env.MYMG_QA_URL??'http://127.0.0.1:4173/MyMG/';
const out=resolve(process.env.MYMG_QA_OUTPUT??'../../output/qa-react');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:1200,height:800}});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
  await page.goto(site,{waitUntil:'networkidle'});
  await page.getByTestId('project-demo').waitFor();
  await page.screenshot({path:resolve(out,'catalog-with-demo.png'),fullPage:true});
  await page.getByTestId('project-demo').click();
  await page.getByTestId('transport').waitFor();
  assert.equal(new URL(page.url()).hash,'#/demo');
  const frame=async()=>Number(await page.getByTestId('frame-readout').textContent());
  assert.equal(await frame(),0);
  await page.screenshot({path:resolve(out,'demo-frame-0.png')});
  const slider=page.getByTestId('frame-slider');
  await slider.focus();
  await slider.press('End');
  await page.waitForFunction(()=>document.querySelector('[data-testid="frame-readout"]')?.textContent==='89');
  assert.equal(await frame(),89);
  await page.screenshot({path:resolve(out,'demo-frame-89.png')});
  await page.getByRole('button',{name:'后退一帧'}).click();
  assert.equal(await frame(),88);
  await page.getByTestId('play-toggle').click();
  await page.waitForTimeout(300);
  await page.getByTestId('play-toggle').click();
  const stopped=await frame();
  await page.waitForTimeout(250);
  assert.equal(await frame(),stopped,'Paused 2D scene must freeze');
  await page.reload({waitUntil:'networkidle'});
  await page.getByTestId('transport').waitFor();
  assert.equal(new URL(page.url()).hash,'#/demo');
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:resolve(out,'demo-mobile.png'),fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('Pure React QA passed: portal card, demo, pause, scrub, step, deep link, mobile.');
}catch(e){
  await writeFile(resolve(out,'failure.log'),(e.stack??String(e))+'\n'+errors.join('\n'));
  try{await page.screenshot({path:resolve(out,'failure.png'),fullPage:true});}catch{}
  throw e;
}finally{await browser.close();}
