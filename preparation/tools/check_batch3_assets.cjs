/* Batch 3 collection art/layout gate. No Cocos startup, build, render or device run. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const objectKinds = [
    'cardboard_box', 'wood_plank', 'basketball', 'fridge', 'toilet', 'dumbbell',
    'wooden_crate', 'ice_block', 'sofa', 'whale', 'burger', 'slipper',
    'television', 'bathtub', 'piano', 'tire', 'bowling_ball', 'oil_drum',
    'spring_pad', 'cat_bed', 'giraffe', 'ufo', 'rocket', 'vending_machine',
];
const itemKinds = ['strong_glue', 'undo', 'shrink', 'reroll', 'feather', 'restore_star'];

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function readPngSize(file) {
    const data = fs.readFileSync(file);
    assert.equal(data.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${file} is PNG`);
    return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
}
function assetMeta(dir, stem) {
    const file = path.join(root, dir, `${stem}.png`);
    const meta = readJson(`${file}.meta`);
    const sprite = meta.subMetas?.f9941;
    assert.equal(meta.importer, 'image', `${stem} importer`);
    assert.equal(sprite?.importer, 'sprite-frame', `${stem} sprite-frame importer`);
    assert.equal(sprite?.displayName, stem, `${stem} display name`);
    const size = readPngSize(file);
    assert.equal(sprite.userData.rawWidth, size.width, `${stem} raw width`);
    assert.equal(sprite.userData.rawHeight, size.height, `${stem} raw height`);
    assert.equal(sprite.userData.width, size.width, `${stem} width`);
    assert.equal(sprite.userData.height, size.height, `${stem} height`);
    return { file, meta, frame: sprite.uuid };
}

const checks = [];
const expectedFrames = new Map();
for (const kind of objectKinds) {
    const dir = kind === 'television' || objectKinds.indexOf(kind) >= 12 ? 'assets/batch1/art' : 'assets/batch0/art';
    const asset = assetMeta(dir, `object_${kind}`);
    expectedFrames.set(`object_${kind}`, asset.frame);
    checks.push(`object_${kind}`);
}
for (const kind of itemKinds) {
    const stem = `prop_${kind}_large`;
    const runtime = assetMeta('assets/batch1/art', stem);
    const source = path.join(root, 'source-inputs/art-source/这也能叠_正式美术素材包_v1/02_ASSETS/items', `${stem}.png`);
    assert.ok(fs.existsSync(source), `${stem} source exists`);
    assert.ok(fs.readFileSync(runtime.file).equals(fs.readFileSync(source)), `${stem} is byte-identical to the official source`);
    expectedFrames.set(stem, runtime.frame);
    checks.push(stem);
}

const scene = readJson(path.join(root, 'assets/batch0/scenes/Home.scene'));
const frameComponents = scene.filter(item => Array.isArray(item.frames));
assert.equal(frameComponents.length, 1, 'Home has one StackSceneActions frame property');
const frames = frameComponents[0].frames;
assert.equal(frames.length, expectedFrames.size, 'Home binds every collection frame exactly once');
const sceneFrames = frames.map(frame => frame.__uuid__);
assert.equal(new Set(sceneFrames).size, sceneFrames.length, 'Home frame refs are unique');
for (const [name, frame] of expectedFrames) {
    assert.ok(sceneFrames.includes(frame), `${name} is bound in Home`);
}
checks.push('home_scene_collection_frame_binding');

const view = fs.readFileSync(path.join(root, 'assets/batch1/collection-view.ts'), 'utf8');
const actions = fs.readFileSync(path.join(root, 'assets/batch1/scene-actions.ts'), 'utf8');
assert.match(view, /fitDetailSprite\(node, image, 300, 220\)/);
assert.match(view, /fitDetailSprite\(node, image, 250, 240\)/);
assert.match(view, /image\.originalSize/);
assert.match(view, /setScale\(scale, scale, 1\)/);
for (const minimum of [56, 72, 96]) assert.match(view, new RegExp(`, ${minimum},`), `touch target ${minimum}`);
assert.match(actions, /setContentSize\(156, 58\)/, 'home collection touch target');
checks.push('detail_aspect_ratio_and_safe_area_scale');

console.log(JSON.stringify({ status: 'passed', checks, collectionFrames: frames.length,
    scope: 'Official collection PNG/meta refs and runtime layout source checks only; no Cocos startup, build, rendering or device acceptance.' }, null, 2));
