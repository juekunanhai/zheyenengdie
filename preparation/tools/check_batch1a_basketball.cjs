/** Historical R3 friction/damping checks. Superseded by check_batch1a_adhesion.cjs after R4 approval.
 * Do not use its slope-roll or immediate contact-end expectations to accept the adhesive material. */
const { chromium } = require('/Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ROOT = path.resolve(__dirname, '../..');
const report = { status: 'running', checks: [], errors: [] };
let browser, page;
const add = (name, evidence) => {
    report.checks.push({ name, status: 'passed', evidence });
    process.stdout.write(name + ': passed\n');
};
async function fresh() {
    await page.evaluate(() => window.qaLoad('HUD'));
    await page.waitForFunction(() => window.qaGame()?.snapshot().phase === 'planning');
    await page.evaluate(async () => {
        const cc = window.qaCC, game = window.qaGame();
        game.enabled = false; game.audio.pause(true); game.world.dispose(); game.display.dispose();
        await new Promise(r => requestAnimationFrame(r));
        const { TowerWorld } = await System.import('chunks:///_virtual/tower-world.ts');
        const { OBJECTS, planarAngle } = await System.import('chunks:///_virtual/object-data.ts');
        window.fixture = game.world = new TowerWorld(cc.director.getScene());
        window.ballSpec = OBJECTS.basketball; game.current = null;
        window.readBall = () => {
            const r = window.ball;
            return { x: r.node.position.x, y: r.node.position.y, angle: planarAngle(r.node.rotation),
                vx: r.body.linearVelocity.x, vy: r.body.linearVelocity.y, omega: r.body.angularVelocity,
                contacts: [...r.contacts].map(c => c.node.name), damping: r.body.angularDamping,
                dynamic: r.body.type === cc.ERigidBody2DType.Dynamic, sleeping: !r.body.isAwake() };
        };
        window.physicsFrames = n => new Promise(resolve => {
            let elapsed = 0;
            const tick = () => {
                if (++elapsed < n) return;
                cc.director.off(cc.Director.EVENT_AFTER_PHYSICS, tick); resolve();
            };
            cc.director.on(cc.Director.EVENT_AFTER_PHYSICS, tick);
        });
    });
}
async function slopeSample(tape) {
    await fresh();
    await page.evaluate(tape => {
        const cc = window.qaCC, f = window.fixture;
        // Wide isolated support keeps both versions in contact during the comparison.
        f.platform.size = new cc.Size(1200, 24); f.platform.apply();
        f.platform.node.setRotationFromEuler(0, 0, -.5);
        const spec = tape ? window.ballSpec : { ...window.ballSpec, friction: .42, contactAngularDamping: undefined };
        window.ball = f.create(spec, 0, 100); f.release(window.ball);
    }, tape);
    await page.waitForFunction(() => window.ball.contacts.size > 0);
    const first = await page.evaluate(() => window.readBall());
    await page.evaluate(() => window.physicsFrames(240));
    const last = await page.evaluate(() => window.readBall());
    return { tape, supportDegrees: -.5, observationFrames: 240, first, last, travel: Math.abs(last.x - first.x) };
}
async function compareSlope() {
    const before = await slopeSample(false), after = await slopeSample(true);
    report.lowSlope = { before, after };
    assert.ok(before.travel > 10);
    assert.ok(after.travel < before.travel * .5, 'Tape must substantially reduce the same mild-slope drift');
    assert.ok(after.travel < 20 && Math.abs(after.last.omega) < .12);
    assert.equal(after.last.contacts.length, 1); assert.equal(after.last.damping, 6);
    assert.ok(after.last.dynamic);
    const spec = await page.evaluate(() => window.ballSpec);
    assert.equal(spec.width, 68); assert.equal(spec.height, 68); assert.equal(spec.circle, true);
    assert.equal(spec.description, '别担心，有人给它贴了双面胶。');
    add('mild_slope_drift_reduced_without_changing_ball_shape', { before, after, spec });
}
async function steepSlope() {
    await fresh();
    await page.evaluate(() => {
        const f = window.fixture;
        f.platform.node.setRotationFromEuler(0, 0, -8);
        window.ball = f.create(window.ballSpec, 0, 100); f.release(window.ball);
    });
    await page.waitForFunction(() => window.ball.contacts.size > 0);
    await page.evaluate(() => window.physicsFrames(30));
    const rolling = await page.evaluate(() => window.readBall());
    assert.ok(rolling.x > 5 && rolling.vx > 0 && Math.abs(rolling.angle) > 5);
    await page.waitForFunction(() => window.ball.node.position.y < -80, null, { timeout: 10000 });
    const fallen = await page.evaluate(() => window.readBall());
    assert.equal(fallen.contacts.length, 0); assert.equal(fallen.damping, .1); assert.ok(fallen.dynamic);
    add('steeper_slope_still_rolls_off_and_falls', { rolling, fallen });
}
async function contactLifecycle() {
    await fresh();
    await page.evaluate(() => {
        const cc = window.qaCC, f = window.fixture, wall = new cc.Node('TapeTestWall');
        f.root.addChild(wall); wall.setPosition(43.5, 40, 0);
        wall.addComponent(cc.RigidBody2D).type = cc.ERigidBody2DType.Static;
        window.wall = wall.addComponent(cc.BoxCollider2D);
        window.wall.size = new cc.Size(20, 120); window.wall.apply();
        window.ball = f.create(window.ballSpec, 0, 34); f.release(window.ball);
    });
    await page.waitForFunction(() => window.ball.contacts.size === 2);
    const two = await page.evaluate(() => window.readBall());
    await page.evaluate(() => { window.wall.enabled = false; });
    await page.waitForFunction(() => window.ball.contacts.size === 1);
    const one = await page.evaluate(() => window.readBall());
    assert.equal(two.damping, 6); assert.equal(one.damping, 6);
    assert.deepEqual(one.contacts, ['GroundSupport']);
    add('remaining_contact_keeps_rolling_resistance', { two, one });
    await page.evaluate(() => { window.fixture.platform.enabled = false; });
    await page.waitForFunction(() => window.ball.contacts.size === 0);
    const leaving = await page.evaluate(() => {
        window.ball.body.angularVelocity = 4; window.ball.body.wakeUp(); return window.readBall();
    });
    await page.evaluate(() => window.physicsFrames(30));
    const air = await page.evaluate(() => window.readBall());
    assert.equal(air.damping, .1); assert.equal(air.contacts.length, 0);
    assert.ok(air.omega > 3.5 && air.y < leaving.y - 50 && air.vy < 0 && air.dynamic);
    add('last_contact_end_restores_air_rotation_and_gravity', { leaving, air });
}
async function main() {
    try {
        browser = await chromium.launch({ headless: true });
        page = await browser.newPage({ viewport: { width: 375, height: 667 } });
        page.on('pageerror', e => report.errors.push(String(e)));
        await page.goto('http://127.0.0.1:8767/preparation/review/play-player.html');
        await page.waitForFunction(() => !!window.qaLoad, null, { timeout: 45000 });
        await compareSlope(); await steepSlope(); await contactLifecycle();
        assert.deepEqual(report.errors, []); report.status = 'passed_directed_tape_material_checks';
    } catch (e) {
        report.status = 'failed'; report.failure = String(e.stack || e); process.exitCode = 1;
        report.lastState = await page?.evaluate(() => window.readBall?.()).catch(() => null);
    } finally {
        fs.writeFileSync(path.join(ROOT, 'preparation/review/evidence/batch1a/BASKETBALL_TAPE.json'), JSON.stringify(report, null, 2) + '\n');
        process.stdout.write(JSON.stringify(report) + '\n');
        await browser?.close();
    }
}
main();
