/* Pure-rule checks compile the actual production module, not a duplicate Incident implementation.
 * This does not exercise Cocos contact order, the real controller, camera animation or audio. */
'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('/Applications/CocosCreator/3.8.8/CocosCreator.app/Contents/Resources/app.asar.unpacked/node_modules/typescript');

const root = path.resolve(__dirname, '../../../..');
const sourcePath = path.join(root, 'assets/batch1/incident-state.ts');
const source = fs.readFileSync(sourcePath, 'utf8');
const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2017, module: ts.ModuleKind.CommonJS },
    fileName: sourcePath, reportDiagnostics: true,
});
assert.equal((compiled.diagnostics || []).filter(item => item.category === ts.DiagnosticCategory.Error).length, 0);
const moduleRecord = { exports: {} };
vm.runInNewContext(compiled.outputText, { module: moduleRecord, exports: moduleRecord.exports }, { filename: sourcePath });
const { Incident } = moduleRecord.exports;
const normal = { top: 800, bottom: 0, left: -240, right: 240 };
const observation = { top: 900, bottom: -167, left: -320, right: 320 };
const create = ids => new Incident(normal, observation, 620, ids, .75);
const plain = value => JSON.parse(JSON.stringify(value));
const checks = [];
const check = (name, run) => {
    try { const details = run(); checks.push({ name, pass: true, ...(details ? { details } : {}) }); }
    catch (error) { checks.push({ name, pass: false, error: error.stack }); }
};

check('Threshold table covers disabled, rounded and capped collapse counts', () => {
    const table = [[0, null], [1, null], [2, null], [3, 3], [4, 3], [5, 3], [6, 4], [7, 5], [8, 5], [9, 6], [10, 6], [20, 6]];
    for (const [N, K] of table) {
        const incident = create(Array.from({ length: N }, (_, index) => index + 1));
        assert.equal(incident.N, N); assert.equal(incident.K, K);
    }
    return table;
});

check('Trend-only context does not charge a star or invent a loss', () => {
    const incident = create([1, 2, 3]);
    assert.equal(incident.starCharged, false); assert.equal(incident.collapse, false);
    assert.equal(incident.lostIDs.length, 0);
});

check('An unplaced caller-excluded body charges once but never fills the old-tower threshold', () => {
    const records = [{ id: 1, placed: true }, { id: 2, placed: true }, { id: 3, placed: true },
        { id: 4, placed: false }, { id: 5, placed: false }];
    const incident = create(records.filter(body => body.placed).map(body => body.id));
    assert.equal(incident.recordLoss(4).firstLoss, true);
    assert.equal(incident.recordLoss(5).firstLoss, false);
    assert.equal(incident.lostMemberCount, 0); assert.equal(incident.N, 3);
    incident.recordLoss(1); incident.recordLoss(2);
    assert.equal(incident.collapse, false);
    assert.equal(incident.recordLoss(3).collapse, true);
    return { boundary: 'Eligibility filtering is caller fixture setup; production filtering requires engine/controller verification.' };
});

check('Repeated loss events neither charge twice nor inflate the collapse count', () => {
    const incident = create([1, 2, 3]);
    assert.deepEqual(plain(incident.recordLoss(1)), { firstLoss: true, duplicate: false, collapse: false });
    assert.deepEqual(plain(incident.recordLoss(1)), { firstLoss: false, duplicate: true, collapse: false });
    assert.equal(incident.lostMemberCount, 1); assert.equal(incident.lostIDs.length, 1);
});

check('One-star protection does not stop later collapse losses in the same incident', () => {
    const incident = create([1, 2, 3, 4, 5, 6, 7, 8]);
    let charges = 0;
    for (const id of [8, 7, 6, 5]) charges += Number(incident.recordLoss(id).firstLoss);
    assert.equal(incident.collapse, false); assert.equal(incident.K, 5);
    const fifth = incident.recordLoss(4); charges += Number(fifth.firstLoss);
    assert.equal(fifth.collapse, true); assert.equal(charges, 1);
    assert.equal(incident.recordLoss(4).collapse, true); assert.equal(incident.lostMemberCount, 5);
});

check('Fewer than three initial members never activates quantity failure', () => {
    const incident = create([1, 2]);
    for (const id of [1, 2, 3, 4, 5, 6, 7]) assert.equal(incident.recordLoss(id).collapse, false);
    assert.equal(incident.N, 2); assert.equal(incident.K, null);
});

check('Caller mutations and later stable pieces cannot alter frozen membership or view', () => {
    const boundary = { ...normal }, planned = { ...observation }, ids = [1, 2, 3, 3];
    const incident = new Incident(boundary, planned, 620, ids, .75);
    boundary.bottom = 500; planned.bottom = -1000; ids.push(4, 5); ids.shift();
    assert.equal(incident.boundary.bottom, 0); assert.equal(incident.observation.bottom, -167);
    assert.equal(incident.referenceTop, 620); assert.equal(incident.zoom, .75);
    assert.deepEqual(plain(incident.members), [1, 2, 3]); assert.equal(incident.N, 3); assert.equal(incident.K, 3);
    assert.ok(Object.isFrozen(incident.members)); assert.ok(Object.isFrozen(incident.boundary));
    assert.ok(Object.isFrozen(incident.observation));
    incident.recordLoss(4); assert.equal(incident.lostMemberCount, 0);
});

check('Diagnostic snapshots cannot mutate pending incident decisions', () => {
    const incident = create([1, 2, 3]); incident.recordLoss(1);
    const snapshot = incident.snapshot();
    snapshot.members.push(4); snapshot.lostIDs.push(2, 3); snapshot.boundary.bottom = 1000;
    snapshot.observation.bottom = 1000; snapshot.K = 1; snapshot.starCharged = false;
    const exposedLosses = incident.lostIDs; exposedLosses.push(99);
    assert.equal(incident.K, 3); assert.equal(incident.boundary.bottom, 0);
    assert.equal(incident.observation.bottom, -167); assert.equal(incident.starCharged, true);
    assert.equal(incident.lostMemberCount, 1); assert.equal(incident.lostIDs.length, 1);
    assert.equal(incident.collapse, false);
});

check('Minimal external star driver ends on the third separate ordinary incident', () => {
    // This tests the firstLoss contract only. It is not a test of StackGameController.
    let stars = 3;
    const remaining = [];
    for (let index = 0; index < 3; index++) {
        const incident = create([]);
        for (const id of [10 + index, 10 + index, 20 + index]) {
            if (incident.recordLoss(id).firstLoss) stars = Math.max(0, stars - 1);
        }
        remaining.push(stars);
    }
    assert.deepEqual(remaining, [2, 1, 0]);
    return { remaining, boundary: 'External star-driver contract simulation; actual controller failure locking remains a separate engine check.' };
});

const report = {
    executedAt: new Date().toISOString(), source: path.relative(root, sourcePath),
    sourceSha256: crypto.createHash('sha256').update(source).digest('hex'),
    compiler: `TypeScript ${ts.version} transpileModule; CommonJS/ES2017`,
    scope: 'Pure production Incident rules. No Cocos, physical timing, controller, visual, audio or real-device acceptance.',
    passed: checks.filter(item => item.pass).length, total: checks.length, checks,
};
fs.writeFileSync(path.join(__dirname, 'INCIDENT_RULES_CHECK.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ passed: report.passed, total: report.total, sourceSha256: report.sourceSha256 }));
if (report.passed !== report.total) {
    for (const item of checks.filter(item => !item.pass)) console.error(item.name + '\n' + item.error);
    process.exitCode = 1;
}
