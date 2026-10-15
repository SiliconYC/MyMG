/** Run after Vite preview starts. Reusable screenshot and navigation test. */
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from 'playwright';

const site = process.env.MYMG_QA_URL ?? 'http://127.0.0.1:4173/MyMG/';
const out = resolve(process.env.MYMG_QA_OUTPUT ?? '../../output/qa-portal');
await mkdir(out, {recursive: true});
const browser = await chromium.launch({headless: true, args: [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--disable-dev-shm-usage', '--no-sandbox',
]});
try {
  const page = await browser.newPage({viewport: {width: 1440, height: 900}, deviceScaleFactor: 1});
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(site, {waitUntil: 'networkidle', timeout: 60_000});
  await page.getByRole('heading',{name:'作品目录'}).waitFor({timeout:20_000});
  assert.ok((await page.locator('[data-testid^="project-"]').count()) >= 1, 'Portal needs a visible catalog');
  await page.screenshot({path: resolve(out,'portal-desktop.png'),fullPage:true});
  await page.getByTestId('project-hbm').click();
  await page.getByTestId('project-player-page').waitFor({timeout:20_000});
  assert.equal(new URL(page.url()).hash, '#/hbm');
  await page.locator('canvas').first().waitFor({timeout:30_000});
  await page.screenshot({path: resolve(out,'hbm-start.png'),fullPage:true});
  await page.getByRole('button',{name:'后一帧'}).click();
  await page.screenshot({path: resolve(out,'hbm-step.png'),fullPage:true});
  await page.reload({waitUntil:'networkidle'});
  await page.getByTestId('project-player-page').waitFor({timeout:20_000});
  assert.equal(new URL(page.url()).hash,'#/hbm','Deep link must survive refresh');
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path: resolve(out,'hbm-mobile.png'),fullPage:true});
  assert.deepEqual(errors, [],`Uncaught browser errors: ${errors.join(' | ')}`);
  console.log(`Browser QA passed: catalog, HBM route, Three.js canvas, frame step, reload, mobile screenshot. ${site}`);
} finally {await browser.close();}
