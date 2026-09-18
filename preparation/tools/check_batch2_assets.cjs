/* Static Batch 2 asset/data gate. No Cocos import, build, render or device run. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('/Applications/CocosCreator/3.8.8/CocosCreator.app/Contents/Resources/app.asar.unpacked/node_modules/typescript/lib/typescript.js');
const root = path.resolve(__dirname, '../..');
const names = ['television','bathtub','piano','tire','bowling_ball','oil_drum','spring_pad','cat_bed','giraffe','ufo','rocket','vending_machine'];
const sourceScale = JSON.parse(fs.readFileSync(path.join(root, 'source-inputs/art-source/这也能叠_正式美术素材包_v1/00_DOCS/OBJECT_GAMEPLAY_SCALE.json')));
const reference = new Map(sourceScale.objects.map(item => [item.slug, item.gameplay_scale]));
const objectData = {};
const code = ts.transpileModule(fs.readFileSync(path.join(root, 'assets/batch1/object-data.ts'), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2018, module: ts.ModuleKind.CommonJS },
}).outputText;
new vm.Script(`(function(module,exports){${code}\n})`).runInThisContext()({ exports: objectData }, objectData);
const OBJECTS = objectData.OBJECTS;
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'assets/batch1/art/objects-r2-manifest.json')));
const scene = fs.readFileSync(path.join(root, 'assets/batch0/scenes/HUD.scene'), 'utf8');
const checks = [];
for (const kind of names) {
    assert.ok(OBJECTS[kind], `${kind} missing from OBJECTS`);
    const scale = reference.get(kind);
    assert.ok(Math.abs(OBJECTS[kind].width - scale.width_u * 100) < 1e-8
        && Math.abs(OBJECTS[kind].height - scale.height_u * 100) < 1e-8, `${kind} gameplay scale`);
    for (const type of ['object', 'next']) {
        const entry = manifest.objects.find(row => row.kind === kind && row.type === type);
        assert.ok(entry, `${type}_${kind} missing manifest entry`);
        const file = path.join(root, entry.file), metaFile = `${file}.meta`;
        assert.ok(fs.existsSync(file), `${entry.file} missing`);
        const meta = JSON.parse(fs.readFileSync(metaFile));
        assert.equal(meta.uuid, entry.uuid); assert.equal(meta.importer, 'image');
        assert.equal(meta.subMetas.f9941.displayName, `${type}_${kind}`);
        assert.equal(meta.subMetas.f9941.userData.width, entry.width);
        assert.equal(meta.subMetas.f9941.userData.height, entry.height);
        assert.match(scene, new RegExp(`${entry.uuid}\\@f9941`));
        checks.push(`${type}_${kind}`);
    }
}
assert.equal(manifest.objects.length, names.length * 2);
console.log(JSON.stringify({ status: 'passed', objects: names.length, frameAssets: checks.length,
    unlocks: objectData.SECOND_BATCH_UNLOCKS ?? 'director gate checked separately',
    scope: 'Source/data/meta/scene references only; no Cocos import or rendering' }, null, 2));
