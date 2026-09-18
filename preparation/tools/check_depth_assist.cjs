/** Dedicated depth-assistance diagnostics: real compiled Cocos / native Box2D.
 * Outputs stay in this revision. No historical report, source or setting is rewritten.
 * All directed fixture changes below are QA initial conditions, never shipping logic.
 */
'use strict';
const { chromium } = require('/Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), cp = require('node:child_process');
const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'preparation/review/evidence/depth-assist-r1');
const profile = process.argv[2] || 'before';
if (!/^[a-z0-9_-]+$/i.test(profile)) throw Error('Profile must be a simple filename');
const IS_BEFORE = profile.startsWith('before');
const BUILD = path.join(ROOT, IS_BEFORE ? 'temp/depth-assist-before/web-desktop' : 'build/web-desktop');
const URL = process.env.DEPTH_URL || `http://127.0.0.1:8767/${IS_BEFORE ? 'temp/depth-assist-before/player.html' : 'preparation/review/play-player.html'}`;
const FILTER = (process.env.DEPTH_CASE || '').split(',').filter(Boolean);
const ABLATION = process.env.DEPTH_ABLATION || null;
if (ABLATION && ABLATION !== 'angular-only') throw Error('Unknown explicit mechanism ablation');
function hashFile(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
function hashTree(directory) {
    const files = {};
    function visit(dir) { for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const file = path.join(dir, ent.name);
        if (ent.isDirectory()) visit(file); else if (ent.isFile()) files[path.relative(directory, file)] = hashFile(file);
    } }
    visit(directory); const sorted = Object.keys(files).sort();
    return { directory: path.relative(ROOT, directory), fileCount: sorted.length,
        sha256: crypto.createHash('sha256').update(sorted.map(n => `${n}:${files[n]}`).join('\n')).digest('hex'), files };
}
fs.mkdirSync(OUT, { recursive: true });
const report = {
    schema: 'depth-assist-real-engine-r1', profile, startedAt: new Date().toISOString(), status: 'running', url: URL,
    gitBaseline: cp.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(),
    builtPackage: hashTree(BUILD), testScriptSha256: hashFile(__filename),
    provenance: 'The package hashes identify the actual tested build. Current worktree source may be edited or ahead of this build and is not claimed identical. Before uses the frozen temp copy.',
    mechanismAblation: ABLATION ? { mode: ABLATION, method: 'Only while actual world.updateAssistance(dt) executes, each existing body applyLinearImpulse is temporarily suppressed and then restored in finally. Angular damping calculation remains original. Native collision/contact/glue impulses outside that call, controller scoring and timing remain live.' } : null,
    method: {
        controller: 'Compiled production controller with its default 14-entry sequence; only unlimited planning calibration and predefined moveTo/release actions. Native contacts, placement hazard, stability, scoring, incidents and camera remain live.',
        fixtures: 'Isolated compiled TowerWorld and actual material outlines. Some fixtures mark settled bodies as old/placed, tilt the real platform, inject one declared impulse or remove support. Reported separately from ordinary play and from success rates.',
        stepping: 'Ordinary Cocos autoSimulation. Requested frameRate 30/60/120 and observed frame timings are both reported. No substituted contact, stability or physics-step results.',
        limits: 'Bounded deterministic policies and controlled fixtures do not establish human surprise, overall win rate, all object combinations or WeChat real-device performance.',
    }, results: [], errors: [], checks: [],
};
if (!IS_BEFORE) {
    report.worktreeSourceHashes = {};
    for (const dir of ['assets/batch1', 'assets/batch0/presentation']) for (const file of fs.readdirSync(path.join(ROOT, dir)).filter(f => f.endsWith('.ts'))) {
        const rel = `${dir}/${file}`; report.worktreeSourceHashes[rel] = hashFile(path.join(ROOT, rel));
    }
    report.worktreeSourceHashNote = 'Captured at after-run start; the parent build record establishes correspondence between these source files and the tested built package.';
}
const save = () => fs.writeFileSync(path.join(OUT, `${profile}.json`), JSON.stringify(report, null, 2) + '\n');
let browser, page;
async function runCase(id, fn) {
    if (FILTER.length && !FILTER.some(f => id.includes(f))) return;
    const row = { id, status: 'running', startedAt: new Date().toISOString() };
    report.results.push(row); save(); process.stdout.write(`${profile} ${id}: running\n`);
    try { row.result = await fn(); row.status = 'completed'; }
    catch (error) { row.status = 'failed'; row.error = String(error.stack || error); }
    row.finishedAt = new Date().toISOString(); save();
    const r = row.result || {};
    process.stdout.write(JSON.stringify({ profile, id, status: row.status, outcome: r.outcome,
        releases: r.actions?.length, placed: r.final?.placed, stars: r.final?.stars,
        maxDrift: r.metrics?.maxHorizontalDrift, maxAngle: r.metrics?.maxAngleChange,
        observedFps: r.timing?.observedFps, error: row.error }) + '\n');
}
async function installHelpers() {
    await page.evaluate(ablation => {
        const cc = qaCC;
        const clone = v => JSON.parse(JSON.stringify(v));
        const wait = (predicate, limit = 12000, event = cc.Director.EVENT_AFTER_PHYSICS) => new Promise((resolve, reject) => {
            let seconds = 0, frames = 0;
            const off = () => { cc.director.off(event, tick); clearTimeout(timer); };
            const tick = () => { try {
                const dt = Math.max(0, cc.game.deltaTime); seconds += dt; frames++;
                const value = predicate({ seconds, frames, dt });
                if (value) { off(); resolve(value); }
            } catch (error) { off(); reject(error); } };
            const timer = setTimeout(() => { off(); reject(Error(`Real-engine wait exceeded ${limit}ms`)); }, limit);
            cc.director.on(event, tick);
        });
        const snapshotBody = (w, r) => ({ id: r.id, kind: r.spec.kind, placed: r.placed, supported: r.supported,
            lost: r.lost, contacts: r.contacts.size, contactSeconds: r.contactSeconds,
            dynamic: r.body.type === cc.ERigidBody2DType.Dynamic, awake: r.body.isAwake(), mass: r.body.getMass(),
            position: { x: r.node.position.x, y: r.node.position.y },
            angle: Math.atan2(2 * r.node.rotation.w * r.node.rotation.z, 1 - 2 * r.node.rotation.z ** 2) * 180 / Math.PI,
            velocity: clone(r.body.linearVelocity), omega: r.body.angularVelocity,
            assistDamping: r.assistDamping, angularDamping: r.body.angularDamping, bounds: w.nativeBounds(r) });
        const timing = times => ({ frames: times.length, seconds: times.reduce((a,b) => a+b, 0),
            observedFps: times.length / times.reduce((a,b) => a+b, 0), minDt: Math.min(...times), maxDt: Math.max(...times),
            framesAtLeastTwoFixedSteps: times.filter(t => t >= cc.PhysicsSystem2D.instance.fixedTimeStep * 1.8).length });
        window.depthHarness = { cc, clone, wait, snapshotBody, timing, clean: null };
        const installAblation = world => {
            if (!ablation) return;
            const update = world.updateAssistance;
            if (typeof update !== 'function') throw Error('Cannot apply declared ablation: production updateAssistance is absent');
            world.depthAblation = { mode: ablation, suppressedCalls: 0, absoluteHorizontalImpulse: 0 };
            world.updateAssistance = function (dt) {
                const originals = this.bodies.map(record => [record.body, record.body.applyLinearImpulse]);
                try {
                    for (const [body] of originals) body.applyLinearImpulse = impulse => {
                        this.depthAblation.suppressedCalls++;
                        this.depthAblation.absoluteHorizontalImpulse += Math.abs(impulse.x);
                    };
                    return update.call(this, dt);
                } finally { for (const [body, original] of originals) body.applyLinearImpulse = original; }
            };
        };
        depthHarness.fresh = async (fps = 60, isolated = true) => {
            depthHarness.clean?.(); depthHarness.clean = null;
            cc.PhysicsSystem2D.instance.enable = true; cc.PhysicsSystem2D.instance.autoSimulation = true;
            cc.game.frameRate = fps;
            cc.sys.localStorage.setItem('zhynd.local-settings.v1', JSON.stringify({ tutorialDone: true, music: false, sound: false, vibration: false }));
            await qaLoad('HUD'); const g = qaGame();
            await wait(() => g.snapshot().phase === 'planning' && g.display.cameraRecovered());
            if (!isolated) { installAblation(g.world); return { cc, g, world: g.world }; }
            g.enabled = false; g.world.dispose(); g.display.dispose(); g.audio.pause(true); g.current = null;
            await wait(({ frames }) => frames >= 2);
            const { TowerWorld } = await System.import('chunks:///_virtual/tower-world.ts');
            const data = await System.import('chunks:///_virtual/object-data.ts');
            const world = new TowerWorld(cc.director.getScene()); g.world = world;
            installAblation(world);
            const boundary = { left: -1200, right: 1200, bottom: -1000, top: 1400 };
            world.configureSafety(boundary, 0, false);
            const spawn = (spec, x, y, angle = 0) => {
                const r = world.create(spec, x, y); r.node.setRotationFromEuler(0, 0, angle); world.release(r); return r;
            };
            const settle = async (body, markPlaced = true) => {
                let stable = 0;
                await wait(({ dt }) => {
                    stable = body.supported && body.body.linearVelocity.length() < .12 && Math.abs(body.body.angularVelocity) < .12 ? stable + dt : 0;
                    return stable >= .65;
                }, 12000);
                if (markPlaced) body.placed = true;
            };
            const ctx = { cc, g, world, data, boundary, spawn, settle };
            depthHarness.ctx = ctx;
            return ctx;
        };
    }, ABLATION);
}
async function controllerTrial(id, offsets) {
    await page.evaluate(async ({ id, offsets }) => {
        const h = depthHarness, { cc, g, world } = await h.fresh(60, false);
        const sequence = g.snapshot().sequence;
        if (sequence.length !== 14) throw Error(`Expected approved default 14-entry sequence, got ${sequence.length}`);
        if (!g.configureCalibration(sequence, true)) throw Error('Actual calibration API refused default sequence');
        const p = { id, sequence, offsets, time: 0, actions: [], samples: [], events: [], times: [], done: false,
            last: h.clone(g.snapshot()), lastSample: -1, signature: '', planStart: null, lastRelease: null,
            maxDrift: {}, initial: {}, maxAngularSpeed: {}, strictMethod: world.isStable };
        const tick = () => {
            if (p.done) return;
            const dt = cc.game.deltaTime; p.time += dt; p.times.push(dt);
            if (!cc.isValid(g, true) || cc.director.getScene()?.name !== 'HUD') { p.done = true; p.outcome = 'scene_ended'; return; }
            const s = g.snapshot(); p.last = h.clone(s);
            const signature = [s.phase,s.releases,s.placed,s.stars,s.incidentCount].join(':');
            if (signature !== p.signature) { p.signature = signature; p.events.push({time:p.time,phase:s.phase,releases:s.releases,placed:s.placed,stars:s.stars,incidentCount:s.incidentCount}); }
            if (p.time - p.lastSample >= .2) { p.samples.push({time:p.time,state:p.last}); p.lastSample = p.time; }
            for (const b of s.bodies.filter(b => b.type === cc.ERigidBody2DType.Dynamic && !b.lost)) {
                if (b.supported && !p.initial[b.id]) p.initial[b.id] = {x:b.position.x,y:b.position.y};
                if (p.initial[b.id]) p.maxDrift[b.id] = Math.max(p.maxDrift[b.id] || 0, Math.abs(b.position.x - p.initial[b.id].x));
                p.maxAngularSpeed[b.id] = Math.max(p.maxAngularSpeed[b.id] || 0, Math.abs(b.angularVelocity));
            }
            if (s.phase === 'defeated' || s.phase === 'ended') { p.done=true;p.outcome='defeated';return; }
            if (s.phase === 'planning' && !s.placementBlocked && p.actions.length < offsets.length) {
                if (p.planStart === null) p.planStart = p.time;
                if (p.time - p.planStart >= .18) {
                    const x = offsets[p.actions.length]; g.moveTo(x);
                    const held = g.current, kind = held.spec.kind, gap = world.bounds(held).bottom - world.placementTop();
                    g.release();
                    if (g.snapshot().releases > s.releases) {
                        p.actions.push({index:p.actions.length,kind,x,time:p.time,actualReleaseGap:gap});p.lastRelease=p.time;p.planStart=null;
                    }
                }
            } else p.planStart = null;
            if (p.actions.length === offsets.length && p.time-p.lastRelease >= 4) {
                if (world.isStable() && !s.incident && s.placed === offsets.length) { p.done=true;p.outcome='all_released_and_confirmed'; }
                else if (world.isStable() && !s.incident && s.bodies.some(b => b.lost)) { p.done=true;p.outcome='settled_after_losses'; }
                else if (p.time-p.lastRelease >= 12) { p.done=true;p.outcome='final_settlement_timeout'; }
            }
            if (p.time >= 85) { p.done=true;p.outcome='trajectory_timeout'; }
        };
        cc.director.on(cc.Director.EVENT_AFTER_UPDATE,tick);
        h.clean=()=>cc.director.off(cc.Director.EVENT_AFTER_UPDATE,tick);
        p.read=()=>({id,sequence,actions:p.actions,events:p.events,samples:p.samples,time:p.time,outcome:p.outcome,
            final:p.last,initialSupportPositions:p.initial,maxHorizontalDrift:p.maxDrift,maxAngularSpeed:p.maxAngularSpeed,
            strictStabilityMethodUnchanged:world.isStable===p.strictMethod,mechanismAblation:world.depthAblation?h.clone(world.depthAblation):null,timing:h.timing(p.times)});
        window.depthControllerProbe=p;
    }, {id,offsets});
    await page.waitForFunction(()=>depthControllerProbe.done,null,{timeout:110000});
    const result=await page.evaluate(()=>{depthHarness.clean?.();return depthControllerProbe.read();});
    await page.screenshot({path:path.join(OUT,`${profile}-${id}.png`)});
    return result;
}
async function impactTrial(depth, fps = 60, kind = 'crooked') {
    return page.evaluate(async ({depth,fps,kind}) => {
        const h=depthHarness, c=await h.fresh(fps), {world:w,data:d,spawn,settle,boundary,cc}=c;
        if (kind==='crooked') w.platform.node.setRotationFromEuler(0,0,3);
        const base=spawn(d.OBJECTS.cardboard_box,0,64,kind==='crooked'?3:0);await settle(base);
        const cap=spawn(d.OBJECTS.cardboard_box,kind==='crooked'?9:0,w.nativeBounds(base).top+58,kind==='crooked'?3:0);await settle(cap);
        const referenceTop=w.nativeBounds(base).top+depth;
        w.configureSafety(boundary,referenceTop,true);
        await h.wait(({seconds})=>seconds>=1);
        const before=w.bodies.map(r=>h.snapshotBody(w,r));
        const load=spawn(d.OBJECTS.fridge,22,w.placementTop()+d.OBJECTS.fridge.height/2+80);
        const incomingInitial=h.snapshotBody(w,load),times=[],samples=[],metrics={maxHorizontalDrift:0,maxAngleChange:0,maxBaseSpeed:0,contacted:false,
            firstContactTime:null,firstStableWindowEnd:null,finalHorizontalDrift:null,finalAngleChange:null,tailRmsOmega:null,tailMaxOmega:0,tailMaxHorizontalSpeed:0,timeToFinalQuiet:null};
        let quietSince=null,tailOmegaSquaredTime=0,tailTime=0,lastElapsed=0;
        await h.wait(({seconds,dt})=>{
            times.push(dt);const states=w.bodies.map(r=>h.snapshotBody(w,r));
            for(const b of states.slice(0,2)){const initial=before.find(s=>s.id===b.id);
                metrics.maxHorizontalDrift=Math.max(metrics.maxHorizontalDrift,Math.abs(b.position.x-initial.position.x));
                metrics.maxAngleChange=Math.max(metrics.maxAngleChange,Math.abs(b.angle-initial.angle));
                metrics.maxBaseSpeed=Math.max(metrics.maxBaseSpeed,Math.abs(b.velocity.x));}
            metrics.contacted ||= load.contacts.size>0 || load.contactSeconds!==null;
            if(metrics.contacted&&metrics.firstContactTime===null)metrics.firstContactTime=seconds;
            const quiet=metrics.contacted&&states.every(b=>!b.lost&&b.supported&&Math.hypot(b.velocity.x,b.velocity.y)<.12&&Math.abs(b.omega)<.12);
            if(quiet){if(quietSince===null)quietSince=seconds;if(seconds-quietSince>=.65&&metrics.firstStableWindowEnd===null)metrics.firstStableWindowEnd=seconds;}
            else quietSince=null;
            if(seconds>=3){
                const old=states.slice(0,2);tailOmegaSquaredTime+=old.reduce((sum,b)=>sum+b.omega*b.omega,0)/old.length*dt;tailTime+=dt;
                metrics.tailMaxOmega=Math.max(metrics.tailMaxOmega,...old.map(b=>Math.abs(b.omega)));
                metrics.tailMaxHorizontalSpeed=Math.max(metrics.tailMaxHorizontalSpeed,...old.map(b=>Math.abs(b.velocity.x)));
            }
            lastElapsed=seconds;
            if(!samples.length||seconds-samples.at(-1).time>=.1)samples.push({time:seconds,bodies:states});
            return seconds>=4;
        },10000);
        const final=w.bodies.map(r=>h.snapshotBody(w,r));
        metrics.finalHorizontalDrift=Math.max(...final.slice(0,2).map((b,i)=>Math.abs(b.position.x-before[i].position.x)));
        metrics.finalAngleChange=Math.max(...final.slice(0,2).map((b,i)=>Math.abs(b.angle-before[i].angle)));
        metrics.tailRmsOmega=tailTime?Math.sqrt(tailOmegaSquaredTime/tailTime):null;
        metrics.timeToFinalQuiet=quietSince!==null&&lastElapsed-quietSince>=.65?quietSince-metrics.firstContactTime:null;
        return {fixture:'Two physically settled real paper boxes on the real platform tilted 3 degrees (level control when selected); upper box x=9, then real fridge at x=22 with 80-unit gap. Only referenceTop differs between depths. Finite geometry and mass retained.',
            depth,requestedFps:fps,referenceTop,before,incomingInitial,metrics,timing:h.timing(times),samples,
            final,safety:h.clone(w.safetySnapshot())};
    },{depth,fps,kind});
}
async function safeguards() {
    return page.evaluate(async()=>{
        const h=depthHarness, results={};
        {
            const c=await h.fresh(),{world:w,data:d,spawn,settle,boundary}=c;
            const b=spawn(d.OBJECTS.cardboard_box,0,64);await settle(b,false);
            const placedBefore=b.placed;w.configureSafety(boundary,w.nativeBounds(b).top+600,true);
            await h.wait(({seconds})=>seconds>=1);
            results.unplacedSupport={placedBefore,beforeImpulse:h.snapshotBody(w,b)};
            b.body.linearVelocity=new h.cc.Vec2(.35,0);b.body.angularVelocity=.2;b.body.wakeUp();
            await h.wait(({seconds})=>seconds>=.5);
            results.unplacedSupport.after=h.snapshotBody(w,b);
        }
        {
            const c=await h.fresh(),{world:w,data:d,spawn,settle,boundary}=c;
            const b=spawn(d.OBJECTS.cardboard_box,0,64);await settle(b);
            b.body.sleep();const before=h.snapshotBody(w,b);w.configureSafety(boundary,w.nativeBounds(b).top+600,true);
            const awakeSamples=[];await h.wait(({seconds})=>{awakeSamples.push(b.body.isAwake());return seconds>=1;});
            results.sleep={before,after:h.snapshotBody(w,b),anyAwake:awakeSamples.some(Boolean)};
            const fallBefore=h.snapshotBody(w,b);w.platform.enabled=false;
            await h.wait(({seconds})=>seconds>=.55);
            results.supportRemoval={before:fallBefore,after:h.snapshotBody(w,b)};
        }
        {
            const c=await h.fresh(),{world:w,data:d,spawn,settle}=c;
            const b=spawn(d.OBJECTS.cardboard_box,0,64);await settle(b);
            const referenceTop=w.nativeBounds(b).top+1000,views=[
                {left:-187.5,right:187.5,bottom:200,top:867},
                {left:-187.5,right:187.5,bottom:200,top:1012},
                {left:-300,right:300,bottom:200,top:1000}];
            const samples=[];
            for(const boundary of views){w.configureSafety(boundary,referenceTop,true);await h.wait(({seconds})=>seconds>=1.2);
                samples.push({boundary,body:h.snapshotBody(w,b)});}
            results.viewport={referenceTop,samples};
        }
        {
            const c=await h.fresh(),{world:w,data:d,spawn,boundary}=c;
            w.configureSafety(boundary,100,true);
            const b=spawn(d.OBJECTS.cardboard_box,115,80),before=h.snapshotBody(w,b);
            let maxAssist=0;await h.wait(({seconds})=>{maxAssist=Math.max(maxAssist,b.assistDamping);return seconds>=3;});
            results.extremeNearOverhang={before,after:h.snapshotBody(w,b),maxAssist};
        }
        {
            const c=await h.fresh(),{world:w,data:d,spawn,settle}=c;
            const b=spawn(d.OBJECTS.cardboard_box,0,64);await settle(b);
            const before=h.snapshotBody(w,b), initialPlacementTop=w.placementTop();
            b.body.angularVelocity=1.8;b.body.wakeUp();
            results.shakingReference={before,initialPlacementTop,after:h.snapshotBody(w,b),
                placementTop:w.placementTop(),supportedTop:typeof w.supportedTop==='function'?w.supportedTop():null,
                method:'One actual grounded, settled body is given 1.8 rad/s angular speed. Read production selectors immediately before any pose change; support/contact are never fabricated.'};
        }
        {
            const c=await h.fresh(),{world:w,data:d,spawn,settle,boundary}=c;
            const b=spawn(d.OBJECTS.cardboard_box,0,64);await settle(b);
            w.configureSafety(boundary,w.nativeBounds(b).top+600,true);
            await h.wait(({seconds})=>seconds>=1);
            b.body.linearVelocity=new h.cc.Vec2(.12,0);b.body.angularVelocity=.03;b.body.wakeUp();
            const before=h.snapshotBody(w,b),samples=[];
            await h.wait(({seconds})=>{samples.push({seconds,awake:b.body.isAwake(),speed:b.body.linearVelocity.length(),omega:b.body.angularVelocity});return seconds>=4;},7000);
            results.settleToSleep={before,after:h.snapshotBody(w,b),firstSleep:samples.find(s=>!s.awake)?.seconds??null,samples};
        }
        {
            const c=await h.fresh(),{world:w,data:d,spawn,settle,boundary}=c;
            const b=spawn(d.OBJECTS.toilet,0,80);await settle(b);
            w.configureSafety(boundary,w.nativeBounds(b).top+600,true);
            await h.wait(({seconds})=>seconds>=1);
            const impulses=[],apply=b.body.applyLinearImpulse.bind(b.body);
            b.body.applyLinearImpulse=(impulse,point,wake)=>{
                const center=b.body.getWorldCenter(new h.cc.Vec2()),origin=b.body.getWorldPoint(new h.cc.Vec2(),new h.cc.Vec2());
                const before={omega:b.body.angularVelocity,velocity:h.clone(b.body.linearVelocity)};
                apply(impulse,point,wake);
                impulses.push({impulse:h.clone(impulse),point:h.clone(point),center:h.clone(center),origin:h.clone(origin),wake,
                    before,after:{omega:b.body.angularVelocity,velocity:h.clone(b.body.linearVelocity)}});
            };
            b.body.linearVelocity=new h.cc.Vec2(.2,0);b.body.wakeUp();
            await h.wait(({seconds})=>seconds>=.3);
            results.irregularCenterImpulse={body:h.snapshotBody(w,b),impulses,horizontalRate:w.safetySnapshot().horizontalRate??null,
                method:'Observe and forward the actual production applyLinearImpulse calls on the real concave toilet. No impulse is fabricated or replaced; compare immediately around each call before collision integration.'};
        }
        return results;
    });
}
function addChecks() {
    const get=id=>report.results.find(r=>r.id===id)?.result;
    const safe=get('safeguards');
    if(safe){
        const fall=safe.supportRemoval, sleep=safe.sleep,edge=safe.extremeNearOverhang;
        report.checks.push({id:'sleeping_supported_body_not_woken',pass:!sleep.anyAwake});
        report.checks.push({id:'removed_support_still_free_falls',pass:fall.after.dynamic&&!fall.after.supported&&fall.after.assistDamping===0&&fall.after.position.y<fall.before.position.y-20});
        report.checks.push({id:'severe_near_overhang_not_saved',pass:edge.maxAssist===0&&(!edge.after.supported||edge.after.lost)&&edge.after.position.y<edge.before.position.y-40});
        if(safe.settleToSleep)report.checks.push({id:'awake_small_sway_returns_to_sleep',pass:safe.settleToSleep.firstSleep!==null&&!safe.settleToSleep.after.awake});
        if(!IS_BEFORE){
            report.checks.push({id:'real_supported_unplaced_body_receives_help',pass:!safe.unplacedSupport.beforeImpulse.placed&&safe.unplacedSupport.beforeImpulse.supported&&safe.unplacedSupport.beforeImpulse.assistDamping>0});
            const values=safe.viewport.samples.map(s=>s.body.assistDamping);
            report.checks.push({id:'same_depth_independent_of_viewport',pass:Math.max(...values)-Math.min(...values)<.03,values});
            const reference=safe.shakingReference;
            report.checks.push({id:'supported_reference_survives_high_angular_speed',pass:reference.after.supported&&reference.after.contacts>0&&reference.supportedTop>reference.placementTop+50&&Math.abs(reference.supportedTop-reference.before.bounds.top)<.01});
            const impulses=safe.irregularCenterImpulse.impulses;
            if(safe.irregularCenterImpulse.horizontalRate===0)report.checks.push({id:'rejected_horizontal_impulse_path_absent',pass:impulses.length===0,horizontalRate:0});
            else report.checks.push({id:'irregular_com_dissipation_adds_no_torque_or_vertical_speed',pass:impulses.length>0&&impulses.every(s=>
                    Math.hypot(s.point.x-s.center.x,s.point.y-s.center.y)<1e-5&&Math.hypot(s.center.x-s.origin.x,s.center.y-s.origin.y)>.5&&
                    Math.abs(s.after.omega-s.before.omega)<1e-6&&Math.abs(s.after.velocity.y-s.before.velocity.y)<1e-8&&s.wake===false)});
        }
    }
    for(const row of report.results.filter(r=>r.id.startsWith('impact_')&&r.result))report.checks.push({id:`${row.id}_actual_collision`,pass:row.result.metrics.contacted});
    for(const row of report.results.filter(r=>r.id.startsWith('controller_')&&r.result))report.checks.push({id:`${row.id}_production_gates_unchanged`,pass:row.result.strictStabilityMethodUnchanged});
}
(async()=>{try{
    save();browser=await chromium.launch({headless:true,args:['--disable-frame-rate-limit','--disable-gpu-vsync']});
    page=await browser.newPage({viewport:{width:375,height:667},hasTouch:true});
    page.on('pageerror',error=>report.errors.push(String(error)));
    await page.goto(URL+`?depth=${profile}`);await page.waitForFunction(()=>!!window.qaLoad,null,{timeout:45000});
    report.engine=await page.evaluate(()=>qaSnapshot());await installHelpers();
    await runCase('controller_center14',()=>controllerTrial('controller_center14',Array(14).fill(0)));
    await runCase('controller_alternating14',()=>controllerTrial('controller_alternating14',Array.from({length:14},(_,i)=>i%2?10:-10)));
    await runCase('controller_early_offset14',()=>controllerTrial('controller_early_offset14',Array.from({length:14},(_,i)=>i===0?10:i===3?-10:0)));
    for(const depth of [0,300,600])await runCase(`impact_depth${depth}_fps60`,()=>impactTrial(depth,60));
    for(const fps of [30,120])await runCase(`impact_depth600_fps${fps}`,()=>impactTrial(600,fps));
    await runCase('safeguards',safeguards);
    await runCase('controller_pressure28',()=>controllerTrial('controller_pressure28',Array.from({length:28},(_,i)=>i%2?10:-10)));
    addChecks();report.builtPackageAfter=hashTree(BUILD);
    report.checks.push({id:'build_unchanged_during_run',pass:report.builtPackageAfter.sha256===report.builtPackage.sha256});
    report.status=report.errors.length||report.results.some(r=>r.status==='failed')||report.checks.some(c=>!c.pass)?'failed_or_incomplete':'completed_bounded_diagnostics';
    if(report.status==='failed_or_incomplete')process.exitCode=1;
}catch(error){report.status='failed_or_incomplete';report.failure=String(error.stack||error);process.exitCode=1;
}finally{report.finishedAt=new Date().toISOString();save();await browser?.close();process.stdout.write(JSON.stringify({profile,status:report.status,results:report.results.length,checks:report.checks,errors:report.errors,failure:report.failure})+'\n');}})();
