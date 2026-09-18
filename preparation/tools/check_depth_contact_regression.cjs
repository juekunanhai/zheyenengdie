/** Real compiled Cocos contact regressions after ContactAssistance extraction.
 * The controlled initial positions/velocities below are declared fixture mutations.
 * No synthetic contact callback, loss callback or replacement solver result is used.
 */
'use strict';
const { chromium } = require('/Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '../..'), BUILD = path.join(ROOT, 'build/web-desktop');
const OUT = path.join(ROOT, 'preparation/review/evidence/depth-assist-r1');
const profile = process.argv[2] || 'contact-regression-r1';
if (!/^[a-z0-9_-]+$/i.test(profile)) throw Error('Use a simple report filename');
const output = path.join(OUT, `${profile}.json`);
if (fs.existsSync(output)) throw Error(`Refusing to overwrite previous evidence: ${output}`);
const selected = (process.env.DEPTH_CONTACT_CASE || '').split(',').filter(Boolean);
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
function packageHash() {
    const files = {};
    function visit(dir) { for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const f = path.join(dir, e.name);
        if (e.isDirectory()) visit(f); else if (e.isFile()) files[path.relative(BUILD, f)] = sha(f);
    } }
    visit(BUILD);
    return { count: Object.keys(files).length, sha256: crypto.createHash('sha256').update(
        Object.keys(files).sort().map(f => `${f}:${files[f]}`).join('\n')).digest('hex'), files };
}
const report = { schema: 'depth-contact-real-engine-r1', profile, startedAt: new Date().toISOString(), status: 'running',
    method: 'Actual built TowerWorld / ContactAssistance / native Box2D events. Physical fixture mutations are documented per case. No production source, previous QA script or previous report is rewritten.',
    limits: 'These directed contact tests do not establish ordinary player difficulty or subjective surprise.',
    scriptSha256: sha(__filename), buildBefore: packageHash(), cases: [], errors: [] };
