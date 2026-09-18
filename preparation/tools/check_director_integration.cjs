/* Executes actual controller/world methods against small engine doubles. No project launch.
 * This verifies orchestration and risk geometry, not Box2D or rendered/device behavior. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('/Applications/CocosCreator/3.8.8/CocosCreator.app/Contents/Resources/app.asar.unpacked/node_modules/typescript/lib/typescript.js');
const root = path.resolve(__dirname, '../..');
class Vec2 {
    constructor(x = 0, y = 0) { this.x = x; this.y = y; }
    clone() { return new Vec2(this.x, this.y); }
    length() { return Math.hypot(this.x, this.y); }
    subtract(v) { this.x -= v.x; this.y -= v.y; return this; }
}
const cc = { Vec2, Component: class {}, _decorator: { ccclass: () => value => value, property: () => () => {} },
    ERigidBody2DType: { Dynamic: 2, Static: 0 }, director: { loadScene() {} } };
const stubs = { './game-audio': {}, './game-music': {}, './play-view': {}, './contact-assistance': {},
    './local-platform': { readSettings: () => ({ tutorialDone: true }), writeSettings() {} } };
const modules = new Map();
function load(name) {
    if (modules.has(name)) return modules.get(name);
    const module = { exports: {} }; modules.set(name, module.exports);
    const file = path.join(root, 'assets/batch1', name + '.ts');
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
        target: ts.ScriptTarget.ES2018, module: ts.ModuleKind.CommonJS, experimentalDecorators: true,
    } }).outputText;
    const requireLocal = id => id === 'cc' ? cc : id in stubs ? stubs[id] : load(id.replace('./', ''));
    new vm.Script(`(function(require,module,exports){${code}\n})`, { filename: file })
        .runInThisContext()(requireLocal, module, module.exports);
    return module.exports;
}
const { StackGameController } = load('game-controller');
const { TowerWorld } = load('tower-world');
const { TowerDirector, classifyTowerRisk } = load('tower-director');
const { CALIBRATION_SEQUENCE, OBJECTS, STABLE_SECONDS, runResult } = load('object-data');
const safe = { maxTiltDegrees: 0, maxAngularSpeed: 0, minSupportRatio: 1,
    unsupportedMassRatio: 0, recentImpactSpeed: 0, mainSupportStable: true };
const checks = [];
function test(name, fn) { fn(); checks.push(name); }
let nextFixtureId = 1;
function fixture(kind = 'cardboard_box', x = 0, y = 50, degrees = 0) {
    const collider = { enabled: true, enabledInHierarchy: true };
    const radians = degrees * Math.PI / 180;
    const record = { id: nextFixtureId++, spec: OBJECTS[kind], collider, placed: false, lost: false, supported: true,
        contactSeconds: 1.5, detachedSeconds: 0, fallingSeconds: 0,
        node: { position: new Vec2(x, y), rotation: { z: Math.sin(radians / 2), w: Math.cos(radians / 2) } },
        body: { type: 2, linearVelocity: new Vec2(), angularVelocity: 0, getMass: () => 4,
            getWorldPoint: () => new Vec2(x, y), getWorldCenter: () => new Vec2(x, y),
            getWorldVector: () => new Vec2(Math.cos(radians), Math.sin(radians)) } };
    return record;
}
function riskWorld(bodies) {
    const world = Object.create(TowerWorld.prototype);
    Object.assign(world, { bodies, platform: { enabledInHierarchy: true }, supportContacts: new Map(),
        contactAssistance: { supportPairs: () => [] } });
    return world;
}
function ground(world, record) { world.supportContacts.set({}, { upper: record, lower: world.platform,
    points: [{ x: -40, y: 0 }, { x: 40, y: 0 }] }); }
function controller() {
    const g = new StackGameController();
    g.objectDirector = new TowerDirector(1234);
    g.lifecycle = { paused: false, update() {} };
    g.audio = { update() {}, play: () => true, stopReactions() {}, pause() {} };
    g.music = { pause() {} };
    const world = g.world = { bodies: [], stable: false, signals: { ...safe },
        riskSignals: () => world.signals, isStable: () => world.stable, collapseTrend: () => false,
        canSaveCheckpoint: () => world.stable && !world.hasPlacementHazard(),
        exportState: () => ({ bodies: world.bodies.filter(r => !r.lost).map(r => ({
            id: r.id, kind: r.spec.kind, placed: r.placed, enabled: r.collider.enabled,
            contactSeconds: r.contactSeconds, x: r.node.position.x, y: r.node.position.y,
        })) }),
        hasPlacementHazard: () => false, supportedTop: () => 100, placementTop: () => 100,
        confirmedTop: () => 100, configureSafety() {}, remainingStable: () => true,
        create(spec) { const r = fixture(spec.kind); r.id = world.bodies.length + 1;
            r.contactSeconds = null; r.collider.enabled = false; world.bodies.push(r); return r; },
        release(r) { r.collider.enabled = true; }, nativeBounds: () => ({ left: -50, right: 50, bottom: 0, top: 100 }),
        bounds: record => TowerWorld.prototype.bounds.call(world, record),
        highlightPlacement: record => ({ id: record.id, supported: true, supportRatio: 1, centerOffsetRatio: 0,
            bridgeGapRatio: 0, bearingCount: 1, supportedBodyIds: [], point: { x: 0, y: 0 } }),
        assistanceTop: () => 100 };
    g.display = { next: null, setNext(kind) { this.next = kind; }, setHeight() {}, setHint() {}, setStars() {},
        exportState: () => ({ cameraY: 0, targetCameraY: 0, heldTop: 400 }),
        beginPlacement: () => ({ left: -300, right: 300, top: 400, bottom: -200 }),
        logicalBounds: () => ({ left: -300, right: 300, top: 600, bottom: -200 }), cameraRecovered: () => true,
        beginIncident() {}, endIncident() {}, holdIncident() {}, clearFeedback() {}, setRisk() {}, showHighlight: () => true };
    g.spawn(); return g;
}
test('All 14 opening objects and advertised NEXT survive the first random boundary', () => {
    const g = controller(), seen = [];
    for (let i = 0; i < 14; i++) {
        seen.push(g.current.spec.kind);
        const advertised = g.display.next;
        g.releaseCount++; g.spawn();
        assert.equal(g.current.spec.kind, advertised);
        if (i < 12) assert.equal(g.objectDirector.snapshot().draws, 0);
    }
    assert.deepEqual(seen, [...CALIBRATION_SEQUENCE]);
    assert.equal(g.objectDirector.snapshot().draws, 2);
});
test('Changing risk / sampling diagnostics cannot change current NEXT or RNG', () => {
    const g = controller();
    g.enter = () => {};
    const before = g.objectDirector.snapshot(), next = g.display.next;
    g.world.signals.maxTiltDegrees = 50;
    for (let i = 0; i < 60; i++) { g.update(1 / 60); g.objectDirector.snapshot(); }
    assert.equal(g.risk, 'Critical'); assert.equal(g.display.next, next);
    assert.deepEqual(g.objectDirector.snapshot(), before);
});
test('Paused frame freezes risk timers, collision decay and draws', () => {
    const g = controller(); g.lifecycle.paused = true; g.recentImpactSpeed = 5; g.steadySeconds = 2;
    const before = [g.elapsedSeconds, g.steadySeconds, g.recentImpactSpeed, g.objectDirector.snapshot()];
    g.update(30);
    assert.deepEqual([g.elapsedSeconds, g.steadySeconds, g.recentImpactSpeed, g.objectDirector.snapshot()], before);
});
test('Early handoff does not score; later stable confirmation neither redraws nor counts twice', () => {
    const g = controller(), first = g.current;
    g.phase = 'planning'; g.release(); first.contactSeconds = 1.5;
    const advertised = g.display.next;
    g.observe();
    assert.equal(g.current.spec.kind, advertised); assert.equal(g.placedCount, 0);
    const after = g.objectDirector.snapshot();
    g.observe(); assert.deepEqual(g.objectDirector.snapshot(), after);
    g.world.stable = true;
    g.confirmStable(STABLE_SECONDS); g.confirmStable(STABLE_SECONDS);
    assert.equal(g.placedCount, 1); assert.equal(first.placed, true);
    assert.deepEqual(g.objectDirector.snapshot(), after);
});
test('Director risk does not change existing physical stability scoring or award unsettled pieces', () => {
    const g = controller(); g.current.collider.enabled = true; g.world.stable = false;
    g.risk = 'Critical'; g.confirmStable(1); assert.equal(g.placedCount, 0);
    g.world.stable = true; g.confirmStable(STABLE_SECONDS - .01); assert.equal(g.placedCount, 0);
    g.confirmStable(.02); assert.equal(g.placedCount, 1);
});
test('Lost-current recovery consumes its advertised NEXT once; held/surviving recovery does not', () => {
    for (const lost of [false, true]) {
        const g = controller(), before = g.objectDirector.snapshot(), advertised = g.display.next;
        g.releaseCount = 1; g.current.lost = lost; g.phase = 'incident';
        g.resumePhase = 'observing'; g.resumeClock = .2; g.incident = {};
        g.updateIncident(.61);
        assert.equal(g.incident, null);
        assert.equal(g.objectDirector.snapshot().turn, before.turn + (lost ? 1 : 0));
        if (lost) assert.equal(g.current.spec.kind, advertised);
        else assert.equal(g.phase, 'observing');
    }
});
test('Only first effective loss counts toward director recovery, not incident start or duplicate loss', () => {
    const g = controller();
    g.phase = 'falling'; g.beginIncident();
    assert.equal(g.chargedIncidentCount, 0);
    g.lost(g.current); g.lost(g.current);
    assert.equal(g.chargedIncidentCount, 1); assert.equal(g.stars, 2);
});
test('Explicit fixed calibration cycles without RNG and rejects changes after release', () => {
    const g = controller();
    g.frames = Object.keys(OBJECTS).flatMap(kind => [{ name: `object_${kind}` }, { name: `next_${kind}` }]);
    const fixed = ['cardboard_box', 'wood_plank', 'fridge'];
    assert.equal(g.configureCalibration(fixed, true), true);
    const before = g.objectDirector.snapshot();
    for (let i = 1; i < 30; i++) { g.releaseCount = i; g.spawn();
        assert.equal(g.current.spec.kind, fixed[i % fixed.length]); }
    assert.equal(g.configureCalibration(fixed), false);
    assert.deepEqual(g.objectDirector.snapshot(), before);
});
test('Orthogonal releases and naturally settled flips are not tilt; oblique leaning still is', () => {
    for (const degrees of [0, 90, -90, 180]) {
        const r = fixture('cardboard_box', 0, 50, degrees), w = riskWorld([r]); ground(w, r);
        assert.ok(w.riskSignals().maxTiltDegrees < 1e-8);
    }
    const r = fixture('cardboard_box', 0, 50, 90), w = riskWorld([r]); ground(w, r);
    assert.equal(w.riskSignals().maxTiltDegrees, 0);
    r.body.getWorldVector = () => new Vec2(Math.cos(Math.PI / 6), Math.sin(Math.PI / 6));
    assert.ok(Math.abs(w.riskSignals().maxTiltDegrees - 30) < 1e-8);
    const ball = fixture('basketball', 0, 34, 53), bw = riskWorld([ball]); ground(bw, ball);
    assert.equal(bw.riskSignals().maxTiltDegrees, 0);
});
test('World angular speed is converted from radians/s; width proxy allows a plank on a box', () => {
    const base = fixture(), plank = fixture('wood_plank', 0, 110), w = riskWorld([base, plank]);
    ground(w, base); w.supportContacts.set({}, { upper: plank, lower: base.collider });
    plank.body.angularVelocity = Math.PI / 6;
    assert.ok(Math.abs(w.riskSignals().maxAngularSpeed - 30) < 1e-8);
    plank.body.angularVelocity = 0;
    const signals = w.riskSignals();
    assert.ok(signals.minSupportRatio > .38 && signals.minSupportRatio < .40);
    assert.notEqual(classifyTowerRisk(signals), 'Critical');
});
test('Held, lost and untouched falling bodies are excluded; contacted unscored and offscreen remain', () => {
    const base = fixture(), held = fixture(), lost = fixture(), falling = fixture(), w = riskWorld([base, held, lost, falling]);
    ground(w, base); held.collider.enabledInHierarchy = false; lost.lost = true; falling.contactSeconds = null;
    [held, lost, falling].forEach(r => { r.body.angularVelocity = 10; });
    assert.equal(w.riskSignals().maxAngularSpeed, 0);
    base.node.position.x = 9999; base.node.position.y = -9999; // Native body transform is unchanged.
    assert.equal(w.riskSignals().minSupportRatio, 1);
    falling.contactSeconds = .01;
    assert.ok(w.riskSignals().maxAngularSpeed > 500);
});
test('A grounded local bond bridges contact gaps; a floating bonded group still has no support', () => {
    const base = fixture(), cap = fixture('cardboard_box', 0, 151), w = riskWorld([base, cap]); ground(w, base);
    w.contactAssistance.supportPairs = () => [[base.collider, cap.collider]];
    assert.equal(w.riskSignals().minSupportRatio, 1);
    base.supported = false; cap.supported = false; w.supportContacts.clear();
    assert.equal(w.riskSignals().unsupportedMassRatio, 1);
    assert.equal(w.riskSignals().mainSupportStable, false);
});
test('Basketball ground bond retains real support through a contact gap in either pair order', () => {
    const ball = fixture('basketball', 0, 34), w = riskWorld([ball]);
    for (const pair of [[ball.collider, w.platform], [w.platform, ball.collider]]) {
        w.contactAssistance.supportPairs = () => [pair];
        const signals = w.riskSignals();
        assert.equal(signals.minSupportRatio, 1); assert.equal(signals.mainSupportStable, true);
        assert.equal(classifyTowerRisk(signals), 'Safe');
    }
});
test('Steady wide-plank towers accumulate time; short impact pauses it and structural danger resets', () => {
    const g = controller(); g.enter = () => {}; g.world.stable = true;
    g.world.signals.minSupportRatio = .388;
    for (let i = 0; i < 1200; i++) g.update(1 / 60);
    assert.equal(g.risk, 'Unstable'); assert.ok(g.steadySeconds > 18);
    const before = g.steadySeconds;
    g.world.signals.recentImpactSpeed = 5; g.update(1 / 60);
    assert.equal(g.steadySeconds, before);
    g.world.signals.recentImpactSpeed = 0; g.world.signals.maxAngularSpeed = 100; g.update(1 / 60);
    assert.equal(g.steadySeconds, 0);
});
test('Repeated fixture support is unioned; overlapping supports never double-count width', () => {
    const base = fixture(), cap = fixture('wood_plank', 0, 110), w = riskWorld([base, cap]); ground(w, base);
    w.supportContacts.set({}, { upper: cap, lower: base.collider });
    const first = w.riskSignals().minSupportRatio;
    w.supportContacts.set({}, { upper: cap, lower: base.collider });
    assert.equal(w.riskSignals().minSupportRatio, first);
});
test('Old-tower risk excludes the new landing impulse but includes its genuine support when rescuing', () => {
    const base = fixture(), old = fixture('cardboard_box', 0, 150), fresh = fixture('wood_plank', 0, 210);
    base.placed = old.placed = true;
    const w = riskWorld([base, old, fresh]); ground(w, base);
    w.supportContacts.set({}, { upper: old, lower: base.collider, points: [{ x: -40, y: 100 }, { x: 40, y: 100 }] });
    w.supportContacts.set({}, { upper: fresh, lower: old.collider, points: [{ x: -40, y: 200 }, { x: 40, y: 200 }] });
    fresh.body.angularVelocity = 5;
    assert.equal(classifyTowerRisk(w.riskSignals()), 'Critical');
    assert.equal(classifyTowerRisk(w.riskSignals(0, true)), 'Safe');
    base.placed = false; // The unconfirmed new root can still carry the existing piece.
    assert.equal(w.riskSignals(0, true).mainSupportStable, true);
});
test('Unrelated new roots cannot contaminate old-tower risk, but a new bearing in its actual support path can', () => {
    const base = fixture(), old = fixture('cardboard_box', 0, 150), fresh = fixture('basketball', 150, 34);
    base.placed = old.placed = true;
    const w = riskWorld([base, old, fresh]); ground(w, base); ground(w, fresh);
    w.supportContacts.set('old', { upper: old, lower: base.collider, points: [{ x: -40, y: 100 }, { x: 40, y: 100 }] });
    const before = w.riskSignals(0, true); fresh.body.angularVelocity = .3;
    assert.deepEqual(w.riskSignals(0, true), before);
    assert.equal(classifyTowerRisk(before), 'Safe');
    assert.equal(w.riskSignals().mainSupportStable, false);
    w.supportContacts.set('base', { upper: base, lower: fresh.collider, points: [{ x: 10, y: 50 }] });
    assert.equal(w.riskSignals(0, true).mainSupportStable, false);
});
test('Bridge evidence needs two actual contacts with a gap across COM, not fixtures or bonds', () => {
    const left = fixture('cardboard_box', -90, 50), right = fixture('cardboard_box', 90, 50);
    const plank = fixture('wood_plank', 0, 115), w = riskWorld([left, right, plank]);
    const edge = (lower, xs) => ({ upper: plank, lower: lower.collider, points: xs.map(x => ({ x, y: 100 })) });
    w.supportContacts.set('left', edge(left, [-110, -70]));
    w.supportContacts.set('right', edge(right, [70, 110]));
    let evidence = w.highlightPlacement(plank);
    assert.equal(evidence.bearingCount, 2); assert.ok(evidence.bridgeGapRatio > .5);
    assert.ok(Math.abs(evidence.point.x) >= 70); // Accent lies on a real bearing, not in the gap.
    w.supportContacts.set('duplicate', edge(left, [-100, -80]));
    assert.deepEqual(w.highlightPlacement(plank), evidence);
    w.supportContacts.delete('right');
    w.contactAssistance.supportPairs = () => [[plank.collider, right.collider]];
    evidence = w.highlightPlacement(plank);
    assert.equal(evidence.bearingCount, 1); assert.equal(evidence.bridgeGapRatio, 0);
});
test('Edge evidence uses physical COM and actual contact span; centered wide planks are not edges', () => {
    const base = fixture(), cap = fixture(), w = riskWorld([base, cap]);
    w.supportContacts.set({}, { upper: cap, lower: base.collider, points: [{ x: -30, y: 0 }, { x: 0, y: 0 }] });
    const first = w.highlightPlacement(cap);
    assert.ok(first.supportRatio > .29 && first.supportRatio < .30); assert.equal(first.centerOffsetRatio, 1);
    cap.node.position.x = 999; assert.equal(w.highlightPlacement(cap).centerOffsetRatio, 1);
    cap.body.getWorldCenter = () => new Vec2(-15, 50);
    assert.equal(w.highlightPlacement(cap).centerOffsetRatio, 0);
});
test('Highlight contacts are copied from pooled manifolds; side/disabled support cannot earn geometry', () => {
    const base = fixture(), cap = fixture(), w = riskWorld([base, cap]);
    const points = [{ x: -30, y: 100 }, { x: 0, y: 100 }];
    const contact = { colliderA: cap.collider, getWorldManifold: () => ({ normal: { x: 0, y: -1 }, points }) };
    w.recordSupport(cap, base.collider, contact);
    points[0].x = -999; points[1].y = 999;
    assert.equal(w.highlightPlacement(cap).point.y, 100);
    assert.ok(w.highlightPlacement(cap).supportRatio < .31);
    base.collider.enabledInHierarchy = false;
    assert.equal(w.highlightPlacement(cap).bearingCount, 0);
    base.collider.enabledInHierarchy = true;
    contact.getWorldManifold = () => ({ normal: { x: 1, y: 0 }, points });
    w.recordSupport(cap, base.collider, contact); assert.equal(w.highlightPlacement(cap).bearingCount, 0);
});
test('Rescue evidence is a directed old-body load, not the rescuer resting on an old tower', () => {
    const old = fixture(), big = fixture('whale'), w = riskWorld([old, big]); old.placed = true;
    w.supportContacts.set('touch', { upper: big, lower: old.collider, points: [{ x: 0, y: 0 }] });
    assert.deepEqual(w.highlightPlacement(big).supportedBodyIds, []);
    w.supportContacts.set('touch', { upper: old, lower: big.collider, points: [{ x: 0, y: 0 }] });
    assert.deepEqual(w.highlightPlacement(big).supportedBodyIds, [old.id]);
});
test('Actual release -> stable confirmation -> failure copies one immutable genuine technical result', () => {
    const g = controller(), body = g.current;
    const sounds = [], visuals = [];
    g.audio.play = (...args) => { sounds.push(args[0]); return false; }; // Muting cannot cancel score.
    g.display.showHighlight = kind => { visuals.push(kind); return true; };
    g.world.highlightPlacement = record => ({ id: record.id, supported: true, supportRatio: .25,
        centerOffsetRatio: .8, bridgeGapRatio: 0, bearingCount: 1, supportedBodyIds: [], point: { x: 0, y: 0 } });
    g.phase = 'planning'; g.release(); body.contactSeconds = 1.5;
    g.phase = 'falling'; g.observe = () => {}; g.world.stable = true;
    for (let i = 0; i < 45; i++) g.update(1 / 60);
    assert.equal(g.highlights.snapshot().counts.edge_balance, 1);
    assert.equal(g.highlights.snapshot().technicalScore, 80);
    assert.deepEqual(visuals, ['edge_balance']); assert.equal(sounds.filter(x => x === 'stable').length, 1);
    g.lockFailure('stars_exhausted');
    assert.equal(runResult.technicalScore, 80); assert.equal(runResult.highlights.edge_balance, 1);
    const locked = JSON.stringify(runResult); g.confirmStable(20); g.update(20);
    assert.equal(JSON.stringify(runResult), locked);
    const snapshot = g.highlights.snapshot(); snapshot.counts.edge_balance = 999;
    assert.equal(runResult.highlights.edge_balance, 1);
});
test('Resume enables feedback before a fresh same-frame stable event, while paused/failed frames stay frozen', () => {
    const g = controller(), visuals = [];
    let enabled = true;
    g.display.clearFeedback = () => { enabled = false; };
    g.display.setRisk = (_risk, active = true) => { enabled = active; };
    g.display.showHighlight = kind => { if (enabled) visuals.push(kind); return enabled; };
    g.world.highlightPlacement = record => ({ id: record.id, supported: true, supportRatio: .25,
        centerOffsetRatio: .8, bridgeGapRatio: 0, bearingCount: 1, supportedBodyIds: [], point: { x: 0, y: 0 } });
    g.phase = 'planning'; g.release(); g.world.stable = true; g.observe = () => {};
    for (let i = 0; i < 38; i++) g.update(1 / 60);
    g.lifecycle.paused = true; g.display.clearFeedback();
    const paused = JSON.stringify(g.highlights.snapshot()); g.update(20);
    assert.equal(JSON.stringify(g.highlights.snapshot()), paused); assert.equal(enabled, false);
    g.lifecycle.paused = false; g.update(.034);
    assert.deepEqual(visuals, ['edge_balance']);
    g.lockFailure('stars_exhausted'); g.update(.01);
    assert.equal(enabled, false); assert.deepEqual(visuals, ['edge_balance']);
});
test('Incident recovery permits a fresh release and genuine highlight before the next observation frame', () => {
    const g = controller(); g.phase = 'planning';
    g.beginIncident(); g.updateIncident(.61);
    assert.equal(g.incident, null); assert.equal(g.phase, 'planning');
    g.release(); g.world.stable = true; g.observe = () => {};
    g.world.highlightPlacement = record => ({ id: record.id, supported: true, supportRatio: .25,
        centerOffsetRatio: .8, bridgeGapRatio: 0, bearingCount: 1, supportedBodyIds: [], point: { x: 0, y: 0 } });
    for (let i = 0; i < 45; i++) g.update(1 / 60);
    assert.equal(g.highlights.snapshot().counts.edge_balance, 1);
});
test('Ordinary collision/spawn flow produces no narrow escape; old-tower recovery without a new placement can', () => {
    const g = controller(); g.enter = () => {}; g.world.stable = true;
    const first = fixture(), second = fixture(); first.placed = second.placed = true;
    g.world.bodies.push(first, second);
    let oldRiskCritical = false;
    g.world.riskSignals = (_impact, oldOnly) => oldOnly
        ? { ...safe, maxTiltDegrees: oldRiskCritical ? 40 : 0 }
        : { ...safe, recentImpactSpeed: 7 };
    for (let i = 0; i < 50; i++) g.update(1 / 60);
    assert.equal(g.highlights.snapshot().counts.narrow_escape, 0);
    oldRiskCritical = true; g.world.stable = false;
    for (let i = 0; i < 24; i++) g.update(1 / 60);
    oldRiskCritical = false; g.world.stable = true;
    g.world.riskSignals = () => safe;
    for (let i = 0; i < 45; i++) g.update(1 / 60);
    assert.equal(g.highlights.snapshot().counts.narrow_escape, 1);
    for (let i = 0; i < 60; i++) g.update(1 / 60);
    assert.equal(g.highlights.snapshot().counts.narrow_escape, 1);
});
module.exports = { controller, fixture, riskWorld, ground, safe, load, Vec2 };
if (require.main === module) console.log(JSON.stringify({ status: 'passed', count: checks.length, checks,
    scope: 'Actual TypeScript controller/world methods with engine doubles; no project, Box2D, browser or device execution.' }, null, 2));
