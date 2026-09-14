/** Native concave-fixture contact regressions in the built Cocos/Box2D runtime. */
const { chromium } = require('/Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'preparation/review/evidence/gameplay-shapes');
const report = { status: 'running', checks: [], errors: [] };
let browser, page;
const add = (name, evidence) => {
    report.checks.push({ name, status: 'passed', evidence }); process.stdout.write(`${name}: passed\n`);
};

async function fresh() {
    await page.evaluate(() => qaLoad('HUD'));
    await page.waitForFunction(() => qaGame()?.snapshot().phase === 'planning');
    await page.evaluate(async () => {
        const cc = qaCC, game = qaGame();
        game.enabled = false; game.audio.pause(true); game.world.dispose(); game.display.dispose();
        await new Promise(resolve => requestAnimationFrame(resolve));
        const { TowerWorld } = await System.import('chunks:///_virtual/tower-world.ts');
        window.data = await System.import('chunks:///_virtual/object-data.ts');
        window.impacts = [];
        window.f = game.world = new TowerWorld(cc.director.getScene(), (body, pair, speed) => {
            impacts.push({ id: body.id, pair, speed });
        });
        game.current = null; f.platform.enabled = false;
        window.nativeContacts = new Set(); window.contactEvents = []; window.maxContacts = 0;
        window.shelf = points => {
            const node = new cc.Node('ConcaveSupport'); f.root.addChild(node);
            node.addComponent(cc.RigidBody2D).type = cc.ERigidBody2DType.Static;
            const collider = node.addComponent(cc.PolygonCollider2D);
            collider.points = points.map(([x, y]) => new cc.Vec2(x, y)); collider.apply();
            return collider;
        };
        window.watch = record => {
            window.subject = record;
            record.collider.on(cc.Contact2DType.BEGIN_CONTACT, (_self, other, contact) => {
                if (other !== support) return;
                nativeContacts.add(contact); maxContacts = Math.max(maxContacts, nativeContacts.size);
                contactEvents.push({ event: 'begin', native: nativeContacts.size,
                    objectContact: record.contacts.has(other), damping: record.body.angularDamping });
            });
            record.collider.on(cc.Contact2DType.END_CONTACT, (_self, other, contact) => {
                if (other !== support) return;
                nativeContacts.delete(contact);
                contactEvents.push({ event: 'end', native: nativeContacts.size,
                    objectContact: record.contacts.has(other), damping: record.body.angularDamping });
            });
        };
        window.readContacts = () => ({ events: contactEvents, maxContacts, activeNative: nativeContacts.size,
            objectContacts: subject.contacts.size, damping: subject.body.angularDamping,
            x: subject.node.position.x, y: subject.node.position.y, impacts,
            bonds: [...f.bonds.values()].map(bond => ({ ball: bond.ball.id, side: bond.side,
                other: bond.other.node.name, retainsPooledContact: 'contact' in bond })),
            bounds: f.bounds(subject), stable: f.isStable() });
        window.physicsFrames = n => new Promise(resolve => {
            let count = 0;
            const tick = () => {
                if (++count < n) return;
                cc.director.off(cc.Director.EVENT_AFTER_PHYSICS, tick); resolve();
            };
            cc.director.on(cc.Director.EVENT_AFTER_PHYSICS, tick);
        });
    });
}

async function twoFixturesOneObject() {
    await fresh();
    await page.evaluate(() => {
        window.support = shelf([[-90, -20], [90, -20], [90, 60], [50, 60], [50, 0], [-50, 0], [-50, 60], [-90, 60]]);
        // A wide dynamic bar touches both sides of one concave collider. The extra damping
        // is a test material value; no game object, official scale or asset is changed.
        const spec = { ...data.OBJECTS.wood_plank, width: 150, height: 20, outline: undefined,
            contactAngularDamping: 6, adhesion: undefined };
        const bar = f.create(spec, 0, 135); watch(bar); f.release(bar);
    });
    await page.waitForFunction(() => nativeContacts.size >= 2 && f.isStable(), null, { timeout: 10000 });
    const both = await page.evaluate(() => readContacts());
    assert.ok(both.maxContacts >= 2, 'Fixture must produce multiple real native contacts with the same Collider2D');
    assert.equal(both.objectContacts, 1); assert.equal(both.damping, 6);
    assert.equal(both.impacts.length, 1, 'Two fixture BEGINs must produce one object-pair impact');
    await page.evaluate(() => {
        // Keep this directed fixture level while translating away from its left support.
        // It remains dynamic; these fixture settings are not applied to gameplay objects.
        subject.body.fixedRotation = true; subject.body.gravityScale = 0;
        subject.body.linearVelocity = new qaCC.Vec2();
        subject.node.setPosition(60, subject.node.position.y, 0); subject.body.wakeUp();
    });
    await page.waitForFunction(() => nativeContacts.size === 1, null, { timeout: 5000 });
    const one = await page.evaluate(() => readContacts());
    assert.equal(one.objectContacts, 1); assert.equal(one.damping, 6);
    assert.equal(one.impacts.length, 1, 'Losing one fixture while another remains is not a new impact');
    assert.ok(one.events.some(event => event.event === 'end' && event.native > 0));
    assert.ok(one.events.every(event => event.native === 0 || event.objectContact),
        'Ending one fixture must never erase another live fixture contact');
    await page.evaluate(() => { support.enabled = false; });
    await page.waitForFunction(() => nativeContacts.size === 0 && subject.contacts.size === 0);
    const none = await page.evaluate(() => readContacts());
    assert.equal(none.damping, 1.5);
    add('concave_fixture_ends_preserve_remaining_support_and_damping', { both, one, none });
}

async function glueOnTwoFaces() {
    await fresh();
    await page.evaluate(() => {
        // The two 45-degree faces belong to one concave polygon and both support the ball.
        window.support = shelf([[-80, -30], [80, -30], [80, 80], [0, 0], [-80, 80]]);
        const ball = f.create(data.OBJECTS.basketball, 0, 145); watch(ball); f.release(ball);
    });
    await page.waitForFunction(() => nativeContacts.size >= 2 && f.bonds.size === 1 && f.isStable(), null, { timeout: 10000 });
    const attached = await page.evaluate(() => readContacts());
    assert.equal(attached.objectContacts, 1); assert.equal(attached.bonds.length, 1);
    assert.equal(attached.bonds[0].side, -1); assert.equal(attached.damping, 6);
    assert.equal(attached.bonds[0].retainsPooledContact, false);
    assert.equal(attached.impacts.length, 1, 'Two faces of one support must not duplicate the landing impact');
    await page.evaluate(() => { support.enabled = false; });
    await page.waitForFunction(() => f.bonds.size === 0 && subject.contacts.size === 0);
    const detached = await page.evaluate(() => readContacts());
    assert.equal(detached.damping, .1);
    add('multiple_support_faces_create_one_glue_bond_and_release_cleanly', { attached, detached });
}

async function recessIsEmpty() {
    await fresh();
    await page.evaluate(() => {
        window.support = shelf([[-90, -20], [90, -20], [90, 60], [50, 60], [50, 0], [-50, 0], [-50, 60], [-90, 60]]);
        const spec = { ...data.OBJECTS.cardboard_box, width: 20, height: 20, outline: undefined };
        const box = f.create(spec, 0, 135); watch(box); f.release(box);
    });
    await page.waitForFunction(() => subject.contacts.size > 0 && f.isStable(), null, { timeout: 10000 });
    const result = await page.evaluate(() => readContacts());
    assert.ok(Math.abs(result.bounds.bottom) < 1, 'Narrow object must reach the bottom of the visible recess');
    assert.ok(result.bounds.top < 30, 'Concave recess must not be filled by an enclosing box');
    add('native_polygon_partition_preserves_the_playable_recess', result);
}

async function main() {
    try {
        browser = await chromium.launch({ headless: true });
        page = await browser.newPage({ viewport: { width: 375, height: 667 } });
        page.on('pageerror', error => report.errors.push(String(error)));
        await page.goto('http://127.0.0.1:8767/preparation/review/play-player.html');
        await page.waitForFunction(() => !!window.qaLoad, null, { timeout: 45000 });
        await twoFixturesOneObject(); await glueOnTwoFaces(); await recessIsEmpty();
        assert.deepEqual(report.errors, []); report.status = 'passed_native_concave_contact_regressions';
    } catch (error) {
        report.status = 'failed'; report.failure = String(error.stack || error); process.exitCode = 1;
        report.last = await page?.evaluate(() => window.readContacts?.()).catch(() => null);
    } finally {
        fs.mkdirSync(OUT, { recursive: true });
        fs.writeFileSync(path.join(OUT, 'CONTACTS.json'), JSON.stringify(report, null, 2) + '\n');
        process.stdout.write(JSON.stringify(report) + '\n'); await browser?.close();
    }
}
main();
