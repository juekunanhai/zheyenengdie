/* Batch 3 pure collection/progress/share checks. No Cocos startup, build or platform runtime. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('/Applications/CocosCreator/3.8.8/CocosCreator.app/Contents/Resources/app.asar.unpacked/node_modules/typescript/lib/typescript.js');
const root = path.resolve(__dirname, '../..');
const modules = new Map();
function load(name) {
    if (modules.has(name)) return modules.get(name);
    const module = { exports: {} }; modules.set(name, module.exports);
    const file = path.join(root, 'assets/batch1', `${name}.ts`);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
        target: ts.ScriptTarget.ES2018, module: ts.ModuleKind.CommonJS,
    } }).outputText;
    const requireLocal = id => load(id.replace('./', ''));
    new vm.Script(`(function(require,module,exports){${code}\n})`, { filename: file })
        .runInThisContext()(requireLocal, module, module.exports);
    return module.exports;
}
const { CollectionLedger, OBJECT_COLLECTION, ITEM_COLLECTION } = load('collection-system');
const checks = [];
function check(name, run) { run(); checks.push(name); }

check('catalog_covers_all_objects_and_items', () => {
    assert.equal(OBJECT_COLLECTION.length, 24);
    assert.equal(new Set(OBJECT_COLLECTION.map(entry => entry.kind)).size, 24);
    assert.equal(ITEM_COLLECTION.length, 6);
    assert.equal(new Set(ITEM_COLLECTION.map(entry => entry.kind)).size, 6);
    assert.ok(OBJECT_COLLECTION.every(entry => entry.spriteName.startsWith('object_') && entry.nextSpriteName.startsWith('next_')));
});

check('first_seen_unlocks_are_monotonic_and_run_scoped', () => {
    const ledger = new CollectionLedger();
    assert.equal(ledger.discoverObject('cardboard_box'), true);
    assert.equal(ledger.discoverObject('cardboard_box'), false);
    assert.equal(ledger.discoverItem('undo'), true);
    assert.deepEqual(ledger.runDiscoveries(), { objects: ['cardboard_box'], items: ['undo'] });
    const saved = ledger.snapshot();
    const restored = new CollectionLedger(saved);
    assert.deepEqual(restored.runDiscoveries(), { objects: [], items: [] });
    assert.equal(restored.discoverObject('cardboard_box'), false);
    assert.equal(restored.discoverItem('shrink'), true);
    assert.deepEqual(restored.runDiscoveries(), { objects: [], items: ['shrink'] });
});

check('invalid_progress_is_rejected_without_mutating_saved_state', () => {
    const ledger = new CollectionLedger(); ledger.discoverObject('fridge');
    const before = ledger.snapshot();
    assert.throws(() => ledger.restoreState({ schemaVersion: 1, discoveredObjects: ['fridge', 'fridge'], discoveredItems: [], bestHeight: 0 }), /Invalid player progress/);
    assert.deepEqual(ledger.snapshot(), before);
});

check('best_height_keeps_real_zero_and_only_accepts_a_new_record', () => {
    const ledger = new CollectionLedger();
    assert.equal(ledger.finishRun(0), false);
    assert.equal(ledger.finishRun(12.4), true);
    assert.equal(ledger.finishRun(12.4), false);
    assert.equal(ledger.snapshot().bestHeight, 12.4);
});

check('runtime_entrypoints_keep_collection_and_share_outside_core_rules', () => {
    const actions = fs.readFileSync(path.join(root, 'assets/batch1/scene-actions.ts'), 'utf8');
    const result = fs.readFileSync(path.join(root, 'assets/batch0/presentation/ResultPresentation.ts'), 'utf8');
    assert.match(actions, /new CollectionView/); assert.match(actions, /makeCollectionButton/);
    assert.match(result, /createShareAdapter/); assert.match(result, /createRunSharePayload/);
});

function loadShare(globals) {
    const file = path.join(root, 'assets/batch1/share-adapter.ts');
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
        target: ts.ScriptTarget.ES2018, module: ts.ModuleKind.CommonJS,
    } }).outputText;
    const sandbox = { module: { exports: {} }, ...globals };
    sandbox.exports = sandbox.module.exports;
    sandbox.globalThis = sandbox;
    vm.runInNewContext(`(function(module,exports){${code}\n})(module,exports)`, sandbox, { filename: file });
    return sandbox.module.exports;
}

(async () => {
    const wxCalls = [];
    const wxShare = loadShare({ wx: { shareAppMessage: options => wxCalls.push(options) } });
    const payload = wxShare.createRunSharePayload({ runId: 'r1', height: 4.2 });
    assert.equal(payload.shareType, 'normal'); assert.equal(payload.mode, 'normal');
    assert.equal(payload.runId, 'r1'); assert.equal(payload.targetHeight, 4.2);
    const wxResult = await wxShare.createShareAdapter().share(payload);
    assert.equal(wxResult.status, 'shared'); assert.equal(wxCalls.length, 1);
    assert.match(wxCalls[0].query, /shareType=normal/); assert.match(wxCalls[0].query, /targetHeight=4.2/);
    checks.push('wechat_share_uses_normal_payload_and_route_query');

    const webCalls = [];
    const webShare = loadShare({ navigator: { share: async data => webCalls.push(data) } });
    const webResult = await webShare.createShareAdapter().share(payload);
    assert.equal(webResult.status, 'shared'); assert.equal(webCalls.length, 1); assert.match(webCalls[0].text, /4\.2m/);
    checks.push('web_share_uses_user_triggered_adapter_payload');

    console.log(JSON.stringify({ status: 'passed', checks,
        scope: 'Pure collection/progress/share adapters; no Cocos startup, build, rendering or device acceptance.' }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
