/** Real exported outline comparison; preserves R1 and separates matched points, forgiveness, fixed regressions and search. */
const {chromium}=require('/Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'../..'),OUTDIR=path.join(ROOT,'preparation/review/evidence/gameplay-toilet-r2');
const GEOMETRY=process.argv[2]||'preparation/design/gameplay-toilet-r2/GEOMETRY.json',NAME=process.argv[3]||'FINAL_COMPARISON';
const geo=JSON.parse(fs.readFileSync(path.join(ROOT,GEOMETRY))).assets.find(x=>x.slug==='toilet');
const r1=JSON.parse(fs.readFileSync(path.join(OUTDIR,'PROBE.json'))).engine.specs.toilet;
const area=p=>Math.abs(p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-b[0]*a[1]},0))/2;
const targetMassArea=area(r1.outline)*r1.density,r2={...r1,width:geo.width,height:geo.height,spriteWidth:geo.spriteWidth,spriteHeight:geo.spriteHeight,spriteOffset:geo.spriteOffset,outline:geo.outline,density:Number((targetMassArea/area(geo.outline)).toFixed(12))};
const profiles=[{id:'r1',spec:r1,artPath:'preparation/design/gameplay-shapes/assets/object_toilet.png',nextPath:'preparation/design/gameplay-shapes/assets/next_toilet.png'},
{id:'r2',spec:r2,artPath:path.relative(ROOT,geo.sprite_path),nextPath:path.relative(ROOT,geo.next_path)}];
const oldXs=Array.from({length:10},(_,i)=>-40+i*5),centerXs=Array.from({length:7},(_,i)=>-15+i*5),offsets=centerXs;
const highCenter=s=>{const top=Math.max(...s.outline.map(p=>p[1]));const xs=s.outline.filter(p=>Math.abs(p[1]-top)<.001).map(p=>p[0]);return Math.round((Math.min(...xs)+Math.max(...xs))/10)*5};
const reps=[{id:'paper_old_position',supports:[{kind:'toilet',x:0}],sequence:['cardboard_box'],actions:[{x:-25,angle:0}]},
{id:'fridge_center',supports:[{kind:'toilet',x:0}],sequence:['fridge'],actions:[{x:0,angle:0}]},
{id:'fridge_plus10',supports:[{kind:'toilet',x:0}],sequence:['fridge'],actions:[{x:10,angle:0}]}];
const holdouts=JSON.parse(fs.readFileSync(path.join(OUTDIR,'PROBE.json'))).holdouts;
const report={status:'running',createdAt:new Date().toISOString(),geometry:geo,profiles,method:{
 rule:'Latest user priority: forgiving early placements; no requirement that lateral C policy beat center.',
 fixed:'Actual traced PNG outlines; height115, original friction/restitution and total mass fixed. Physical COM/inertia follow geometry. No hidden COM, stabilization, fixed tower, added glue or bounce adjustment.',
 matchedOldDiagnostic:{xs:oldXs,kinds:['cardboard_box','fridge'],countPerProfile:20},
 worldCenterTolerance:{xs:centerXs,coreXs:[-10,-5,0,5,10]},
 ledgeRelativeTolerance:{roundedHighCenters:profiles.map(p=>({profile:p.id,x:highCenter(p.spec)})),offsets,explanation:'Compare equal offsets from each visible high ledge midpoint, rounded to existing five-unit grid. This is separate from identical world-coordinate comparisons.'},
 physicalSuccess:'completed=true; toilet abs(angle)<12deg; payload bottom > toilet bottom+50. Falling beside toilet and stopping on base is rejected.',
 search:'Only the unchanged H01 two-item sequence is re-searched, both objects visible as current+NEXT, available C actions x0,+/-30 and 0/90/180/270. No extra x values are tuned for new shape. Fixed old chosen actions are reported separately.',
 caveat:'80 world-unit synthetic release clearance, continuous stability .65seconds and timeout8seconds as before. Normal six-piece claw placement is separate LIVE_R1/LIVE_R2 evidence. These are diagnostics, not human playtest success rates.'},
 scan:[],representatives:reps.map(s=>({id:s.id,scenario:s,actions:s.actions,results:{}})),holdouts:holdouts.map(s=>({id:s.id,scenario:s,actions:s.actions,results:{}})),search:[],summary:{},checks:[],sources:{},errors:[]};
