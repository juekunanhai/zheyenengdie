/** Directed fixtures in the real Cocos/Box2D build; fixtures remain outside game assets. */
const { chromium } = require('/Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ROOT = path.resolve(__dirname, '../..');
const report = { status: 'running', checks: [], errors: [] };
let browser, page;
const wait = ms => page.evaluate(ms => new Promise(r => setTimeout(r, ms)), ms);
const add = (name, evidence) => { report.checks.push({ name, status: 'passed', evidence }); process.stdout.write(`${name}: passed\n`); };
async function fresh() {
    await page.evaluate(() => window.qaLoad('HUD'));
    await page.waitForFunction(() => window.qaGame()?.snapshot().phase === 'planning');
    await page.evaluate(async () => {
        const cc = window.qaCC, game = window.qaGame();
        game.enabled = false; game.world.dispose();
        await new Promise(r => requestAnimationFrame(r));
        const { TowerWorld } = await System.import('chunks:///_virtual/tower-world.ts');
        const { OBJECTS } = await System.import('chunks:///_virtual/object-data.ts');
        window.fixture = new TowerWorld(cc.director.getScene()); window.objectSpecs = OBJECTS;
        game.world = window.fixture; game.current = null;
        window.fixturePaint = () => game.display.update(1 / 60, window.fixture.bodies, null, 1);
        cc.director.on(cc.Director.EVENT_AFTER_PHYSICS, window.fixturePaint);
    });
}
async function clearPaint() {
    await page.evaluate(() => {
        const cc = window.qaCC;
        cc.director.off(cc.Director.EVENT_AFTER_PHYSICS, window.fixturePaint);
    });
}
async function spawn(kind, x, y, angle = 0) {
    return page.evaluate(({ kind, x, y, angle }) => {
        const r = window.fixture.create(window.objectSpecs[kind], x, y);
        r.node.setRotationFromEuler(0, 0, angle);
        window.fixture.release(r); return r.id;
    }, { kind, x, y, angle });
}
async function state() {
    return page.evaluate(() => window.fixture.bodies.map(r => ({ id: r.id, kind: r.spec.kind,
        x: r.node.position.x, y: r.node.position.y, vx: r.body.linearVelocity.x, vy: r.body.linearVelocity.y,
        angle: Math.atan2(2 * r.node.rotation.w * r.node.rotation.z, 1 - 2 * r.node.rotation.z ** 2) * 180 / Math.PI,
        contacts: r.contacts.size, type: r.body.type, mass: r.body.getMass(), scale: r.node.worldScale.x,
        bounds: window.fixture.bounds(r) })));
}
async function boxAndBridge() {
    await fresh();
    await spawn('cardboard_box', 0, 250);
    await page.waitForFunction(() => window.fixture.isStable(), null, { timeout: 8000 });
    let s = await state(); assert.ok(Math.abs(s[0].y - 50) < 1);
    add('centered_box_support', s); await clearPaint();
    await fresh(); await spawn('cardboard_box', 100, 250); await wait(2200);
    s = await state(); assert.ok(s[0].y < -100); assert.ok(Math.abs(s[0].angle) > 10);
    add('unsupported_edge_tips_and_falls', s); await clearPaint();
    await fresh();
    await spawn('cardboard_box', -58, 50.5); await spawn('cardboard_box', 58, 50.5);
    await wait(800); await spawn('wood_plank', 0, 290);
    await page.waitForFunction(() => window.fixture.isStable(), null, { timeout: 10000 });
    s = await state();
    assert.ok(s[2].contacts >= 2); assert.ok(Math.abs(s[2].angle) < 1); assert.ok(s[2].y > 113 && s[2].y < 117);
    add('wood_plank_bridges_two_supports', s);
    await page.screenshot({ path: path.join(ROOT, 'preparation/review/evidence/batch1a/07-bridge.png') });
    await clearPaint();
}
async function ballAndFridge() {
    await fresh();
    await page.evaluate(() => { window.fixture.platform.node.setRotationFromEuler(0, 0, -8); });
    await spawn('basketball', 0, 100);
    await page.waitForFunction(() => window.fixture.isStable() && window.fixture.bonds.size === 1, null, { timeout: 8000 });
    const ball = (await state())[0];
    assert.ok(ball.contacts > 0 && ball.y > 20 && ball.type === 2);
    const radius = await page.evaluate(() => window.fixture.bodies[0].collider.radius);
    assert.equal(radius, 34);
    add('adhesive_circle_keeps_real_shape_on_inclined_support', { ball, radius }); await clearPaint();
    await fresh(); await spawn('fridge', 0, 230);
    await page.waitForFunction(() => window.fixture.isStable(), null, { timeout: 8000 });
    const fridge = (await state())[0]; assert.ok(Math.abs(fridge.y - 72.5) < 1); assert.ok(fridge.mass > 10);
    add('fridge_centered_mass_and_landing', fridge); await clearPaint();
    await fresh(); await spawn('fridge', 95, 230); await wait(2400);
    const edge = (await state())[0]; assert.ok(edge.y < -100); assert.ok(Math.abs(edge.angle) > 10);
    add('fridge_overhang_is_not_artificially_stabilized', edge); await clearPaint();
}
async function fullTower() {
    await fresh();
    for (let i = 0; i < 6; i++) await spawn('cardboard_box', 0, 50.5 + 100.5 * i);
    await page.waitForFunction(() => window.fixture.isStable(), null, { timeout: 15000 });
    await page.evaluate(() => window.qaGame().display.follow(900));
    await wait(900);
    const before = await state();
    assert.equal(before.length, 6); assert.ok(before.every(r => r.type === 2 && Math.abs(r.scale - 1) < 1e-8));
    const view = await page.evaluate(() => window.qaGame().display.snapshot());
    const firstScreenY = view.originY + (before[0].y - view.cameraY) * view.scale;
    assert.ok(firstScreenY < -view.height / 2);
    await page.screenshot({ path: path.join(ROOT, 'preparation/review/evidence/batch1a/08-offscreen-support.png') });
    await page.evaluate(() => {
        const cc = window.qaCC, r = window.fixture.bodies[0];
        // A small impulse is absorbed by platform friction under six boxes. This deliberately
        // large external perturbation tests transmission, not natural difficulty balancing.
        r.body.applyLinearImpulse(new cc.Vec2(150, 0), r.body.getWorldCenter(new cc.Vec2()), true);
    });
    await wait(700);
    const after = await state();
    assert.equal(after.length, 6); assert.ok(Math.abs(after[0].x - before[0].x) > 10);
    assert.ok(Math.abs(after[5].x - before[5].x) + Math.abs(after[5].y - before[5].y) > 3);
    add('offscreen_dynamic_support_transmits_motion', { before, after, view, firstScreenY });
    await clearPaint();
}
async function main() {
    try {
        browser = await chromium.launch({ headless: true });
        page = await browser.newPage({ viewport: { width: 375, height: 667 } });
        page.on('pageerror', e => report.errors.push(String(e)));
        await page.goto('http://127.0.0.1:8767/preparation/review/play-player.html');
        await page.waitForFunction(() => !!window.qaLoad, null, { timeout: 45000 });
        await boxAndBridge(); await ballAndFridge(); await fullTower();
        assert.deepEqual(report.errors, []); report.status = 'passed_directed_fixtures_only';
    } catch (e) { report.status = 'failed'; report.failure = String(e.stack || e); report.lastState = await state().catch(() => null); process.exitCode = 1; }
    finally {
        fs.mkdirSync(path.join(ROOT, 'preparation/review/evidence/batch1a'), { recursive: true });
        fs.writeFileSync(path.join(ROOT, 'preparation/review/evidence/batch1a/PHYSICS.json'), JSON.stringify(report, null, 2) + '\n');
        process.stdout.write(JSON.stringify({ status: report.status, checks: report.checks.length, failure: report.failure, errors: report.errors }) + '\n');
        await browser?.close();
    }
}
main();
