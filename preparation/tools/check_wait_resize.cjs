/** Bounded actual-Cocos resize regression. No controller or contact stubs.
 * Alternating first-body vx keeps genuine contacts below the strict score gate.
 * Automatic Box2D stepping is paused only for layout-isolation comparisons;
 * controller updates, UI layout and actual touch rotation continue normally.
 */
const { chromium } = require('/Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'preparation/review/evidence/placement-wait-r1');
const report = { status: 'running', createdAt: new Date().toISOString(),
  method: 'Actual built Cocos automatic physics makes all contacts and handoff decisions. First cardboard receives alternating +/-0.18 m/s vx after native contact to exercise timeout without a confirmed score. For resize-only isolation, public PhysicsSystem2D.autoSimulation is temporarily false while ordinary controller, layout and touchscreen rotation remain active; no body position/type/mass/scale or contact list is modified. Real physics resumes afterward.',
  checks: [], captures: [], errors: [] };
let browser, page;
const read = () => page.evaluate(() => qaGame()?.snapshot() || { scene:qaCC.director.getScene()?.name });
const waitPlanning = id => page.waitForFunction(id => qaGame()?.snapshot().phase === 'planning' && qaGame().snapshot().currentId === id, id, {timeout:15000});
async function twoFrames() { await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); }
function invariant(s) { return s.bodies.filter(b => b.lossBoundary).map(b => ({id:b.id, position:b.position, angle:b.angle, mass:b.mass, scale:b.scale, type:b.type, lossBoundary:b.lossBoundary})); }
async function capture(name) { await twoFrames(); await page.screenshot({path:path.join(OUT,name+'.png')}); report.captures.push(name+'.png'); }
async function rotateButton() {
  const p = await page.evaluate(() => {
    const cc=qaCC,g=qaGame(),camera=g.node.getComponent(cc.Canvas).cameraComponent;
    const point=camera.worldToScreen(g.display.rotate.worldPosition),rect=cc.game.canvas.getBoundingClientRect();
    return {x:rect.left+point.x/cc.game.canvas.width*rect.width,y:rect.top+(1-point.y/cc.game.canvas.height)*rect.height};
  });
  await page.touchscreen.tap(p.x,p.y); await twoFrames();
}
async function start(sequence) {
  await page.evaluate(() => {
    window.resizeProbe?.dispose();
    qaCC.PhysicsSystem2D.instance.autoSimulation=true;
    qaCC.PhysicsSystem2D.instance.resetAccumulator(0);
    localStorage.setItem('zhynd.local-settings.v1',JSON.stringify({tutorialDone:true,music:false,sound:false,vibration:false}));
  });
  await page.evaluate(() => qaLoad('HUD')); await waitPlanning(1);
  assert.equal(await page.evaluate(sequence => qaGame().configureCalibration(sequence,true),sequence),true);
  await page.evaluate(() => {
    const cc=qaCC,g=qaGame(); let frame=0;
    const p=window.resizeProbe={sway:true};
    const afterPhysics=()=>{
      frame++;
      const b=g.world.bodies[0];
      if(p.sway && b.collider.enabled && b.contactSeconds!==null && cc.PhysicsSystem2D.instance.autoSimulation) {
        b.body.linearVelocity=new cc.Vec2(frame%2?.18:-.18,b.body.linearVelocity.y); b.body.wakeUp();
      }
    };
    cc.director.on(cc.Director.EVENT_AFTER_PHYSICS,afterPhysics);
    p.dispose=()=>cc.director.off(cc.Director.EVENT_AFTER_PHYSICS,afterPhysics);
  });
}
async function releaseNext(id) {
  await waitPlanning(id); await page.evaluate(()=>{qaGame().moveTo(0);qaGame().release()}); await waitPlanning(id+1);
}
async function check(name, fn) {
  const item={name,status:'running'}; report.checks.push(item);
  try {item.evidence=await fn();item.status='passed';}
  catch(e){item.status='failed';item.error=String(e.stack||e);item.state=await read().catch(()=>null)}
  fs.writeFileSync(path.join(OUT,'RESIZE.json'),JSON.stringify(report,null,2)+'\n');
  process.stdout.write(name+': '+item.status+(item.error?'\n'+item.error:'')+'\n');
}
async function isolateResize(label) {
  await page.evaluate(()=>{qaCC.PhysicsSystem2D.instance.autoSimulation=false;qaCC.PhysicsSystem2D.instance.resetAccumulator(0)});
  const before=await read(), baseline=invariant(before), views=[];
  assert.equal(before.phase,'planning'); assert.ok(before.bodies[0].contactSeconds===1.5 && !before.bodies[0].placed);
  try {
    for(const [width,height] of [[375,667],[375,812],[600,800]]) {
      await page.setViewportSize({width,height});
      await page.waitForFunction(r=>{const s=qaGame()?.snapshot();return s&&Math.abs(s.view.width/s.view.height-r)<.015},width/height);
      await twoFrames();
      const poses=[];
      for(let i=0;i<4;i++) {
        const value=await page.evaluate(()=>{
          const g=qaGame(),s=g.snapshot(),top=Math.max(0,...g.world.bodies.filter(b=>b.collider.enabled&&b.contacts.size>0).map(b=>g.world.bounds(b).top));
          return {state:s,contactTop:top,gap:g.world.bounds(g.current).bottom-top,renderBottom:s.view.cameraY+(-s.view.height/2-s.view.originY)/s.view.scale};
        });
        assert.deepEqual(invariant(value.state),baseline,'Resize/rotate must not transform released bodies, mass, physical scale, type, or frozen loss boundary');
        assert.equal(value.state.phase,'planning'); assert.equal(value.state.releases,before.releases);
        assert.ok(value.gap>=23.999,'Every actual touch-rotated pose retains >=24 world-unit clearance');
        poses.push(value); await rotateButton();
      }
      const angles=poses.map(p=>Math.round(((p.state.bodies.at(-1).angle%360)+360)%360));
      assert.equal(new Set(angles).size,4,'Touching rotate button must produce four unique quarter-turns');
      views.push({width,height,angles,poses}); await capture(label+'-'+width+'x'+height);
    }
    return {before,baseline,views};
  } finally { await page.evaluate(()=>{qaCC.PhysicsSystem2D.instance.resetAccumulator(0);qaCC.PhysicsSystem2D.instance.autoSimulation=true}) }
}
async function highTower() {
  await page.setViewportSize({width:375,height:667});
  await start(['cardboard_box','cardboard_box','cardboard_box','cardboard_box','cardboard_box','cardboard_box','cardboard_box','wood_plank']);
  const attempts=[];
  for(let id=1;id<=7;id++) {
    await releaseNext(id); const state=await read(); attempts.push(state);
    assert.equal(state.bodies[0].placed,false); assert.equal(state.peakMetres,0);
  }
  await page.waitForFunction(()=>{
    const s=qaGame()?.snapshot(); if(!s)return false;
    const bottom=s.view.cameraY+(-s.view.height/2-s.view.originY)/s.view.scale;
    return s.bodies[0].bounds.top<bottom && s.view.cameraY>1;
  },null,{timeout:4000});
  const before=await read();
  const currentVisibleBottom=before.view.cameraY+(-before.view.height/2-before.view.originY)/before.view.scale;
  assert.ok(before.bodies[0].bounds.top<currentVisibleBottom);
  assert.ok(before.bodies[0].bounds.top>before.bodies[0].lossBoundary.bottom);
  const resize=await isolateResize('high-tower-resize');
  // Native physics resumes; an ordinary old tower body outside the current view must not end the run.
  await page.evaluate(()=>new Promise(r=>{let n=0;const tick=()=>{if(++n>=30){qaCC.director.off(qaCC.Director.EVENT_AFTER_UPDATE,tick);r()}};qaCC.director.on(qaCC.Director.EVENT_AFTER_UPDATE,tick)}));
  const resumed=await read(); assert.equal(resumed.phase,'planning'); assert.equal(resumed.currentId,8);
  assert.equal(resumed.bodies[0].lossBoundary.bottom,before.bodies[0].lossBoundary.bottom);
  assert.equal(await page.evaluate(()=>qaCC.PhysicsSystem2D.instance.autoSimulation),true);
  await page.evaluate(()=>{resizeProbe.sway=false});
  await page.waitForFunction(()=>qaGame()?.snapshot().placed===7,null,{timeout:12000});
  const settled=await read();
  const settledVisibleBottom=settled.view.cameraY+(-settled.view.height/2-settled.view.originY)/settled.view.scale;
  assert.equal(settled.phase,'planning'); assert.equal(settled.currentId,8);
  assert.equal(settled.bodies[0].placed,true); assert.ok(settled.bodies[0].bounds.top<settledVisibleBottom);
  assert.equal(settled.bodies[0].lossBoundary.bottom,before.bodies[0].lossBoundary.bottom);
  await capture('high-tower-old-base-settled-offscreen');
  return {attempts,before,currentVisibleBottom,resize,resumed,settled,settledVisibleBottom};
}
(async()=>{
  try {
    fs.mkdirSync(OUT,{recursive:true}); browser=await chromium.launch({headless:true});
    page=await browser.newPage({viewport:{width:375,height:667},hasTouch:true});
    page.on('pageerror',e=>report.errors.push(String(e)));
    await page.goto('http://127.0.0.1:8767/preparation/review/play-player.html?revision=placement-wait-resize-r1');
    await page.waitForFunction(()=>!!window.qaLoad,null,{timeout:45000});
    await check('first_timeout_resize_and_actual_rotate_button',async()=>{
      await start(['cardboard_box','wood_plank']);await releaseNext(1);
      const result=await isolateResize('timeout-resize');
      assert.equal(await page.evaluate(()=>qaCC.PhysicsSystem2D.instance.autoSimulation),true);return result;
    });
    await check('high_tower_resize_and_frozen_old_body_loss_boundary',highTower);
    report.status=report.checks.every(c=>c.status==='passed')&&!report.errors.length?'passed':'failed';
  }catch(e){report.status='failed';report.failure=String(e.stack||e)}
  finally {
    if(report.status!=='passed')process.exitCode=1;
    fs.writeFileSync(path.join(OUT,'RESIZE.json'),JSON.stringify(report,null,2)+'\n');
    await browser?.close();process.stdout.write(JSON.stringify({status:report.status,errors:report.errors,checks:report.checks.map(c=>({name:c.name,status:c.status,error:c.error})),failure:report.failure})+'\n');
  }
})();
