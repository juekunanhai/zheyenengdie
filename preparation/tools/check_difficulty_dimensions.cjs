/** Current candidate dimensions through the ordinary Cocos controller, without pose/physics overrides. */
const { chromium } = require('/Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'../..'),OUT=path.join(ROOT,'preparation/review/evidence/difficulty-r1');
const OUTPUT=path.join(OUT,process.argv[2]||'DIFFICULTY_DIMENSIONS.json');
if(fs.existsSync(OUTPUT))throw Error('Refusing to overwrite existing dimensions evidence');
const KINDS=['cardboard_box','wood_plank','fridge'];
const KIND_FILTER=process.argv[3]||null;
const CAPTURE_PREFIX=path.basename(OUTPUT,'.json').toLowerCase();
const report={status:'running',createdAt:new Date().toISOString(),method:'Actual compiled Cocos HUD, automatic native Box2D, configureCalibration([paper, plank, fridge, paper], true), controller.rotate/moveTo/release. No body pose, velocity, type, scale, contacts, stepping, score, or camera mutation. Measurements after normal UI animation settles. World-coordinate area-density products are not engine mass; snapshot mass is native kg.',views:[],errors:[],sources:{},captures:[],kindFilter:KIND_FILTER};
for(const f of ['assets/batch1/object-data.ts','assets/batch1/tower-world.ts','assets/batch1/game-controller.ts','assets/batch1/play-view.ts','preparation/review/play-player.html','build/web-desktop/assets/main/index.js'])report.sources[f]=crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,f))).digest('hex');
const save=()=>fs.writeFileSync(OUTPUT,JSON.stringify(report,null,2)+'\n');
let browser,page;
async function frames(){await page.evaluate(()=>new Promise(resolve=>qaCC.director.once(qaCC.Director.EVENT_AFTER_DRAW,()=>qaCC.director.once(qaCC.Director.EVENT_AFTER_DRAW,resolve))));}
async function measure(){return page.evaluate(()=>{
 const cc=qaCC,g=qaGame(),s=g.snapshot(),held=g.current,v=g.display,bodyView=v.views.get(held.id);
 const camera=g.node.getComponent(cc.Canvas).cameraComponent,canvas=cc.game.canvas,canvasRect=canvas.getBoundingClientRect();
 const project=point=>{const q=camera.worldToScreen(point);return {x:canvasRect.left+q.x/canvas.width*canvasRect.width,y:canvasRect.top+(1-q.y/canvas.height)*canvasRect.height};};
 const rect=node=>{const b=node.getComponent(cc.UITransform).getBoundingBoxToWorld();const points=[project(new cc.Vec3(b.x,b.y,0)),project(new cc.Vec3(b.x+b.width,b.y+b.height,0))];return{left:Math.min(...points.map(p=>p.x)),right:Math.max(...points.map(p=>p.x)),top:Math.min(...points.map(p=>p.y)),bottom:Math.max(...points.map(p=>p.y))};};
 const bounds=g.world.bounds(held),released=g.world.bodies.filter(b=>b.collider.enabled),supportTop=Math.max(0,...released.map(b=>g.world.bounds(b).top));
 const attachment=v.root.getComponent(cc.UITransform).convertToWorldSpaceAR(new cc.Vec3(held.node.position.x*s.view.scale,s.view.originY+(bounds.top-s.view.cameraY)*s.view.scale,0));
 const nextKind=s.sequence[(s.releases+1)%s.sequence.length];
 return{scene:cc.director.getScene().name,phase:s.phase,currentId:held.id,kind:held.spec.kind,angle:s.bodies.at(-1).angle,releases:s.releases,position:{x:held.node.position.x,y:held.node.position.y},physicsScale:held.node.worldScale.clone(),bounds,supportTop,gap:bounds.bottom-supportTop,boundary:s.boundary,view:s.view,canvas:{left:canvasRect.left,top:canvasRect.top,right:canvasRect.right,bottom:canvasRect.bottom},attachment:project(attachment),sprite:{active:bodyView.activeInHierarchy,frame:bodyView.getComponent(cc.Sprite).spriteFrame.name,rect:rect(bodyView),size:bodyView.getComponent(cc.UITransform).contentSize},claw:{active:v.claw.activeInHierarchy,frame:v.claw.getComponent(cc.Sprite).spriteFrame.name,rect:rect(v.claw)},next:{expected:'next_'+nextKind,frame:v.next.spriteFrame.name,active:v.next.node.activeInHierarchy,rect:rect(v.next.node),size:v.next.node.getComponent(cc.UITransform).contentSize,originalSize:v.next.spriteFrame.originalSize},releasedBodies:s.bodies.filter(b=>b.type===cc.ERigidBody2DType.Dynamic).map(b=>({id:b.id,kind:b.kind,mass:b.mass,scale:b.scale,angle:b.angle,position:b.position})),autoSimulation:cc.PhysicsSystem2D.instance.autoSimulation};
 });}