for(const file of [GEOMETRY,...profiles.flatMap(p=>[p.artPath,p.nextPath]),'assets/batch1/object-data.ts','assets/batch1/tower-world.ts','preparation/review/gameplay-lab.js','preparation/tools/check_toilet_r2_final.cjs'])report.sources[file]=crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,file))).digest('hex');
let browser,page,trials=0,steps=0;const started=Date.now();const save=()=>{report.trials=trials;report.physicsSteps=steps;report.elapsedMs=Date.now()-started;fs.writeFileSync(path.join(OUTDIR,NAME+'.json'),JSON.stringify(report,null,2)+'\n')};
async function run(scenario,actions){if(++trials>800||Date.now()-started>480000)throw Error('Bounded comparison budget exceeded');const r=await page.evaluate(({scenario,actions})=>choiceLab.runTrial(scenario,actions),{scenario,actions});steps+=r.steps;return r;}
function feasible(r){const t=r.finalState.find(s=>s.kind==='toilet'),b=r.finalState.find(s=>s.kind!=='toilet');return !!(r.completed&&t&&b&&Math.abs(t.angle)<12&&b.bounds.bottom>t.bounds.bottom+50)}
function better(a,b){return !b||a.successfulDrops>b.successfulDrops||(a.successfulDrops===b.successfulDrops&&a.stableHeight>b.stableHeight+.1)}
(async()=>{try{browser=await chromium.launch({headless:true});page=await browser.newPage({viewport:{width:375,height:667}});page.on('pageerror',e=>report.errors.push(String(e)));await page.goto('http://127.0.0.1:8767/preparation/review/play-player.html');await page.waitForFunction(()=>!!window.qaLoad,null,{timeout:45000});await page.addScriptTag({url:'http://127.0.0.1:8767/preparation/review/gameplay-lab.js'});report.engine=await page.evaluate(()=>choiceLab.initialize());
for(const p of profiles){await page.evaluate(async spec=>{const d=await System.import('chunks:///_virtual/object-data.ts');d.OBJECTS.toilet=spec},p.spec);
const hc=highCenter(p.spec),xs=[...new Set([...oldXs,...centerXs,...offsets.map(o=>hc+o)])].sort((a,b)=>a-b);
for(const kind of ['cardboard_box','fridge'])for(const x of xs){const s={id:`${p.id}_${kind}_${x}`,supports:[{kind:'toilet',x:0}],sequence:[kind]};const result=await run(s,[{x,angle:0}]);report.scan.push({profile:p.id,kind,x,highLedgeOffset:x-hc,feasible:feasible(result),result});}
for(const entry of [...report.representatives,...report.holdouts]){const runs=[];for(let i=0;i<3;i++)runs.push(await run(entry.scenario,entry.actions));entry.results[p.id]=runs[0];entry.repetitions??={};entry.repetitions[p.id]=runs;}
report.summary[p.id]={};for(const kind of ['cardboard_box','fridge']){const rows=report.scan.filter(r=>r.profile===p.id&&r.kind===kind),group=vs=>({feasible:rows.filter(r=>vs.includes(r.x)&&r.feasible).length,total:vs.length,feasibleXs:rows.filter(r=>vs.includes(r.x)&&r.feasible).map(r=>r.x)});report.summary[p.id][kind]={matchedOld:group(oldXs),worldCenter15:group(centerXs),worldCenter10:group(centerXs.filter(x=>Math.abs(x)<=10)),ledgeRelative15:group(offsets.map(o=>hc+o))};}
save();process.stdout.write(p.id+' '+JSON.stringify(report.summary[p.id])+'\n');
const s=holdouts[0],actions=[0,-30,30].flatMap(x=>[0,90,180,270].map(angle=>({x,angle}))),forecasts=[];let best;
for(const a of actions)for(const b of actions){const r=await run(s,[a,b]);forecasts.push({actions:[a,b],successfulDrops:r.successfulDrops,completed:r.completed,stableHeight:r.stableHeight,end:r.outcomes.at(-1)?.status||r.setup.status});if(better(r,best))best=r;}
const selected=best.outcomes.map(o=>o.action),repetitions=[];for(let i=0;i<3;i++)repetitions.push(await run(s,selected));report.search.push({profile:p.id,scenario:s.id,actionSet:actions,forecasts,selectedActions:selected,result:best,repetitions});save();}
const masses=report.scan.map(r=>r.result.supportState.find(s=>s.kind==='toilet')?.mass).filter(Number.isFinite);const spread=(Math.max(...masses)-Math.min(...masses))/Math.max(...masses);report.checks.push({name:'native_total_mass_control',passed:spread<.00001,relativeSpread:spread});
report.checks.push({name:'representative_and_fixed_holdout_repeatability',passed:[...report.representatives,...report.holdouts].every(e=>profiles.every(p=>e.repetitions[p.id].every(r=>r.successfulDrops===e.results[p.id].successfulDrops)))});
report.checks.push({name:'search_selected_repeatability',passed:report.search.every(e=>e.repetitions.every(r=>r.successfulDrops===e.result.successfulDrops))});
report.status=report.errors.length?'completed_with_runtime_errors':'completed_outline_comparison_not_human_playtest';
}catch(e){report.status='failed_or_incomplete';report.failure=String(e.stack||e);process.exitCode=1;}finally{save();await browser?.close();process.stdout.write(JSON.stringify({status:report.status,trials,steps,checks:report.checks,errors:report.errors,failure:report.failure})+'\n')}})();
