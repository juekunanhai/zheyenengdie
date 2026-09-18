/** Real compiled Cocos camera/landing checks. Directed initial conditions are disclosed below.
 * No synthetic LandingContact or contact callback invocation; native Box2D produces every impact.
 */
'use strict';
const { chromium } = require('/Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '../..'), OUT = path.join(ROOT, 'preparation/review/evidence/camera-impact-r1');
const PROFILE = process.argv[2] || 'engine-r1';
const SELECTED = (process.env.MOTION_CASE || '').split(',').filter(Boolean);
if (!/^[a-z0-9_-]+$/i.test(PROFILE)) throw Error('Use a plain evidence profile name');
const URL = 'http://127.0.0.1:8767/preparation/review/play-player.html';
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function buildHash() {
    const rows = [];
    function visit(dir) { for (const file of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, file.name);
        if (file.isDirectory()) visit(full); else rows.push([path.relative(ROOT, full), hash(full)]);
    } }
    visit(path.join(ROOT, 'build/web-desktop')); rows.sort((a,b) => a[0].localeCompare(b[0]));
    return { files: rows.length, sha256: crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex') };
}
fs.mkdirSync(OUT, { recursive: true });
const report = { profile: PROFILE, startedAt: new Date().toISOString(), status: 'running', build: buildHash(),
    scriptSha256: hash(__filename), method: {
        landing: 'Actual normal first box release, plus isolated real fridge/ball and horizontal side-contact fixtures. The impact observer forwards the original callback without changing its arguments or result.',
        camera: 'Explicit presentation fixture: fixed view heights and beginIncident/endIncident calls. It does not claim to be a naturally triggered accident or gameplay survival test.',
        pause: 'Production lifecycle.togglePause freezes native simulation and presentation; browser timer only measures elapsed wall time.',
        limits: 'Rectangle coverage is not pixel seam inspection. Screenshots and video still need visual review. Browser validation is not WeChat real-device acceptance.' },
    cases: [], checks: [], errors: [], gaps: [] };
const save = () => fs.writeFileSync(path.join(OUT, `${PROFILE}.json`), JSON.stringify(report, null, 2) + '\n');
const check = (id, pass, details) => report.checks.push({ id, pass: !!pass, details });
let browser, page;
async function helpers() {
    await page.evaluate(() => {
        const cc = qaCC, clone = v => JSON.parse(JSON.stringify(v));
        const wait = (predicate, limit = 10000) => new Promise((resolve, reject) => {
            let seconds = 0, frames = 0;
            const off = () => { cc.director.off(cc.Director.EVENT_AFTER_UPDATE, tick); clearTimeout(timer); };
            const tick = () => { try {
                seconds += cc.game.deltaTime; frames++;
                const value = predicate({ seconds, frames, dt: cc.game.deltaTime });
                if (value) { off(); resolve(value); }
            } catch (error) { off(); reject(error); } };
            const timer = setTimeout(() => { off(); reject(Error('Real frame wait timed out')); }, limit);
            cc.director.on(cc.Director.EVENT_AFTER_UPDATE, tick);
        });
        const node = n => ({ name:n.name, active:n.activeInHierarchy, position:clone(n.worldPosition), scale:clone(n.worldScale),
            rectangle:clone(n.getComponent(cc.UITransform).getBoundingBoxToWorld()) });
        window.motionQA = { cc, clone, wait, node, cleanup:null, contacts:[], samples:[] };
        motionQA.fresh = async (isolated = false) => {
            motionQA.cleanup?.(); motionQA.cleanup = null;
            cc.game.resume(); cc.game.frameRate = 60;
            cc.PhysicsSystem2D.instance.enable = true; cc.PhysicsSystem2D.instance.autoSimulation = true;
            cc.sys.localStorage.setItem('zhynd.local-settings.v1', JSON.stringify({ tutorialDone:true,music:false,sound:false,vibration:false }));
            await qaLoad('HUD'); const g = qaGame();
            await wait(() => g.snapshot().phase === 'planning');
            g.configureCalibration(g.snapshot().sequence, true);
            if (isolated) {
                g.enabled = false; g.world.dispose(); g.display.dispose(); g.current = null;
                await wait(({frames}) => frames >= 2);
                const {TowerWorld} = await System.import('chunks:///_virtual/tower-world.ts');
                const {PlayView} = await System.import('chunks:///_virtual/play-view.ts');
                g.display = new PlayView(g.node, new Map(g.frames.map(f => [f.name,f])));
                g.world = new TowerWorld(cc.director.getScene(), (r,p,s,l) => g.impact(r,p,s,l));
                g.world.configureSafety({left:-1500,right:1500,bottom:-1500,top:1500},0,false);
                const tick = () => g.display.update(Math.min(cc.game.deltaTime,.067),g.world.bodies,null,1);
                cc.director.on(cc.Director.EVENT_AFTER_UPDATE,tick);
                motionQA.cleanup = () => cc.director.off(cc.Director.EVENT_AFTER_UPDATE,tick);
            }
            motionQA.g = g; motionQA.contacts = []; motionQA.samples = [];
            const original = g.impact;
            g.impact = function(r,p,s,l) { motionQA.contacts.push({id:r.id,pair:p,speed:s,landing:l?clone({id:l.record.id,speed:l.speed,normal:l.normal,point:l.point}):null});return original.call(this,r,p,s,l); };
            return g;
        };
    });
}
async function landingHelpers() {
    await page.evaluate(() => {
        const h=motionQA, {cc}=h;
        h.frame = () => {
            const g=h.g,d=g.display,state=h.clone(d.snapshot()),anchorErrors=[];
            for(const r of state.landing.reactions){
                const body=g.world.bodies.find(b=>b.id===r.id),view=d.views.get(r.id);
                if(!body||!view) continue;
                const [ox,oy]=body.spec.spriteOffset||[0,0],lp=r.localPoint;
                const visible=view.getComponent(cc.UITransform).convertToWorldSpaceAR(new cc.Vec3((lp.x-ox)*state.scale,(lp.y-oy)*state.scale,0));
                const point=body.body.getWorldPoint(new cc.Vec2(lp.x,lp.y),new cc.Vec2());
                const expected=d.root.getComponent(cc.UITransform).convertToWorldSpaceAR(new cc.Vec3(point.x*state.scale,state.originY+(point.y-state.cameraY)*state.scale,0));
                anchorErrors.push({id:r.id,error:Math.hypot(visible.x-expected.x,visible.y-expected.y),visual:h.node(view),physicalScale:h.clone(body.node.worldScale)});
            }
            return {landing:state.landing,anchorErrors,physical:g.world.bodies.map(b=>({id:b.id,kind:b.spec.kind,scale:h.clone(b.node.worldScale),contacts:b.contacts.size,lost:b.lost}))};
        };
        h.observe = () => { const tick=()=>h.samples.push(h.frame());cc.director.on(cc.Director.EVENT_AFTER_UPDATE,tick);return()=>cc.director.off(cc.Director.EVENT_AFTER_UPDATE,tick); };
        h.spawn = async (kind,x,y) => {
            const {OBJECTS}=await System.import('chunks:///_virtual/object-data.ts');
            const r=h.g.world.create(OBJECTS[kind],x,y);h.g.world.release(r);return r;
        };
        h.settle = async r => {
            let quiet=0;
            await h.wait(({dt})=>{quiet=r.contacts.size&&r.body.linearVelocity.length()<.1&&Math.abs(r.body.angularVelocity)<.1?quiet+dt:0;return quiet>.65;});
            r.placed=true;
        };
    });
}
function landingChecks(id, result) {
    const rows=result.samples, anchors=rows.flatMap(s=>s.anchorErrors);
    const reactions=rows.flatMap(s=>s.landing.reactions).filter(r=>r.id===result.targetId);
    const ys=reactions.map(r=>r.deformation.y),xs=reactions.map(r=>r.deformation.x);
    check(`${id}_real_landing_contact`,result.contacts.some(c=>c.landing?.id===result.targetId));
    check(`${id}_compression_and_rebound`,Math.min(...ys)<.995&&Math.max(...ys)>1.001,{minY:Math.min(...ys),maxY:Math.max(...ys),minX:Math.min(...xs),maxX:Math.max(...xs)});
    check(`${id}_particles_visible`,rows.some(s=>s.landing.particles>=2));
    check(`${id}_physical_scale_unchanged`,rows.every(s=>s.physical.every(b=>Math.abs(b.scale.x-1)<1e-6&&Math.abs(b.scale.y-1)<1e-6)));
    check(`${id}_contact_anchor_retained`,anchors.length>0&&Math.max(...anchors.map(a=>a.error))<.02,{maxWorldPixelError:Math.max(...anchors.map(a=>a.error))});
    check(`${id}_quiet_effects_clear`,result.final.landing.particles===0&&result.final.landing.reactions.length===0);
}
async function firstLanding() {
    const first=await page.evaluate(async()=>{
        const h=motionQA,g=await h.fresh();h.stop=h.observe();const targetId=g.current.id;
        g.moveTo(0);g.release();
        await h.wait(()=>h.g.display.snapshot().landing.reactions.some(r=>r.id===targetId&&r.age>.025));
        g.lifecycle.togglePause();return {targetId,paused:h.frame()};
    });
    await page.screenshot({path:path.join(OUT,`${PROFILE}-box-contact-paused.png`)});
    await page.waitForTimeout(300);
    const pausedAfter=await page.evaluate(()=>motionQA.frame());
    check('production_pause_freezes_reaction',JSON.stringify(first.paused)===JSON.stringify(pausedAfter),{wallMilliseconds:300});
    const rest=await page.evaluate(async()=>{
        const h=motionQA;h.g.lifecycle.togglePause();await h.wait(({seconds})=>seconds>1.6);h.stop();
        return {samples:h.samples,contacts:h.contacts,final:h.frame()};
    });
    const result={...first,...rest};landingChecks('box_platform',result);return result;
}
async function ballLanding() {
    await page.evaluate(async()=>{
        const h=motionQA;await h.fresh(true);
        const fridge=await h.spawn('fridge',0,100);await h.settle(fridge);await h.wait(({seconds})=>seconds>.55);
        h.contacts=[];h.samples=[];h.stop=h.observe();
        const ball=await h.spawn('basketball',0,h.g.world.nativeBounds(fridge).top+34+65);
        h.target=ball.id;await h.wait(()=>h.g.display.snapshot().landing.reactions.some(r=>r.id===ball.id&&r.age>.025));
        h.g.lifecycle.togglePause();
    });
    await page.screenshot({path:path.join(OUT,`${PROFILE}-ball-fridge-contact-paused.png`)});
    const result=await page.evaluate(async()=>{
        const h=motionQA;h.g.lifecycle.togglePause();await h.wait(({seconds})=>seconds>1.2);h.stop();
        return {targetId:h.target,samples:h.samples,contacts:h.contacts,final:h.frame()};
    });
    landingChecks('ball_fridge',result);return result;
}
async function sideContact() {
    const result=await page.evaluate(async()=>{
        const h=motionQA,{cc}=h;await h.fresh(true);
        const fixed=await h.spawn('cardboard_box',0,150);
        fixed.body.type=cc.ERigidBody2DType.Static;fixed.body.linearVelocity=new cc.Vec2();
        const moving=await h.spawn('cardboard_box',-180,150);
        moving.body.gravityScale=0;moving.body.linearVelocity=new cc.Vec2(6,0);
        h.contacts=[];h.samples=[];const stop=h.observe();
        await h.wait(({seconds})=>seconds>.9);stop();
        return {method:'Declared horizontal fixture: same approved box outlines; stationary box at y150 and gravity-free incoming box speed6m/s. Real native side contact.',contacts:h.contacts,samples:h.samples};
    });
    check('side_contact_is_real',result.contacts.length>0);
    check('side_contact_has_no_landing',result.contacts.every(c=>c.landing===null)&&result.samples.every(s=>s.landing.particles===0&&s.landing.reactions.length===0));
    return result;
}
async function concaveContact() {
    const attempts=[];
    for(const offset of [{x:59,y:44},{x:58.5,y:45}]){
        const result=await page.evaluate(async offset=>{
            const h=motionQA,{cc}=h;await h.fresh(true);
            const lower=await h.spawn('toilet',0,160);
            lower.body.type=cc.ERigidBody2DType.Static;lower.body.linearVelocity=new cc.Vec2();lower.placed=true;
            const ball=await h.spawn('basketball',offset.x,160+offset.y);
            ball.body.linearVelocity=new cc.Vec2(-1,-5);
            const active=new Set(),events=[];
            ball.collider.on(cc.Contact2DType.BEGIN_CONTACT,(_self,other,contact)=>{
                if(other!==lower.collider)return;active.add(contact);
                const m=contact.getWorldManifold(),sign=contact.colliderA===ball.collider?-1:1;
                events.push({type:'begin',active:active.size,normal:{x:m.normal.x*sign,y:m.normal.y*sign}});
            });
            ball.collider.on(cc.Contact2DType.END_CONTACT,(_self,other,contact)=>{
                if(other!==lower.collider)return;active.delete(contact);events.push({type:'end',active:active.size});
            });
            h.contacts=[];h.samples=[];const stop=h.observe();
            await h.wait(({seconds})=>seconds>.8);stop();
            return {offset,events,contacts:h.contacts,samples:h.samples,targetId:ball.id};
        },offset);
        attempts.push(result);
        const side=result.events.findIndex(e=>e.type==='begin'&&Math.abs(e.normal.y)<.3);
        const floor=result.events.findIndex((e,i)=>i>side&&e.type==='begin'&&e.normal.y>.3&&e.active>=2);
        if(side>=0&&floor>side){
            check('concave_second_fixture_real_landing',result.contacts.some(c=>c.landing?.id===result.targetId&&c.speed===0));
            check('concave_second_fixture_visual_feedback',result.samples.some(s=>s.landing.reactions.some(r=>r.id===result.targetId)&&s.landing.particles>=2));
            return {method:'Approved native concave toilet held static; real ball initial velocity(-1,-5)m/s presses its inner tank side then seat. No collider shape edits or contact injection.',attempts,sideIndex:side,floorIndex:floor};
        }
    }
    report.gaps.push('Two declared concave fixtures did not obtain side-first plus a second simultaneous bearing fixture; this path remains unverified.');
    return {attempts,gap:report.gaps.at(-1)};
}
async function concaveEngineeredContact() {
    const result=await page.evaluate(async()=>{
        const h=motionQA,{cc}=h;await h.fresh(true);
        const {OBJECTS,localBounds}=await System.import('chunks:///_virtual/object-data.ts');
        const points=[[-160,-30],[0,-30],[0,260],[-20,260],[-20,0],[-160,0]];
        const spec={...OBJECTS.cardboard_box,width:160,height:290,spriteWidth:160,spriteHeight:290,outline:points,friction:0,restitution:0};
        h.g.world.platform.enabled=false;
        const lower=h.g.world.create(spec,0,0);h.g.world.release(lower);
        lower.body.type=cc.ERigidBody2DType.Static;lower.body.linearVelocity=new cc.Vec2();lower.placed=true;
        const x=-20-localBounds(OBJECTS.cardboard_box,0).right-.05;
        const box=await h.spawn('cardboard_box',x,110);box.body.linearVelocity=new cc.Vec2(.15,0);
        const active=new Set(),events=[];
        box.collider.on(cc.Contact2DType.BEGIN_CONTACT,(_self,other,contact)=>{
            if(other!==lower.collider)return;active.add(contact);
            const m=contact.getWorldManifold(),sign=contact.colliderA===box.collider?-1:1;
            events.push({type:'begin',active:active.size,normal:{x:m.normal.x*sign,y:m.normal.y*sign},position:h.clone(box.node.position)});
        });
        box.collider.on(cc.Contact2DType.END_CONTACT,(_self,other,contact)=>{
            if(other!==lower.collider)return;active.delete(contact);events.push({type:'end',active:active.size});
        });
        h.contacts=[];h.samples=[];const stop=h.observe();
        await h.wait(({seconds})=>seconds>1.6);stop();
        return {fixture:{points,staticSupport:true,supportFriction:0,supportRestitution:0,disabledDefaultPlatform:true,
            boxInitial:{x,y:110,vx:.15,vy:0},normalGravity:true,velocityServo:false},events,contacts:h.contacts,samples:h.samples,targetId:box.id};
    });
    const side=result.events.findIndex(e=>e.type==='begin'&&Math.abs(e.normal.y)<.3);
    const floor=result.events.findIndex((e,i)=>i>side&&e.type==='begin'&&e.normal.y>.3&&e.active>=2);
    if(side<0||floor<=side){
        report.gaps.push('Engineered L support did not retain a native side contact through the new floor contact. No further retry made.');
        return {...result,gap:report.gaps.at(-1)};
    }
    check('engineered_concave_simultaneous_native_contacts',true,{sideIndex:side,floorIndex:floor,events:result.events});
    check('engineered_concave_floor_emits_landing_with_audio_dedup',result.contacts.some(c=>c.speed===0&&c.landing?.id===result.targetId&&c.landing.normal.y>.3));
    check('engineered_concave_floor_has_visual_feedback',result.samples.some(s=>s.landing.particles>=2&&s.landing.reactions.some(r=>r.id===result.targetId)));
    return result;
}
async function cameraHelpers() {
    await page.evaluate(()=>{
        const h=motionQA,{cc}=h;
        h.camera=()=>{
            const g=h.g,d=g.display,b=d.backdrop,base=b.layers.filter(n=>n.active&&n.getComponent(cc.UIOpacity).opacity===255).at(-1);
            const backdrop=[base,b.skyEdges[b.layers.indexOf(base)],...b.extensions.get(base).map(e=>e.node)].filter(n=>n.activeInHierarchy).map(h.node);
            // getBoundingBoxToWorld includes descendants, including intentionally offscreen art.
            // Sample the Canvas's own content rectangle rather than that scene-content union.
            const ui=g.node.getComponent(cc.UITransform),size=ui.contentSize,anchor=ui.anchorPoint;
            const a=ui.convertToWorldSpaceAR(new cc.Vec3(-size.width*anchor.x,-size.height*anchor.y,0));
            const z=ui.convertToWorldSpaceAR(new cc.Vec3(size.width*(1-anchor.x),size.height*(1-anchor.y),0));
            const canvas={x:a.x,y:a.y,width:z.x-a.x,height:z.y-a.y};let uncovered=0;
            for(let x=0;x<=20;x++)for(let y=0;y<=20;y++){
                const px=canvas.x+canvas.width*x/20,py=canvas.y+canvas.height*y/20;
                if(!backdrop.some(n=>{const r=n.rectangle;return px>=r.x-.01&&px<=r.x+r.width+.01&&py>=r.y-.01&&py<=r.y+r.height+.01;}))uncovered++;
            }
            const hud=d.safe.children.filter(n=>!['World_1x','PlayWorld','PlayInput','PlanningHint'].includes(n.name)).map(h.node);
            return {view:h.clone(d.snapshot()),boundary:h.clone(d.logicalBounds()),normalBoundary:h.clone(g.normalBoundary),hud,uncovered,
                layers:b.layers.map(h.node),clouds:b.clouds.map(h.node),ground:b.groundForeground?h.node(b.groundForeground):null,backdrop};
        };
    });
}
async function cameraCase(size,height) {
    await page.setViewportSize(size);
    await page.evaluate(async height=>{
        const h=motionQA;await h.fresh(true);
        h.g.display.cameraY=h.g.display.targetCameraY=height*100;
        await h.wait(({frames})=>frames>=3);
    },height);
    const normal=await page.evaluate(()=>motionQA.camera()),stages=[];
    for(const zoom of [.85,.75]){
        const state=await page.evaluate(async zoom=>{
            const h=motionQA;h.g.display.beginIncident(zoom);
            await h.wait(()=>Math.abs(h.g.display.snapshot().zoom-zoom)<1e-6);return h.camera();
        },zoom);
        stages.push({zoom,state});
    }
    await page.screenshot({path:path.join(OUT,`${PROFILE}-camera-${size.width}x${size.height}-${height}m-075.png`)});
    const recovered=await page.evaluate(async()=>{
        const h=motionQA;h.g.display.endIncident();await h.wait(()=>h.g.display.cameraRecovered());return h.camera();
    });
    const id=`camera_${size.width}x${size.height}_${height}m`;
    check(`${id}_hud_and_bounds_fixed`,[...stages.map(s=>s.state),recovered].every(s=>JSON.stringify(s.hud)===JSON.stringify(normal.hud)&&JSON.stringify(s.boundary)===JSON.stringify(normal.boundary)&&JSON.stringify(s.normalBoundary)===JSON.stringify(normal.normalBoundary)));
    check(`${id}_background_clouds_retreat`,stages.every(({state:s})=>s.layers.some(l=>l.active&&l.scale.x<.999)&&s.clouds.every(c=>c.scale.x<.999)&&s.layers.every(l=>l.scale.x>=s.view.zoom)));
    check(`${id}_full_background_coverage`,[normal,...stages.map(s=>s.state),recovered].every(s=>s.uncovered===0));
    check(`${id}_recovery_identity`,recovered.view.zoom===1&&recovered.layers.every(l=>Math.abs(l.scale.x-1)<1e-6)&&recovered.clouds.every(c=>Math.abs(c.scale.x-1)<1e-6));
    return {size,height,normal,stages,recovered};
}
async function run(id,fn){
    if(SELECTED.length&&!SELECTED.includes(id))return;
    const row={id,status:'running'};report.cases.push(row);save();process.stdout.write(`${id}: running\n`);
    try{row.result=await fn();row.status='completed';}catch(error){row.status='failed';row.error=String(error.stack||error);}
    save();process.stdout.write(`${id}: ${row.status}\n`);
}
(async()=>{try{
    save();browser=await chromium.launch({headless:true});page=await browser.newPage({viewport:{width:375,height:667},hasTouch:true});
    page.on('pageerror',error=>report.errors.push(String(error)));
    await page.goto(`${URL}?motion=${PROFILE}`);await page.waitForFunction(()=>window.qaLoad,null,{timeout:45000});
    report.engine=await page.evaluate(()=>qaSnapshot());await helpers();await landingHelpers();await cameraHelpers();
    await run('box_platform',firstLanding);await run('ball_fridge',ballLanding);await run('side_contact',sideContact);
    await run('concave_second_contact',concaveContact);
    await run('concave_engineered_support',concaveEngineeredContact);
    for(const size of [{width:375,height:667},{width:390,height:844}])for(const height of [0,60,200])
        await run(`camera_${size.width}x${size.height}_${height}m`,()=>cameraCase(size,height));
    const after=buildHash();check('built_package_unchanged',after.sha256===report.build.sha256,after);
    report.status=report.errors.length||report.cases.some(r=>r.status!=='completed')||report.checks.some(c=>!c.pass)?'failed_or_incomplete':'passed_bounded_checks';
    if(report.status!=='passed_bounded_checks')process.exitCode=1;
}catch(error){report.status='failed_or_incomplete';report.failure=String(error.stack||error);process.exitCode=1;}
finally{report.finishedAt=new Date().toISOString();save();await browser?.close();process.stdout.write(JSON.stringify({status:report.status,checks:report.checks,errors:report.errors,failure:report.failure})+'\n');}})();
