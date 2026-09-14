/** Bounded motor-contact counterfactual. Same ordinary fixed-action driver as check_difficulty_r1.cjs; only an optional existing basketball joint correctionFactor differs. */
const { chromium } = require('/Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '../..'), OUT = path.join(ROOT, 'preparation/review/evidence/difficulty-r1');
const profile = process.argv[2] || 'motor-original';
const MOTOR_VELOCITY_ITERATIONS=Number(process.env.MOTOR_VELOCITY_ITERATIONS||0);
const MOTOR_ALL_CONTACT_TARGET=process.env.MOTOR_ALL_CONTACT_TARGET==='1';
const MOTOR_CONTACT_TARGET=process.env.MOTOR_CONTACT_TARGET==='1';
const MOTOR_DELAY_STEPS=Number(process.env.MOTOR_DELAY_STEPS||0);
const MOTOR_CORRECTION=process.env.MOTOR_CORRECTION===undefined?null:Number(process.env.MOTOR_CORRECTION);
const MOTOR_CONTACT_DAMPING=process.env.MOTOR_CONTACT_DAMPING===undefined?null:Number(process.env.MOTOR_CONTACT_DAMPING);
const PLAYER_URL = process.env.DIFFICULTY_URL || (profile === 'baseline' ?
  'http://127.0.0.1:8767/preparation/review/difficulty-before-player.html' : 'http://127.0.0.1:8767/preparation/review/play-player.html');
const SPEC_OVERRIDE = process.env.DIFFICULTY_SPEC_FILE;
const CASE_FILTER = process.env.DIFFICULTY_CASE ? process.env.DIFFICULTY_CASE.split(',') : null;
const AUTO_MODE = process.env.DIFFICULTY_MODE === 'timed';
const SUPPORT_CENTER_MODE = process.env.DIFFICULTY_MODE === 'support-centered';
const BASE = ['cardboard_box','wood_plank','toilet','fridge','dumbbell','basketball'];
const scenarios = AUTO_MODE ? [{id:'timed_auto4',xs:[0,0,0,0],auto:true}] : SUPPORT_CENTER_MODE ? [
  {id:'support_centered10',xs:Array(10).fill(0),supportCentered:true},
  {id:'support_centered_alternating10',xs:Array.from({length:10},(_,i)=>i%2?10:-10),supportCentered:true},
] : [
  {id:'center10', xs:Array(10).fill(0)},
  {id:'alternating10', xs:Array.from({length:10},(_,i)=>i%2 ? 10 : -10)},
  {id:'all_plus10', xs:Array(10).fill(10)},
  {id:'all_minus10', xs:Array(10).fill(-10)},
  {id:'fridge_plus15', xs:[0,0,0,15,0,0,0,0,0,15]},
  {id:'fridge_minus15', xs:[0,0,0,-15,0,0,0,0,0,-15]},
  {id:'paper_plus10', xs:[10,0,0,0,0,0,10,0,0,0]},
  {id:'paper_minus10', xs:[-10,0,0,0,0,0,-10,0,0,0]},
];
const report = {status:'running',createdAt:new Date().toISOString(),profile,method:{
  driver:AUTO_MODE ? 'Cocos ordinary automatic frames, native Box2D and actual 4-second auto release; no direct release call, timer override, altered contacts, stability, scores or damping.' : 'Cocos 3.8.8 ordinary automatic frames and native Box2D; controller moveTo/release after 0.18 active seconds in each planning phase. No altered contacts, isStable, scoring, poses or native stepping; deliberate physical counterfactuals are listed below.',
  timing:'Current 1.5-second first-contact handoff remains live. Releases continue even with pending unplaced bodies. After last scheduled release wait at least 3 active seconds, and until true strict stability + all released bodies placed, up to 10 seconds.',
  scope:'Eight fixed ten-object actions, same cyclic six-object sequence. This diagnoses bounded control policies, not a human success rate. Ended means the existing calibration whole-body loss rule fired.',
  override:SPEC_OVERRIDE||MOTOR_CONTACT_DAMPING!==null ? 'Counterfactual exported ObjectSpec override in the loaded engine; see overrideSpecs and motorCounterfactual. Not an unchanged compiled-build acceptance.' : 'Actual compiled current ObjectSpec data; any joint counterfactual is listed separately.',
  motorCounterfactual:{correctionFactor:MOTOR_CORRECTION,contactAngularDampingNonBasketball:MOTOR_CONTACT_DAMPING,contactTarget:MOTOR_CONTACT_TARGET,allContactTarget:MOTOR_ALL_CONTACT_TARGET,delaySteps:MOTOR_DELAY_STEPS,velocityIterations:MOTOR_VELOCITY_ITERATIONS||'unchanged',note:'Existing contactAngularDamping activates on any genuine BEGIN contact, including side contact, and returns to original free-flight damping after all contacts end. Joint overrides are applied once per attachment. Driver, body poses, actual contacts, strict stability and scores are unchanged.'},
  timedMode:AUTO_MODE ? 'Four actual 4-second automatic releases. No countdown or release monkeypatch. End after at least 3 seconds of final-load observation and confirmed strict stability; if a fifth auto-release comes before settling, report incomplete instead of muting its timer.' : false},
  scenarios:scenarios.map(s=>({...s,sequence:Array.from({length:s.xs.length},(_,i)=>BASE[i%BASE.length])})),results:[],errors:[],sources:{}};
for(const file of ['assets/batch1/object-data.ts','assets/batch1/tower-world.ts','assets/batch1/game-controller.ts','assets/batch1/play-view.ts','preparation/review/play-player.html'])
  report.sources[file] = crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,file))).digest('hex');
