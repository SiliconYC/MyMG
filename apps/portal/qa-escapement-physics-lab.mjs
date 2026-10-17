import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from 'playwright';

const site = process.env.MYMG_QA_URL ?? 'http://127.0.0.1:4173/MyMG/';
const out = resolve(process.env.MYMG_QA_OUTPUT ?? 'output/qa-portal/escapement-physics-lab');
await mkdir(out,{recursive:true});
const browser = await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--enable-webgl']});
const page = await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];
page.on('pageerror', e => errors.push(e.stack ?? String(e)));
let report={};
try {
  await page.goto(site+'#/escapement-physics-lab',{waitUntil:'networkidle',timeout:60_000});
  await page.getByTestId('escapement-physics-lab-scene').waitFor({timeout:60_000});
  await page.waitForFunction(()=>typeof window.__mymgEscapementLab?.audit==='function',null,{timeout:60_000});
  const initial=await page.evaluate(()=>window.__mymgEscapementLab.state());
  assert.equal(initial.step,0);
  // Geometric assembly MUST NOT start with tooth/pallet interpenetration.
  assert.equal(initial.initialOverlap,false,'Graham geometry starts interpenetrating');
  await page.getByText('实验未通过物理验证').waitFor({timeout:20_000});
  await page.screenshot({path:resolve(out,'full-initial.png'),fullPage:true});
  const single=await page.evaluate(()=>window.__mymgEscapementLab.audit(10,'single'));
  const ten=await page.evaluate(()=>window.__mymgEscapementLab.audit(10));
  const sixty=await page.evaluate(()=>window.__mymgEscapementLab.audit(60));
  assert.equal(ten.step,2400);
  assert.equal(sixty.step,14400);
  assert.equal(single.step,2400);
  assert.equal(ten.initialOverlap,false);
  assert.equal(sixty.initialOverlap,false);
  assert.equal(sixty.contactSequence.every(e =>
    Number.isInteger(e.toothId) && e.toothId>=0 && e.toothId<30
    && (e.side==='left'||e.side==='right')),true,
    'The contact sequence must contain only actual tooth/pallet events');
  assert.equal(sixty.parameters.geometry.pitchDeg,12);
  assert.equal(sixty.parameters.geometry.embracedDeg,90);
  assert.ok(sixty.parameters.geometry.leftTangentDot<1e-8);
  assert.ok(sixty.parameters.geometry.rightTangentDot<1e-8);
  assert.equal(sixty.parameters.geometry.diameterRatio,0.75);
  for (const x of [single,ten,sixty]) {
    for (const k of ['wheelAngle','anchorAngle','forward','reverse','totalImpulse','maxPenetration','alternations','longestStuck','physicsMs'])
      assert.ok(Number.isFinite(x[k]),x.mode+' invalid '+k);
  }
  // Three truly fresh physics worlds; exclude wall-clock runtime from the comparison.
  const repeats=await page.evaluate(()=>[0,1,2].map(()=>window.__mymgEscapementLab.replay(91)));
  const fields=['step','wheelAngle','anchorAngle','wheelOmega','anchorOmega',
    'forward','reverse','alternations','totalImpulse','maxPenetration','longestStuck'];
  for(const x of repeats.slice(1))for(const k of fields)assert.equal(x[k],repeats[0][k], 'reset determinism '+k);
  const afterStep=await page.evaluate(()=>window.__mymgEscapementLab.replay(92));
  assert.equal(afterStep.step,repeats[0].step+8);
  await page.getByTestId('play-toggle').click();
  await page.waitForFunction(()=>Number(document.querySelector('[data-testid="escapement-physics-lab-scene"]')?.getAttribute('data-lab-step'))>=32,null,{timeout:30_000});
  await page.getByTestId('play-toggle').click();
  await page.screenshot({path:resolve(out,'full-running.png'),fullPage:true});
  await page.getByTestId('lab-slow').click();
  await page.getByTestId('lab-reset').click();
  await page.waitForFunction(()=>Number(document.querySelector('[data-testid="escapement-physics-lab-scene"]')?.getAttribute('data-lab-step'))===0);
  await page.getByTestId('lab-mode-single').click();
  await page.waitForFunction(()=>document.querySelector('[data-testid="escapement-physics-lab-scene"]')?.textContent?.includes('单齿夹具'));
  await page.screenshot({path:resolve(out,'single-tooth.png'),fullPage:true});
  await page.getByTestId('lab-mode-full').click();
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:resolve(out,'mobile.png'),fullPage:true});
  assert.deepEqual(errors,[]);
  report={site,engine:await page.evaluate(()=>window.__mymgEscapementLab.version),
    initial,single,ten,sixty,resetReplays:repeats,oneFrame:afterStep,
    geometry:sixty.parameters.geometry,contactSequence:sixty.contactSequence,
    explanation:!sixty.accepted?
      'NEGATIVE PHYSICAL EXPERIMENT: do not transfer this model to the pendulum clock':
      'CANDIDATE only: requires independent geometry and contact review'};
  await writeFile(resolve(out,'audit.json'),JSON.stringify(report,null,2));
  await writeFile(resolve(out,'conclusion.md'),[
    '# Issue #78 / Actual Chromium Rapier experiment',
    '- 10-second accepted: '+ten.accepted,
    '- 60-second accepted: '+sixty.accepted,
    '- Initial full overlap: '+sixty.initialOverlap,
    '- Alternations: '+sixty.alternations,
    '- Left/right contacts: '+sixty.contactCount.left+' / '+sixty.contactCount.right,
    '- Total impulse N s: '+sixty.totalImpulse,
    '- Maximum penetration m: '+sixty.maxPenetration,
    '- Accumulated reverse rad: '+sixty.reverse,
    '- Longest stuck s: '+sixty.longestStuck,
    '- Real tooth/pallet start/end events: '+sixty.contactSequence.length,
    '- Result: '+(sixty.accepted?'CANDIDATE, NOT CERTIFIED':'EXPERIMENT NOT PHYSICALLY VERIFIED'),
    '',
    'All measurements are gathered from running Rapier WASM in Chromium, not preset animation curves.',
  ].join('\n')+'\n');
  console.log('Rapier Chromium real-world results',JSON.stringify({
    tenAccepted:ten.accepted,sixtyAccepted:sixty.accepted,
    singleImpulse:single.totalImpulse,tenAlternations:ten.alternations,
    sixtyAlternations:sixty.alternations,maxPenetration:sixty.maxPenetration,
    reverse:sixty.reverse,initialOverlap:sixty.initialOverlap,
    toothEvents:sixty.contactSequence.length,
    contactSequence:sixty.contactSequence.slice(0,24),
    tenState:{wheelAngle:ten.wheelAngle,anchorAngle:ten.anchorAngle,forward:ten.forward,reverse:ten.reverse,
      wheelOmega:ten.wheelOmega,anchorOmega:ten.anchorOmega,longestStuck:ten.longestStuck,
      contacts:ten.contactCount,impulse:ten.totalImpulse},
    sixtyState:{wheelAngle:sixty.wheelAngle,anchorAngle:sixty.anchorAngle,forward:sixty.forward,reverse:sixty.reverse,
      wheelOmega:sixty.wheelOmega,anchorOmega:sixty.anchorOmega,longestStuck:sixty.longestStuck,
      contacts:sixty.contactCount,impulse:sixty.totalImpulse},
  }));
} catch(e) {
  await writeFile(resolve(out,'failure.txt'),(e.stack??String(e))+'\n'+errors.join('\n'));
  try{await page.screenshot({path:resolve(out,'failure.png'),fullPage:true});}catch{}
  throw e;
} finally{await browser.close();}
