/** Directed native Box2D checks of local plank support and contact cushioning.
 * Fixtures may widen the ground, reposition bodies, inject impulses or disable gravity;
 * those isolation controls are recorded below and are not gameplay balance evidence.
 */
const { chromium } = require('/Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const ROOT = path.resolve(__dirname, '../..'), OUT = path.join(ROOT, 'preparation/review/evidence/difficulty-r1');
const REPORT_FILE = process.env.STABILIZER_CASE ? 'STABILIZER-' + process.env.STABILIZER_CASE + '.json' : 'STABILIZER.json';
const report = { status: 'running', createdAt: new Date().toISOString(),
  method: 'Built TowerWorld with automatic Cocos frames and native Box2D contacts. Directed fixture controls do not alter runtime source, substitute contacts, or stub attachment decisions. Current object shapes are reused; a 260-wide constant-mass plank and widened ground are explicit three-support fixtures.',
  checks: [], errors: [] };
let browser, page;
async function frames(n) { await page.evaluate(n => p.frames(n), n); }
async function read() { return page.evaluate(() => p.read()); }
async function fresh() {
  await page.evaluate(() => window.p?.dispose());
  await page.evaluate(() => qaLoad('HUD'));
  await page.waitForFunction(() => qaGame()?.snapshot().phase === 'planning');
  await page.evaluate(async () => {
    const cc = qaCC, g = qaGame(); g.enabled = false; g.audio.pause(true); g.world.dispose(); g.display.dispose();
    await new Promise(resolve => requestAnimationFrame(resolve));
    const { TowerWorld } = await System.import('chunks:///_virtual/tower-world.ts');
    const { PlayView } = await System.import('chunks:///_virtual/play-view.ts');
    const data = await System.import('chunks:///_virtual/object-data.ts');
    const world = g.world = new TowerWorld(cc.director.getScene());
    g.display = new PlayView(g.node, new Map(g.frames.map(frame => [frame.name, frame]))); g.current = null;
    const p = window.p = { world, data, steady:0, ticks:0, maxBonds:0, maxSupportContacts:0, contactSamples:[], cushionSamples:[] };
    const paint = () => {
      p.ticks++; p.steady = world.isStable() ? p.steady + 1 : 0;
      g.display.update(1/60, world.bodies, null, 1);
      p.maxBonds = Math.max(p.maxBonds, world.stabilizerSnapshot().active.length);
      for (const b of world.bodies.filter(b => b.spec.stabilizer))
        p.maxSupportContacts = Math.max(p.maxSupportContacts, [...b.contacts].filter(c => world.bodies.some(o => o.collider===c && o.id<b.id)).length);
    };
    cc.director.on(cc.Director.EVENT_AFTER_PHYSICS, paint);
    p.dispose = () => cc.director.off(cc.Director.EVENT_AFTER_PHYSICS, paint);
    p.frames = n => new Promise(resolve => { let count=0; const tick=()=>{ if (++count<n) return;
      cc.director.off(cc.Director.EVENT_AFTER_PHYSICS,tick); resolve(); }; cc.director.on(cc.Director.EVENT_AFTER_PHYSICS,tick); });
    p.plank = (width=data.OBJECTS.wood_plank.width) => {
      const spec=data.OBJECTS.wood_plank, scale=width/spec.width;
      return {...spec,width,spriteWidth:spec.spriteWidth*scale,density:spec.density/scale,
        outline:spec.outline?.map(([x,y])=>[x*scale,y]),contactImpactSpeed:2.4,
        stabilizer:{maxForce:420,maxTorque:95,maxImpactSpeed:1.8,maxAngleError:12}};
    };
    p.spawn = (spec,x,y,angle=0) => {
      const b=world.create(spec,x,y); b.node.setRotationFromEuler(0,0,angle); world.release(b); p.steady=0;
      b.collider.on(cc.Contact2DType.PRE_SOLVE,(self,other,contact)=>{
        const m=contact.getWorldManifold(),sign=contact.colliderA===self?1:-1;
        if (p.contactSamples.length<500) p.contactSamples.push({id:b.id,other:world.bodies.find(o=>o.collider===other)?.id??0,ny:m.normal.y*sign,
          cushioned:world.cushionedBodies.has(b.id), angle:data.planarAngle(b.node.rotation)});
      }); return b;
    };
    const cushion=world.cushionImpact.bind(world);
    world.cushionImpact=(body,support,point,toward,limit)=>{
      const axis=toward.clone(),tangent=new cc.Vec2(-axis.y,axis.x),before=body.linearVelocity.clone(),omega=body.angularVelocity;
      cushion(body,support,point,toward,limit);
      p.cushionSamples.push({id:world.bodies.find(b=>b.body===body)?.id,limit,normal:[axis.x,axis.y],before:[before.x,before.y],after:[body.linearVelocity.x,body.linearVelocity.y],
        tangentDelta:body.linearVelocity.clone().subtract(before).dot(tangent),omegaDelta:body.angularVelocity-omega});
    };
    p.read=()=>({steady:p.steady,ticks:p.ticks,maxBonds:p.maxBonds,maxSupportContacts:p.maxSupportContacts,stabilizers:world.stabilizerSnapshot(),jointOffsets:Array.from(world.stabilizerBonds.values()).map(b=>b.joint.angularOffset),adhesion:Array.from(world.bonds.values()).map(b=>({ballId:b.ball.id,side:b.side,angleOffset:b.joint.angularOffset,baseAngle:b.base.impl.impl.GetAngle()*180/Math.PI,attachedAngle:b.attached.impl.impl.GetAngle()*180/Math.PI})),
      contacts:p.contactSamples,cushions:p.cushionSamples,bodies:world.bodies.map(b=>({id:b.id,kind:b.spec.kind,x:b.node.position.x,y:b.node.position.y,
        angle:data.planarAngle(b.node.rotation),nativeAngle:b.body.impl.impl.GetAngle()*180/Math.PI,vx:b.body.linearVelocity.x,vy:b.body.linearVelocity.y,omega:b.body.angularVelocity,
        dynamic:b.body.type===cc.ERigidBody2DType.Dynamic,contacts:[...b.contacts].map(c=>world.bodies.find(o=>o.collider===c)?.id??0),cushioned:world.cushionedBodies.has(b.id)}))});
  });
}
async function stable() { await page.waitForFunction(() => p.steady>=25,null,{timeout:10000}); }
async function check(name,action) {
  const item={name,status:'running'};report.checks.push(item);
  try {item.evidence=await action();item.status='passed';} catch(error){item.status='failed';item.error=String(error.stack||error);item.evidence=await read().catch(()=>null);}
  fs.writeFileSync(path.join(OUT,REPORT_FILE),JSON.stringify(report,null,2)+'\n');
  process.stdout.write(`${name}: ${item.status}${item.error?'\n'+item.error:''}\n`);
}
async function oneSupport(angle=0) {
  await fresh(); await page.evaluate(()=>p.spawn({...p.data.OBJECTS.cardboard_box,contactImpactSpeed:2.4},0,90));await stable();
  await page.evaluate(angle=>p.spawn(p.plank(),0,190,angle),angle);
  await page.waitForFunction(()=>p.world.stabilizerSnapshot().active.length===1,null,{timeout:6000}); await frames(20); return read();
}
async function staticGround() {
  await fresh();await page.evaluate(()=>p.spawn(p.plank(),0,100));await stable();const s=await read();
  assert.equal(s.stabilizers.active.length,0);assert.ok(s.bodies[0].contacts.includes(0));return s;
}
async function upsideDown() {
  const s=await oneSupport(180);assert.equal(s.stabilizers.active.length,1);assert.ok(Math.abs(s.bodies[1].angle)>165);return s;
}
async function bridgeLimitAndFreeFall() {
  await fresh();await page.evaluate(()=>{p.world.platform.size=new qaCC.Size(400,24);p.world.platform.apply();for(const x of [-100,0,100])p.spawn({...p.data.OBJECTS.cardboard_box,contactImpactSpeed:2.4},x,85);});await stable();
  await page.evaluate(()=>p.spawn(p.plank(260),0,185));
  await page.waitForFunction(()=>p.world.stabilizerSnapshot().active.length===2,null,{timeout:7000});await frames(35);
  const before=await read();assert.equal(before.stabilizers.active.length,2);assert.ok(before.maxSupportContacts>=3,'Must actually touch three different lower bodies');
  assert.ok(before.maxBonds<=2);assert.ok(before.stabilizers.active.reduce((s,b)=>s+b.maxForce,0)<=420);assert.ok(before.stabilizers.active.reduce((s,b)=>s+b.maxTorque,0)<=95);
  assert.ok(before.stabilizers.active.every(b=>b.supportId<b.plankId));
  await page.screenshot({path:path.join(OUT,'stabilizer-three-supports.png')});
  await page.evaluate(()=>{p.world.platform.enabled=false;});await frames(35);const after=await read();
  assert.equal(after.stabilizers.active.length,2);assert.ok(after.bodies.every((b,i)=>b.dynamic&&b.y<before.bodies[i].y-50));
  return {before,after};
}
async function vertical() {
  await fresh();await page.evaluate(()=>p.spawn({...p.data.OBJECTS.cardboard_box,contactImpactSpeed:2.4},0,80));await stable();
  await page.evaluate(()=>{const b=p.spawn(p.plank(),0,245,90);b.body.fixedRotation=true;});
  await page.waitForFunction(()=>p.world.bodies[1].contacts.has(p.world.bodies[0].collider));await frames(25);const s=await read();
  assert.equal(s.maxBonds,0);assert.ok(Math.abs(s.bodies[1].angle-90)<.1);return {isolation:'Only this vertical-orientation probe locks rotation to prevent later horizontal landing; both bodies remain dynamic.',...s};
}
async function sideThenLanding() {
  await fresh();await page.evaluate(()=>{
    const support=p.spawn(p.data.OBJECTS.fridge,70,260);support.body.gravityScale=0;support.body.fixedRotation=true;
    const plank=p.spawn(p.plank(),-105,245);plank.body.gravityScale=0;plank.body.fixedRotation=true;plank.body.linearVelocity=new qaCC.Vec2(4,0);
  });
  await page.waitForFunction(()=>p.contactSamples.some(c=>c.id===2&&c.other===1&&Math.abs(c.ny)<.1),null,{timeout:6000});await frames(4);const side=await read();
  assert.equal(side.maxBonds,0);assert.equal(side.bodies[1].cushioned,false);
  await page.evaluate(()=>{p.world.bodies[0].collider.enabled=false;const b=p.world.bodies[1];b.node.setPosition(0,145,0);b.body.gravityScale=1;b.body.fixedRotation=false;b.body.linearVelocity=new qaCC.Vec2(.5,-4);});
  await page.waitForFunction(()=>p.world.bodies[1].contacts.has(p.world.platform));await frames(10);const landed=await read();
  assert.equal(landed.bodies[1].cushioned,true);assert.equal(landed.cushions.filter(c=>c.id===2).length,1);
  assert.ok(landed.cushions.every(c=>Math.abs(c.tangentDelta)<1e-6&&Math.abs(c.omegaDelta)<1e-6));return {side,landed};
}
async function tearNoReconnect() {
  const before=await oneSupport();await page.evaluate(()=>{const b=p.world.bodies[1];b.body.applyLinearImpulse(new qaCC.Vec2(150,0),b.body.getWorldCenter(new qaCC.Vec2()),true);});
  await page.waitForFunction(()=>p.world.stabilizerSnapshot().active.length===0&&p.world.stabilizerSnapshot().brokenPairs.length===1,null,{timeout:5000});const torn=await read();
  await page.evaluate(()=>{
    const cc=qaCC,[support,plank]=p.world.bodies;
    for(const b of [support,plank]){b.node.setRotationFromEuler(0,0,0);b.body.linearVelocity=new cc.Vec2();b.body.angularVelocity=0;b.body.wakeUp();}
    support.node.setPosition(0,p.data.OBJECTS.cardboard_box.height/2+.5,0);plank.node.setPosition(0,p.data.OBJECTS.cardboard_box.height+60,0);
  });await page.waitForFunction(()=>p.world.bodies[1].contacts.has(p.world.bodies[0].collider),null,{timeout:7000});await frames(35);const later=await read();
  assert.equal(later.stabilizers.active.length,0);assert.equal(later.stabilizers.brokenPairs.length,1);return {before,torn,later};
}
async function halfTurnBoundary() {
  await fresh();await page.evaluate(()=>p.spawn({...p.data.OBJECTS.cardboard_box,contactImpactSpeed:2.4},0,90));await stable();
  const initial=await page.evaluate(()=>{
    const cc=qaCC,support=p.world.bodies[0],native=support.body.impl.impl;
    // Equivalent physical pose at two complete native turns tests continuous-angle handling.
    native.SetTransform(native.GetPosition(),Math.PI*4);
    const plank=p.spawn(p.plank(),0,185,180);return {support:native.GetAngle()*180/Math.PI,plank:plank.body.impl.impl.GetAngle()*180/Math.PI};
  });await page.waitForFunction(()=>p.world.stabilizerSnapshot().active.length===1,null,{timeout:6000});const attached=await read();await frames(45);const after=await read();
  assert.equal(after.stabilizers.active.length,1);assert.ok(attached.bodies[0].nativeAngle>700);assert.ok(attached.jointOffsets[0]<-500);assert.ok(after.stabilizers.active[0].angle<5);assert.ok(Math.abs(after.bodies[1].angle)>165);
  assert.ok(Math.abs(after.bodies[1].omega)<.5);return {initial,attached,after};
}
async function basketballHalfTurnBoundary() {
  await fresh();await page.evaluate(()=>p.spawn({...p.data.OBJECTS.cardboard_box,contactImpactSpeed:2.4},0,90));await stable();
  const initial=await page.evaluate(()=>{
    const support=p.world.bodies[0],native=support.body.impl.impl;
    // Keep the QA support at a physical 181-degree pose while a real 0-degree ball lands.
    // Both remain dynamic; fixing this lower body's rotation only isolates angle representation.
    support.body.fixedRotation=true;native.SetTransform(native.GetPosition(),181*Math.PI/180);
    p.spawn(p.data.OBJECTS.basketball,0,195);return {supportAngle:native.GetAngle()*180/Math.PI,ballParameters:p.data.OBJECTS.basketball.adhesion};
  });await page.waitForFunction(()=>p.world.bonds.size===1,null,{timeout:6000});const attached=await read();await frames(50);const after=await read();
  assert.equal(after.adhesion.length,1);assert.equal(after.adhesion[0].side,-1);
  assert.ok(attached.adhesion[0].baseAngle>180&&attached.adhesion[0].baseAngle<182);
  assert.ok(attached.adhesion[0].angleOffset<-175&&attached.adhesion[0].angleOffset>-185);
  assert.ok(Math.abs(after.bodies[1].nativeAngle)<5,'Ball must not perform a spurious full turn after adhesion');
  assert.ok(Math.abs(after.bodies[1].omega)<.5);
  assert.deepEqual(initial.ballParameters,{maxForce:1500,maxTorque:150,maxImpactSpeed:2});
  return {isolation:'Dynamic lower box fixedRotation at native 181 degrees; genuine falling basketball and PRE_SOLVE create adhesion with original parameters.',initial,attached,after};
}
async function targetInitialization() {
  await fresh();await page.evaluate(()=>{
    const cc=qaCC,w=p.world;p.targets=[];
    const capture=(contact,attach,plank)=>{
      const base=plank?contact.support.body:(contact.side<0?contact.other.body:contact.ball.body);
      const attached=plank?contact.plank.body:(contact.side<0?contact.ball.body:contact.other.body);
      const baseCollider=plank?contact.support.collider:(contact.side<0?contact.other:contact.ball.collider);
      const before=[base.node.position.clone(),attached.node.position.clone()],m=contact.contact.getWorldManifold();
      const sign=contact.contact.colliderA===baseCollider?1:-1,d=Math.max(0,-Math.min(...m.separations)-.16);
      const normal=new cc.Vec2(m.normal.x*sign,m.normal.y*sign),actual=base.getLocalPoint(attached.getWorldPoint(new cc.Vec2(),new cc.Vec2()),new cc.Vec2());
      const expected=actual.clone().add(base.getLocalVector(normal.clone().multiplyScalar(d),new cc.Vec2())),separations=m.separations.slice();
      const bond=attach(contact);
      p.targets.push({type:plank?'plank':'basketball',side:contact.side??-1,correction:d,separations,actual:[actual.x,actual.y],expected:[expected.x,expected.y],target:[bond.offset.x,bond.offset.y],
        error:cc.Vec2.distance(expected,bond.offset),bodyMoved:cc.Vec3.distance(before[0],base.node.position)+cc.Vec3.distance(before[1],attached.node.position)});return bond;
    };
    const ball=w.attach.bind(w),board=w.attachStabilizer.bind(w);
    w.attach=c=>capture(c,ball,false);w.attachStabilizer=c=>capture(c,board,true);
    p.spawn({...p.data.OBJECTS.cardboard_box,contactImpactSpeed:2.4},0,90);
  });await stable();await page.evaluate(()=>p.spawn(p.plank(),0,225));await stable();
  await page.evaluate(()=>p.spawn(p.data.OBJECTS.basketball,0,235));await stable();
  await page.evaluate(()=>p.spawn({...p.data.OBJECTS.cardboard_box,contactImpactSpeed:2.4},0,325));await stable();
  const targets=await page.evaluate(()=>p.targets);assert.equal(targets.length,3);assert.deepEqual(targets.map(t=>[t.type,t.side]),[['plank',-1],['basketball',-1],['basketball',1]]);
  assert.ok(targets.every(t=>t.error<.00001&&t.bodyMoved===0));assert.ok(targets.some(t=>t.correction>.1));
  assert.ok(targets.every(t=>t.correction>=0&&t.correction<=Math.max(0,-Math.min(...t.separations))));return {targets,state:await read()};
}
async function topCushionNoUpperBond() {
  await oneSupport();await page.evaluate(()=>p.spawn({...p.data.OBJECTS.cardboard_box,contactImpactSpeed:2.4},0,265));
  await page.waitForFunction(()=>p.cushionSamples.some(c=>c.id===3),null,{timeout:6000});await frames(35);const s=await read();
  const samples=s.cushions.filter(c=>c.id===3);assert.equal(samples.length,1);assert.equal(samples[0].limit,1.8);
  assert.ok(samples.every(c=>Math.abs(c.tangentDelta)<1e-6&&Math.abs(c.omegaDelta)<1e-6));
  assert.equal(s.stabilizers.active.length,1);assert.equal(s.stabilizers.active[0].supportId,1);assert.equal(s.stabilizers.active[0].plankId,2);return s;
}
async function contactDampingRestoresInAir() {
  await fresh();const airborne=await page.evaluate(()=>{const b=p.spawn(p.data.OBJECTS.cardboard_box,0,120);return{value:b.body.angularDamping,configured:b.spec.contactAngularDamping};});
  assert.equal(airborne.configured,6);assert.equal(airborne.value,1.5);await stable();
  const supported=await page.evaluate(()=>({value:p.world.bodies[0].body.angularDamping,contacts:p.world.bodies[0].contacts.size}));
  assert.equal(supported.value,6);assert.ok(supported.contacts>0);
  await page.evaluate(()=>{p.world.platform.enabled=false;});await frames(3);
  const detached=await page.evaluate(()=>({value:p.world.bodies[0].body.angularDamping,contacts:p.world.bodies[0].contacts.size}));
  assert.equal(detached.value,1.5);assert.equal(detached.contacts,0);return{airborne,supported,detached};
}
(async()=>{try{
  fs.mkdirSync(OUT,{recursive:true});browser=await chromium.launch({headless:true});page=await browser.newPage({viewport:{width:375,height:667}});
  page.on('pageerror',e=>report.errors.push(String(e)));await page.goto('http://127.0.0.1:8767/preparation/review/play-player.html?revision=difficulty-r1');
  await page.waitForFunction(()=>!!window.qaLoad,null,{timeout:45000});
  const cases={static_ground_never_bonds:staticGround,horizontal_180_degree_board_bonds:upsideDown,three_contacts_two_bonds_and_unfixed_group_falls:bridgeLimitAndFreeFall,
    vertical_board_does_not_bond:vertical,side_graze_preserves_first_landing_cushion:sideThenLanding,overload_breaks_without_same_pair_reattachment:tearNoReconnect,
    continuous_native_angle_does_not_cause_full_turn_correction:halfTurnBoundary,basketball_native_181_degree_support_preserves_contact_pose:basketballHalfTurnBoundary,joint_target_resolves_real_contact_overlap_without_body_movement:targetInitialization,board_top_cushions_without_upper_bond:topCushionNoUpperBond,
    ordinary_contact_damping_restores_original_in_air:contactDampingRestoresInAir};
  for(const [name,fn]of Object.entries(cases))if(!process.env.STABILIZER_CASE||name.includes(process.env.STABILIZER_CASE))await check(name,fn);
  report.status=report.errors.length||report.checks.some(c=>c.status==='failed')?'failed':'passed';if(report.status==='failed')process.exitCode=1;
}catch(e){report.status='failed';report.failure=String(e.stack||e);process.exitCode=1;}finally{
  fs.writeFileSync(path.join(OUT,REPORT_FILE),JSON.stringify(report,null,2)+'\n');process.stdout.write(JSON.stringify({status:report.status,checks:report.checks.length,errors:report.errors,failure:report.failure})+'\n');await browser?.close();}})();