report.sourcesNote='Source hashes describe files at probe start, not a guarantee that they match compiled output; compiled bundle hashes below identify the tested engine.';
report.compiledBundles={};
for(const file of fs.readdirSync(path.join(ROOT,'build/web-desktop/assets/main')).filter(f=>f.endsWith('.js')))
  report.compiledBundles[file]=crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,'build/web-desktop/assets/main',file))).digest('hex');
const save=()=>fs.writeFileSync(path.join(OUT,profile+'.json'),JSON.stringify(report,null,2)+'\n');
let browser,page;
async function run(scenario) {
  await page.evaluate(()=>window.difficultyProbe?.dispose());
  await page.evaluate(()=>localStorage.setItem('zhynd.local-settings.v1',JSON.stringify({tutorialDone:true,music:false,sound:false,vibration:false})));
  await page.evaluate(()=>qaLoad('HUD'));
  await page.waitForFunction(()=>qaGame()?.snapshot().phase==='planning');
  if(!await page.evaluate(({seq,untimed})=>qaGame().configureCalibration(seq,untimed),{seq:BASE,untimed:!scenario.auto}))throw Error('Calibration configuration refused');
  await page.evaluate(({scenario,motorCorrection,motorDelaySteps,motorContactTarget,motorAllContactTarget})=>{
    const cc=qaCC,g=qaGame(),p=window.difficultyProbe={time:0,frames:0,g,actions:[],events:[],samples:[],firstContacts:{},masses:{},done:false,
      motorSamples:[],motorEvents:[],contactImpulses:[],delayed:[],watched:new Set(),initialStable:g.world.isStable,last:g.snapshot(),lastSignature:'',lastSample:-1,lastReleaseTime:null,planningSince:null,settledSince:null,
      maxAbsAngle:{},maxSpeed:{},maxAngularSpeed:{},firstHazard:null,autoPlanningSeconds:0,beforeAuto:null,autoGap:null};
    const originalAttach=g.world.attach.bind(g.world);
    g.world.attach=contact=>{const b=originalAttach(contact);
      if(motorContactTarget||motorAllContactTarget){const m=contact.contact.getWorldManifold(),direction=(contact.contact.colliderA===b.ball.collider?1:-1)*(b.side<0?-1:1);
        const normal=new cc.Vec2(m.normal.x*direction,m.normal.y*direction),penetration=Math.max(0,-Math.min(...m.separations)-.16),oldOffset=[b.offset.x,b.offset.y];
        const delta=b.base.getLocalVector(normal.clone().multiplyScalar(penetration),new cc.Vec2());b.offset=b.base.getLocalPoint(b.attached.getWorldPoint(new cc.Vec2(),new cc.Vec2()),new cc.Vec2()).add(delta);b.joint.linearOffset=b.offset;
        p.motorEvents.push({time:p.time,event:'contact_target_only',side:b.side,separations:m.separations.slice(),penetration,normal:[normal.x,normal.y],oldOffset,offset:[b.offset.x,b.offset.y]});
      }
      if(motorCorrection!==null)b.joint.correctionFactor=motorCorrection;if(motorDelaySteps){b.joint.enabled=false;p.delayed.push({bond:b,remaining:motorDelaySteps+1});}
      p.motorEvents.push({time:p.time,event:'attach',ball:b.ball.id,other:g.world.bodies.find(r=>r.collider===b.other)?.id??0,side:b.side,
        offset:[b.offset.x,b.offset.y],angularOffset:b.joint.angularOffset,correction:b.joint.correctionFactor,maxForce:b.joint.maxForce,maxTorque:b.joint.maxTorque});return b;};
    const originalBoardAttach=g.world.attachStabilizer.bind(g.world);
    g.world.attachStabilizer=contact=>{const b=originalBoardAttach(contact);
      if(motorAllContactTarget){const m=contact.contact.getWorldManifold(),direction=contact.contact.colliderA===b.support.collider?1:-1;
        const normal=new cc.Vec2(m.normal.x*direction,m.normal.y*direction),penetration=Math.max(0,-Math.min(...m.separations)-.16),oldOffset=[b.offset.x,b.offset.y];
        const delta=b.support.body.getLocalVector(normal.clone().multiplyScalar(penetration),new cc.Vec2());b.offset=b.support.body.getLocalPoint(b.plank.body.getWorldPoint(new cc.Vec2(),new cc.Vec2()),new cc.Vec2()).add(delta);b.joint.linearOffset=b.offset;
        p.motorEvents.push({time:p.time,event:'board_contact_target_only',plank:b.plank.id,support:b.support.id,separations:m.separations.slice(),penetration,oldOffset,offset:[b.offset.x,b.offset.y]});
        if(motorCorrection!==null)b.joint.correctionFactor=motorCorrection;
      }return b;};
    const snap=()=>{const s=g.snapshot();s.contactPairs=g.world.bodies.filter(b=>b.collider.enabled).map(b=>({id:b.id,others:[...b.contacts].map(c=>g.world.bodies.find(r=>r.collider===c)?.id??0)}));
      if(typeof g.world.stabilizerSnapshot==='function')s.stabilizers=g.world.stabilizerSnapshot();return s;};
    const afterUpdate=()=>{
      if(p.done)return;
      p.time+=cc.director.getDeltaTime();p.frames++;
      if(!cc.isValid(g,true)){p.done=true;p.outcome='ended';return;}
      const s=snap();
      if(scenario.auto&&s.releases>p.actions.length){
        p.actions.push({time:p.time,x:0,angle:0,kind:s.bodies[s.releases-1].kind,before:p.beforeAuto||p.last,
          actualGap:p.autoGap,automatic:true,planningSeconds:p.autoPlanningSeconds});
        p.lastReleaseTime=p.time;p.planningSince=null;p.autoPlanningSeconds=0;p.beforeAuto=null;
        if(p.actions.length>scenario.xs.length){p.last=s;p.done=true;p.outcome='timed_next_release_before_settlement';return;}
      }
      p.last=s;
      for(const b of g.world.bodies)if(b.id>=5&&!p.watched.has(b.id)){p.watched.add(b.id);b.collider.on(cc.Contact2DType.POST_SOLVE,(self,other,c)=>{
        if(p.time<9||p.time>19||p.contactImpulses.length>=12000)return;const m=c.getWorldManifold(),j=c.getImpulse();if(!j)return;
        const otherId=g.world.bodies.find(r=>r.collider===other)?.id??0;if(otherId>b.id)return;
        p.contactImpulses.push({time:p.time,id:b.id,other:otherId,normal:[m.normal.x,m.normal.y],normalImpulse:j.normalImpulses.map(x=>x/32),tangentImpulse:j.tangentImpulses.slice(),points:m.points.map(v=>[v.x,v.y]),separations:m.separations.slice()});
      });}
      const signature=[s.phase,s.currentId,s.placed,s.placementBlocked].join(':');
      if(signature!==p.lastSignature){p.events.push({time:p.time,state:s});p.lastSignature=signature;}
      if(p.time-p.lastSample>=.15){p.samples.push({time:p.time,state:s});p.lastSample=p.time;}
      for(const b of s.bodies.filter(b=>b.type===cc.ERigidBody2DType.Dynamic)){
        p.masses[b.kind]=b.mass;p.maxAbsAngle[b.id]=Math.max(p.maxAbsAngle[b.id]||0,Math.abs(b.angle));
        p.maxSpeed[b.id]=Math.max(p.maxSpeed[b.id]||0,Math.hypot(b.velocity.x,b.velocity.y));
        p.maxAngularSpeed[b.id]=Math.max(p.maxAngularSpeed[b.id]||0,Math.abs(b.angularVelocity));
      }
      if(s.placementBlocked&&!p.firstHazard)p.firstHazard={time:p.time,state:s};
      if(s.phase==='ended'){p.done=true;p.outcome='ended';return;}
      if(s.phase==='planning'&&!s.placementBlocked){
        if(p.planningSince===null)p.planningSince=p.time;
        if(scenario.auto){
          p.autoPlanningSeconds+=cc.director.getDeltaTime();p.beforeAuto=s;
          const enabled=g.world.bodies.filter(b=>b.collider.enabled),top=Math.max(0,...enabled.map(b=>g.world.bounds(b).top));
          p.autoGap=g.world.bounds(g.current).bottom-top;
        }else if(p.actions.length<scenario.xs.length&&p.time-p.planningSince>=.18){
          const requestedOffset=scenario.xs[p.actions.length];let supportCenter=0;
          if(scenario.supportCentered){
            const previous=g.world.bodies.filter(b=>b.collider.enabled).at(-1);
            if(previous){supportCenter=previous.node.position.x;
              if(previous.spec.outline){const top=Math.max(...previous.spec.outline.map(v=>v[1]));
                const high=previous.spec.outline.filter(v=>Math.abs(v[1]-top)<.001),middle=(Math.min(...high.map(v=>v[0]))+Math.max(...high.map(v=>v[0])))/2;
                const q=previous.node.rotation,angle=Math.atan2(2*(q.w*q.z+q.x*q.y),1-2*(q.y*q.y+q.z*q.z));
                supportCenter+=middle*Math.cos(angle)-top*Math.sin(angle);}
            }
          }
          const x=supportCenter+requestedOffset;g.moveTo(x);const before=snap();
          const enabled=g.world.bodies.filter(b=>b.collider.enabled),top=Math.max(0,...enabled.map(b=>g.world.bounds(b).top));
          const actualGap=g.world.bounds(g.current).bottom-top;g.release();
          if(g.snapshot().releases>before.releases){p.actions.push({time:p.time,x,requestedOffset,supportCenter,angle:0,kind:before.bodies.at(-1).kind,before,actualGap});p.lastReleaseTime=p.time;p.planningSince=null;}
        }
      }else p.planningSince=null;
      if(p.actions.length===scenario.xs.length&&p.lastReleaseTime!==null){
        const elapsed=p.time-p.lastReleaseTime;
        if(g.world.isStable()&&s.placed===p.actions.length){if(p.settledSince===null)p.settledSince=p.time;}else p.settledSince=null;
        if(elapsed>=3&&p.settledSince!==null&&p.time-p.settledSince>=.65){p.done=true;p.outcome='survived_and_confirmed';}
        else if(elapsed>=10){p.done=true;p.outcome='final_settlement_timeout';}
      }
      if(p.time>=50){p.done=true;p.outcome='trajectory_timeout';}
    };
    const afterPhysics=()=>{
      if(!cc.isValid(g,true)||p.done)return;
      for(const delayed of p.delayed){if(--delayed.remaining!==0)continue;const b=delayed.bond;
        if(!Array.from(g.world.bonds.values()).includes(b)||!b.ball.contacts.has(b.other)){p.motorEvents.push({time:p.time,event:'delayed_aborted_no_contact'});continue;}
        const oldOffset=[b.offset.x,b.offset.y],offset=b.base.getLocalPoint(b.attached.getWorldPoint(new cc.Vec2(),new cc.Vec2()),new cc.Vec2());
        b.offset=offset;b.joint.linearOffset=offset;b.joint.angularOffset=(b.attached.impl.impl.GetAngle()-b.base.impl.impl.GetAngle())*180/Math.PI;
        b.joint.enabled=true;b.joint.apply();
        p.motorEvents.push({time:p.time,event:'activate_after_natural_contact_steps',steps:motorDelaySteps,side:b.side,oldOffset,offset:[offset.x,offset.y],angularOffset:b.joint.angularOffset});
      }
      if(p.time>=9&&p.time<=19&&p.motorSamples.length<5000){
        const joints=Array.from(g.world.bonds.values()).map(b=>{const n=b.joint.impl.impl,f=n?n.GetReactionForce(60):{x:0,y:0},actual=b.base.getLocalPoint(b.attached.getWorldPoint(new cc.Vec2(),new cc.Vec2()),new cc.Vec2());
          return{ball:b.ball.id,side:b.side,correction:b.joint.correctionFactor,force:[f.x,f.y],torque:n?n.GetReactionTorque(60):0,distance:cc.Vec2.distance(actual,b.offset),
            angleError:(b.attached.impl.impl.GetAngle()-b.base.impl.impl.GetAngle())*180/Math.PI-b.joint.angularOffset};});
        p.motorSamples.push({time:p.time,joints,stabilizers:g.world.stabilizerSnapshot(),poses:g.world.bodies.filter(b=>b.id>=5).map(b=>({id:b.id,x:b.node.position.x,y:b.node.position.y,angle:b.body.impl.impl.GetAngle()*180/Math.PI,vx:b.body.linearVelocity.x,vy:b.body.linearVelocity.y,omega:b.body.angularVelocity}))});
      }
      for(const b of g.world.bodies)if(b.collider.enabled&&b.contacts.size&&p.firstContacts[b.id]===undefined)
        p.firstContacts[b.id]={time:p.time,state:snap()};
    };
    cc.director.on(cc.Director.EVENT_AFTER_UPDATE,afterUpdate);cc.director.on(cc.Director.EVENT_AFTER_PHYSICS,afterPhysics);
    p.read=()=>({motorCorrection,motorDelaySteps,motorContactTarget,motorAllContactTarget,motorEvents:p.motorEvents,motorSamples:p.motorSamples,contactImpulses:p.contactImpulses,time:p.time,frames:p.frames,done:p.done,outcome:p.outcome,actions:p.actions,events:p.events,samples:p.samples,firstContacts:p.firstContacts,
      masses:p.masses,maxAbsAngle:p.maxAbsAngle,maxSpeed:p.maxSpeed,maxAngularSpeed:p.maxAngularSpeed,firstHazard:p.firstHazard,
      stableMethodUnchanged:cc.isValid(g,true)?p.initialStable===g.world.isStable:true,final:p.last,scene:cc.director.getScene()?.name,
      released:p.actions.length,entered:Math.max(0,...p.events.map(e=>(e.state.currentId||1)-1)),placed:p.last.placed,
      survivingReleased:p.outcome==='survived_and_confirmed'?p.actions.length:null,
      finalTowerTop:Math.max(0,...p.last.bodies.filter(b=>b.type===cc.ERigidBody2DType.Dynamic).map(b=>b.bounds.top)),
      releasedBodiesTouchingGround:p.last.contactPairs.filter(b=>b.others.includes(0)).map(b=>b.id),
      finalMaxAbsAngle:Math.max(0,...p.last.bodies.filter(b=>b.type===cc.ERigidBody2DType.Dynamic).map(b=>Math.abs(b.angle)))});
    p.dispose=()=>{cc.director.off(cc.Director.EVENT_AFTER_UPDATE,afterUpdate);cc.director.off(cc.Director.EVENT_AFTER_PHYSICS,afterPhysics);};
  },{scenario,motorCorrection:MOTOR_CORRECTION,motorDelaySteps:MOTOR_DELAY_STEPS,motorContactTarget:MOTOR_CONTACT_TARGET,motorAllContactTarget:MOTOR_ALL_CONTACT_TARGET});
  await page.waitForFunction(()=>difficultyProbe.done,null,{timeout:65000});
  const result=await page.evaluate(()=>difficultyProbe.read());
  if(result.outcome!=='ended')await page.evaluate(()=>{const g=qaGame();if(g&&!g.lifecycle.paused)g.lifecycle.togglePause();});
  const capture=profile+'-'+scenario.id+'.png';await page.screenshot({path:path.join(OUT,capture)});
  return {id:scenario.id,...result,capture};
}
(async()=>{try{
  fs.mkdirSync(OUT,{recursive:true});browser=await chromium.launch({headless:true,args:['--disable-background-timer-throttling','--disable-renderer-backgrounding']});
  page=await browser.newPage({viewport:{width:375,height:667},hasTouch:true});page.on('pageerror',e=>report.errors.push(String(e)));
  report.url=PLAYER_URL;await page.goto(PLAYER_URL+'?difficulty='+profile);
  await page.waitForFunction(()=>!!window.qaLoad,null,{timeout:45000});
  report.engine=await page.evaluate(()=>qaSnapshot());report.solver=await page.evaluate(value=>{const p=qaCC.PhysicsSystem2D.instance,before={velocity:p.velocityIterations,position:p.positionIterations};if(value)p.velocityIterations=value;return{before,after:{velocity:p.velocityIterations,position:p.positionIterations}}},MOTOR_VELOCITY_ITERATIONS);
  if(SUPPORT_CENTER_MODE)report.method.supportCentered='Separate adaptive policy, never counted as same-action before/after evidence: target the previous released object local highest horizontal ledge midpoint transformed to world (circle uses center), plus fixed 0 or alternating +/-10 offset. No search, no changing body pose or physics.';
  report.compiledSpecs=await page.evaluate(async()=>JSON.parse(JSON.stringify((await System.import('chunks:///_virtual/object-data.ts')).OBJECTS)));
  if(SPEC_OVERRIDE){const specs=JSON.parse(fs.readFileSync(SPEC_OVERRIDE));await page.evaluate(async specs=>{const d=await System.import('chunks:///_virtual/object-data.ts');Object.assign(d.OBJECTS,specs)},specs);report.overrideSpecs=specs;}
  if(MOTOR_CONTACT_DAMPING!==null)report.contactDampingOverrides=await page.evaluate(async value=>{const d=await System.import('chunks:///_virtual/object-data.ts'),changed={};for(const [key,spec]of Object.entries(d.OBJECTS))if(key!=='basketball'){d.OBJECTS[key]={...spec,contactAngularDamping:value};changed[key]=value;}return changed;},MOTOR_CONTACT_DAMPING);
  if(profile==='baseline')fs.writeFileSync(path.join(OUT,'before/OBJECTS.json'),JSON.stringify(report.compiledSpecs,null,2)+'\n');
  save();
  for(const scenario of scenarios){if(CASE_FILTER&&!CASE_FILTER.some(term=>scenario.id.includes(term)))continue;
    const r=await run(scenario);if(scenario.auto)r.timingCheck=r.actions.slice(0,4).every(a=>a.automatic&&a.planningSeconds>=3.8&&a.planningSeconds<=4.25);report.results.push(r);save();
    process.stdout.write(JSON.stringify({profile,id:r.id,outcome:r.outcome,released:r.released,entered:r.entered,placed:r.placed,time:r.time,peak:r.final.peakMetres,firstHazard:r.firstHazard?.time})+'\n');}
  report.status=report.errors.length?'completed_with_runtime_errors':'completed_diagnostic_not_human_playtest';
}catch(e){report.status='failed_or_incomplete';report.failure=String(e.stack||e);process.exitCode=1;}
finally{save();await browser?.close();process.stdout.write(JSON.stringify({status:report.status,errors:report.errors,failure:report.failure})+'\n');}})();
