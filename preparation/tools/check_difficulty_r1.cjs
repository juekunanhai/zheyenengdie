/** Bounded real-controller difficulty diagnostics. No replacement stability/contact/score logic. */
const { chromium } = require('/Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '../..'), OUT = path.join(ROOT, 'preparation/review/evidence/difficulty-r1');
const profile = process.argv[2] || 'baseline';
const PLAYER_URL = process.env.DIFFICULTY_URL || (profile === 'baseline' ?
  'http://127.0.0.1:8767/preparation/review/difficulty-before-player.html' : 'http://127.0.0.1:8767/preparation/review/play-player.html');
const SPEC_OVERRIDE = process.env.DIFFICULTY_SPEC_FILE;
const CASE_FILTER = process.env.DIFFICULTY_CASE ? process.env.DIFFICULTY_CASE.split(',') : null;
const AUTO_MODE = process.env.DIFFICULTY_MODE === 'timed';
const SUPPORT_CENTER_MODE = process.env.DIFFICULTY_MODE === 'support-centered';
const BOARD_MODE = process.env.DIFFICULTY_MODE === 'board';
const BASE = ['cardboard_box','wood_plank','toilet','fridge','dumbbell','basketball'];
const scenarios = AUTO_MODE ? [{id:'timed_auto4',xs:[0,0,0,0],auto:true}] : SUPPORT_CENTER_MODE ? [
  {id:'support_centered10',xs:Array(10).fill(0),supportCentered:true},
  {id:'support_centered_alternating10',xs:Array.from({length:10},(_,i)=>i%2?10:-10),supportCentered:true},
] : BOARD_MODE ? [
  ...[260,225].flatMap(width=>[false,true].map(connection=>({id:`dual_edge_${width}_${connection?'on':'off'}`,width,connection,
    supports:[{x:-52},{x:52}],xs:[0,110,110],sequence:['wood_plank','fridge','cardboard_box','wood_plank']}))),
  ...[{id:'single_bias',x:55},{id:'single_severe',x:125}].flatMap(load=>[false,true].map(connection=>({id:`${load.id}_260_${connection?'on':'off'}`,
    width:260,connection,supports:[{x:0}],xs:[0,load.x,load.x],sequence:['wood_plank','fridge','cardboard_box','wood_plank']}))),
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
  driver:AUTO_MODE ? 'Cocos ordinary automatic frames, native Box2D and actual 4-second auto release; no direct release call, timer override, altered contacts, stability, scores or damping.' : 'Cocos 3.8.8 ordinary automatic frames and native Box2D; controller moveTo/release after 0.18 active seconds in each planning phase. No altered contacts, isStable, scoring, damping, poses or native stepping.',
  timing:'Current 1.5-second first-contact handoff remains live. Releases continue even with pending unplaced bodies. After last scheduled release wait at least 3 active seconds, and until true strict stability + all released bodies placed, up to 10 seconds.',
  scope:'Eight fixed ten-object actions, same cyclic six-object sequence. This diagnoses bounded control policies, not a human success rate. Ended means the existing calibration whole-body loss rule fired.',
  override:SPEC_OVERRIDE ? 'Counterfactual exported ObjectSpec override in the loaded engine. This is not evidence of an old engine build.' : 'Actual compiled current build; no spec override.',
  timedMode:AUTO_MODE ? 'Four actual 4-second automatic releases. No countdown or release monkeypatch. End after at least 3 seconds of final-load observation and confirmed strict stability; if a fifth auto-release comes before settling, report incomplete instead of muting its timer.' : false},
  scenarios:scenarios.map(s=>({...s,sequence:s.sequence||Array.from({length:s.xs.length},(_,i)=>BASE[i%BASE.length])})),results:[],errors:[],sources:{}};
for(const file of ['assets/batch1/object-data.ts','assets/batch1/tower-world.ts','assets/batch1/game-controller.ts','assets/batch1/play-view.ts','preparation/review/play-player.html'])
  report.sources[file] = crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,file))).digest('hex');
const buildDir=PLAYER_URL.includes('difficulty-before-player')?path.join(OUT,'before/web-desktop'):path.join(ROOT,'build/web-desktop');
const packageFiles={};
function hashTree(directory){for(const entry of fs.readdirSync(directory,{withFileTypes:true})){const file=path.join(directory,entry.name);
  if(entry.isDirectory())hashTree(file);else if(entry.isFile())packageFiles[path.relative(buildDir,file)]=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}}
