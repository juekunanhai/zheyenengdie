/** Matched ordinary-controller smoke, not synthetic settlement probes. */
const { chromium }=require('/Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');const ROOT=path.resolve(__dirname,'../..'),OUT=path.join(ROOT,'preparation/review/evidence/gameplay-toilet-r2');
const profile=process.argv[2]||'r1',seq=['cardboard_box','wood_plank','toilet','fridge','dumbbell','basketball'];
const r1=JSON.parse(fs.readFileSync(path.join(OUT,'PROBE.json'))).engine.specs.toilet;
const scenarios=[{id:'normal_center',xs:[0,0,0,0,0,0]},{id:'normal_reasonable_high_shelf',xs:[0,0,0,-30,-30,-30]}];
if(profile==='r2')for(const x of [-15,-10,10,15])scenarios.push({id:'normal_fridge_offset_'+x,xs:[0,0,0,x,0,0],additionalR2ToleranceProbe:true});
const report={status:'running',createdAt:new Date().toISOString(),profile,method:{sequence:seq,scenarios,untimed:true,driver:'Ordinary Cocos automatic frame/physics and public controller moveTo/release. No 80-unit synthetic gap. Each release captures actual world clearance and snapshot.',limits:'Two fixed short action policies. Does not estimate human survival or difficulty. A placed count alone does not prove full tower integrity; per-body evidence is retained.'},results:[],errors:[]};let browser,page;
(async()=>{try{browser=await chromium.launch({headless:true});page=await browser.newPage({viewport:{width:375,height:667},hasTouch:true});page.on('pageerror',e=>report.errors.push(String(e)));await page.goto('http://127.0.0.1:8767/preparation/review/play-player.html');await page.waitForFunction(()=>!!window.qaLoad,null,{timeout:45000});
 report.loadedSpec=await page.evaluate(async()=>{const d=await System.import('chunks:///_virtual/object-data.ts');return d.OBJECTS.toilet});
 if(profile==='r2'){const expected=JSON.parse(fs.readFileSync(path.join(OUT,'FINAL_COMPARISON.json'))).profiles.find(p=>p.id==='r2').spec;const keys=['kind','width','height','circle','spriteWidth','spriteHeight','spriteOffset','outline','friction','restitution','density'];for(const key of keys)assert.deepEqual(report.loadedSpec[key],expected[key],key+' differs from FINAL');report.compiledSpecCheck={passed:true,fields:keys};}
 if(profile==='r1')await page.evaluate(async s=>{const d=await System.import('chunks:///_virtual/object-data.ts');d.OBJECTS.toilet=s},r1);
 await page.touchscreen.tap(180,120);
 for(const scenario of scenarios){await page.evaluate(()=>qaLoad('HUD'));await page.waitForFunction(()=>qaGame()?.snapshot().phase==='planning');if(!await page.evaluate(seq=>qaGame().configureCalibration(seq,true),seq))throw Error('Cannot configure sequence');
 const entry={id:scenario.id,actions:scenario.xs.map(x=>({x,angle:0})),attempts:[]};report.results.push(entry);
 for(let i=0;i<seq.length;i++){await page.waitForFunction(()=>qaGame()?.snapshot().phase==='planning',null,{timeout:18000});
 const before=await page.evaluate(x=>{const g=qaGame();g.moveTo(x);const state=g.snapshot();const r=g.world.bodies.find(r=>r.spec.kind==='toilet');if(r)state.toiletNative={mass:r.body.getMass(),density:r.collider.density,friction:r.collider.friction,restitution:r.collider.restitution,points:r.collider.points.map(p=>[p.x,p.y]),spec:r.spec};g.release();return state},scenario.xs[i]);
 await page.waitForFunction(n=>!qaGame()||qaGame().snapshot().placed>=n,i+1,{timeout:18000}).catch(()=>{});
 const after=await page.evaluate(()=>qaGame()?.snapshot()||qaSnapshot());entry.attempts.push({kind:seq[i],before,after});
 fs.writeFileSync(path.join(OUT,'LIVE_'+profile.toUpperCase()+'.json'),JSON.stringify(report,null,2)+'\n');
 if(!after.phase||after.placed<i+1)break;}
 entry.successfulDrops=Math.max(0,...entry.attempts.map(r=>r.after.placed||0));
 if(await page.evaluate(()=>!!qaGame()))await page.evaluate(()=>qaGame().lifecycle.togglePause());
 await page.screenshot({path:path.join(OUT,profile+'-'+scenario.id+'.png')});process.stdout.write(profile+' '+entry.id+' '+entry.successfulDrops+'/6\n');}
 report.status=report.errors.length?'completed_with_errors':'completed_live_diagnostic';
 }catch(e){report.status='failed_or_incomplete';report.failure=String(e.stack||e);process.exitCode=1;}finally{fs.writeFileSync(path.join(OUT,'LIVE_'+profile.toUpperCase()+'.json'),JSON.stringify(report,null,2)+'\n');await browser?.close();process.stdout.write(JSON.stringify({status:report.status,errors:report.errors,failure:report.failure})+'\n')}})();
