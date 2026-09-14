/** Directed material/impact regressions in the current Cocos build; no substitute physics. */
const { chromium } = require('/Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const ROOT = path.resolve(__dirname, '../..'), OUT = path.join(ROOT, 'preparation/review/evidence/batch1a');
const report = { status: 'running', checks: [], errors: [] };
let browser, context, page, videoStart;
const add = (name, evidence) => { report.checks.push({ name, status: 'passed', evidence }); process.stdout.write(name + ': passed\n'); };
async function fresh() {
    await page.evaluate(() => { if (window.fixturePaint) qaCC.director.off(qaCC.Director.EVENT_AFTER_PHYSICS, fixturePaint); });
    await page.evaluate(() => qaLoad('HUD'));
    await page.waitForFunction(() => qaGame()?.snapshot().phase === 'planning');
    await page.evaluate(async () => {
        const cc = qaCC, g = qaGame(); g.enabled = false; g.audio.pause(true); g.world.dispose(); g.display.dispose();
        await new Promise(r => requestAnimationFrame(r));
        const { TowerWorld } = await System.import('chunks:///_virtual/tower-world.ts');
        const { PlayView } = await System.import('chunks:///_virtual/play-view.ts');
        window.data = await System.import('chunks:///_virtual/object-data.ts');
        window.f = g.world = new TowerWorld(cc.director.getScene());
        g.display = new PlayView(g.node, new Map(g.frames.map(frame => [frame.name, frame]))); g.current = null;
        window.steady = 0; window.probe = null; window.cushionSamples = [];
        window.fixturePaint = () => {
            g.display.update(1 / 60, f.bodies, null, 1);
            steady = f.isStable() ? steady + 1 : 0;
            if (!probe) return;
            probe.frames++;
            const support = f.bodies[2], ball = f.bodies[3];
            probe.maxSupportAngle = Math.max(probe.maxSupportAngle, Math.abs(data.planarAngle(support.node.rotation)));
            probe.maxBallOffset = Math.max(probe.maxBallOffset, Math.abs(ball.node.position.x - support.node.position.x));
        };
        cc.director.on(cc.Director.EVENT_AFTER_PHYSICS, fixturePaint);
        window.frames = n => new Promise(resolve => {
            let count = 0; const tick = () => { if (++count < n) return; cc.director.off(cc.Director.EVENT_AFTER_PHYSICS, tick); resolve(); };
            cc.director.on(cc.Director.EVENT_AFTER_PHYSICS, tick);
        });
        window.spawn = (kind, x, y, angle = 0) => {
            const r = f.create(data.OBJECTS[kind], x, y); r.node.setRotationFromEuler(0, 0, angle); f.release(r); steady = 0;
            if (kind === 'basketball') r.collider.on(cc.Contact2DType.PRE_SOLVE, (self, other, contact) => {
                if (cushionSamples.some(s => s.other === other.node.name)) return;
                const m = contact.getWorldManifold(), normal = new cc.Vec2(m.normal.x, m.normal.y);
                normal.multiplyScalar(contact.colliderA === self ? 1 : -1);
                if (Math.abs(normal.y) < .7 || !f.pendingAdhesion.has(`${r.id}:${Math.sign(normal.y)}`)) return;
                const peer = f.bodies.find(b => b.collider === other), incoming = peer && peer.id > r.id ? peer : r;
                const support = incoming === r ? other.body : r.body;
                if (incoming !== r) normal.multiplyScalar(-1);
                const velocity = incoming.body.getLinearVelocityFromWorldPoint(m.points[0], new cc.Vec2());
                velocity.subtract(support.getLinearVelocityFromWorldPoint(m.points[0], new cc.Vec2()));
                cushionSamples.push({ other: other.node.name, normalClosingSpeed: velocity.dot(normal) / 32 });
            });
            return r;
        };
        window.readFixture = () => ({ bonds: [...f.bonds].map(([key, b]) => ({ key, ball: b.ball.id,
            other: b.other.node.name, connected: b.joint.connectedBody.node.name, side: b.side })),
            bodies: f.bodies.map(r => ({ kind: r.spec.kind, id: r.id, x: r.node.position.x, y: r.node.position.y,
                angle: data.planarAngle(r.node.rotation), vx: r.body.linearVelocity.x, vy: r.body.linearVelocity.y,
                omega: r.body.angularVelocity, damping: r.body.angularDamping, contacts: r.contacts.size,
                dynamic: r.body.type === cc.ERigidBody2DType.Dynamic, bounds: f.bounds(r) })) });
    });
}
async function fiveDrops(offset) {
    await fresh();
    if (offset === 0) report.video_start_seconds = (Date.now() - videoStart) / 1000;
    const placed = [];
    for (const kind of ['cardboard_box', 'wood_plank', 'fridge', 'basketball', 'cardboard_box']) {
        const number = placed.length;
        await page.evaluate(({ kind, number, offset }) => {
            const d = qaGame().display, boundary = d.beginPlacement(), spec = data.OBJECTS[kind];
            if (number === 4) probe = { frames: 0, maxSupportAngle: 0, maxBallOffset: 0 };
            const r = spawn(kind, number === 4 ? offset : 0, boundary.top - spec.height / 2);
            window.last = r;
        }, { kind, number, offset });
        await page.waitForFunction(() => steady >= 40, null, { timeout: 14000 });
        const state = await page.evaluate(() => {
            last.placed = true; const top = f.confirmedTop(); qaGame().display.setHeight(top); qaGame().display.follow(top);
            return readFixture();
        });
        placed.push(state);
        if (number === 0 && offset === 0) {
            await page.screenshot({ path: path.join(OUT, '17-platform-contact.png') });
            const mapping = await page.evaluate(() => {
                const cc = qaCC, d = qaGame().display, n = d.platform, rect = n.getComponent(cc.UITransform);
                const frame = n.getComponent(cc.Sprite).spriteFrame, view = d.snapshot();
                return { sourceWidth: frame.originalSize.width, sourceHeight: frame.originalSize.height,
                    contactRow: (n.position.y + rect.height / 2 - view.originY) / rect.width * frame.originalSize.width,
                    bodyBottom: f.bounds(f.bodies[0]).bottom, physicalPlatformWidth: f.platform.size.width };
            });
            assert.ok(Math.abs(mapping.contactRow - 82) < .01 && Math.abs(mapping.bodyBottom) < 1);
            assert.equal(mapping.physicalPlatformWidth, 160);
            add('platform_contact_maps_to_visible_wooden_face', mapping);
        }
    }
    await page.evaluate(() => frames(120));
    const final = await page.evaluate(() => ({ ...readFixture(), probe, stable: f.isStable() }));
    assert.equal(final.bonds.length, 2);
    assert.ok(final.bodies.every(b => b.dynamic && b.contacts > 0));
    assert.ok(final.stable, 'Five objects must settle after the fifth impact');
    assert.ok(final.probe.maxSupportAngle < 5, 'A mild offset must not cause a large visible sway');
    assert.ok(final.probe.maxBallOffset < 6);
    await page.screenshot({ path: path.join(OUT, `18-five-drops-${offset}.png`) });
    add(`five_drops_offset_${offset}_settle_with_upper_and_lower_adhesion`, { placed, final });
    if (offset === 0) {
        const samples = await page.evaluate(() => cushionSamples);
        assert.equal(samples.length, 2); assert.ok(samples.every(s => s.normalClosingSpeed >= 0 && s.normalClosingSpeed <= 2.01));
        add('real_contact_closing_speed_is_cushioned_without_reversal', samples);
        report.video_duration_seconds = (Date.now() - videoStart) / 1000 - report.video_start_seconds;
        await page.evaluate(() => { f.platform.enabled = false; });
        await page.evaluate(() => frames(30));
        const falling = await page.evaluate(() => readFixture());
        assert.equal(falling.bonds.length, 2);
        assert.ok(falling.bodies.every((b, i) => b.dynamic && b.y < final.bodies[i].y - 50));
        add('glued_segment_falls_with_the_unfixed_tower', { before: final.bodies, after: falling });
    }
}
async function detachAndSideContact() {
    await fresh();
    await page.evaluate(() => spawn('basketball', 0, 140, 37));
    await page.waitForFunction(() => steady >= 40 && f.bonds.size === 1);
    const before = await page.evaluate(() => readFixture());
    await page.evaluate(() => { f.platform.enabled = false; });
    await page.waitForFunction(() => f.bonds.size === 0 && f.bodies[0].contacts.size === 0);
    await page.evaluate(() => { f.bodies[0].body.angularVelocity = 4; f.bodies[0].body.wakeUp(); });
    await page.evaluate(() => frames(30));
    const after = await page.evaluate(() => readFixture());
    assert.equal(after.bodies[0].damping, .1); assert.ok(after.bodies[0].omega > 3.5);
    assert.ok(after.bodies[0].y < before.bodies[0].y - 50 && after.bodies[0].dynamic);
    add('support_removed_releases_joint_and_preserves_free_fall', { before, after });
    await fresh();
    await page.evaluate(() => {
        const cc = qaCC, wall = new cc.Node('SideOnly'); f.root.addChild(wall); wall.setPosition(45, 270, 0);
        wall.addComponent(cc.RigidBody2D).type = cc.ERigidBody2DType.Static;
        const collider = wall.addComponent(cc.BoxCollider2D); collider.size = new cc.Size(20, 300); collider.apply();
        window.sideContacts = 0; const ball = spawn('basketball', 0, 330);
        ball.body.linearVelocity = new cc.Vec2(5, 0);
        ball.collider.on(cc.Contact2DType.BEGIN_CONTACT, (_self, other) => { if (other === collider) sideContacts++; });
    });
    await page.waitForFunction(() => sideContacts > 0);
    const side = await page.evaluate(() => ({ ...readFixture(), sideContacts }));
    assert.equal(side.bonds.length, 0);
    add('side_graze_does_not_attach', side);
}
async function groupStillFalls() {
    await fresh();
    await page.evaluate(() => spawn('basketball', 0, 140));
    await page.waitForFunction(() => steady >= 40 && f.bonds.size === 1);
    await page.evaluate(() => {
        const cc = qaCC, ball = f.bodies[0];
        ball.body.applyLinearImpulse(new cc.Vec2(150, 0), ball.body.getWorldCenter(new cc.Vec2()), true);
    });
    await page.waitForFunction(() => f.bonds.size === 0, null, { timeout: 4000 });
    const escaped = await page.evaluate(() => readFixture());
    assert.ok(escaped.bodies[0].x > 10 && escaped.bodies[0].dynamic);
    add('large_pull_releases_limited_strength_adhesion', escaped);
    await fresh();
    assert.deepEqual((await page.evaluate(() => readFixture())).bonds, []);
    add('scene_retry_cleans_up_native_joints', { bonds: 0 });
}
async function rotatingImpact() {
    await fresh();
    await page.evaluate(() => spawn('basketball', 0, 140));
    await page.waitForFunction(() => steady >= 40 && f.bonds.size === 1);
    await page.evaluate(() => {
        const cc = qaCC, cushion = f.cushionImpact.bind(f); window.rotatingSamples = [];
        f.cushionImpact = (body, support, point, toward, limit) => {
            const before = body.linearVelocity.clone().subtract(support.linearVelocity).dot(toward);
            const spin = body.angularVelocity;
            const axis = toward.clone(); cushion(body, support, point, toward, limit);
            const after = body.linearVelocity.clone().subtract(support.linearVelocity).dot(axis);
            rotatingSamples.push({ before, after, spin });
        };
        const upper = spawn('cardboard_box', 12, 180, 15);
        upper.body.angularVelocity = -4;
    });
    await page.waitForFunction(() => rotatingSamples.length > 0, null, { timeout: 5000 });
    const samples = await page.evaluate(() => rotatingSamples);
    assert.ok(samples.some(s => Math.abs(s.spin) > .1));
    assert.ok(samples.every(s => s.after >= Math.min(0, s.before) - .00001 && s.after <= s.before + .00001));
    add('rotating_contact_does_not_inject_reverse_translation', samples);
}
async function main() {
    try {
        browser = await chromium.launch({ headless: true });
        context = await browser.newContext({ viewport: { width: 375, height: 667 },
            recordVideo: { dir: path.join(ROOT, 'temp/adhesion-video'), size: { width: 375, height: 667 } } });
        page = await context.newPage(); videoStart = Date.now();
        page.on('pageerror', e => report.errors.push(String(e)));
        await page.goto('http://127.0.0.1:8767/preparation/review/play-player.html');
        await page.waitForFunction(() => !!window.qaLoad, null, { timeout: 45000 });
        await fiveDrops(0); await fiveDrops(-15); await fiveDrops(15);
        await detachAndSideContact(); await groupStillFalls(); await rotatingImpact();
        assert.deepEqual(report.errors, []); report.status = 'passed_directed_adhesion_and_platform_checks';
    } catch (e) {
        report.status = 'failed'; report.failure = String(e.stack || e); process.exitCode = 1;
        report.last = await page?.evaluate(() => ({ ...readFixture(), probe })).catch(() => null);
        await page?.screenshot({ path: path.join(OUT, 'adhesion-failure.png') }).catch(() => {});
    } finally {
        await context?.close();
        if (page) await page.video().saveAs(path.join(OUT, 'adhesion-five-drops-raw.webm'));
        fs.writeFileSync(path.join(OUT, 'ADHESION.json'), JSON.stringify(report, null, 2) + '\n');
        process.stdout.write(JSON.stringify({ status: report.status, checks: report.checks.length,
            failure: report.failure, last: report.last, errors: report.errors }) + '\n');
        await browser?.close();
    }
}
main();
