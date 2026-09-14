/** Actual Chromium + built Cocos integration checks. No mocked physics or gameplay. */
const { chromium } = require('/Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ROOT = path.resolve(__dirname, '../..');
const output = path.join(ROOT, 'preparation/review/evidence/batch1a');
fs.mkdirSync(output, { recursive: true });
const report = { status: 'running', source: 'actual_Creator_Web_build', checks: [], errors: [], browserWarnings: [], captures: [] };
let browser, page;
const add = (name, evidence) => { report.checks.push({ name, status: 'passed', evidence }); process.stdout.write(`${name}: passed\n`); };
const snapshot = () => page.evaluate(() => window.qaSnapshot());
const waitGame = (predicate, timeout = 15000) => page.waitForFunction(predicate, null, { timeout });
const waitReal = ms => page.evaluate(ms => new Promise(resolve => setTimeout(resolve, ms)), ms);

async function capture(name) {
    const file = path.join(output, `${name}.png`);
    await page.screenshot({ path: file });
    report.captures.push(path.relative(ROOT, file));
}
async function buttonPoint(name) {
    return page.evaluate(name => {
        const cc = window.qaCC, canvas = cc.director.getScene().getChildByName('Canvas');
        const nodes = [canvas]; let found;
        while (nodes.length) { const n = nodes.shift(); if (n.name === name) { found = n; break; } nodes.push(...n.children); }
        if (!found) throw Error(`Missing node ${name}`);
        const camera = canvas.getComponent(cc.Canvas).cameraComponent;
        const p = camera.worldToScreen(found.worldPosition);
        const rect = cc.game.canvas.getBoundingClientRect();
        return { x: rect.left + p.x / cc.game.canvas.width * rect.width,
            y: rect.top + (1 - p.y / cc.game.canvas.height) * rect.height };
    }, name);
}
async function tap(name) {
    const p = await buttonPoint(name); await page.touchscreen.tap(p.x, p.y);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function loadHud() {
    await page.evaluate(() => window.qaLoad('HUD'));
    await waitGame(() => window.qaGame()?.snapshot().phase === 'planning');
}
async function boot() {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 375, height: 667 }, hasTouch: true });
    page = await context.newPage();
    page.on('pageerror', e => report.errors.push(String(e)));
    page.on('console', m => {
        if (m.type() !== 'error') return;
        if (m.text().startsWith('Ignored attempt to cancel a touchcancel event with cancelable=false')) report.browserWarnings.push(m.text());
        else report.errors.push(m.text());
    });
    await page.goto('http://127.0.0.1:8767/preparation/review/play-player.html');
    await page.waitForFunction(() => !!window.qaLoad, null, { timeout: 45000 });
    await tap('btn_start');
    await waitGame(() => window.qaGame()?.snapshot().phase === 'planning');
    const s = await snapshot();
    assert.equal(s.engine, '3.8.8'); assert.equal(s.physics.gravity.y, -1000);
    assert.equal(s.physics.auto, true); assert.equal(s.physics.maxSubSteps, 4);
    assert.equal(s.game.bodies.length, 1); assert.equal(s.game.peakMetres, 0);
    add('ground_start_and_engine_settings', s);
}
async function inputAndTutorial() {
    await waitReal(4200);
    let s = (await snapshot()).game;
    assert.equal(s.phase, 'planning'); assert.equal(s.releases, 0); assert.equal(s.secondsLeft, 4);
    add('first_object_tutorial_exemption', s.secondsLeft);
    await tap('hud_rotate_90');
    s = (await snapshot()).game;
    assert.ok(Math.abs(s.bodies[0].angle + 90) < .001); assert.equal(s.releases, 0);
    await tap('hud_rotate_90');
    let rotated = (await snapshot()).game.bodies[0];
    assert.ok(Math.abs(Math.abs(rotated.angle) - 180) < .001);
    assert.ok(rotated.physicsAxis.x < -.99);
    for (let i = 0; i < 2; i++) await tap('hud_rotate_90');
    assert.ok(Math.abs((await snapshot()).game.bodies[0].angle) < .001);
    add('rotate_button_consumes_touch', { rotations: 4, releases: 0 });
    // Cancelled drag must leave the object held; only the matching pointer may release it.
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 185, y: 280, id: 11 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 205, y: 280, id: 11 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    s = (await snapshot()).game;
    assert.equal(s.releases, 0); assert.ok(s.bodies[0].position.x > 10);
    add('cancelled_drag_keeps_object', s.bodies[0].position.x);
    await page.evaluate(() => window.qaGame().moveTo(0));
    await capture('01-ground-planning');
    await page.touchscreen.tap(185, 125);
    await waitGame(() => window.qaGame()?.snapshot().placed === 1);
    s = (await snapshot()).game;
    assert.equal(s.releases, 1); assert.ok(Math.abs(s.peakMetres - 1) < .03);
    assert.equal(s.bodies[0].type, 2); assert.ok(Math.abs(s.bodies[0].scale.x - 1) < 1e-9);
    assert.ok(Math.abs(s.bodies[0].bounds.bottom) < 1);
    add('tap_releases_once_and_box_lands', s.bodies[0]);
    await waitGame(() => window.qaGame()?.snapshot().phase === 'planning');
    await waitReal(4200);
    s = (await snapshot()).game;
    assert.equal(s.releases, 1); assert.equal(s.secondsLeft, 4);
    const top = s.bodies[1].bounds.top;
    await tap('hud_rotate_90');
    s = (await snapshot()).game;
    assert.ok(Math.abs(s.bodies[1].bounds.top - top) < .01);
    assert.ok(s.bodies[1].bounds.bottom - s.bodies[0].bounds.top > 180);
    await capture('02-plank-rotated');
    for (let i = 0; i < 3; i++) await tap('hud_rotate_90');
    add('second_exemption_and_rotated_clearance', { top, lowest: s.bodies[1].bounds.bottom });
    await tap('hud_pause');
    await page.evaluate(() => { const cc = window.qaCC; cc.game.emit(cc.Game.EVENT_HIDE); cc.game.emit(cc.Game.EVENT_SHOW); });
    assert.equal((await snapshot()).game.paused, true);
    await waitReal(800);
    assert.equal((await snapshot()).game.releases, 1);
    await tap('hud_pause');
    await page.touchscreen.tap(180, 125);
    await waitGame(() => window.qaGame()?.snapshot().placed === 2);
    await waitGame(() => window.qaGame()?.snapshot().phase === 'planning');
    await capture('03-two-landings');
    add('manual_pause_survives_background_return', true);
}
async function countdownAndNext() {
    await waitReal(750);
    const before = (await snapshot()).game;
    assert.ok(before.secondsLeft < 3.8 && before.secondsLeft > 0);
    await tap('hud_pause');
    const paused = (await snapshot()).game.secondsLeft;
    await waitReal(1200);
    assert.equal((await snapshot()).game.secondsLeft, paused);
    await tap('hud_pause'); await tap('hud_rotate_90');
    const after = (await snapshot()).game;
    assert.ok(after.secondsLeft <= paused); assert.equal(after.releases, 2);
    for (let i = 0; i < 3; i++) await tap('hud_rotate_90');
    await waitGame(() => window.qaGame()?.snapshot().releases === 3, 8000);
    add('third_countdown_pause_rotation_and_auto_release', { before: before.secondsLeft, paused });
    await waitGame(() => window.qaGame()?.snapshot().placed === 3);
    const s = (await snapshot()).game;
    assert.ok(s.bodies[2].mass > s.bodies[0].mass);
    await waitGame(() => window.qaGame()?.snapshot().phase === 'planning');
    await capture('04-fridge-landed-ball-held');
    add('fridge_mass_and_stable_landing', s.bodies[2]);
    await page.evaluate(() => window.qaGame().release());
    const radius = (await snapshot()).game.bodies[3].size;
    assert.deepEqual(radius, [68, 68]);
    await waitGame(() => window.qaGame()?.snapshot().placed === 4);
    add('basketball_collision_and_settling', (await snapshot()).game.bodies[3]);
    await waitGame(() => window.qaGame()?.snapshot().phase === 'planning');
    await page.touchscreen.tap(187, 180);
    await waitGame(() => window.qaGame()?.snapshot().placed === 5);
    const adhesive = await page.evaluate(() => ({ snapshot: qaGame().snapshot(), bonds: qaGame().world.bonds.size }));
    assert.equal(adhesive.bonds, 2); assert.equal(adhesive.snapshot.releases, 5);
    await capture('19-live-five-landings');
    add('fifth_touch_drop_settles_with_both_native_adhesion_bonds', adhesive);
    await page.evaluate(() => window.qaGame().finish());
    await page.waitForFunction(() => window.qaSnapshot().scene === 'Result');
    await capture('05-result');
    await tap('result_btn_retry');
    await waitGame(() => window.qaGame()?.snapshot().phase === 'planning');
    assert.equal((await snapshot()).game.tutorial, false);
    assert.equal((await snapshot()).game.placed, 0);
    add('end_retry_resets_world_keeps_tutorial_completion', (await snapshot()).game);
}
async function resizeAndStall() {
    await page.evaluate(() => window.qaGame().release());
    await waitGame(() => window.qaGame()?.snapshot().placed === 1);
    await waitGame(() => window.qaGame()?.snapshot().phase === 'planning');
    const towerBefore = (await snapshot()).game;
    await page.setViewportSize({ width: 375, height: 812 });
    await waitReal(400);
    const live = (await snapshot()).game;
    assert.equal(live.placed, 1); assert.equal(live.bodies.length, 2);
    assert.ok(Math.abs(live.bodies[0].position.y - towerBefore.bodies[0].position.y) < 1);
    assert.deepEqual(live.bodies[0].size, towerBefore.bodies[0].size);
    assert.ok(Math.abs(live.view.width / live.view.height - 375 / 812) < .01);
    assert.ok(Math.abs(live.bodies[1].bounds.top - live.boundary.top) < .01);
    assert.ok(Math.abs(live.boundary.top - towerBefore.boundary.top) > 1);
    add('live_resize_preserves_tower_and_refreshes_held_boundary', { before: towerBefore.boundary, after: live.boundary });
    for (const [width, height] of [[375, 812], [600, 800], [375, 667]]) {
        await page.setViewportSize({ width, height });
        await waitReal(350);
        await loadHud();
        const s = (await snapshot()).game;
        assert.ok(Math.abs(s.bodies[0].scale.x - 1) < 1e-9); assert.deepEqual(s.bodies[0].size, [100, 100]);
        assert.ok(Math.abs(s.view.width / s.view.height - width / height) < .01);
        await capture(`06-size-${width}-${height}`);
        add(`resize-${width}-${height}`, { view: s.view, body: s.bodies[0].size });
    }
    await page.evaluate(() => { const end = performance.now() + 450; while (performance.now() < end) {} });
    await waitReal(100);
    const before = (await snapshot()).game.secondsLeft;
    await waitReal(300);
    const elapsed = before - (await snapshot()).game.secondsLeft;
    assert.ok(elapsed < .6);
    add('stall_does_not_leave_countdown_catchup', elapsed);
}
async function main() {
    try {
        await boot(); await inputAndTutorial(); await countdownAndNext(); await resizeAndStall();
        assert.deepEqual(report.errors, []);
        report.status = 'passed_tested_scope_only';
    } catch (error) {
        report.status = 'failed'; report.failure = String(error.stack || error);
        if (page) { report.lastSnapshot = await snapshot().catch(() => null); await capture('failure').catch(() => {}); }
        process.exitCode = 1;
    } finally {
        report.not_proven = ['Subjective audio or real audio playback', 'WeChat device behavior', 'Incident and star rules', 'Long-session performance'];
        fs.writeFileSync(path.join(output, 'INTEGRATION.json'), JSON.stringify(report, null, 2) + '\n');
        process.stdout.write(JSON.stringify({ status: report.status, checks: report.checks.length, failure: report.failure, errors: report.errors }) + '\n');
        await browser?.close();
    }
}
main();