function validatePose(m){
 assert.equal(m.phase,'planning');assert.ok(m.autoSimulation);assert.ok(['x','y','z'].every(axis=>Math.abs(m.physicsScale[axis]-1)<1e-6),'Physics node scale remains one within float precision');
 assert.ok(m.gap>0,'Current collider must stay above actual platform/tower top');
 assert.ok(m.bounds.left>=m.boundary.left+3.999 && m.bounds.right<=m.boundary.right-3.999,'Held collider must remain inside lateral margins');
 assert.ok(m.sprite.active&&m.claw.active&&m.next.active);
 assert.equal(m.sprite.frame,'object_'+m.kind);assert.equal(m.next.frame,m.next.expected);
 assert.ok(m.attachment.x>=m.canvas.left&&m.attachment.x<=m.canvas.right&&m.attachment.y>=m.canvas.top&&m.attachment.y<=m.canvas.bottom,'Attachment point must be visible');
 assert.ok(m.attachment.x>=m.claw.rect.left-.5&&m.attachment.x<=m.claw.rect.right+.5&&m.attachment.y>=m.claw.rect.top-.5&&m.attachment.y<=m.claw.rect.bottom+.5,'Claw overlaps actual body attachment');
 assert.ok(m.sprite.rect.left>=m.canvas.left-.5&&m.sprite.rect.right<=m.canvas.right+.5&&m.sprite.rect.top>=m.canvas.top-.5&&m.sprite.rect.bottom<=m.canvas.bottom+.5,'Held Sprite rect must be visible');
 assert.ok(m.next.rect.left>=m.canvas.left&&m.next.rect.right<=m.canvas.right&&m.next.rect.top>=m.canvas.top&&m.next.rect.bottom<=m.canvas.bottom,'NEXT must be visible');
 assert.ok(Math.abs(m.next.size.width/m.next.size.height-m.next.originalSize.width/m.next.originalSize.height)<1e-6,'NEXT aspect preserved');
 m.clawClippedAtScreenEdge=m.claw.rect.left<m.canvas.left||m.claw.rect.right>m.canvas.right||m.claw.rect.top<m.canvas.top||m.claw.rect.bottom>m.canvas.bottom;
}
async function planning(id){await page.waitForFunction(id=>qaGame()?.snapshot().phase==='planning'&&qaGame().snapshot().currentId===id,id,{timeout:15000});await page.waitForFunction(()=>{const s=qaGame()?.snapshot();return s&&Math.abs(s.view.cameraY-s.view.targetCameraY)<.025},null,{timeout:5000});await frames();}
(async()=>{try{
 browser=await chromium.launch({headless:true});page=await browser.newPage({viewport:{width:375,height:667},hasTouch:true});page.on('pageerror',e=>report.errors.push(String(e)));await page.goto('http://127.0.0.1:8767/preparation/review/play-player.html?revision=difficulty-dimensions-r1');await page.waitForFunction(()=>!!window.qaLoad,null,{timeout:45000});
 report.engine=await page.evaluate(()=>qaSnapshot());report.compiledSpecs=await page.evaluate(async()=>JSON.parse(JSON.stringify((await System.import('chunks:///_virtual/object-data.ts')).OBJECTS)));
 for(const [width,height] of [[375,667],[375,812],[600,800]]){
  await page.setViewportSize({width,height});await page.evaluate(()=>{localStorage.setItem('zhynd.local-settings.v1',JSON.stringify({tutorialDone:true,music:false,sound:false,vibration:false}));});await page.evaluate(()=>qaLoad('HUD'));await planning(1);
  assert.equal(await page.evaluate(()=>qaGame().configureCalibration(['cardboard_box','wood_plank','fridge','cardboard_box'],true)),true);
  const view={viewport:{width,height},objects:[]};report.views.push(view);save();
  for(let k=0;k<KINDS.length;k++){
   const id=k+1;await planning(id);
   if(KIND_FILTER&&KINDS[k]!==KIND_FILTER){
    if(k<2){await page.evaluate(()=>{qaGame().moveTo(0);qaGame().release();});await planning(id+1);}
    continue;
   }
   const obj={kind:KINDS[k],poses:[]};view.objects.push(obj);
   for(let rotation=0;rotation<4;rotation++){
    await page.evaluate(()=>qaGame().moveTo(0));await frames();const center=await measure();validatePose(center);assert.equal(center.kind,KINDS[k]);
    await page.evaluate(()=>qaGame().moveTo(-100000));await frames();const left=await measure();validatePose(left);
    await page.evaluate(()=>qaGame().moveTo(100000));await frames();const right=await measure();validatePose(right);
    assert.ok(right.position.x>left.position.x,'Every orientation must permit lateral movement');
    assert.ok(Math.abs(left.bounds.left-left.boundary.left-4)<.001&&Math.abs(right.boundary.right-right.bounds.right-4)<.001,'moveTo clamps at genuine collider edges');
    obj.poses.push({rotation,center,left,right,movableWidth:right.position.x-left.position.x});
    await page.evaluate(()=>{qaGame().moveTo(0);qaGame().rotate();});await frames();save();
   }
   assert.equal(new Set(obj.poses.map(p=>Math.round(((p.center.angle%360)+360)%360))).size,4);
   if(k===1){await page.evaluate(()=>qaGame().rotate());await frames();const capture=CAPTURE_PREFIX+'-'+width+'x'+height+'-vertical-plank.png';await page.screenshot({path:path.join(OUT,capture)});report.captures.push(capture);await page.evaluate(()=>qaGame().rotate());await page.evaluate(()=>qaGame().rotate());await page.evaluate(()=>qaGame().rotate());await frames();}
   if(k===2){const capture=CAPTURE_PREFIX+'-'+width+'x'+height+'-fridge.png';await page.screenshot({path:path.join(OUT,capture)});report.captures.push(capture);}
   if(k<2){await page.evaluate(()=>{qaGame().moveTo(0);qaGame().release();});await planning(id+1);}
   console.log(JSON.stringify({viewport:[width,height],kind:obj.kind,poses:obj.poses.length,minGap:Math.min(...obj.poses.flatMap(p=>[p.center.gap,p.left.gap,p.right.gap])),minMovableWidth:Math.min(...obj.poses.map(p=>p.movableWidth))}));
  }
 }
 report.status=report.errors.length?'failed':'passed_dimensions_not_gameplay_difficulty';
 report.summary={viewports:report.views.length,objectOrientations:report.views.reduce((n,v)=>n+v.objects.reduce((s,o)=>s+o.poses.length,0),0),clippedClawEdgePoses:report.views.flatMap(v=>v.objects.flatMap(o=>o.poses.flatMap(p=>['left','right'].filter(side=>p[side].clawClippedAtScreenEdge).map(side=>({viewport:v.viewport,kind:o.kind,angle:p[side].angle,side,rect:p[side].claw.rect})))))};
}catch(e){report.status='failed_or_incomplete';report.failure=String(e.stack||e);try{report.failureState=await measure()}catch{}process.exitCode=1;}finally{save();await browser?.close();console.log(JSON.stringify({status:report.status,failure:report.failure,summary:report.summary,errors:report.errors}));}})();
