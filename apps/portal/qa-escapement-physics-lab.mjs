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
  // Before ten seconds it is collecting data, not a false failure claim.
  await page.getByText('采集中 · 至少运行 10 秒后评估').waitFor({timeout:20_000});
  assert.equal(initial.status,'UNVERIFIED');
  // Each visible structural member comes from an actual Rapier collider.
  assert.equal(await page.locator('[data-wheel-structure="open-rim-six-spokes"]').count(),1);
  assert.equal(await page.locator('[data-model-part^="rim-"]').count(),30);
  assert.equal(await page.locator('[data-model-part^="spoke-"]').count(),6);
  const hubRadius=Number(await page.locator('[data-model-part="hub"]').getAttribute('r'));
  assert.ok(hubRadius < 30,'huge solid hub still blocks the inner escape wheel');
  assert.ok(Math.abs(hubRadius-0.24*88)<0.01);
  assert.equal(await page.locator('[data-model-part^="tooth-"]').count(),30);
  await page.screenshot({path:resolve(out,'full-initial.png'),fullPage:true});
  const single=await page.evaluate(()=>window.__mymgEscapementLab.audit(10,'single'));
  const ten=await page.evaluate(()=>window.__mymgEscapementLab.audit(10));
  const sixty=await page.evaluate(()=>window.__mymgEscapementLab.audit(60));

  // Run a bounded physical search after geometry mass/inertia changes.
  // Never force angular positions during integration or pick successes from
  // overlapping initial bodies. This is diagnostic; no implicit tuning.
  const physicalScan = await page.evaluate(() => {
    const all=[];
    for (const wheelDeg of [-17,-13,-9,-7,-5])
      for (const anchorDeg of [0,1.5])
        for (const kick of [-3,-4.5,-6])
          for (const driveTorque of [-0.8,-1.1]) {
            const q=window.__mymgEscapementLab.audit(10,'full',{
              wheelStart:wheelDeg*Math.PI/180,
              pendulumStart:anchorDeg*Math.PI/180,
              startTorqueImpulse:kick,driveTorque,
            });
            all.push({wheelDeg,anchorDeg,kick,driveTorque,
              overlap:q.initialOverlap,alternations:q.alternations,
              stuck:q.longestStuck,reverse:q.reverse,impulse:q.totalImpulse,
              accepted:q.accepted});
          }
    return all;
  });
  console.log('OPEN-WHEEL PHYSICAL PARAMETER SCAN',
    JSON.stringify(physicalScan.sort((a,b)=>
      Number(b.accepted)-Number(a.accepted)||b.alternations-a.alternations).slice(0,35)));
  // Long-run tuning must measure an ENTIRE 60s, not choose a phase on
  // 10s alternations. Each entry is an independently initialized Rapier World.
  const longRunScan = await page.evaluate(() => {
    const choices = [
      [-7,0,-6,-1.1],[-7,0,-4.5,-1.1],[-7,0,-3,-1.1],
      [-7,0,-4.5,-0.8],[-7,0,-6,-0.8],
      [-17,1.5,-4.5,-1.1],[-17,1.5,-3,-1.1],
      [-5,1.5,-4.5,-1.1],[-5,0,-3,-1.1],[-5,0,-4.5,-1.1],
      [-17,0,-3,-1.1],[-17,0,-4.5,-1.1],
      [-5,1.5,-3,-0.8],[-17,0,-3,-0.8],[-5,0,-3,-0.8],
      [-7,0,-6,-1.4],[-7,0,-4.5,-1.4],[-5,0,-4.5,-1.4],
    ];
    return choices.map(([wheelDeg,anchorDeg,kick,driveTorque]) => {
      const q=window.__mymgEscapementLab.audit(60,'full',{
        wheelStart:wheelDeg*Math.PI/180,
        pendulumStart:anchorDeg*Math.PI/180,
        startTorqueImpulse:kick,driveTorque,
      });
      return {wheelDeg,anchorDeg,kick,driveTorque,
        initialOverlap:q.initialOverlap,accepted:q.accepted,
        alternations:q.alternations,forward:q.forward,reverse:q.reverse,
        longestStuck:q.longestStuck,maxPenetration:q.maxPenetration,
        totalImpulse:q.totalImpulse,
        lastEventTime:q.contactSequence.at(-1)?.time ?? null};
    });
  });
  console.log('OPEN-WHEEL 60-SECOND PARAMETER SCAN', JSON.stringify(
    longRunScan.sort((a,b)=>
      Number(b.accepted)-Number(a.accepted) ||
      b.alternations-a.alternations || a.longestStuck-b.longestStuck)));
  // Independent event-sequence review: a contact start alone does not prove
  // locking or release. Match real tooth/pallet start/end pairs, reject
  // repeated orphan events, and count alternating *completed* dwells only.
  const livePairs=new Map();
  const completedContacts=[];
  let malformedEvents=0;
  for(const event of sixty.contactSequence){
    const key=event.side+':'+event.toothId;
    if(event.event==='start'){
      if(livePairs.has(key)) malformedEvents++;
      else livePairs.set(key,event.time);
    } else {
      const from=livePairs.get(key);
      if(from===undefined) malformedEvents++;
      else {
        completedContacts.push({side:event.side,toothId:event.toothId,
          start:from,end:event.time,duration:event.time-from});
        livePairs.delete(key);
      }
    }
  }
  const dwellContacts=completedContacts.filter(x=>x.duration>=0.025);
  let completedAlternations=0,priorCompletedSide=null;
  for(const event of dwellContacts){
    if(priorCompletedSide!==null && event.side!==priorCompletedSide)
      completedAlternations++;
    priorCompletedSide=event.side;
  }
  const contactReview={malformedEvents,unclosedPairs:[...livePairs.keys()],
    completedPairs:completedContacts.length,qualifiedPairs:dwellContacts.length,
    qualifiedAlternations:completedAlternations,minimumDwellSeconds:0.025,
    firstQualifiedPairs:dwellContacts.slice(0,16)};
  console.log('OPEN-WHEEL DYNAMICS DIAGNOSTIC', JSON.stringify({
    ten:{accepted:ten.accepted,alternations:ten.alternations,forward:ten.forward,
      reverse:ten.reverse,stuck:ten.longestStuck,impulse:ten.totalImpulse},
    sixty:{accepted:sixty.accepted,alternations:sixty.alternations,forward:sixty.forward,
      reverse:sixty.reverse,stuck:sixty.longestStuck,impulse:sixty.totalImpulse,
      maximumPenetration:sixty.maxPenetration,maxSwing:sixty.maxSwingAngle},
    contactReview,
  }));
  assert.equal(contactReview.malformedEvents,0,
    'Malformed tooth/pallet start/end event pairing');
  assert.ok(contactReview.qualifiedAlternations>=10,
    'Real completed lock/release contacts did not alternate at least ten times');
  // Former QA bug: >=10 contacts by second 10 could conceal a wheel that
  // physically seized for the remaining 49 seconds. This must NEVER pass.
  assert.equal(ten.accepted,true,'10-second physical motion failed');
  assert.equal(sixty.accepted,true,'60-second wheel stalled or otherwise failed physical motion');
  assert.ok(new Set(dwellContacts.map(x=>x.toothId)).size>=8,
    'Insufficient distinct contacted teeth: possible chattering');

  // One Chromium WASM run explores real (non-scripted) physical start conditions.
  // Every case creates an independent Rapier world, with a one-off manual kick.
  const scan = await page.evaluate(()=>{
    const cases=[];
    for(const wheelDeg of [-17,-15,-13,-11,-9,-7,-5])
      for(const anchorDeg of [-1.5,0,1.5])
        for(const kick of [-3,3]) {
          const trial={driveTorque:-0.8,wheelStart:wheelDeg*Math.PI/180,
            pendulumStart:anchorDeg*Math.PI/180,startTorqueImpulse:kick};
          const q=window.__mymgEscapementLab.audit(10,'full',trial);
          cases.push({wheelDeg,anchorDeg,kick,overlap:q.initialOverlap,
            alternations:q.alternations,forward:q.forward,reverse:q.reverse,
            maxSwingAngle:q.maxSwingAngle,longestStuck:q.longestStuck,
            contacts:q.contactSequence.slice(0,8)});
        }
    return cases.sort((a,b)=>b.alternations-a.alternations||a.longestStuck-b.longestStuck);
  });
  console.log('Graham phase sweep 10s in Chromium',JSON.stringify(scan.slice(0,22)));
  assert.equal(ten.step,2400);
  assert.equal(sixty.step,14400);
  assert.equal(single.step,2400);
  assert.equal(ten.initialOverlap,false);
  const firstContacts=ten.contactSequence.filter(e => e.event==='start' && e.time <= 2/240);
  assert.ok(firstContacts.length<=1,
    'Malformed escapement: simultaneous tooth contacts at startup '+JSON.stringify(firstContacts));
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
  assert.equal(sixty.parameters.structure.spokes,6);
  assert.equal(sixty.parameters.structure.hubRadius,0.24);
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
    trialSweep:scan,contactReview,
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
    '- Independently paired/dwell-qualified alternations: '+contactReview.qualifiedAlternations,
    '- Unmatched/malformed contact events: '+contactReview.malformedEvents,
    '- Result: '+(sixty.accepted?'CANDIDATE, NOT CERTIFIED':'EXPERIMENT NOT PHYSICALLY VERIFIED'),
    '',
    'All measurements are gathered from running Rapier WASM in Chromium, not preset animation curves.',
  ].join('\n')+'\n');
  console.log('Rapier Chromium real-world results',JSON.stringify({
    tenAccepted:ten.accepted,sixtyAccepted:sixty.accepted,
    singleImpulse:single.totalImpulse,tenAlternations:ten.alternations,
    sixtyAlternations:sixty.alternations,maxPenetration:sixty.maxPenetration,
    reverse:sixty.reverse,initialOverlap:sixty.initialOverlap,
    toothEvents:sixty.contactSequence.length,contactReview,
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
