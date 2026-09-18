/** Execute the production pure module in memory. No build, app, server or files are produced. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('/Applications/CocosCreator/3.8.8/CocosCreator.app/Contents/Resources/app.asar.unpacked/node_modules/typescript/lib/typescript.js');
const ROOT = path.resolve(__dirname, '../..');
function load(relative) {
    const filename = path.join(ROOT, relative);
    const result = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
        fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2015 },
    });
    const module = new Module(filename);
    module.require = name => {
        assert.equal(name, './object-data', 'Highlights must remain independent of engine/platform/UI');
        return load('assets/batch1/object-data.ts');
    };
    module._compile(result.outputText, filename);
    return module.exports;
}
const { RunHighlights, HIGHLIGHT_TUNING: T, HIGHLIGHT_LABELS } = load('assets/batch1/run-highlights.ts');
const base = { dt: .05, oldTowerRisk: 'Safe', towerRisk: 'Safe', hasExistingTower: true,
    stable: true, incidentActive: false, incidentCount: 0 };
const release = { large: false, oldTowerRisk: 'Safe', oldBodyIds: [1, 2] };
const ordinary = { id: 3, supported: true, supportRatio: 1, centerOffsetRatio: 0,
    bridgeGapRatio: 0, bearingCount: 1, supportedBodyIds: [] };
const bridge = { ...ordinary, supportRatio: .6, bridgeGapRatio: .2, bearingCount: 2 };
const edge = { ...ordinary, supportRatio: .25, centerOffsetRatio: .8 };
function advance(run, seconds = .7, patch = {}) {
    for (let i = 0; i < Math.ceil(seconds / base.dt); i++) run.observe({ ...base, ...patch });
}
function released(run, id = 3, patch = {}) { run.recordRelease(id, { ...release, ...patch }); }
function danger(run, seconds = .4, patch = {}) {
    advance(run, seconds, { oldTowerRisk: 'Critical', towerRisk: 'Critical', stable: false, ...patch });
}
const passed = [];
function check(name, test) { test(); passed.push(name); process.stdout.write(`PASS ${name}\n`); }

check('ordinary / perfect landing adds no formal score or result kind', () => {
    const run = new RunHighlights(); released(run); advance(run);
    assert.deepEqual(run.confirmStable([ordinary]), []);
    assert.equal(run.snapshot().technicalScore, 0);
    assert.deepEqual(Object.keys(run.snapshot().counts).sort(), ['bridge', 'edge_balance', 'large_rescue', 'narrow_escape']);
    assert.equal(Object.values(HIGHLIGHT_LABELS).includes('完美落点'), false);
});

check('sustained old-tower Critical needs recovered risk, true stable duration and confirmation', () => {
    const run = new RunHighlights(); danger(run);
    advance(run, .7, { stable: false });
    assert.deepEqual(run.confirmStable([]), []);
    advance(run, .6);
    assert.deepEqual(run.confirmStable([]), [], 'The ordinary 1.5 s handoff timer is not evidence of stability');
    advance(run, .1);
    assert.equal(run.snapshot().technicalScore, 0, 'Observation alone cannot award success');
    assert.deepEqual(run.confirmStable([]), [{ kind: 'narrow_escape', bodyId: null, points: T.points.narrow_escape, feedback: true }]);
    assert.deepEqual(run.confirmStable([]), []);
    advance(run, 4);
    assert.deepEqual(run.confirmStable([]), [], 'One danger episode cannot be counted on every stable frame');
});

check('separate sustained Critical episodes each count once', () => {
    const run = new RunHighlights(); danger(run); advance(run); run.confirmStable([]);
    danger(run); advance(run);
    const events = run.confirmStable([]);
    assert.equal(events.length, 1); assert.equal(events[0].feedback, false);
    assert.equal(run.snapshot().counts.narrow_escape, 2);
});

check('Critical spikes, impact-only risk and new-object danger never arm old-tower recovery', () => {
    for (const setup of [
        run => { danger(run, .2); advance(run, .1); danger(run, .2); },
        run => advance(run, 2, { oldTowerRisk: 'Safe', towerRisk: 'Critical', stable: false }),
        run => danger(run, 2, { hasExistingTower: false }),
        run => danger(run, 2, { oldTowerRisk: 'Dangerous' }),
    ]) {
        const run = new RunHighlights(); setup(run); advance(run);
        assert.deepEqual(run.confirmStable([]), []);
    }
});

check('recovery accepts Unstable only after both old and complete tower actually recover', () => {
    const run = new RunHighlights(); danger(run);
    advance(run, 1, { towerRisk: 'Dangerous' });
    assert.deepEqual(run.confirmStable([]), []);
    advance(run, 1, { oldTowerRisk: 'Dangerous' });
    assert.deepEqual(run.confirmStable([]), []);
    advance(run, .7, { oldTowerRisk: 'Unstable', towerRisk: 'Unstable' });
    assert.equal(run.confirmStable([])[0].kind, 'narrow_escape');
});

check('loss of the qualified old tower cancels a pending episode', () => {
    const run = new RunHighlights(); danger(run);
    advance(run, .1, { hasExistingTower: false }); advance(run);
    assert.deepEqual(run.confirmStable([]), []);
});

check('zero/invalid pause delta does not progress; long resume frame is capped', () => {
    const run = new RunHighlights(); const before = run.snapshot();
    for (const dt of [0, -1, NaN, Infinity]) run.observe({ ...base, dt, oldTowerRisk: 'Critical', towerRisk: 'Critical' });
    assert.deepEqual(run.snapshot(), before);
    run.observe({ ...base, dt: 300, oldTowerRisk: 'Critical', towerRisk: 'Critical', stable: false });
    assert.equal(run.snapshot().criticalSeconds, T.maxFrameSeconds);
    assert.equal(run.snapshot().pendingRecovery, false);
    run.observe({ ...base, dt: 300 });
    assert.equal(run.snapshot().stableSeconds, T.maxFrameSeconds);
    assert.deepEqual(run.confirmStable([]), []);
});

check('active incident and newly charged incident cancel recovery and pending placement success, including zero-time callbacks', () => {
    for (const patch of [{ incidentActive: true }, { incidentCount: 1 },
        { dt: 0, incidentActive: true }, { dt: 0, incidentCount: 1 }]) {
        const run = new RunHighlights(); released(run); danger(run);
        run.observe({ ...base, ...patch }); advance(run, 1, { incidentCount: 1 });
        assert.deepEqual(run.confirmStable([bridge]), [], 'No geometry celebration on accident survivors');
        assert.deepEqual(run.confirmStable([]), []);
        released(run, 4); advance(run, .7, { incidentCount: 1 });
        assert.equal(run.confirmStable([{ ...bridge, id: 4 }])[0].kind, 'bridge', 'Future clean placements remain eligible');
    }
});

check('paused reads cannot consume an armed recovery or mutate result counts', () => {
    const run = new RunHighlights(); danger(run); advance(run);
    const snapshot = run.snapshot();
    for (let i = 0; i < 20; i++) assert.deepEqual(run.snapshot(), snapshot);
    snapshot.counts.narrow_escape = 99; snapshot.technicalScore = 99999;
    assert.equal(run.confirmStable([])[0].points, T.points.narrow_escape);
    assert.equal(run.snapshot().counts.narrow_escape, 1);
});

check('incident end synchronizes at zero time before a valid same-frame release', () => {
    const run = new RunHighlights();
    run.observe({ ...base, dt: 0, incidentActive: true, incidentCount: 1 });
    const afterIncident = run.snapshot();
    run.observe({ ...base, dt: 0, incidentActive: false, incidentCount: 1 });
    assert.deepEqual(run.snapshot(), afterIncident, 'Zero-time end cannot grant stable time or success');
    released(run); advance(run, .7, { incidentCount: 1 });
    assert.equal(run.confirmStable([bridge])[0].kind, 'bridge', 'A clean release after recovery is eligible immediately');
});

check('bridge needs distinct bearing count, a real central gap and stable support', () => {
    for (const patch of [{ bearingCount: 1 }, { bridgeGapRatio: 0 }, { bridgeGapRatio: .119 },
        { supportRatio: .149 }, { supported: false }, { bridgeGapRatio: 1.1 }, { bearingCount: 2.5 }]) {
        const run = new RunHighlights(); released(run); advance(run);
        assert.deepEqual(run.confirmStable([{ ...bridge, ...patch }]), []);
    }
    const run = new RunHighlights(); released(run); advance(run);
    assert.equal(run.confirmStable([{ ...bridge, bridgeGapRatio: T.bridgeMinGapRatio }])[0].kind, 'bridge');
});

check('edge needs narrow real support and COM near its edge, not a centrally supported wide plank', () => {
    for (const patch of [{ supportRatio: .149 }, { supportRatio: .351 }, { centerOffsetRatio: .649 },
        { centerOffsetRatio: 0 }, { centerOffsetRatio: 1.01 }, { centerOffsetRatio: -.8 }, { bearingCount: 2 }]) {
        const run = new RunHighlights(); released(run); advance(run);
        assert.deepEqual(run.confirmStable([{ ...edge, ...patch }]), []);
    }
    const run = new RunHighlights(); released(run); advance(run);
    assert.equal(run.confirmStable([edge])[0].kind, 'edge_balance');
});

check('geometry highlights preserve true stable confirmation even if conservative risk stays Dangerous', () => {
    const run = new RunHighlights(); released(run);
    advance(run, .7, { oldTowerRisk: 'Dangerous', towerRisk: 'Dangerous' });
    assert.equal(run.confirmStable([edge])[0].kind, 'edge_balance');
    assert.equal(run.snapshot().counts.narrow_escape, 0);
});

check('malformed geometry never awards a geometric event', () => {
    for (const patch of [{ supportRatio: NaN }, { supportRatio: Infinity }, { supportRatio: -1 },
        { supportRatio: 2 }, { bearingCount: NaN }, { bridgeGapRatio: NaN }]) {
        const run = new RunHighlights(); released(run); advance(run);
        assert.deepEqual(run.confirmStable([{ ...bridge, ...patch }]), []);
    }
    const run = new RunHighlights(); released(run); advance(run);
    assert.deepEqual(run.confirmStable([{ ...edge, centerOffsetRatio: NaN }]), []);
});

check('large rescue needs high risk at release and must really support a pre-release confirmed old body', () => {
    const run = new RunHighlights(); released(run, 3, { large: true, oldTowerRisk: 'Dangerous' }); advance(run);
    const events = run.confirmStable([{ ...ordinary, supportedBodyIds: [1] }]);
    assert.equal(events[0].kind, 'large_rescue');
    for (const [releasePatch, placementPatch, framePatch] of [
        [{ large: false, oldTowerRisk: 'Dangerous' }, { supportedBodyIds: [1] }, {}],
        [{ large: true }, { supportedBodyIds: [1] }, {}],
        [{ large: true, oldTowerRisk: 'Critical' }, { supportedBodyIds: [] }, {}],
        [{ large: true, oldTowerRisk: 'Critical' }, { supportedBodyIds: [4] }, {}],
        [{ large: true, oldTowerRisk: 'Critical', oldBodyIds: [1] }, { supportedBodyIds: [1] }, {}],
        [{ large: true, oldTowerRisk: 'Critical', oldBodyIds: [1, 1] }, { supportedBodyIds: [1] }, {}],
        [{ large: true, oldTowerRisk: 'Dangerous' }, { supportedBodyIds: [1] }, { towerRisk: 'Dangerous' }],
    ]) {
        const other = new RunHighlights(); released(other, 3, releasePatch); advance(other, .7, framePatch);
        assert.deepEqual(other.confirmStable([{ ...ordinary, ...placementPatch }]), []);
    }
});

check('release captures old-body history and rejects duplicate release rewriting', () => {
    const run = new RunHighlights(); const oldBodyIds = [1, 2];
    released(run, 3, { large: true, oldTowerRisk: 'Dangerous', oldBodyIds }); oldBodyIds.push(4);
    released(run, 3, { large: true, oldTowerRisk: 'Dangerous', oldBodyIds: [1, 4] }); advance(run);
    assert.deepEqual(run.confirmStable([{ ...ordinary, supportedBodyIds: [4] }]), []);
});

check('late stable batch scores each piece at most once with deterministic bridge/edge/rescue priority', () => {
    const run = new RunHighlights();
    for (const id of [3, 4, 5]) released(run, id, { large: true, oldTowerRisk: 'Dangerous' });
    advance(run);
    const pieces = [{ ...bridge, supportedBodyIds: [1] }, { ...edge, id: 4, supportedBodyIds: [1] },
        { ...ordinary, id: 5, supportedBodyIds: [1] }];
    const events = run.confirmStable([...pieces, pieces[0], pieces[1]]);
    assert.deepEqual(events.map(event => event.kind), ['bridge', 'edge_balance', 'large_rescue']);
    assert.equal(events.filter(event => event.feedback).length, 1);
    assert.equal(run.snapshot().technicalScore, T.points.bridge + T.points.edge_balance + T.points.large_rescue);
    assert.deepEqual(run.confirmStable(pieces), []);
});

check('first ordinary confirmation consumes later geometric mutations and unsupported confirmations', () => {
    const run = new RunHighlights(); released(run); advance(run); run.confirmStable([ordinary]);
    released(run); advance(run);
    assert.deepEqual(run.confirmStable([bridge]), []);
    const other = new RunHighlights(); released(other); advance(other);
    other.confirmStable([{ ...bridge, supported: false }]);
    assert.deepEqual(other.confirmStable([bridge]), []);
});

check('a body event and independent danger episode may coincide without duplicate episode counting', () => {
    const run = new RunHighlights(); released(run); danger(run); advance(run);
    assert.deepEqual(run.confirmStable([bridge]).map(event => event.kind), ['bridge', 'narrow_escape']);
    assert.deepEqual(run.confirmStable([bridge]), []);
});

check('feedback cooldown never suppresses points and never queues stale audio', () => {
    const run = new RunHighlights(); released(run); advance(run);
    assert.equal(run.confirmStable([bridge])[0].feedback, true);
    released(run, 4); advance(run);
    assert.equal(run.confirmStable([{ ...bridge, id: 4 }])[0].feedback, false);
    assert.equal(run.snapshot().technicalScore, T.points.bridge * 2);
    advance(run, 7);
    assert.deepEqual(run.confirmStable([]), [], 'No replay after the old event cooldown expires');
    released(run, 5); advance(run);
    assert.equal(run.confirmStable([{ ...bridge, id: 5 }])[0].feedback, true);
});

check('new release cannot borrow the preceding placement stable duration', () => {
    const run = new RunHighlights(); advance(run, 2); released(run);
    assert.deepEqual(run.confirmStable([bridge]), []);
    advance(run); assert.equal(run.confirmStable([bridge])[0].kind, 'bridge');
});

check('failure lock freezes all result data and internal clocks despite later collapse callbacks', () => {
    const run = new RunHighlights(); released(run); advance(run); run.confirmStable([bridge]);
    danger(run); const locked = run.lock();
    released(run, 4); advance(run, 10); danger(run, 1);
    run.observe({ ...base, incidentActive: true, incidentCount: 9 });
    assert.deepEqual(run.confirmStable([{ ...bridge, id: 4 }]), []);
    assert.deepEqual(run.snapshot(), locked);
    const external = run.lock(); external.counts.bridge = 99;
    assert.deepEqual(run.snapshot(), locked);
});

check('invalid IDs and unregistered placements cannot manufacture scores', () => {
    const run = new RunHighlights();
    for (const id of [0, -1, NaN, Infinity, 1.5]) released(run, id);
    advance(run);
    assert.deepEqual(run.confirmStable([bridge, ...[0, -1, NaN, Infinity, 1.5].map(id => ({ ...bridge, id }))]), []);
});

check('checkpoint restores pending releases and late confirmation without borrowing extra stable time', () => {
    const run = new RunHighlights(); released(run, 3); released(run, 4, { large: true, oldTowerRisk: 'Dangerous' });
    advance(run, .3); const saved = run.exportState();
    advance(run); run.confirmStable([bridge, { ...ordinary, id: 4, supportedBodyIds: [1] }]);
    run.restoreState(saved);
    assert.deepEqual(run.exportState(), saved, 'Restore does not tick clocks or confirm bodies');
    assert.deepEqual(run.confirmStable([bridge]), [], 'Partial stable time stays partial');
    advance(run, .4);
    const events = run.confirmStable([bridge, { ...ordinary, id: 4, supportedBodyIds: [1] }]);
    assert.deepEqual(events.map(event => event.kind), ['bridge', 'large_rescue']);
    assert.deepEqual(events.map(event => event.feedback), [true, false]);
    const settled = run.exportState();
    run.restoreState(settled); released(run, 3); advance(run);
    assert.deepEqual(run.confirmStable([bridge]), [], 'Confirmed body IDs survive recovery');
    assert.equal(run.snapshot().counts.bridge, 1);
});

check('checkpoint preserves partial Critical, armed recovery, and the remaining recovery duration', () => {
    const run = new RunHighlights(); danger(run, .2); const partialCritical = run.exportState();
    danger(run, 1); advance(run); run.confirmStable([]);
    run.restoreState(partialCritical); danger(run, .2);
    assert.equal(run.snapshot().pendingRecovery, true, 'Partial Critical time is carried forward');
    advance(run, .3); const partialRecovery = run.exportState();
    advance(run); run.confirmStable([]); run.restoreState(partialRecovery);
    assert.deepEqual(run.confirmStable([]), []);
    advance(run, .4);
    assert.equal(run.confirmStable([])[0].kind, 'narrow_escape');
    assert.deepEqual(run.confirmStable([]), []);
    assert.equal(run.snapshot().counts.narrow_escape, 1, 'Discarded future award is rolled back exactly once');
});

check('checkpoint preserves feedback cooldown without replaying feedback or losing scores', () => {
    const run = new RunHighlights(); released(run); advance(run); run.confirmStable([bridge]);
    const saved = run.exportState(); advance(run, 20); released(run, 4); advance(run); run.confirmStable([{ ...edge, id: 4 }]);
    run.restoreState(saved);
    assert.deepEqual(run.confirmStable([]), [], 'Restore itself never replays a past event');
    released(run, 4); advance(run);
    assert.equal(run.confirmStable([{ ...edge, id: 4 }])[0].feedback, false);
    advance(run, 6); released(run, 5); advance(run);
    assert.equal(run.confirmStable([{ ...bridge, id: 5 }])[0].feedback, true);
    assert.equal(run.snapshot().technicalScore, T.points.bridge * 2 + T.points.edge_balance);
});

check('checkpoint restores incident cancellation and locked status, and can recover an earlier unlocked checkpoint', () => {
    const run = new RunHighlights(); released(run); advance(run); const playable = run.exportState();
    run.confirmStable([bridge]); run.lock(); const frozen = run.exportState();
    const restored = new RunHighlights(); restored.restoreState(frozen); danger(restored); released(restored, 4); advance(restored);
    assert.deepEqual(restored.confirmStable([{ ...bridge, id: 4 }]), []);
    assert.deepEqual(restored.exportState(), frozen);
    run.restoreState(playable);
    assert.equal(run.confirmStable([bridge])[0].kind, 'bridge', 'Restoring a pre-failure ledger unlocks it');
    run.observe({ ...base, dt: 0, incidentActive: true, incidentCount: 2 });
    const incident = run.exportState();
    run.observe({ ...base, dt: 0, incidentActive: false, incidentCount: 2 }); released(run, 4);
    run.restoreState(incident); released(run, 5); advance(run, 1, { incidentActive: true, incidentCount: 2 });
    assert.deepEqual(run.exportState().releases, []);
    assert.equal(run.exportState().incidentCount, 2);
});

check('checkpoint counts, release records, old body IDs and confirmations are detached in both directions', () => {
    const run = new RunHighlights(); released(run); advance(run); run.confirmStable([bridge]);
    released(run, 4, { large: true, oldTowerRisk: 'Dangerous' }); const clean = run.exportState();
    const exported = run.exportState(); exported.counts.bridge = 10; exported.confirmed.push(5);
    exported.releases[0].large = false; exported.releases[0].oldBodyIds.push(6); exported.releases.length = 0;
    assert.deepEqual(run.exportState(), clean);
    const input = run.exportState(); run.lock(); run.restoreState(input);
    input.counts.bridge = 10; input.confirmed.length = 0; input.releases[0].oldBodyIds.length = 0;
    input.releases[0].oldTowerRisk = 'Safe'; input.releases.push({ id: 5, ...release });
    assert.deepEqual(run.exportState(), clean);
    advance(run); assert.equal(run.confirmStable([{ ...ordinary, id: 4, supportedBodyIds: [1] }])[0].kind, 'large_rescue');
});

check('invalid highlight checkpoint rejection leaves all score, timers and late history unchanged', () => {
    const run = new RunHighlights(); released(run); advance(run); run.confirmStable([bridge]);
    released(run, 4); danger(run); const clean = run.exportState();
    const corrupt = [
        state => { state.technicalScore++; }, state => { state.counts.bridge = -1; }, state => { state.counts = null; },
        state => { state.locked = 1; }, state => { state.pendingRecovery = 1; }, state => { state.incidentActive = 1; },
        state => { state.incidentCount = -1; }, state => { state.elapsedSeconds = NaN; },
        state => { state.criticalSeconds = Infinity; }, state => { state.stableSeconds = -1; },
        state => { state.recoverySeconds = state.stableSeconds + 1; }, state => { state.lastFeedbackSeconds = -Infinity; },
        state => { state.lastFeedbackSeconds = state.elapsedSeconds + 1; },
        state => { state.confirmed.push(3); }, state => { state.confirmed = []; },
        state => { state.confirmed.push(0); }, state => { state.releases = null; },
        state => { state.releases.push({ ...state.releases[0] }); },
        state => { state.releases[0].id = 3; }, state => { state.releases[0].large = 1; },
        state => { state.releases[0].oldTowerRisk = 'Unknown'; }, state => { state.releases[0].oldBodyIds.push(1); },
        state => { state.releases[0].oldBodyIds.push(4); }, state => { state.incidentActive = true; },
    ];
    for (const change of corrupt) {
        const bad = structuredClone(clean); change(bad);
        assert.throws(() => run.restoreState(bad), /checkpoint|history/);
        assert.deepEqual(run.exportState(), clean, 'Late rejection may not overwrite earlier score/timer fields');
    }
    assert.throws(() => run.restoreState(null), /checkpoint/);
    assert.deepEqual(run.exportState(), clean);
    const empty = new RunHighlights(); empty.restoreState(new RunHighlights().exportState());
    assert.equal(empty.exportState().lastFeedbackSeconds, -Infinity, 'Empty in-memory sentinel is a valid initial checkpoint');
});

process.stdout.write(JSON.stringify({ status: 'passed', checks: passed.length,
    limits: 'Pure production source rules only; no project build/start, real physics, rendering/audio or device acceptance.' }) + '\n');
