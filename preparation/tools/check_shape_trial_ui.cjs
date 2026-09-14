const { chromium } = require('/Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const ROOT = path.resolve(__dirname, '../..');
// Keep each accepted shape revision's evidence instead of overwriting the previous trial.
const OUT = path.resolve(ROOT, process.env.SHAPE_UI_OUT || 'preparation/review/evidence/gameplay-shapes');
const report = { status: 'running', checks: [], errors: [], captures: [] };
let browser, page;
const add = (name, evidence) => { report.checks.push({name,evidence}); process.stdout.write(name+'\n'); };
async function snap(name) {
  // A command can change the body before lateUpdate paints its Sprite. Capture the rendered pose.
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await page.screenshot({path:path.join(OUT,name+'.png')}); report.captures.push(name+'.png');
}
async function waitPlanning() { await page.waitForFunction(()=>qaGame()?.snapshot().phase==='planning'); }
async function start(sequence, untimed=true) {
  await page.evaluate(()=>qaLoad('HUD')); await waitPlanning();
  assert.equal(await page.evaluate(({sequence,untimed})=>qaGame().configureCalibration(sequence,untimed),{sequence,untimed}),true);
}
async function checkKind(kind) {
  await start(['cardboard_box',kind]);
  await page.evaluate(()=>qaGame().release());
  await page.waitForFunction(()=>qaGame()?.snapshot().placed===1); await waitPlanning();
  const rotations=[];
  for(let i=0;i<4;i++) {
    const result=await page.evaluate(()=>{
      const g=qaGame();g.moveTo(999);const right=g.snapshot();g.moveTo(-999);const left=g.snapshot();g.moveTo(0);
      return {right,left,center:g.snapshot()};
    });
    const r=result.right.bodies.at(-1),l=result.left.bodies.at(-1),c=result.center.bodies.at(-1);
    assert.ok(Math.abs(r.bounds.right-result.right.boundary.right+4)<.001);
    assert.ok(Math.abs(l.bounds.left-result.left.boundary.left-4)<.001);
    assert.ok(Math.abs(c.bounds.top-result.center.boundary.top)<.001);
    rotations.push({angle:c.angle,bounds:c.bounds,top:result.center.boundary.top});
    if(i===0||i===1)await snap(kind+'-held-'+i*90);
    await page.waitForFunction(()=>{
      const g=qaGame(),body=g.current,paint=g.display.views.get(body.id);
      return paint&&Math.abs(paint.rotation.z-body.node.rotation.z)<1e-6&&Math.abs(paint.rotation.w-body.node.rotation.w)<1e-6;
    });
    await page.evaluate(()=>qaGame().rotate());
  }
  assert.equal(await page.evaluate(()=>qaGame().configureCalibration(['cardboard_box','wood_plank'],false)),false);
  await page.evaluate(()=>qaGame().release());
  await page.waitForFunction(()=>!qaGame()||qaGame().snapshot().placed===2,null,{timeout:15000});
  const s=await page.evaluate(()=>qaGame()?.snapshot());
  assert.ok(s&&s.placed===2,kind+' failed to settle on first box');
  await page.evaluate(()=>qaGame().lifecycle.togglePause());
  await snap(kind+'-contact'); add(kind+'_rotated_bounds_and_real_landing',{rotations,landed:s.bodies[1]});
}
async function sixRun() {
  const sequence=['cardboard_box','wood_plank','toilet','fridge','dumbbell','basketball'];
  await start(sequence); const attempts=[];
  for(let i=0;i<sequence.length;i++) {
    await waitPlanning();
    await page.evaluate(x=>{qaGame().moveTo(x);qaGame().release()},i<3?0:-25);
    await page.waitForFunction(n=>!qaGame()||qaGame().snapshot().placed>=n,i+1,{timeout:18000}).catch(()=>{});
    const state=await page.evaluate(()=>qaGame()?.snapshot()||qaSnapshot());attempts.push(state);
    if(!state.phase||state.placed<i+1)break;
  }
  const last=attempts.at(-1); if(last.phase)await page.evaluate(()=>qaGame().lifecycle.togglePause());
  await snap('six-live-run');
  add('six_live_smoke_outcome_not_a_balance_pass',{attempts,successfulDrops:Math.max(0,...attempts.map(s=>s.placed||0))});
}
async function main(){
 try{
  fs.mkdirSync(OUT,{recursive:true});browser=await chromium.launch({headless:true});
  page=await browser.newPage({viewport:{width:375,height:667},hasTouch:true});
  page.on('pageerror',e=>report.errors.push(String(e)));
  await page.goto('http://127.0.0.1:8767/preparation/review/play-player.html?revision=shape-trial-1');
  await page.waitForFunction(()=>!!window.qaLoad,null,{timeout:45000});
  await page.touchscreen.tap(185,180);
  await checkKind('toilet');await checkKind('dumbbell');await sixRun();
  for(const [width,height] of [[375,812],[600,800]]) {
    await page.setViewportSize({width,height});await start(['cardboard_box','toilet','dumbbell']);
    const s=await page.evaluate(()=>qaGame().snapshot());assert.equal(s.untimedCalibration,true);
    assert.ok(Math.abs(s.view.width/s.view.height-width/height)<.01);
    await snap('six-'+width+'x'+height);add('viewport_'+width+'x'+height,s.view);
  }
  await page.evaluate(()=>qaLoad('HUD'));await waitPlanning();
  const defaultState=await page.evaluate(()=>qaGame().snapshot());assert.equal(defaultState.untimedCalibration,false);
  assert.deepEqual(defaultState.sequence,['cardboard_box','wood_plank','fridge','basketball']);
  add('normal_entry_preserves_four_object_sequence_and_timer',defaultState);
  report.status=report.errors.length?'checks_complete_with_browser_errors':'passed';
 }catch(error){report.status='failed';report.failure=String(error.stack||error);process.exitCode=1}
 finally{fs.writeFileSync(path.join(OUT,'UI.json'),JSON.stringify(report,null,2)+'\n');await browser?.close();process.stdout.write(JSON.stringify({status:report.status,checks:report.checks.length,errors:report.errors,failure:report.failure})+'\n')}
}
main();
