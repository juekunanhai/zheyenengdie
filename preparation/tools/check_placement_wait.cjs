/** Placement waiting regressions against the built Cocos runtime and native Box2D.
 * Velocity injection below is a bounded QA disturbance, not a replacement physics
 * result: real contacts, controller update, camera, scoring and scene transitions run.
 */
const { chromium } = require('/Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'preparation/review/evidence/placement-wait-r1');
const REPORT_FILE = process.env.WAIT_CASE ? 'WAIT-' + process.env.WAIT_CASE + '.json' : 'WAIT.json';
const SIX = ['cardboard_box', 'wood_plank', 'toilet', 'fridge', 'dumbbell', 'basketball'];
const report = { status: 'running', createdAt: new Date().toISOString(),
    method: 'Ordinary Cocos automatic frames and native Box2D. QA may apply alternating 0.18 m/s horizontal velocity after real contact (0.8 m/s only in the named horizontal-top case); it never replaces isStable, contact lists, scoring, or spawn decisions. Timer measurements use active Cocos frame time. Forced escape/hop cases are directed regression fixtures, not difficulty claims.',
    checks: [], errors: [], captures: [] };
let browser, page;
async function read() { return page.evaluate(() => window.waitProbe.read()); }
async function until(fn, timeout = 12000) { return page.waitForFunction(fn, null, { timeout }); }
async function start({ tutorial = false, untimed = true, sequence = SIX } = {}) {
    await page.evaluate(() => { window.waitProbe?.dispose(); });
    await page.evaluate(tutorial => { localStorage.setItem('zhynd.local-settings.v1', JSON.stringify({ tutorialDone: !tutorial, music: false, sound: false, vibration: false })); }, tutorial);
    await page.evaluate(() => qaLoad('HUD'));
    await until(() => qaGame()?.snapshot().phase === 'planning');
    assert.equal(await page.evaluate(({sequence,untimed}) => qaGame().configureCalibration(sequence, untimed), {sequence,untimed}), true);
    await page.evaluate(() => {
        const cc = qaCC, g = qaGame();
        const p = window.waitProbe = { g, time: 0, frames: 0, firstContact: {}, transitions: [], contacts: [],
            samples: [], sway: false, swayIds: null, initialStableMethod: g.world.isStable,
            lastPhase: null, lastCurrent: null, lastContacts: {}, last: g.snapshot() };
        const afterUpdate = () => {
            p.time += cc.director.getDeltaTime(); p.frames++;
            if (!cc.isValid(g, true)) return;
            const s = g.snapshot(); p.last = s;
            if (s.phase !== p.lastPhase || s.currentId !== p.lastCurrent) {
                p.transitions.push({ time: p.time, state: s }); p.lastPhase = s.phase; p.lastCurrent = s.currentId;
            }
            if (p.frames % 12 === 0) p.samples.push({ time: p.time, state: s });
        };
        const afterPhysics = () => {
            if (!cc.isValid(g, true) || g.lifecycle.paused) return;
            for (const b of g.world.bodies) {
                if (!b.collider.enabled) continue;
                if (b.contacts.size && p.firstContact[b.id] === undefined) p.firstContact[b.id] = p.time;
                if (p.lastContacts[b.id] !== b.contacts.size) {
                    p.contacts.push({ time: p.time, id: b.id, count: b.contacts.size }); p.lastContacts[b.id] = b.contacts.size;
                }
                if (p.sway && p.firstContact[b.id] !== undefined && (!p.swayIds || p.swayIds.includes(b.id))) {
                    b.body.linearVelocity = new cc.Vec2((p.frames % 2 ? 1 : -1) * (p.swaySpeed || .18), b.body.linearVelocity.y);
                    b.body.wakeUp();
                }
            }
        };
        cc.director.on(cc.Director.EVENT_AFTER_UPDATE, afterUpdate);
        cc.director.on(cc.Director.EVENT_AFTER_PHYSICS, afterPhysics);
        p.read = () => ({ time: p.time, frames: p.frames, firstContact: p.firstContact,
            transitions: p.transitions, contacts: p.contacts, samples: p.samples,
            stableMethodUnchanged: p.initialStableMethod === g.world.isStable,
            state: cc.isValid(g, true) ? g.snapshot() : p.last, scene: cc.director.getScene()?.name });
        p.dispose = () => { cc.director.off(cc.Director.EVENT_AFTER_UPDATE, afterUpdate);
            cc.director.off(cc.Director.EVENT_AFTER_PHYSICS, afterPhysics); if (cc.isValid(g, true) && g.lifecycle.paused) g.lifecycle.togglePause(); };
    });
}
async function capture(name) {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.screenshot({ path: path.join(OUT, name + '.png') }); report.captures.push(name + '.png');
}
async function check(name, action) {
    const entry = { name, status: 'running' }; report.checks.push(entry);
    try { entry.evidence = await action(); entry.status = 'passed'; }
    catch (error) { entry.status = 'failed'; entry.error = String(error.stack || error); entry.evidence = await read().catch(() => null); }
    fs.writeFileSync(path.join(OUT, REPORT_FILE), JSON.stringify(report, null, 2) + '\n');
    process.stdout.write(name + ': ' + entry.status + (entry.error ? '\n' + entry.error : '') + '\n');
}
async function waitActive(seconds) {
    const target = await page.evaluate(seconds => waitProbe.time + seconds, seconds);
    await page.waitForFunction(target => waitProbe.time >= target, target);
}
function enteredFor(p, id) { return p.transitions.find(t => t.state.currentId === id && t.state.phase === 'entering'); }
function planningFor(p, id) { return p.transitions.find(t => t.state.currentId === id && t.state.phase === 'planning'); }

async function precontact() {
    await start();
    await page.evaluate(() => { const g = qaGame(); g.release(); g.current.body.gravityScale = 0; });
    await waitActive(1.85);
    const p = await read(); assert.equal(p.state.phase, 'falling'); assert.equal(p.state.bodies.length, 1);
    assert.deepEqual(p.firstContact, {}); assert.equal(p.state.placed, 0); assert.equal(p.state.peakMetres, 0);
    assert.equal(p.state.observationSeconds, null);
    return p;
}
async function stableAdvance() {
    await start(); await page.evaluate(() => qaGame().release());
    await until(() => qaGame()?.snapshot().currentId === 2 && qaGame().snapshot().phase === 'planning');
    const p = await read(), entered = enteredFor(p, 2), planning = planningFor(p, 2);
    assert.ok(entered && planning); assert.ok(entered.time - p.firstContact[1] < 1.5);
    assert.ok(planning.time - entered.time >= .22 && planning.time - entered.time < .34);
    assert.equal(p.state.placed, 1); assert.ok(p.state.peakMetres > 0);
    return { contactToEnter: entered.time - p.firstContact[1], contactToPlanning: planning.time - p.firstContact[1], probe: p };
}
async function gentleTimeout() {
    await start(); await page.evaluate(() => { waitProbe.sway = true; waitProbe.swayIds = [1]; qaGame().release(); });
    await until(() => qaGame()?.snapshot().currentId === 2 && qaGame().snapshot().phase === 'planning');
    const waiting = await read(), entered = enteredFor(waiting, 2), planning = planningFor(waiting, 2);
    assert.ok(waiting.stableMethodUnchanged); assert.ok(entered);
    assert.ok(entered.time - waiting.firstContact[1] >= 1.45 && entered.time - waiting.firstContact[1] < 1.62);
    assert.ok(planning.time - waiting.firstContact[1] < 1.92);
    assert.equal(waiting.state.placed, 0); assert.equal(waiting.state.peakMetres, 0);
    assert.equal(waiting.state.bodies[0].placed, false); assert.ok(waiting.state.bodies[0].contacts > 0);
    assert.equal(waiting.state.bodies[0].contactSeconds, 1.5);
    await capture('light-sway-next-without-score');
    await page.evaluate(() => { waitProbe.sway = false; });
    await until(() => qaGame()?.snapshot().placed === 1); const qualified = await read();
    assert.ok(qualified.state.peakMetres > 0); assert.equal(qualified.state.currentId, 2);
    assert.equal(qualified.state.view.targetCameraY, waiting.state.view.targetCameraY);
    await waitActive(.9); const later = await read(); assert.equal(later.state.placed, 1);
    assert.equal(later.state.peakMetres, qualified.state.peakMetres);
    return { contactToEnter: entered.time - waiting.firstContact[1], contactToPlanning: planning.time - waiting.firstContact[1], waiting, qualified, later };
}
async function contactHop() {
    await start(); await page.evaluate(() => { waitProbe.sway = true; waitProbe.swayIds = [1]; qaGame().release(); });
    await until(() => waitProbe.firstContact[1] !== undefined && waitProbe.time - waitProbe.firstContact[1] > .45);
    const hopTime = await page.evaluate(() => { qaGame().world.bodies[0].body.linearVelocity = new qaCC.Vec2(0, .8); return waitProbe.time; });
    await until(() => qaGame()?.snapshot().currentId === 2 && qaGame().snapshot().phase === 'planning');
    const p = await read(), entered = enteredFor(p, 2);
    assert.ok(p.contacts.some(c => c.id === 1 && c.count === 0 && c.time > hopTime));
    assert.ok(p.contacts.some(c => c.id === 1 && c.count > 0 && c.time > hopTime + .01));
    assert.ok(entered.time - p.firstContact[1] < 1.65, 'Brief native contact interruption must not restart the observation limit');
    assert.equal(p.state.placed, 0); return { hopTime, contactToEnter: entered.time - p.firstContact[1], probe: p };
}
async function pauseClock() {
    await start(); await page.evaluate(() => { waitProbe.sway = true; waitProbe.swayIds = [1]; qaGame().release(); });
    await until(() => waitProbe.firstContact[1] !== undefined && waitProbe.time - waitProbe.firstContact[1] > .4);
    await page.evaluate(() => qaGame().lifecycle.togglePause()); const before = await read();
    // Deliberate wall time: native Cocos should produce no gameplay frames while paused.
    await page.waitForTimeout(1800); const paused = await read();
    assert.equal(paused.time, before.time); assert.equal(paused.state.currentId, 1); assert.equal(paused.state.paused, true);
    assert.deepEqual(paused.state.bodies[0].position, before.state.bodies[0].position);
    assert.equal(paused.state.bodies[0].contactSeconds, before.state.bodies[0].contactSeconds);
    await page.evaluate(() => qaGame().lifecycle.togglePause());
    await until(() => qaGame()?.snapshot().currentId === 2 && qaGame().snapshot().phase === 'planning');
    const resumed = await read(), entered = enteredFor(resumed, 2);
    assert.ok(entered.time - resumed.firstContact[1] < 1.65); return { before, paused, resumed };
}
async function lowFrameRate() {
    const original = await page.evaluate(() => qaCC.game.frameRate);
    try {
        // Public engine frame-rate API. The actual native simulation and controller
        // still run together; this does not substitute a hand-written physics loop.
        await page.evaluate(() => { qaCC.game.frameRate = 10; });
        await start(); await page.evaluate(() => { waitProbe.sway = true; waitProbe.swayIds = [1]; qaGame().release(); });
        await until(() => qaGame()?.snapshot().currentId === 2 && qaGame().snapshot().phase === 'planning', 15000);
        const p = await read(), entered = enteredFor(p, 2), planning = planningFor(p, 2);
        const seconds = entered.time - p.firstContact[1];
        assert.ok(seconds >= 1.45 && seconds < 1.85, '10 FPS must not stretch a 1.5-second limit to 2.2+ seconds');
        assert.ok(planning.time - entered.time < .5); assert.equal(p.state.placed, 0);
        return { configuredFrameRate: 10, contactToEnter: seconds, contactToPlanning: planning.time - p.firstContact[1], probe: p };
    } finally { await page.evaluate(value => { qaCC.game.frameRate = value; }, original); }
}
async function freeFallAndOldEscape() {
    await start({untimed:false}); await page.evaluate(() => { waitProbe.sway = true; waitProbe.swayIds = [1]; qaGame().release(); });
    await until(() => qaGame()?.snapshot().currentId === 2 && qaGame().snapshot().phase === 'planning');
    await page.evaluate(() => { waitProbe.sway = false; const b = qaGame().world.bodies[0]; b.body.linearVelocity = new qaCC.Vec2(12, -3); b.body.wakeUp(); });
    await until(() => { const g = qaGame(); return g && g.world.bodies[0].contacts.size === 0; });
    const before = await read(); await page.evaluate(() => { qaGame().planningLeft = .001; qaGame().release(); }); const guarded = await read();
    assert.equal(guarded.state.releases, 1, 'Held next body must not release during unmistakable older-body free fall');
    await until(() => !qaGame() || qaGame().snapshot().phase === 'ended');
    const after = await read(); assert.equal(after.state.releases, 1); assert.equal(after.state.bodies.length, 2);
    assert.equal(after.state.phase, 'ended'); assert.equal(after.state.placed, 0);
    return { before, guarded, after };
}
async function slidingTopClearance() {
    await start({sequence:['cardboard_box','wood_plank','cardboard_box','wood_plank','cardboard_box','wood_plank']});
    // Five released objects place the top above the initial placement band. A
    // short stack would pass on initial spare room even if its moving top was lost.
    for (let i = 0; i < 4; i++) {
        await page.evaluate(() => qaGame().release());
        await page.waitForFunction(id => qaGame()?.snapshot().currentId === id && qaGame().snapshot().phase === 'planning', i + 2);
    }
    await page.evaluate(() => { waitProbe.sway = true; waitProbe.swayIds = [5]; waitProbe.swaySpeed = .8; qaGame().release(); });
    await until(() => qaGame()?.snapshot().currentId === 6 && qaGame().snapshot().phase === 'planning');
    const after = await read(), rotations = [];
    assert.equal(after.state.bodies[4].placed, false); assert.ok(after.state.bodies[4].contacts > 0);
    for (let i = 0; i < 4; i++) {
        const pose = await page.evaluate(() => { const g = qaGame();
            const top = Math.max(0, ...g.world.bodies.filter(b => b.collider.enabled && b.contacts.size > 0).map(b => g.world.bounds(b).top));
            const held = g.world.bounds(g.current); return { top, held, gap: held.bottom-top, snapshot:g.snapshot() }; });
        rotations.push(pose); assert.ok(pose.gap >= 23.7, 'Contacting horizontal mover remains part of the required placement clearance');
        await page.evaluate(() => qaGame().rotate());
    }
    await capture('horizontal-top-next-rotation-clearance'); return { after, rotations };
}
async function currentEscape() {
    await start(); await page.evaluate(() => { waitProbe.sway = true; waitProbe.swayIds = [1]; qaGame().release(); });
    await until(() => waitProbe.firstContact[1] !== undefined);
    await page.evaluate(() => { waitProbe.sway = false; qaGame().current.body.linearVelocity = new qaCC.Vec2(14, -5); });
    await until(() => !qaGame() || qaGame().snapshot().phase === 'ended');
    const p = await read(); assert.equal(p.state.bodies.length, 1); assert.equal(p.state.releases, 1);
    assert.equal(p.state.phase, 'ended'); assert.equal(p.state.placed, 0); return p;
}
async function tutorialAndNext() {
    await start({ tutorial: true, untimed: false });
    await waitActive(4.3); assert.equal((await read()).state.releases, 0);
    await page.evaluate(() => qaGame().release());
    await until(() => qaGame()?.snapshot().currentId === 2 && qaGame().snapshot().phase === 'planning');
    await waitActive(4.3); const second = await read(); assert.equal(second.state.releases, 1);
    assert.equal(await page.evaluate(() => qaGame().display.next.spriteFrame.name), 'next_toilet');
    await page.evaluate(() => qaGame().release());
    await until(() => qaGame()?.snapshot().currentId === 3 && qaGame().snapshot().phase === 'planning');
    const third = await read(); assert.equal(third.state.bodies[2].kind, 'toilet');
    assert.equal(await page.evaluate(() => qaGame().display.next.spriteFrame.name), 'next_fridge');
    await until(() => qaGame()?.snapshot().releases === 3, 6500);
    const timed = await read(); return { second, third, timed };
}
async function continuousTimeouts() {
    await start(); await page.evaluate(() => { waitProbe.sway = true; waitProbe.swayIds = [1]; });
    const attempts = [];
    for (let i = 0; i < SIX.length; i++) {
        await until(() => qaGame()?.snapshot().phase === 'planning');
        const before = await page.evaluate(() => { const g = qaGame(), s = g.snapshot();
            const enabled = g.world.bodies.filter(b => b.collider.enabled);
            const top = Math.max(0, ...enabled.map(b => g.world.bounds(b).top));
            return { state: s, clearance: g.world.bounds(g.current).bottom - top,
                next: g.display.next.spriteFrame.name }; });
        assert.equal(before.state.bodies.at(-1).kind, SIX[i]);
        assert.equal(before.next, 'next_' + SIX[(i + 1) % SIX.length]);
        assert.ok(before.clearance >= 23.9, 'Held object needs the designed 24-unit release gap');
        await page.evaluate(() => { qaGame().moveTo(0); qaGame().release(); });
        await page.waitForFunction(id => !qaGame() || (qaGame().snapshot().currentId === id && qaGame().snapshot().phase === 'planning'), i + 2, {timeout:12000});
        const after = await read(); attempts.push({ before, after });
        assert.equal(after.state.currentId, i + 2); assert.equal(after.state.placed, 0);
        assert.equal(after.state.peakMetres, 0);
    }
    await capture('six-timeouts-camera-clearance');
    const waiting = await read(); assert.ok(waiting.state.view.targetCameraY > 100);
    await page.evaluate(() => { waitProbe.sway = false; });
    await until(() => qaGame()?.snapshot().placed === 6, 12000); const qualified = await read();
    assert.equal(qualified.state.view.targetCameraY, waiting.state.view.targetCameraY,
        'Delayed real stability at a high tower confirms score without moving the placement camera');
    assert.ok(qualified.state.peakMetres > 4); assert.equal(qualified.state.currentId, 7);
    return { attempts, waiting, qualified, caution: 'Alternating micro-velocity keeps first support below the strict scoring stability gate. This fixture verifies wait/score/camera behavior, not normal difficulty.' };
}
async function airborneCamera() {
    await start(); await page.evaluate(() => qaGame().release());
    await until(() => qaGame()?.snapshot().currentId === 2 && qaGame().snapshot().phase === 'planning');
    await waitActive(.8); const before = await read();
    await page.evaluate(() => { const b = qaGame().world.bodies[0]; b.body.linearVelocity = new qaCC.Vec2(0, 9); b.body.wakeUp(); });
    await waitActive(.25); const airborne = await read();
    assert.ok(airborne.state.bodies[0].bounds.top > before.state.bodies[0].bounds.top + 30);
    assert.ok(airborne.state.view.cameraY - before.state.view.cameraY < 1);
    assert.equal(airborne.state.peakMetres, before.state.peakMetres);
    return { before, airborne };
}
async function normalSix() {
    await start(); const attempts = [];
    for (let i = 0; i < SIX.length; i++) {
        await until(() => qaGame()?.snapshot().phase === 'planning');
        await page.evaluate(() => { qaGame().moveTo(0); qaGame().release(); });
        await page.waitForFunction(id => !qaGame() || (qaGame().snapshot().currentId === id && qaGame().snapshot().phase === 'planning'), i + 2, {timeout:14000});
        const p = await read(); attempts.push(p); assert.equal(p.state.currentId, i + 2);
    }
    await until(() => qaGame()?.snapshot().placed === 6, 10000);
    const p = await read(); assert.equal(p.state.releases, 6); assert.equal(p.state.bodies.length, 7);
    assert.equal(p.state.bodies.at(-1).kind, 'cardboard_box'); await capture('normal-six-complete');
    return { attempts, final: p };
}
async function main() {
    try {
        fs.mkdirSync(OUT, {recursive:true}); browser = await chromium.launch({headless:true});
        page = await browser.newPage({viewport:{width:375,height:667},hasTouch:true});
        page.on('pageerror', e => report.errors.push(String(e)));
        await page.goto('http://127.0.0.1:8767/preparation/review/play-player.html?revision=placement-wait-r1');
        await page.waitForFunction(() => !!window.qaLoad, null, {timeout:45000});
        report.engine = await page.evaluate(() => qaSnapshot());
        const cases = { precontact_does_not_start_deadline: precontact, stable_advance_before_deadline: stableAdvance,
            real_light_sway_times_out_without_scoring_then_scores_once: gentleTimeout,
            brief_native_contact_gap_does_not_reset_deadline: contactHop,
            paused_wall_time_does_not_advance_wait: pauseClock,
            ten_fps_wait_uses_real_active_seconds: lowFrameRate,
            older_unqualified_body_escape_blocks_release_and_ends: freeFallAndOldEscape,
            current_body_escape_never_forces_next: currentEscape,
            first_two_tutorial_exemptions_and_next_sequence: tutorialAndNext,
            repeated_deadlines_keep_camera_clearance_without_score: continuousTimeouts,
            contacting_horizontal_top_keeps_four_rotation_clearance: slidingTopClearance,
            transient_airborne_object_does_not_raise_camera_or_score: airborneCamera,
            ordinary_center_six_object_regression: normalSix };
        for (const [name, action] of Object.entries(cases)) {
            if (process.env.WAIT_CASE && !name.includes(process.env.WAIT_CASE)) continue;
            await check(name, action);
        }
        report.status = report.checks.every(c => c.status === 'passed') && !report.errors.length ? 'passed' : 'failed';
        if (report.status !== 'passed') process.exitCode = 1;
    } catch (error) { report.status = 'failed'; report.failure = String(error.stack || error); process.exitCode = 1; }
    finally {
        fs.writeFileSync(path.join(OUT, REPORT_FILE), JSON.stringify(report, null, 2) + '\n');
        await browser?.close(); process.stdout.write(JSON.stringify({status:report.status, checks:report.checks.map(c=>({name:c.name,status:c.status})),errors:report.errors,failure:report.failure})+'\n');
    }
}
main();
