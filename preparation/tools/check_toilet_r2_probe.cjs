/** QA-only geometry probes; no runtime spec/art writes. */
const { chromium } = require('/Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'../..'),OUT=path.join(ROOT,'preparation/review/evidence/gameplay-toilet-r2/PROBE.json');
const area=p=>Math.abs(p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-b[0]*a[1]},0))/2;
function geometry(width,foot,high) { const l=-width/2,r=width/2,h=l+high;return [
[l+4,57.5],[l,53.5],[l,-2],[l+4,-9],[l+15,-17],[-width*.18,-29],[-width*.12,-39],
[-foot/2+6,-48],[-foot/2,-52],[-foot/2,-55],[-foot/2+3,-57.5],[foot/2-3,-57.5],[foot/2,-55],[foot/2,-51],
[foot/2-8,-45],[width*.18,-36],[width*.21,-28],[width*.35,-22],[r-4,-12],[r,0],[r,7],[r-4,11],
[h+3,11],[h,9],[h,53.5],[h-4,57.5]]; }
const variants=[{id:'r1',baseline:true},
{id:'W115_F90_H38',width:115,foot:90,high:38},
{id:'W125_F100_H44',width:125,foot:100,high:44},
{id:'W135_F108_H48',width:135,foot:108,high:48},
{id:'W125_F60_H44',width:125,foot:60,high:44},
{id:'W125_F100_H24',width:125,foot:100,high:24}];
const xs=Array.from({length:15},(_,i)=>-55+i*5);
const holdouts=[
{id:'H01_existing_dumbbell_bridge',supports:[{kind:'toilet',x:0}],sequence:['dumbbell','wood_plank'],actions:[{x:0,angle:180},{x:0,angle:270}]},
{id:'H02_toilet_lands_on_box_plank',supports:[],sequence:['cardboard_box','wood_plank','toilet'],actions:[{x:0,angle:0},{x:0,angle:0},{x:0,angle:0}]},
{id:'H03_lower_lid_ball',supports:[{kind:'toilet',x:0}],sequence:['basketball'],actions:[{x:35,angle:0}]},
{id:'H04_rotated_toilet_on_box',supports:[{kind:'cardboard_box',x:0}],sequence:['toilet'],actions:[{x:0,angle:90}]}
];
const report={status:'running',createdAt:new Date().toISOString(),method:{
 purpose:'Pre-art shape screening, not final contour acceptance. No original sprite is displayed with these diagnostic profiles.',
 fixed:'All variants retain original 115 height, friction .62, restitution .015 and original total mass. Natural geometric COM and inertia are allowed to change. No COM override, added damping, bonds, fixed tower or hidden stabilization.',
 scan:{payloads:['cardboard_box','fridge'],x:xs,angle:0,dropGap:80,stableSeconds:.65,settleSeconds:8},
 selection:'Prefer the smallest width/complexity producing at least 3 adjacent feasible x positions for BOTH upright paper and fridge. Feasible means continuously stable, toilet within 12deg of upright, and payload bottom > toilet bottom+50; falling beside it onto ground is not a success. Holdouts are diagnostic and not used to tune the chosen profile.',
 limitations:'Tests use artificial initial dynamic support and fixed 80-unit release gap, not normal claw camera height, incident rules or player fun. Candidate widths include selective controls so foot vs high surface are not conflated.'},
 variants,holdouts,scan:[],holdoutResults:[],summary:{},errors:[],sources:{}};
for(const f of ['assets/batch1/object-data.ts','assets/batch1/tower-world.ts','preparation/review/gameplay-lab.js','preparation/tools/check_toilet_r2_probe.cjs']) report.sources[f]=crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,f))).digest('hex');
let browser,page;const started=Date.now(); const save=()=>{report.elapsedMs=Date.now()-started;fs.writeFileSync(OUT,JSON.stringify(report,null,2)+'\n')};
async function run(scenario,actions){return page.evaluate(({scenario,actions})=>choiceLab.runTrial(scenario,actions),{scenario,actions})}
function supportSuccess(row){const t=row.finalState.find(r=>r.kind==='toilet'),load=row.finalState.find(r=>r.kind!=='toilet');return row.completed&&t&&load&&Math.abs(t.angle)<12&&load.bounds.bottom>t.bounds.bottom+50;}
(async()=>{try{
 browser=await chromium.launch({headless:true});page=await browser.newPage({viewport:{width:375,height:667}});page.on('pageerror',e=>report.errors.push(String(e)));
 await page.goto('http://127.0.0.1:8767/preparation/review/play-player.html');await page.waitForFunction(()=>!!window.qaLoad,null,{timeout:45000});
 await page.addScriptTag({url:'http://127.0.0.1:8767/preparation/review/gameplay-lab.js'});report.engine=await page.evaluate(()=>choiceLab.initialize());
 const original=report.engine.specs.toilet;report.originalMassArea=area(original.outline)*original.density;
 for(const v of variants){ const spec=JSON.parse(JSON.stringify(original));if(!v.baseline){spec.outline=geometry(v.width,v.foot,v.high);spec.width=v.width;spec.density=report.originalMassArea/area(spec.outline);}v.spec=spec;
 await page.evaluate(async spec=>{const data=await System.import('chunks:///_virtual/object-data.ts');data.OBJECTS.toilet=spec},spec);
 for(const kind of ['cardboard_box','fridge'])for(const x of xs){const scenario={id:`${v.id}_${kind}_${x}`,supports:[{kind:'toilet',x:0}],sequence:[kind]};const result=await run(scenario,[{x,angle:0}]);report.scan.push({variant:v.id,kind,x,feasible:supportSuccess(result),result});}
 report.summary[v.id]={};for(const kind of ['cardboard_box','fridge']){const rows=report.scan.filter(r=>r.variant===v.id&&r.kind===kind);report.summary[v.id][kind]={feasibleX:rows.filter(r=>r.feasible).map(r=>r.x),stable:rows.filter(r=>r.result.completed).length,total:rows.length};}
 save();process.stdout.write(v.id+' '+JSON.stringify(report.summary[v.id])+'\n');
 }
 // Fixed holdout actions, declared before any run. No candidate is tuned from these.
 for(const v of variants){await page.evaluate(async spec=>{const data=await System.import('chunks:///_virtual/object-data.ts');data.OBJECTS.toilet=spec},v.spec);
 for(const h of holdouts)report.holdoutResults.push({variant:v.id,scenario:h.id,result:await run(h,h.actions)});save();}
 const masses=report.scan.map(r=>r.result.supportState.find(s=>s.kind==='toilet')?.mass).filter(Number.isFinite);
 report.massRelativeSpread=(Math.max(...masses)-Math.min(...masses))/Math.max(...masses);
 report.status=report.errors.length?'runtime_errors':'completed_proxy_geometry_screen';
 }catch(e){report.status='failed_or_incomplete';report.failure=String(e.stack||e);process.exitCode=1;}finally{save();await browser?.close();process.stdout.write(JSON.stringify({status:report.status,summary:report.summary,massRelativeSpread:report.massRelativeSpread,failure:report.failure})+'\n')}})();
