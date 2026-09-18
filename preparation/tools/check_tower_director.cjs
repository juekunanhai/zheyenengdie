/** Pure production-module tests. No Cocos process, browser, server or files are started/written. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('/Applications/CocosCreator/3.8.8/CocosCreator.app/Contents/Resources/app.asar.unpacked/node_modules/typescript/lib/typescript.js');
const ROOT = path.resolve(__dirname, '../..');
const cache = new Map();
function load(file) {
    const full = path.join(ROOT, file);
    if (cache.has(full)) return cache.get(full).exports;
    const compiled = ts.transpileModule(fs.readFileSync(full, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2015 }, fileName: full,
    });
    const module = new Module(full); cache.set(full, module);
    module.require = request => {
        assert.equal(request, './object-data', 'The pure director must not gain engine/platform dependencies');
        return load('assets/batch1/object-data.ts');
    };
    module._compile(compiled.outputText, full);
    return module.exports;
}
const { TowerDirector, classifyTowerRisk, DIRECTOR_OBJECTS, DIRECTOR_TUNING } = load('assets/batch1/tower-director.ts');
const { CALIBRATION_SEQUENCE, OBJECTS } = load('assets/batch1/object-data.ts');
const calm = { maxTiltDegrees: 0, maxAngularSpeed: 0, minSupportRatio: 1,
    unsupportedMassRatio: 0, recentImpactSpeed: 0, mainSupportStable: true };
const base = { elapsedSeconds: 100, risk: 'Safe', stableSeconds: 0, incidentCount: 0 };
const isHard = kind => ['Hard', 'Chaos'].includes(DIRECTOR_OBJECTS[kind].difficulty);
const hasRole = (kind, role) => DIRECTOR_OBJECTS[kind].roles.includes(role);
const rescue = kind => hasRole(kind, 'Rescue') || hasRole(kind, 'Platform');
function generated(seed, count, context = base, observe = false) {
    const director = new TowerDirector(seed), kinds = [director.current, director.next];
    while (kinds.length < count) {
        if (observe) for (let i = 0; i < 7; i++) { director.snapshot(); classifyTowerRisk({ ...calm, maxTiltDegrees: i * 10 }); }
        const nextContext = typeof context === 'function' ? context(kinds.length) : context;
        kinds.push(director.handoff(nextContext).next);
    }
    return { kinds, state: director.snapshot() };
}
const passed = [];
function check(name, run) { run(); passed.push(name); process.stdout.write(`PASS ${name}\n`); }

check('risk boundaries, six factors, valid zero, malformed sample', () => {
    assert.equal(classifyTowerRisk(calm), 'Safe');
    for (const [signal, value, expected] of [
        ['maxTiltDegrees', 8, 'Unstable'], ['maxTiltDegrees', 18, 'Dangerous'], ['maxTiltDegrees', 32, 'Critical'],
        ['maxAngularSpeed', 35, 'Dangerous'], ['minSupportRatio', .45, 'Unstable'], ['minSupportRatio', 0, 'Critical'],
        ['unsupportedMassRatio', .35, 'Dangerous'], ['recentImpactSpeed', 5, 'Critical'],
        ['mainSupportStable', false, 'Dangerous'], ['maxTiltDegrees', NaN, 'Critical'],
    ]) assert.equal(classifyTowerRisk({ ...calm, [signal]: value }), expected, signal);
});

check('approved fourteen-piece opening, first-eight limits and early absurdity', () => {
    for (const seed of [0, 1, 0xffffffff, 123456]) {
        for (const risk of ['Safe', 'Critical']) {
            const result = generated(seed, 14, { ...base, risk, incidentCount: 1 });
            assert.deepEqual(result.kinds, CALIBRATION_SEQUENCE);
            assert.equal(result.state.draws, 0, 'The fixed prefix does not consume RNG');
            assert(result.kinds.slice(0, 8).every(kind => !hasRole(kind, 'Rolling') && !hasRole(kind, 'Slippery')));
            assert(result.kinds.slice(0, 6).some(kind => DIRECTOR_OBJECTS[kind].absurdity !== 'Normal'));
            assert.equal(new Set(result.kinds).size, 12);
        }
    }
});

check('seed replay and RNG stability across observation frequency', () => {
    const a = generated(12345, 500, i => ({ ...base, risk: i % 9 === 0 ? 'Dangerous' : 'Safe', elapsedSeconds: i * 5 }));
    const b = generated(12345, 500, i => ({ ...base, risk: i % 9 === 0 ? 'Dangerous' : 'Safe', elapsedSeconds: i * 5 }), true);
    assert.deepEqual(a, b);
    assert.notDeepEqual(a.kinds.slice(14), generated(54321, 500).kinds.slice(14));
    assert.equal(a.state.draws, 486, 'One random draw per newly generated post-opening object');
    assert.deepEqual(generated(0, 60), generated(0, 60), 'Zero is a reproducible seed');
});

check('advertised NEXT stays locked through risk, snapshots and incident; handoff consumes it once', () => {
    const director = new TowerDirector(90210);
    for (let i = 0; i < 15; i++) director.handoff(base);
    const before = director.snapshot();
    const changed = { ...base, risk: 'Critical', incidentCount: 1 };
    for (let i = 0; i < 100; i++) { classifyTowerRisk({ ...calm, minSupportRatio: 0 }); director.snapshot(); }
    assert.deepEqual(director.snapshot(), before, 'Read-only observation or an incident does not secretly handoff');
    const after = director.handoff(changed);
    assert.equal(after.current, before.next);
    assert.equal(director.snapshot().draws, before.draws + 1);
    assert.equal(director.current, after.current);
    assert.equal(director.next, after.next);
    const detachedSnapshot = director.snapshot(); detachedSnapshot.next = 'basketball';
    assert.equal(director.next, after.next, 'Debug snapshot is not a mutable director state');
});

check('post-opening filters across 51,200 generated turns', () => {
    for (let seed = 0; seed < 128; seed++) {
        const { kinds } = generated(seed, 400, { ...base, elapsedSeconds: seed % 2 ? 60 : 600, stableSeconds: 60 });
        let hardStreak = 0, rollingStreak = 0, platformGap = 0;
        const seen = new Map();
        for (let i = 0; i < kinds.length; i++) {
            const kind = kinds[i]; assert(OBJECTS[kind], 'Only the twelve available assets are emitted');
            hardStreak = isHard(kind) ? hardStreak + 1 : 0;
            rollingStreak = hasRole(kind, 'Rolling') ? rollingStreak + 1 : 0;
            platformGap = rescue(kind) ? 0 : platformGap + 1;
            if (i >= 14) {
                assert.notEqual(kind, kinds[i - 1], 'No adjacent duplicate');
                assert(hardStreak <= 2, 'Recover after two Hard/Chaos');
                assert(rollingStreak <= 2, 'Never three rolling objects');
                assert(platformGap <= DIRECTOR_TUNING.maxPlatformGap, 'Offer a rescue within eight draws');
                if (seed % 2) assert(!(hasRole(kinds[i - 1], 'Slippery') && hasRole(kind, 'Rolling')), 'Early ice-to-ball');
                if (DIRECTOR_OBJECTS[kind].rarity === 'Rare' && seen.has(kind))
                    assert(i - seen.get(kind) >= DIRECTOR_TUNING.rareCooldownDraws, 'Rare cooldown');
            }
            seen.set(kind, i);
        }
    }
});

check('incident recovery affects only two unseen draws and does not reset on unchanged count', () => {
    for (let seed = 0; seed < 100; seed++) {
        const director = new TowerDirector(seed);
        for (let i = 0; i < 18; i++) director.handoff({ ...base, elapsedSeconds: 500 });
        const advertised = director.next;
        for (let i = 0; i < 2; i++) {
            const result = director.handoff({ ...base, elapsedSeconds: 500, incidentCount: 1 });
            if (i === 0) assert.equal(result.current, advertised, 'An already promised Hard may still be current');
            assert(!isHard(result.next));
            assert(!hasRole(result.next, 'Rolling') && !hasRole(result.next, 'Slippery'));
        }
        assert.equal(director.snapshot().recoveryDrawsRemaining, 0);
        director.handoff({ ...base, incidentCount: 1 });
        assert.equal(director.snapshot().recoveryDrawsRemaining, 0);
        director.handoff({ ...base, incidentCount: 2 });
        assert.equal(director.snapshot().recoveryDrawsRemaining, 1, 'A genuinely new incident renews recovery');
    }
});

check('high risk increases rescue opportunity; long stable period increases danger; time raises difficulty', () => {
    function count(context, predicate) {
        let hits = 0;
        for (let seed = 0; seed < 100; seed++) hits += generated(seed, 214, context).kinds.slice(14).filter(predicate).length;
        return hits;
    }
    const safeRescue = count(base, rescue), dangerousRescue = count({ ...base, risk: 'Dangerous' }, rescue);
    assert(dangerousRescue > safeRescue * 1.35, `${safeRescue} => ${dangerousRescue}`);
    const normalDanger = count(base, kind => hasRole(kind, 'Danger'));
    const stableDanger = count({ ...base, stableSeconds: 60 }, kind => hasRole(kind, 'Danger'));
    assert(stableDanger > normalDanger * 1.15, `${normalDanger} => ${stableDanger}`);
    const earlyHard = count({ ...base, elapsedSeconds: 20 }, isHard), lateHard = count({ ...base, elapsedSeconds: 500 }, isHard);
    assert(lateHard > earlyHard * 2, `${earlyHard} => ${lateHard}`);
    process.stdout.write(JSON.stringify({ safeRescue, dangerousRescue, normalDanger, stableDanger, earlyHard, lateHard }) + '\n');
});

check('steady Unstable tower can increase challenge; Dangerous/Critical ignore stale steady duration', () => {
    let shortDanger = 0, steadyDanger = 0;
    for (let seed = 0; seed < 32; seed++) {
        const short = generated(seed, 314, { ...base, risk: 'Unstable', stableSeconds: 0 });
        const steady = generated(seed, 314, { ...base, risk: 'Unstable', stableSeconds: 60 });
        shortDanger += short.kinds.slice(14).filter(kind => hasRole(kind, 'Danger')).length;
        steadyDanger += steady.kinds.slice(14).filter(kind => hasRole(kind, 'Danger')).length;
        assert.deepEqual(steady, generated(seed, 314, { ...base, risk: 'Safe', stableSeconds: 60 }),
            'A steady tower marked Unstable only by conservative coverage receives the same long-steady policy');
        for (const risk of ['Dangerous', 'Critical']) {
            assert.deepEqual(generated(seed, 314, { ...base, risk, stableSeconds: 0 }),
                generated(seed, 314, { ...base, risk, stableSeconds: 60 }),
                `${risk} must not increase Danger weights because an old steady duration remains`);
        }
    }
    assert(steadyDanger > shortDanger * 1.15, `${shortDanger} => ${steadyDanger}`);
    process.stdout.write(JSON.stringify({ unstableNormalDanger: shortDanger, unstableSteadyDanger: steadyDanger }) + '\n');
});

check('checkpoint restores the exact current/NEXT/RNG and replays future draws across prefix and incidents', () => {
    for (const seed of [0, 1, 0xffffffff, 873451]) for (const turns of [0, 4, 12, 35, 81]) {
        const director = new TowerDirector(seed);
        const context = turn => ({ ...base, elapsedSeconds: turn * 7, risk: turn % 5 ? 'Safe' : 'Critical',
            stableSeconds: turn % 3 ? 0 : 30, incidentCount: Math.floor(turn / 17) });
        for (let turn = 0; turn < turns; turn++) director.handoff(context(turn));
        const saved = director.exportState();
        for (let read = 0; read < 5; read++) assert.deepEqual(director.exportState(), saved, 'Export consumes no RNG');
        const continuation = [];
        for (let turn = turns; turn < turns + 180; turn++) {
            director.handoff(context(turn)); continuation.push(director.exportState());
        }
        director.restoreState(saved);
        assert.deepEqual(director.exportState(), saved, 'Restore consumes no draw and retains advertised NEXT');
        assert.equal(director.seed, seed);
        for (let offset = 0; offset < continuation.length; offset++) {
            director.handoff(context(turns + offset));
            assert.deepEqual(director.exportState(), continuation[offset], 'Cooldown/history/recovery reproduce the future sequence');
        }
    }
});

check('checkpoint captures incident recovery remaining draws instead of restarting recovery', () => {
    const director = new TowerDirector(42);
    for (let i = 0; i < 25; i++) director.handoff(base);
    director.handoff({ ...base, incidentCount: 1 });
    const saved = director.exportState(); assert.equal(saved.recoveryDrawsRemaining, 1);
    const expected = [director.handoff({ ...base, incidentCount: 1 }), director.handoff({ ...base, incidentCount: 1 })];
    director.restoreState(saved);
    assert.deepEqual(director.handoff({ ...base, incidentCount: 1 }), expected[0]);
    assert.equal(director.exportState().recoveryDrawsRemaining, 0);
    assert.deepEqual(director.handoff({ ...base, incidentCount: 1 }), expected[1]);
});

check('exported and restored director history never aliases caller values', () => {
    const director = new TowerDirector(91);
    for (let i = 0; i < 25; i++) director.handoff(base);
    const clean = director.exportState(), exported = director.exportState();
    exported.lastSeen[0].index = 9999; exported.lastSeen.length = 0; exported.next = 'basketball';
    assert.deepEqual(director.exportState(), clean);
    const input = director.exportState(); director.handoff(base); director.restoreState(input);
    input.lastSeen[0].index = 9999; input.lastSeen.push({ kind: 'toilet', index: 9999 }); input.rngState = 0;
    assert.deepEqual(director.exportState(), clean);
});

check('invalid director checkpoint rejection is atomic, including seed mismatch and late history validation', () => {
    const director = new TowerDirector(91);
    for (let i = 0; i < 25; i++) director.handoff(base);
    const clean = director.exportState();
    const corrupt = [
        state => { state.seed++; }, state => { state.rngState++; }, state => { state.draws = -1; },
        state => { state.generatedCount++; }, state => { state.turn++; }, state => { state.current = 'unknown'; },
        state => { state.next = 'toString'; }, state => { state.lastKind = null; }, state => { state.hardStreak = NaN; },
        state => { state.rollingStreak = state.hardStreak + 1; }, state => { state.platformGap = -1; },
        state => { state.incidentCount = 1.5; }, state => { state.recoveryDrawsRemaining = 3; },
        state => { state.lastSeen = null; }, state => { state.lastSeen.push({ ...state.lastSeen[0] }); },
        state => { state.lastSeen[0].index = state.generatedCount; },
        state => { state.lastSeen = state.lastSeen.filter(entry => entry.kind !== state.next); },
        state => { state.lastSeen = state.lastSeen.filter(entry => entry.kind !== 'whale'); },
    ];
    for (const change of corrupt) {
        const bad = structuredClone(clean); change(bad);
        assert.throws(() => director.restoreState(bad), /checkpoint/);
        assert.deepEqual(director.exportState(), clean, 'Rejected state may not partially change RNG/history');
    }
    assert.throws(() => director.restoreState(null), /checkpoint/);
    assert.deepEqual(director.exportState(), clean);
});

process.stdout.write(JSON.stringify({ status: 'passed', checks: passed.length,
    limits: 'Pure source logic only. No Cocos startup, physical playtest, visual/audio review or WeChat/device acceptance.' }) + '\n');