let browser, page;
function save() { fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n'); }
async function run(id, fn) {
    if (selected.length && !selected.includes(id)) return;
    const row = { id, status: 'running', startedAt: new Date().toISOString() }; report.cases.push(row); save();
    process.stdout.write(`${id}: running\n`);
    try { row.result = await fn(); row.status = 'passed'; }
    catch (e) { row.status = 'failed'; row.error = String(e.stack || e); row.last = await page.evaluate(() => contactHarness.last).catch(() => null); }
    row.finishedAt = new Date().toISOString(); save(); process.stdout.write(JSON.stringify({ id, status: row.status, error: row.error }) + '\n');
}
async function install() {
    await page.evaluate(() => {
        const cc = qaCC, clone = value => JSON.parse(JSON.stringify(value));
        const check = (condition, message, evidence) => { if (!condition) throw Error(message + (evidence ? ` ${JSON.stringify(evidence)}` : '')); };
        const wait = (predicate, timeoutMs = 15000) => new Promise((resolve, reject) => {
            let frames = 0, elapsed = 0;
            const off = () => { cc.director.off(cc.Director.EVENT_AFTER_PHYSICS, tick); clearTimeout(timeout); };
            const tick = () => { try { elapsed += Math.max(0, cc.game.deltaTime); frames++;
                const result = predicate({ frames, elapsed }); if (result) { off(); resolve(result); }
            } catch (e) { off(); reject(e); } };
            const timeout = setTimeout(() => { off(); reject(Error(`Physics predicate timed out after ${timeoutMs}ms`)); }, timeoutMs);
            cc.director.on(cc.Director.EVENT_AFTER_PHYSICS, tick);
        });
        const snapshot = (w, b) => ({ id: b.id, kind: b.spec.kind, dynamic: b.body.type === cc.ERigidBody2DType.Dynamic,
            placed: b.placed, supported: b.supported, lost: b.lost, bounds: w.nativeBounds(b), nodeBounds: w.bounds(b),
            velocity: clone(b.body.linearVelocity), angularVelocity: b.body.angularVelocity,
            contacts: b.contacts.size, assistDamping: b.assistDamping, awake: b.body.isAwake() });
        const fresh = async (safety = true) => {
            cc.PhysicsSystem2D.instance.enable = true; cc.PhysicsSystem2D.instance.autoSimulation = true; cc.game.frameRate = 60;
            cc.sys.localStorage.setItem('zhynd.local-settings.v1', JSON.stringify({ tutorialDone: true, music: false, sound: false, vibration: false }));
            await qaLoad('HUD'); const g = qaGame();
            await wait(() => g.snapshot().phase === 'planning' && g.display.cameraRecovered());
            g.enabled = false; g.audio.pause(true); g.world.dispose(); g.display.dispose(); g.current = null;
            await wait(({ frames }) => frames >= 2);
            const { TowerWorld } = await System.import('chunks:///_virtual/tower-world.ts');
            const data = await System.import('chunks:///_virtual/object-data.ts');
            const world = g.world = new TowerWorld(cc.director.getScene());
            check(world.contactAssistance, 'Current build is missing extracted ContactAssistance');
            const boundary = { left: -375, right: 375, bottom: -400, top: 1200 };
            if (safety) world.configureSafety(boundary, 0, false);
            const spawn = (spec, x, y) => { const b = world.create(spec, x, y); world.release(b); return b; };
            const settle = async b => { let steady = 0;
                await wait(() => { steady = world.isStable() ? steady + Math.min(.1, cc.game.deltaTime) : 0; return steady >= .7; });
                b.placed = true; return b;
            };
            const ctx = { cc, g, world, data, boundary, spawn, settle };
            contactHarness.ctx = ctx; return ctx;
        };
        window.contactHarness = { cc, clone, check, wait, snapshot, fresh, last: null };
    });
}
async function detachedGlueGroup() {
    return page.evaluate(async () => {
        const h = contactHarness, { world: w, data, boundary, spawn, settle } = await h.fresh();
        const box = await settle(spawn(data.OBJECTS.cardboard_box, 0, 62));
        const ball = await settle(spawn(data.OBJECTS.basketball, 0, w.placementTop() + 36));
        const cap = await settle(spawn(data.OBJECTS.cardboard_box, 0, w.placementTop() + 52));
        const bonds = w.contactAssistance.bonds;
        h.check(bonds.size === 2, 'Actual basketball must establish two local joints');
        w.configureSafety(boundary, w.nativeBounds(cap).top + 600, true);
        await h.wait(({ elapsed }) => elapsed >= 1);
        const before = w.bodies.map(b => h.snapshot(w, b));
        h.check(before.every(b => b.supported && b.assistDamping > 0), 'All three real grounded bodies must receive depth assistance first', before);
        const samples = []; w.platform.enabled = false;
        await h.wait(({ elapsed }) => {
            samples.push({ elapsed, bonds: bonds.size, bodies: w.bodies.map(b => h.snapshot(w, b)) });
            h.last = samples[samples.length - 1]; return elapsed >= .5;
        });
        const firstDetached = samples.find(s => s.bodies.every(b => !b.supported));
        h.check(firstDetached && firstDetached.bodies.every(b => b.assistDamping === 0), 'Floating glue group retained assistance', firstDetached);
        h.check(samples.some(s => s.bonds === 2 && s.bodies.every(b => !b.supported)), 'Need actual intact-but-ungrounded glue group, not merely broken bonds');
        const after = samples[samples.length - 1];
        h.check(after.bodies.every((b, i) => b.dynamic && !b.supported && b.assistDamping === 0 && b.bounds.top < before[i].bounds.top - 20), 'Detached group did not fall naturally', after);
        return { fixture: 'Real box, basketball and cap are individually physically settled. Both basketball joints are built by real contacts. Then only the real GroundSupport collider is disabled; local glue remains simulated.', before, firstDetached, after, samples };
    });
}
async function motorVariant(filtered) {
    return page.evaluate(async filtered => {
        const h = contactHarness, { cc, world: w, data, spawn, settle } = await h.fresh(filtered);
        // Same real two-sided basketball / screen-external probe setup as batch1b-checks.js motorVariant.
        // Native SetTransform is a declared initial-condition injection after the rule's BEFORE guard.
        const boundary = { left: -375, right: 375, bottom: -200, top: 800 };
        if (filtered) w.configureSafety(boundary, 100, false);
        const lower = await settle(spawn(data.OBJECTS.cardboard_box, 0, 52));
        const upper = await settle(spawn(data.OBJECTS.basketball, 0, w.placementTop() + 36));
        const cap = await settle(spawn(data.OBJECTS.cardboard_box, 0, w.placementTop() + 52));
        const bonds = w.contactAssistance.bonds, joints = [...bonds.values()].map(b => b.joint);
        h.check(bonds.size === 2 && [...bonds.values()].every(b => b.ball === upper), 'Need two physically created basketball joints');
        const targetX = boundary.right + upper.spec.width + 50;
        const barrier = w.create(data.OBJECTS.cardboard_box,
            targetX + upper.spec.width / 2 + data.OBJECTS.cardboard_box.width / 2 - .5, upper.node.position.y);
        barrier.body.type = cc.ERigidBody2DType.Static; barrier.collider.enabled = true; barrier.collider.apply();
        await h.wait(({ frames }) => frames >= 2);
        const before = { lower: h.snapshot(w, lower), upper: h.snapshot(w, upper), cap: h.snapshot(w, cap),
            joints: joints.map(j => ({ maxForce: j.maxForce, maxTorque: j.maxTorque, enabled: j.enabledInHierarchy })) };
        h.check(before.joints.every(j => j.enabled && j.maxForce > 0), 'Joint was not active before the real collision');
        const native = upper.body.impl.impl, contacts = [], impulses = [], lossEvents = [];
        let injectionPending = true, injected = null, physicalPhase = 'between-frames';
        w.onLoss = b => lossEvents.push({ id: b.id, physicalPhase, stepping: cc.PhysicsSystem2D.instance._steping,
            bounds: w.nativeBounds(b), nodeBounds: w.bounds(b) });
        upper.collider.on(cc.Contact2DType.PRE_SOLVE, (_self, other, contact) => contacts.push({
            otherId: w.bodies.find(b => b.collider === other)?.id ?? 0, probe: other === barrier.collider,
            disabled: !!contact.disabled, disabledOnce: !!contact.disabledOnce, bounds: w.nativeBounds(upper) }));
        upper.collider.on(cc.Contact2DType.POST_SOLVE, (_self, other, contact) => {
            if (other === barrier.collider) { const impulse = contact.getImpulse(); impulses.push(impulse ? h.clone(impulse) : null); }
        });
        const beforeStep = () => {
            physicalPhase = 'solver'; if (!injectionPending) return; injectionPending = false;
            // BEFORE_PHYSICS is emitted even on a render frame with no native step.
            // Seed one public fixed-step budget so the declared injection reaches a
            // real solver pass before afterPhysics can retire its broken joints.
            cc.PhysicsSystem2D.instance.resetAccumulator(cc.PhysicsSystem2D.instance.fixedTimeStep);
            native.SetTransform({ x: targetX / 32, y: native.GetPosition().y }, native.GetAngle());
            upper.body.linearVelocity = new cc.Vec2(15, 0); upper.body.wakeUp(); lower.body.wakeUp();
            injected = { node: w.bounds(upper), native: w.nativeBounds(upper), boundary };
        };
        const afterStep = () => { physicalPhase = 'between-frames'; };
        cc.director.on(cc.Director.EVENT_BEFORE_PHYSICS, beforeStep);
        cc.director.on(cc.Director.EVENT_AFTER_PHYSICS, afterStep);
        try { await h.wait(({ frames }) => frames >= 1); }
        finally { cc.director.off(cc.Director.EVENT_BEFORE_PHYSICS, beforeStep); cc.director.off(cc.Director.EVENT_AFTER_PHYSICS, afterStep); }
        h.check(injected && injected.native.left > boundary.right && injected.node.right < boundary.right, 'Injection did not preserve old Node position', injected);
        const first = { lower: h.snapshot(w, lower), cap: h.snapshot(w, cap), upper: h.snapshot(w, upper),
            nativeEnabled: upper.body.impl.impl.IsEnabled(), bonds: bonds.size,
            joints: joints.map(j => ({ valid: cc.isValid(j, true), enabled: j.enabled, maxForce: j.maxForce, maxTorque: j.maxTorque })) };
        await h.wait(({ elapsed }) => elapsed >= .35);
        const after = { lower: h.snapshot(w, lower), cap: h.snapshot(w, cap), upper: h.snapshot(w, upper), bonds: bonds.size,
            nativeEnabled: upper.body.impl.impl.IsEnabled() };
        const result = { filtered, fixture: 'Real double basketball MotorJoint first, then native transform + 15m/s injection after TowerWorld BEFORE guard into a pre-registered static screen-external probe. Public resetAccumulator(fixedTimeStep) guarantees that injection frame runs at least one actual solver step. Actual PRE_SOLVE/POST_SOLVE and original production loss code remain live; no direct loss call.',
            before, injected, first, after, contacts, impulses, lossEvents };
        h.last = result; return result;
    }, filtered);
}
async function motorIsolation() {
    const filtered = await motorVariant(true), control = await motorVariant(false);
    await page.evaluate(result => { contactHarness.last = result; }, { filtered, control });
    const check = (yes, message) => { if (!yes) throw Error(message); };
    const total = rows => rows.flatMap(r => r?.normalImpulses || []).reduce((sum, n) => sum + Math.abs(n), 0);
    check(filtered.lossEvents.some(e => e.stepping) && filtered.contacts.some(c => c.probe && (c.disabled || c.disabledOnce)), 'Need observed native PRE_SOLVE loss and disabled probe contact');
    check(filtered.first.upper.lost && filtered.first.bonds === 0 && filtered.first.joints.every(j => j.maxForce === 0 && j.maxTorque === 0), 'Joint budget survived PRE_SOLVE loss');
    check(Math.abs(filtered.first.lower.velocity.x) < .03 && Math.abs(filtered.first.cap.velocity.x) < .03, 'Filtered joint transmitted first-step horizontal drag');
    check(total(filtered.impulses) === 0 && total(control.impulses) > .001, 'Need zero filtered probe impulse and positive unfiltered control impulse');
    // The two motors can transfer the strongest first-step drag to either supported body.
    // Require a real response on at least one side, while both filtered sides stay quiet.
    check(Math.max(Math.abs(control.first.lower.velocity.x), Math.abs(control.first.cap.velocity.x)) >
        Math.max(Math.abs(filtered.first.lower.velocity.x), Math.abs(filtered.first.cap.velocity.x)) + .05,
        'Control did not demonstrate joint drag on either side');
    check(!filtered.first.nativeEnabled && !filtered.after.nativeEnabled &&
        Object.keys(filtered.first.upper.bounds).every(k => Math.abs(filtered.first.upper.bounds[k] - filtered.after.upper.bounds[k]) < 1e-5), 'Retired body continued native simulation');
    return { filtered, control };
}
async function concavePendingEnd() {
    return page.evaluate(async () => {
        const h = contactHarness, { cc, world: w, data } = await h.fresh(false), physics = cc.PhysicsSystem2D.instance;
        const oldPhysics = { fixedTimeStep: physics.fixedTimeStep, maxSubSteps: physics.maxSubSteps, frameRate: cc.game.frameRate };
        physics.fixedTimeStep = 1 / 240; physics.maxSubSteps = 8; physics.resetAccumulator(); cc.game.frameRate = 30;
        w.platform.enabled = false;
        const supportNode = new cc.Node('ConcaveVSupport'); w.root.addChild(supportNode);
        supportNode.addComponent(cc.RigidBody2D).type = cc.ERigidBody2DType.Static;
        const support = supportNode.addComponent(cc.PolygonCollider2D);
        support.points = [[-80,-30],[80,-30],[80,80],[0,0],[-80,80]].map(([x,y]) => new cc.Vec2(x,y)); support.apply();
        // Restitution 1 and high impact cap are deliberate transient-contact QA material values.
        // Two 45-degree faces are actual native fixtures, not manually delivered contacts.
        const spec = { ...data.OBJECTS.basketball, friction: 0, restitution: 1,
            adhesion: { ...data.OBJECTS.basketball.adhesion, maxImpactSpeed: 100 } };
        const nativeContacts = new Set(), events = [], cancellations = [], ca = w.contactAssistance;
        let maxContacts = 0, owner = null;
        const originalEnd = ca.endContact.bind(ca);
        ca.endContact = (record, contact) => {
            const pending = [...ca.pendingAdhesion.entries()].filter(([, p]) => p.ball === record && p.contact === contact);
            originalEnd(record, contact);
            if (pending.length) cancellations.push({ id: record.id, nativeBeforeEnd: nativeContacts.size,
                keys: pending.map(([key]) => key), allCancelled: pending.every(([key]) => !ca.pendingAdhesion.has(key)),
                bonds: ca.bonds.size });
        };
        const attempts = [];
        try {
            for (const start of [58, 60, 63, 67, 72]) {
                nativeContacts.clear();
                owner = w.create(spec, 0, start);
                const body = owner, firstCancellation = cancellations.length;
                body.collider.on(cc.Contact2DType.BEGIN_CONTACT, (_self, other, contact) => {
                    if (other !== support) return; nativeContacts.add(contact); maxContacts = Math.max(maxContacts, nativeContacts.size);
                    events.push({ type: 'begin', id: body.id, active: nativeContacts.size });
                });
                body.collider.on(cc.Contact2DType.PRE_SOLVE, (_self, other, contact) => {
                    if (other !== support) return;
                    events.push({ type: 'pre', id: body.id, active: nativeContacts.size,
                        pendingThisContact: [...ca.pendingAdhesion.values()].some(p => p.ball === body && p.contact === contact) });
                });
                body.collider.on(cc.Contact2DType.END_CONTACT, (_self, other, contact) => {
                    if (other !== support) return; nativeContacts.delete(contact);
                    events.push({ type: 'end', id: body.id, active: nativeContacts.size,
                        pendingRetained: [...ca.pendingAdhesion.values()].some(p => p.ball === body && p.contact === contact) });
                });
                w.release(body); body.body.gravityScale = 0; body.body.linearVelocity = new cc.Vec2(0, -20);
                await h.wait(({ elapsed }) => elapsed >= .22);
                attempts.push({ start, id: body.id, end: h.snapshot(w, body), cancellations: cancellations.slice(firstCancellation), bonds: ca.bonds.size });
                if (cancellations.some(c => c.allCancelled && c.nativeBeforeEnd >= 2)) break;
                body.collider.enabled = false; body.node.active = false;
                await h.wait(({ frames }) => frames >= 2);
            }
            const result = { fixture: 'Dynamic basketball with deliberately elastic QA contact parameters strikes a concave V containing two real native fixture faces. Ordinary Cocos runs 1/240s physics, max8, target30fps so transient PRE→END can occur before afterPhysics. endContact wrapper only records and forwards the actual production call.',
                fixtureCount: support.impl._fixtures.length, maxContacts, cancellations, attempts, events, oldPhysics,
                fixturePhysics: { fixedTimeStep: physics.fixedTimeStep, maxSubSteps: physics.maxSubSteps, frameRate: cc.game.frameRate } };
            h.last = result;
            h.check(result.fixtureCount >= 2 && maxContacts >= 2, 'Did not establish actual concave multi-fixture contacts', result);
            h.check(cancellations.some(c => c.allCancelled && c.nativeBeforeEnd >= 2), 'No actual pending support contact ended while another native contact remained; do not claim cancellation coverage', result);
            h.check(events.filter(e => e.type === 'end').every(e => !e.pendingRetained), 'Ended pooled contact retained in pending glue', result);
            return result;
        } finally {
            ca.endContact = originalEnd; physics.fixedTimeStep = oldPhysics.fixedTimeStep; physics.maxSubSteps = oldPhysics.maxSubSteps;
            physics.resetAccumulator(); cc.game.frameRate = oldPhysics.frameRate;
        }
    });
}
(async () => {
    try {
        save(); browser = await chromium.launch({ headless: true, args: ['--disable-frame-rate-limit', '--disable-gpu-vsync'] });
        page = await browser.newPage({ viewport: { width: 375, height: 667 }, hasTouch: true });
        page.on('pageerror', e => report.errors.push(String(e)));
        await page.goto('http://127.0.0.1:8767/preparation/review/play-player.html?contact-depth-r1');
        await page.waitForFunction(() => !!window.qaLoad, null, { timeout: 45000 }); await install();
        await run('detached_glue_group', detachedGlueGroup);
        await run('joint_presolve_isolation', motorIsolation);
        await run('concave_pending_end', concavePendingEnd);
        report.buildAfter = packageHash();
        report.buildUnchanged = report.buildAfter.sha256 === report.buildBefore.sha256;
        report.status = !report.buildUnchanged || report.errors.length || report.cases.some(c => c.status !== 'passed') ? 'failed_or_incomplete' : 'passed_directed_contact_regressions';
        if (report.status === 'failed_or_incomplete') process.exitCode = 1;
    } catch (e) { report.status = 'failed_or_incomplete'; report.failure = String(e.stack || e); process.exitCode = 1; }
    finally { report.finishedAt = new Date().toISOString(); save(); await browser?.close();
        process.stdout.write(JSON.stringify({ profile, status: report.status, buildUnchanged: report.buildUnchanged, cases: report.cases.map(c => ({ id: c.id, status: c.status, error: c.error })), errors: report.errors }) + '\n'); }
})();