hashTree(buildDir);
report.builtPackage={directory:buildDir,fileCount:Object.keys(packageFiles).length,
  sha256:crypto.createHash('sha256').update(Object.keys(packageFiles).sort().map(name=>`${name}:${packageFiles[name]}`).join('\n')).digest('hex'),files:packageFiles};
const save=()=>fs.writeFileSync(path.join(OUT,profile+'.json'),JSON.stringify(report,null,2)+'\n');
let browser,page;
async function run(scenario) {
  await page.evaluate(()=>window.difficultyProbe?.dispose());
  await page.evaluate(()=>localStorage.setItem('zhynd.local-settings.v1',JSON.stringify({tutorialDone:true,music:false,sound:false,vibration:false})));
  await page.evaluate(()=>qaLoad('HUD'));
  await page.waitForFunction(()=>qaGame()?.snapshot().phase==='planning');
  let setup=null;
  if(scenario.supports){
    setup=await page.evaluate(async scenario=>{
      const cc=qaCC,g=qaGame(),d=await System.import('chunks:///_virtual/object-data.ts');
      window.difficultyFixtureSpecs??=JSON.parse(JSON.stringify(d.OBJECTS));
      for(const [kind,spec] of Object.entries(window.difficultyFixtureSpecs))d.OBJECTS[kind]=JSON.parse(JSON.stringify(spec));
      const plank=d.OBJECTS.wood_plank,ratio=scenario.width/plank.width;
      plank.width*=ratio;plank.spriteWidth*=ratio;plank.outline=plank.outline.map(([x,y])=>[x*ratio,y]);plank.density/=ratio;
      if(!plank.stabilizer)throw Error('Both fixture arms require the same explicit stabilizer/cushion spec');
      g.enabled=false;g.phase='ended';g.world.root.active=false;g.world.dispose();g.current=null;
      // Let normal Director deferred destruction flush; automatic physics remains the engine's responsibility.
      await new Promise(resolve=>requestAnimationFrame(resolve));
      const {TowerWorld}=await System.import('chunks:///_virtual/tower-world.ts');g.world=new TowerWorld(g.node.scene);
      // Explicit QA mechanism ablation: retain the complete board material spec and
      // its upper-surface cushioning; turn off only joint-contact eligibility.
      if(!scenario.connection)g.world.validStabilizerContact=()=>false;
      for(const support of scenario.supports){const spec=d.OBJECTS.cardboard_box,r=g.world.create(spec,support.x,-d.localBounds(spec,0).bottom+.5);g.world.release(r);}
      let active=0,stable=0;
      await new Promise((resolve,reject)=>{
        const after=()=>{const dt=cc.director.getDeltaTime();active+=dt;stable=g.world.isStable()?stable+dt:0;
          if(stable>=.65||active>=5){cc.director.off(cc.Director.EVENT_AFTER_PHYSICS,after);
            if(stable>=.65)resolve();else reject(Error('Initial dynamic supports failed real settling'));}};
        cc.director.on(cc.Director.EVENT_AFTER_PHYSICS,after);
      });
      const initial=g.world.bodies.map(r=>({id:r.id,kind:r.spec.kind,x:r.node.position.x,y:r.node.position.y,mass:r.body.getMass(),contacts:r.contacts.size}));
      g.sequence=scenario.sequence;g.untimedCalibration=true;g.spawn();
      for(const r of g.world.bodies.filter(r=>r.collider.enabled))r.lossBoundary={left:g.boundary.left,right:g.boundary.right,bottom:g.boundary.bottom};
      g.enabled=true;
      return {method:'Dynamic paper supports placed as explicit fixture initial conditions, then native automatic physics settles continuously for 0.65s. No fixed supports and no replaced isStable/placed values. New three payloads use the ordinary controller release path.',
        mechanismToggle:scenario.connection?'Actual connection eligibility unchanged':'QA instance validStabilizerContact returns false; complete stabilizer spec and its 1.8m/s upper-surface cushioning remain identical',
        active,stable,initial,plankSpec:plank};
    },scenario);
    await page.waitForFunction(()=>qaGame()?.snapshot().phase==='planning');
  }else if(!await page.evaluate(({seq,untimed})=>qaGame().configureCalibration(seq,untimed),{seq:scenario.sequence||BASE,untimed:!scenario.auto}))throw Error('Calibration configuration refused');
  await page.evaluate(scenario=>{
    const cc=qaCC,g=qaGame(),p=window.difficultyProbe={time:0,frames:0,g,actions:[],events:[],samples:[],firstContacts:{},masses:{},done:false,
      initialStable:g.world.isStable,last:g.snapshot(),lastSignature:'',lastSample:-1,lastReleaseTime:null,planningSince:null,settledSince:null,
      maxAbsAngle:{},maxSpeed:{},maxAngularSpeed:{},maxDrift:{},initialPositions:{},firstHazard:null,autoPlanningSeconds:0,beforeAuto:null,autoGap:null};
    for(const b of g.world.bodies.filter(b=>b.collider.enabled))p.initialPositions[b.id]={x:b.node.position.x,y:b.node.position.y};
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
      const signature=[s.phase,s.currentId,s.placed,s.placementBlocked].join(':');
      if(signature!==p.lastSignature){p.events.push({time:p.time,state:s});p.lastSignature=signature;}
      if(p.time-p.lastSample>=.15){p.samples.push({time:p.time,state:s});p.lastSample=p.time;}
      for(const b of s.bodies.filter(b=>b.type===cc.ERigidBody2DType.Dynamic)){
        p.masses[b.kind]=b.mass;p.maxAbsAngle[b.id]=Math.max(p.maxAbsAngle[b.id]||0,Math.abs(b.angle));
        p.maxSpeed[b.id]=Math.max(p.maxSpeed[b.id]||0,Math.hypot(b.velocity.x,b.velocity.y));
        p.maxAngularSpeed[b.id]=Math.max(p.maxAngularSpeed[b.id]||0,Math.abs(b.angularVelocity));
        if(p.initialPositions[b.id])p.maxDrift[b.id]=Math.max(p.maxDrift[b.id]||0,Math.hypot(b.position.x-p.initialPositions[b.id].x,b.position.y-p.initialPositions[b.id].y));
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
        if(g.world.isStable()&&s.placed===p.actions.length+(scenario.supports?.length||0)){if(p.settledSince===null)p.settledSince=p.time;}else p.settledSince=null;
        if(elapsed>=3&&p.settledSince!==null&&p.time-p.settledSince>=.65){p.done=true;p.outcome='survived_and_confirmed';}
        else if(elapsed>=10){p.done=true;p.outcome='final_settlement_timeout';}
      }
      if(p.time>=50){p.done=true;p.outcome='trajectory_timeout';}
    };
    const afterPhysics=()=>{
      if(!cc.isValid(g,true)||p.done)return;
      for(const b of g.world.bodies)if(b.collider.enabled&&b.contacts.size&&p.firstContacts[b.id]===undefined)
        p.firstContacts[b.id]={time:p.time,state:snap()};
    };
    cc.director.on(cc.Director.EVENT_AFTER_UPDATE,afterUpdate);cc.director.on(cc.Director.EVENT_AFTER_PHYSICS,afterPhysics);
    p.read=()=>({time:p.time,frames:p.frames,done:p.done,outcome:p.outcome,actions:p.actions,events:p.events,samples:p.samples,firstContacts:p.firstContacts,
      masses:p.masses,maxAbsAngle:p.maxAbsAngle,maxSpeed:p.maxSpeed,maxAngularSpeed:p.maxAngularSpeed,maxSupportDrift:p.maxDrift,initialPositions:p.initialPositions,firstHazard:p.firstHazard,
      stableMethodUnchanged:cc.isValid(g,true)?p.initialStable===g.world.isStable:true,final:p.last,scene:cc.director.getScene()?.name,
      released:p.actions.length,entered:Math.max(0,...p.events.map(e=>(e.state.currentId||1)-1-(scenario.supports?.length||0))),placed:p.last.placed,
      survivingReleased:p.outcome==='survived_and_confirmed'?p.actions.length:null,
      finalTowerTop:Math.max(0,...p.last.bodies.filter(b=>b.type===cc.ERigidBody2DType.Dynamic).map(b=>b.bounds.top)),
      releasedBodiesTouchingGround:p.last.contactPairs.filter(b=>b.others.includes(0)).map(b=>b.id),
      finalMaxAbsAngle:Math.max(0,...p.last.bodies.filter(b=>b.type===cc.ERigidBody2DType.Dynamic).map(b=>Math.abs(b.angle)))});
    p.dispose=()=>{cc.director.off(cc.Director.EVENT_AFTER_UPDATE,afterUpdate);cc.director.off(cc.Director.EVENT_AFTER_PHYSICS,afterPhysics);
      if(cc.isValid(g,true)&&g.lifecycle.paused)g.lifecycle.togglePause();};
  },scenario);
  await page.waitForFunction(()=>difficultyProbe.done,null,{timeout:65000});
  const result=await page.evaluate(()=>difficultyProbe.read());
  if(result.outcome!=='ended')await page.evaluate(()=>{const g=qaGame();if(g&&!g.lifecycle.paused)g.lifecycle.togglePause();});
  const capture=profile+'-'+scenario.id+'.png';await page.screenshot({path:path.join(OUT,capture)});
  return {id:scenario.id,setup,...result,capture};
}
(async()=>{try{
  fs.mkdirSync(OUT,{recursive:true});browser=await chromium.launch({headless:true,args:['--disable-background-timer-throttling','--disable-renderer-backgrounding']});
  page=await browser.newPage({viewport:{width:375,height:667},hasTouch:true});page.on('pageerror',e=>report.errors.push(String(e)));
  report.url=PLAYER_URL;await page.goto(PLAYER_URL+'?difficulty='+profile);
  await page.waitForFunction(()=>!!window.qaLoad,null,{timeout:45000});
  report.engine=await page.evaluate(()=>qaSnapshot());
  if(SUPPORT_CENTER_MODE)report.method.supportCentered='Separate adaptive policy, never counted as same-action before/after evidence: target the previous released object local highest horizontal ledge midpoint transformed to world (circle uses center), plus fixed 0 or alternating +/-10 offset. No search, no changing body pose or physics.';
  if(BOARD_MODE)report.method.boardFixtures='Eight bounded local-mechanic fixtures, not human difficulty statistics. Real dynamic paper supports settle first; ordinary held board/fridge/paper release next. Both arms keep identical complete material specs including board upper-impact cap1.8; off only disables QA instance validStabilizerContact eligibility. Width225 x-only diagnostic keeps thickness and mass, not production art. Same controller algorithm determines later gaps from actual state; each gap is recorded, not forced constant.';
  report.compiledSpecs=await page.evaluate(async()=>JSON.parse(JSON.stringify((await System.import('chunks:///_virtual/object-data.ts')).OBJECTS)));
  if(SPEC_OVERRIDE){const specs=JSON.parse(fs.readFileSync(SPEC_OVERRIDE));await page.evaluate(async specs=>{const d=await System.import('chunks:///_virtual/object-data.ts');Object.assign(d.OBJECTS,specs)},specs);report.overrideSpecs=specs;}
  if(profile==='baseline')fs.writeFileSync(path.join(OUT,'before/OBJECTS.json'),JSON.stringify(report.compiledSpecs,null,2)+'\n');
  save();
  for(const scenario of scenarios){if(CASE_FILTER&&!CASE_FILTER.some(term=>scenario.id.includes(term)))continue;
    const r=await run(scenario);if(scenario.auto)r.timingCheck=r.actions.slice(0,4).every(a=>a.automatic&&a.planningSeconds>=3.8&&a.planningSeconds<=4.25);report.results.push(r);save();
    process.stdout.write(JSON.stringify({profile,id:r.id,outcome:r.outcome,released:r.released,entered:r.entered,placed:r.placed,time:r.time,peak:r.final.peakMetres,firstHazard:r.firstHazard?.time})+'\n');}
  report.status=report.errors.length?'completed_with_runtime_errors':'completed_diagnostic_not_human_playtest';
}catch(e){report.status='failed_or_incomplete';report.failure=String(e.stack||e);process.exitCode=1;}
finally{save();await browser?.close();process.stdout.write(JSON.stringify({status:report.status,errors:report.errors,failure:report.failure})+'\n');}})();
