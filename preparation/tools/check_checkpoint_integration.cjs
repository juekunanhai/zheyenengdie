/* Actual controller/director/highlight source with world/view doubles. The world and view
 * have separate actual-source restore checks. No project, physics engine or build is run. */
const assert = require('node:assert/strict');
const { controller, fixture, load, safe } = require('./check_director_integration.cjs');
const { runResult, STABLE_SECONDS, OBJECTS } = load('object-data');
const checks = [];
function test(name, run) { run(); checks.push(name); }
function make() {
    const g = controller(), calls = { audio: [], music: [], feedback: [], saved: [], restored: [] };
    g.calls = calls;
    g.audio.pause = value => calls.audio.push(value);
    g.music.pause = value => calls.music.push(value);
    g.audio.play = name => { calls.feedback.push(name); return true; };
    g.display.showHighlight = kind => { calls.feedback.push(kind); return true; };
    g.display.setHeight = value => { g.display.height = value; };
    g.display.setStars = value => { g.display.stars = value; };
    g.display.setHint = value => { g.display.hint = value; };
    g.display.restoreState = state => { g.display.restored = { ...state }; };
    g.world.restoring = false;
    g.world.restoreState = state => {
        calls.restored.push(state);
        g.world.bodies = state.bodies.map(row => {
            const body = fixture(row.kind, row.x, row.y);
            body.id = row.id; body.placed = row.placed;
            body.collider.enabled = row.enabled; body.contactSeconds = row.contactSeconds;
            return body;
        });
        g.world.restoring = true;
    };
    return g;
}
function settle(g) {
    g.world.stable = true;
    g.current.contactSeconds = 1.5;
    for (let i = 0; i < 41; i++) {
        g.highlights.observe({ dt: 1 / 60, oldTowerRisk: 'Safe', towerRisk: 'Safe',
            stable: true, hasExistingTower: false, incidentActive: false, incidentCount: 0 });
        g.confirmStable(1 / 60);
    }
}
function released(g) { g.phase = 'planning'; g.release(); }
function apply(g, kind) {
    assert.equal(g.restoreCheckpoint(kind), true);
    g.update(.02);
    assert.equal(g.restoringCheckpoint, true);
}
function finish(g) { g.world.restoring = false; g.update(.02); assert.equal(g.restoringCheckpoint, false); }
test('Missing, invalid and ended restore requests are rejected without manufacturing a point', () => {
    const g = make(), before = g.objectDirector.exportState();
    assert.equal(g.restoreCheckpoint('stable'), false);
    assert.equal(g.restoreCheckpoint('undo'), false);
    assert.equal(g.restoreCheckpoint('anything'), false);
    assert.deepEqual(g.objectDirector.exportState(), before);
    released(g); g.phase = 'ended'; assert.equal(g.restoreCheckpoint('undo'), false);
});
test('Undo is captured before release, preserving held ID, rotation count, planning time and locked NEXT', () => {
    const g = make(); g.phase = 'planning'; g.rotations = 3; g.planningLeft = 1.23;
    const id = g.current.id, next = g.display.next, director = g.objectDirector.exportState();
    g.release(); const undo = g.undoCheckpoint;
    assert.equal(undo.phase, 'planning'); assert.equal(undo.releaseCount, 0);
    assert.equal(undo.currentId, id); assert.equal(undo.world.bodies[0].enabled, false);
    assert.equal(undo.rotations, 3); assert.equal(undo.planningLeft, 1.23);
    assert.equal(undo.next, next); assert.deepEqual(undo.director, director);
    g.current.node.position.x = 77; g.boundary.left = -999;
    assert.equal(undo.world.bodies[0].x, 0); assert.notEqual(undo.boundary.left, -999);
});
test('Ordinary 1.5-second handoff never forces a stable checkpoint', () => {
    const g = make(); released(g); g.current.contactSeconds = 1.5; g.world.stable = false;
    g.observe(); assert.equal(g.stableCheckpoint, null); assert.equal(g.placedCount, 0);
    assert.notEqual(g.current.id, g.undoCheckpoint.currentId);
});
test('Stable save requires real stability, low impact, non-Critical risk and world boundary safety', () => {
    const g = make(); released(g); g.world.stable = true; g.stableFor = STABLE_SECONDS;
    g.current.placed = true; g.placedCount = 1;
    for (const [key, value] of [['risk', 'Critical'], ['recentImpactSpeed', 2.4], ['incident', {}],
        ['checkpointAction', 'rebuilding'], ['phase', 'defeated'], ['stableFor', .1]]) {
        const previous = g[key]; g[key] = value; g.saveStableCheckpoint();
        assert.equal(g.stableCheckpoint, null, key); g[key] = previous;
    }
    g.world.canSaveCheckpoint = () => false; g.saveStableCheckpoint(); assert.equal(g.stableCheckpoint, null);
    g.world.canSaveCheckpoint = () => true; g.lifecycle.paused = true; g.saveStableCheckpoint();
    assert.equal(g.stableCheckpoint, null); g.lifecycle.paused = false;
    g.risk = 'Dangerous'; g.saveStableCheckpoint(); assert.equal(g.stableCheckpoint.placedCount, 1);
});
test('Late risk recovery saves the genuinely confirmed score without requiring another placement', () => {
    const g = make(); released(g); g.risk = 'Critical'; settle(g);
    assert.equal(g.placedCount, 1); assert.equal(g.stableCheckpoint, null);
    g.risk = 'Safe'; g.confirmStable(.01);
    assert.equal(g.stableCheckpoint.placedCount, 1); assert.equal(g.stableCheckpoint.peak, 100);
    const point = g.stableCheckpoint; g.confirmStable(1); assert.equal(g.stableCheckpoint, point);
});
test('Stable and undo points retain separate times; undo discards the abandoned future point and is single-use', () => {
    const g = make(); released(g); settle(g); const first = g.stableCheckpoint;
    g.spawn(); released(g); const beforeSecond = g.undoCheckpoint;
    assert.equal(beforeSecond.placedCount, 1); assert.equal(g.stableCheckpoint, first);
    settle(g); assert.equal(g.stableCheckpoint.placedCount, 2);
    apply(g, 'undo');
    assert.equal(g.placedCount, 1); assert.equal(g.releaseCount, 1);
    assert.equal(g.phase, 'planning'); assert.equal(g.current.collider.enabled, false);
    assert.equal(g.stableCheckpoint, null); assert.equal(g.undoCheckpoint, null);
    assert.equal(g.restoreCheckpoint('undo'), false);
    finish(g); assert.equal(g.restoreCheckpoint('undo'), false);
    g.release(); assert.ok(g.undoCheckpoint);
});
test('Restoring keeps NEXT/RNG, scores, timers and input frozen until world contact rebuilding completes', () => {
    const g = make(); released(g); settle(g);
    const saved = g.stableCheckpoint; g.spawn();
    apply(g, 'stable');
    const before = g.objectDirector.exportState(), counts = g.highlights.exportState();
    const state = [g.clock, g.elapsedSeconds, g.planningLeft, g.releaseCount, g.placedCount, g.stars];
    for (let i = 0; i < 12; i++) { g.update(1); g.release(); g.rotate(); g.moveTo(88); }
    g.impact(g.current, 'restoring', 9); g.lost(g.current);
    assert.deepEqual(g.objectDirector.exportState(), before); assert.deepEqual(g.highlights.exportState(), counts);
    assert.deepEqual([g.clock, g.elapsedSeconds, g.planningLeft, g.releaseCount, g.placedCount, g.stars], state);
    assert.equal(g.display.next, saved.next); assert.equal(g.calls.audio.at(-1), true);
    assert.equal(g.calls.music.at(-1), true);
    finish(g); assert.equal(g.calls.audio.at(-1), false); assert.equal(g.calls.music.at(-1), false);
    assert.deepEqual(g.objectDirector.exportState(), saved.director);
});
test('A queued restore preserves user pause and applies only after an ordinary resume', () => {
    const g = make(); released(g); const before = g.releaseCount;
    g.lifecycle.paused = true; assert.equal(g.restoreCheckpoint('undo'), true);
    g.update(30); assert.equal(g.releaseCount, before); assert.equal(g.calls.restored.length, 0);
    assert.equal(g.lifecycle.paused, true); assert.equal(g.restoreCheckpoint('undo'), false);
    g.lifecycle.paused = false; g.update(30);
    assert.equal(g.releaseCount, 0); assert.equal(g.clock, g.undoCheckpoint?.clock ?? 0);
    assert.equal(g.calls.restored.length, 1); assert.equal(g.lifecycle.paused, false);
});
test('Undo after an automatic or last-moment drop gives a fresh planning window', () => {
    const g = make(); g.phase = 'planning'; g.planningLeft = .01;
    g.plan(.02); assert.equal(g.phase, 'falling'); assert.equal(g.undoCheckpoint.planningLeft, 0);
    apply(g, 'undo'); finish(g);
    assert.equal(g.planningLeft, 4); assert.equal(g.phase, 'planning');
    g.update(1 / 60); assert.equal(g.phase, 'planning'); assert.equal(g.releaseCount, 0);
    assert(g.planningLeft > 3.9);
});
test('Restore during failure tail clears the failed result and incident without committing or drawing', () => {
    const g = make(); released(g); settle(g); const point = g.stableCheckpoint;
    g.lockFailure('stars_exhausted'); assert.equal(g.highlights.snapshot().locked, true);
    g.incident = {}; g.recoveryFor = .9;
    apply(g, 'stable');
    assert.equal(g.phase, point.phase); assert.equal(g.failureReason, null); assert.equal(g.incident, null);
    assert.equal(g.recoveryFor, 0); assert.equal(g.highlights.snapshot().locked, false);
    assert.equal(runResult.height, 0); assert.equal(runResult.technicalScore, 0);
    assert.deepEqual(g.objectDirector.exportState(), point.director);
});
test('Calibration NEXT is restored correctly on both sides of release and still bypasses RNG', () => {
    const g = make(); g.frames = Object.keys(OBJECTS).flatMap(kind => [{ name: `object_${kind}` }, { name: `next_${kind}` }]);
    assert.equal(g.configureCalibration(['cardboard_box', 'wood_plank', 'fridge'], true), true);
    const next = g.display.next; released(g); settle(g);
    assert.equal(g.stableCheckpoint.next, next); assert.equal(g.undoCheckpoint.next, next);
    apply(g, 'stable'); assert.equal(g.display.next, 'wood_plank'); assert.equal(g.untimedCalibration, true);
    assert.equal(g.objectDirector.snapshot().draws, 0); finish(g);
});
test('Same-size restore keeps the held pose; a resized held piece refits only after solver readiness', () => {
    for (const resized of [false, true]) {
        const g = make(); let refits = 0; released(g);
        g.refitHeld = () => { refits++; g.pendingResize = false; };
        if (resized) g.display.logicalBounds = () => ({ left: -200, right: 200, top: 500, bottom: -300 });
        apply(g, 'undo'); assert.equal(refits, 0); assert.equal(g.pendingResize, resized);
        finish(g); assert.equal(refits, resized ? 1 : 0);
    }
});
test('A resized released piece retains its saved death boundary until a later normal handoff', () => {
    const g = make(); released(g); settle(g); const point = g.stableCheckpoint;
    g.display.logicalBounds = () => ({ left: -200, right: 200, top: 500, bottom: -300 });
    g.refitHeld = () => assert.fail('Released bodies must not be reattached to the claw');
    apply(g, 'stable'); finish(g);
    assert.deepEqual(g.boundary, point.boundary); assert.deepEqual(g.normalBoundary, point.normalBoundary);
    assert.equal(g.pendingResize, true);
});
test('Refitting an entering body preserves its current delivery offset rather than jumping to the endpoint', () => {
    const g = make(); g.phase = 'entering'; g.clock = .12;
    g.current.node.setPosition = (x, y) => { g.current.node.position.x = x; g.current.node.position.y = y; };
    g.refitHeld(); const before = g.current.node.position.y;
    g.enter(); assert.equal(g.current.node.position.y, before);
    assert(g.current.node.position.y > g.boundary.top - g.current.spec.height / 2);
});
test('Undo/replay restores the highlighter history and returns one real score rather than duplicating it', () => {
    const g = make();
    g.world.highlightPlacement = record => ({ id: record.id, supported: true, supportRatio: .25,
        centerOffsetRatio: .8, bridgeGapRatio: 0, bearingCount: 1, supportedBodyIds: [], point: { x: 0, y: 0 } });
    released(g); settle(g); assert.equal(g.highlights.snapshot().technicalScore, 80);
    apply(g, 'undo'); finish(g); assert.equal(g.highlights.snapshot().technicalScore, 0);
    released(g); settle(g); assert.equal(g.highlights.snapshot().technicalScore, 80);
    assert.equal(g.highlights.snapshot().counts.edge_balance, 1);
    g.lockFailure('stars_exhausted'); assert.equal(runResult.technicalScore, 80);
});
test('Repeated stable restore and confirmation cannot award an already-confirmed piece again', () => {
    const g = make(); released(g); settle(g); const point = g.stableCheckpoint;
    for (let i = 0; i < 3; i++) {
        apply(g, 'stable'); finish(g); g.confirmStable(.1);
        assert.equal(g.placedCount, point.placedCount);
        assert.deepEqual(g.highlights.exportState().counts, point.highlights.counts);
        assert.equal(g.undoCheckpoint, null);
    }
});
console.log(JSON.stringify({ status: 'passed', count: checks.length, checks,
    boundary: 'Actual production controller and rule state, engine doubles for world/view/lifecycle. No live Box2D, Cocos rendering, audio, build, device, inventory consumption or ad verification.' }, null, 2));
