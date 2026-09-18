/** Read-only checks of exact R2 inputs and transpiled production code with a small cc mock.
 * This does not launch Creator, a browser, a build, or the game, and cannot prove rendered quality. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), vm = require('node:vm');
const ROOT = path.resolve(__dirname, '../..');
const IMPORT = path.join(ROOT, 'assets/batch0/home-expression-r2');
const SOURCE = path.join(ROOT, 'preparation/design/home-expression-r2');
const ts = require('/Applications/CocosCreator/3.8.8/CocosCreator.app/Contents/Resources/resources/3d/engine/node_modules/typescript');
const json = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const imported = json(path.join(IMPORT, 'sequence.json'));
const original = json(path.join(SOURCE, 'sequence.json'));
const scene = json(path.join(ROOT, 'assets/batch0/scenes/Home.scene'));
const bound = scene.find(row => 'characterFrames' in row);
let assertions = 0;
const check = (pass, message) => { assert.ok(pass, message); assertions++; };
const near = (a, b, message) => check(Math.abs(a - b) < 1e-8, `${message}: ${a} != ${b}`);
function walk(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(item => {
        const file = path.join(dir, item.name); return item.isDirectory() ? walk(file) : [file];
    });
}
const metas = new Map();
for (const file of walk(path.join(ROOT, 'assets')).filter(file => file.endsWith('.meta'))) {
    const meta = json(file);
    metas.set(meta.uuid, { ...meta, file });
    for (const sub of Object.values(meta.subMetas || {})) metas.set(sub.uuid, { ...sub, file });
}
const images = walk(IMPORT).filter(file => file.endsWith('.png'));
check(images.length === 128, 'exactly 126 sequence frames and 2 sky images');
check(imported.files.length === 126 && bound.characterFrames.length === 126, 'all 126 frames bound once');
assert.deepEqual(imported.layers.map(layer => ({ ...layer, frames: layer.frames.map(({ frame, ...rest }) => rest) })), original.layers);
assertions++;
let frameBytes = 0, frameRGBABytes = 0;
for (let index = 0; index < imported.files.length; index++) {
    const name = imported.files[index], file = path.join(IMPORT, name), meta = json(file + '.meta');
    const bytes = fs.readFileSync(file), width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
    check(hash(file) === hash(path.join(SOURCE, name)), `copied unchanged: ${name}`);
    check(bound.characterFrames[index].__uuid__ === meta.uuid + '@f9941', `frame order: ${name}`);
    const data = meta.subMetas.f9941.userData;
    check(data.trimType === 'none' && data.width === width && data.height === height
        && data.rawWidth === width && data.rawHeight === height && data.offsetX === 0 && data.offsetY === 0,
    `untrimmed source registration: ${name}`);
    frameBytes += bytes.length; frameRGBABytes += width * height * 4;
}
for (const layer of imported.layers) {
    check(layer.frames.every((frame, index) => (!index || frame.time >= layer.frames[index - 1].time)
        && (frame.file === null ? frame.frame === -1 : imported.files[frame.frame] === frame.file)),
    `valid sorted frame mapping: ${layer.name}`);
    if (layer.loopFrom !== undefined) check(layer.loopFrom < layer.frames.at(-1).time, `nonempty loop: ${layer.name}`);
}
for (const name of ['background-no-near-clouds.png', 'city-foreground.png']) {
    check(hash(path.join(IMPORT, 'cloud', name)) === hash(path.join(SOURCE, 'cloud', name)), `unchanged sky: ${name}`);
}
for (const row of [...bound.characterFrames, bound.homeSequence, bound.cityForeground]) {
    check(metas.has(row.__uuid__), `resolved scene input: ${row.__uuid__}`);
}
check(metas.get(bound.homeSequence.__uuid__).importer === 'json', 'sequence imported as JsonAsset');
check(hash(path.join(ROOT, 'assets/batch0/art/home_r9_cloud.png')) === hash(path.join(SOURCE, 'cloud/moving-cloud.png')),
    'reuse exact official cloud');

class Events {
    constructor() { this.events = new Map(); }
    on(type, callback, target) { const list = this.events.get(type) || []; list.push({ callback, target }); this.events.set(type, list); }
    off(type, callback) { this.events.set(type, (this.events.get(type) || []).filter(row => row.callback !== callback)); }
    emit(type) { for (const row of this.events.get(type) || []) row.callback.call(row.target); }
    targetOff(target) { for (const [type, list] of this.events) this.events.set(type, list.filter(row => row.target !== target)); }
    count(type) { return (this.events.get(type) || []).length; }
}
class UITransform { constructor() { this.width = 0; this.height = 0; } setContentSize(w, h) { this.width = w; this.height = h; } }
class UIOpacity { constructor() { this.opacity = 255; } }
class Sprite { constructor() { this.spriteFrame = null; } }
Sprite.SizeMode = { CUSTOM: 0 };
class SpriteFrame {}
class JsonAsset {}
class Component { constructor() { this.enabledInHierarchy = true; } }
class Node extends Events {
    constructor(name) { super(); this.name = name; this.children = []; this.components = new Map();
        this.active = true; this.position = { x: 0, y: 0, z: 0 }; this.scale = { x: 1, y: 1, z: 1 }; this.eulerAngles = { z: 0 }; }
    set parent(parent) { if (this._parent) this._parent.children.splice(this._parent.children.indexOf(this), 1);
        this._parent = parent; if (parent) parent.children.push(this); }
    get parent() { return this._parent; }
    addComponent(Type) { if (Type === Sprite && !this.getComponent(UITransform)) this.addComponent(UITransform);
        const item = new Type(); item.node = this; this.components.set(Type, item); return item; }
    getComponent(Type) { return this.components.get(Type) || null; }
    getChildByName(name) { return this.children.find(node => node.name === name); }
    setPosition(x, y, z) { this.position = { x, y, z }; }
    setScale(x, y, z) { this.scale = { x, y, z }; }
    setRotationFromEuler(x, y, z) { this.eulerAngles = { x, y, z }; }
    getSiblingIndex() { return this.parent.children.indexOf(this); }
    setSiblingIndex(index) { const list = this.parent.children; list.splice(list.indexOf(this), 1); list.splice(index, 0, this); }
}
Node.EventType = { TOUCH_START: 'start', TOUCH_END: 'end', TOUCH_CANCEL: 'cancel' };
const game = new Events();
const Game = { EVENT_HIDE: 'hide', EVENT_SHOW: 'show' };
const activeTweens = new Set();
const cc = { Component, game, Game, JsonAsset, Node, Sprite, SpriteFrame, UITransform, UIOpacity,
    _decorator: { ccclass: () => value => value, property: () => () => {} },
    Tween: { stopAllByTarget: value => activeTweens.delete(value) },
    tween: value => ({ to(duration, next) { Object.assign(value, next); return this; }, start() { activeTweens.add(value); } }) };
const sourceFile = path.join(ROOT, 'assets/batch0/presentation/HomePresentation.ts');
const compiled = ts.transpileModule(fs.readFileSync(sourceFile, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2015, module: ts.ModuleKind.CommonJS, experimentalDecorators: true },
}).outputText;
const moduleExports = {};
vm.runInNewContext(compiled, { exports: moduleExports, require: name => { assert.equal(name, 'cc'); return cc; } });
function frame(uuid) { const meta = metas.get(uuid); assert.ok(meta); return Object.assign(new SpriteFrame(),
    { uuid, originalSize: { width: meta.userData.rawWidth, height: meta.userData.rawHeight } }); }
function fixture() {
    const nodes = new Map();
    scene.forEach((row, index) => { if (row.__type__ === 'cc.Node') nodes.set(index, new Node(row._name)); });
    for (const [index, node] of nodes) {
        const row = scene[index]; node.layer = row._layer;
        node.setPosition(row._lpos.x, row._lpos.y, row._lpos.z); node.setScale(row._lscale.x, row._lscale.y, row._lscale.z);
        node.setRotationFromEuler(0, 0, row._euler.z);
        for (const ref of row._components) {
            const data = scene[ref.__id__], Type = { 'cc.UITransform': UITransform, 'cc.Sprite': Sprite, 'cc.UIOpacity': UIOpacity }[data.__type__];
            if (!Type) continue;
            const component = node.addComponent(Type);
            if (Type === UITransform) component.setContentSize(data._contentSize.width, data._contentSize.height);
            if (Type === Sprite) component.spriteFrame = frame(data._spriteFrame.__uuid__);
            if (Type === UIOpacity) component.opacity = data._opacity;
        }
    }
    for (const [index, node] of nodes) for (const ref of scene[index]._children) nodes.get(ref.__id__).parent = node;
    const home = new moduleExports.HomePresentation(); home.node = [...nodes.values()].find(node => node.name === 'Canvas');
    home.characterFrames = bound.characterFrames.map(ref => frame(ref.__uuid__));
    home.cityForeground = frame(bound.cityForeground.__uuid__); home.homeSequence = { json: imported };
    home.onLoad(); home.onEnable(); return home;
}
const home = fixture();
const setTime = time => { home.elapsed = time; home.update(0); };
function expected(layer, elapsed) {
    let local = (layer.loopFrom === undefined ? elapsed % original.duration : elapsed) - layer.start;
    if (local < 0) return null;
    const end = layer.frames.at(-1).time;
    if (layer.loopFrom !== undefined && local >= end) local = layer.loopFrom + (local - layer.loopFrom) % (end - layer.loopFrom);
    else if (local > end) return null;
    return layer.frames.filter(frame => frame.time <= local).at(-1).file;
}
const sampleTimes = new Set([0, .58, .62333, 1.7, 2.375, 3.5, 3.51, 8.1999, 8.2, 8.2001, 16.4, 24.6, 60]);
for (const layer of original.layers) for (const frame of layer.frames) {
    for (const offset of [-.000001, 0, .000001]) sampleTimes.add(Math.max(0, layer.start + frame.time + offset));
}
for (const time of sampleTimes) {
    setTime(time);
    original.layers.forEach((layer, index) => {
        const file = expected(layer, time), sprite = home.actors[index];
        check(sprite.node.active === !!file && (!file || sprite.spriteFrame === home.characterFrames[imported.files.indexOf(file)]),
            `sample-equivalent frame ${layer.name} at ${time}`);
    });
}
setTime(24.15);
const held = home.actors.slice(4).map(sprite => sprite.spriteFrame);
game.emit(Game.EVENT_HIDE); home.update(4);
near(home.elapsed, 24.15, 'background freezes clock');
check(home.actors.slice(4).every((sprite, i) => sprite.node.active && sprite.spriteFrame === held[i]), 'background retains hands and closed face');
game.emit(Game.EVENT_SHOW); home.update(.02); near(home.elapsed, 24.17, 'foreground resumes clock');
setTime(5);
const heldBeforeTap = home.actors.slice(4).map(sprite => sprite.spriteFrame);
home.content.getChildByName('R9Hero').emit(Node.EventType.TOUCH_END);
near(home.motionSnapshot().acting.phase, 1.7, 'tap advances ordinary reach');
check(home.actors.slice(4).every((sprite, i) => sprite.spriteFrame === heldBeforeTap[i]), 'tap never restarts sustained layers');
const offset = home.trickAt; home.content.getChildByName('R9Hero').emit(Node.EventType.TOUCH_END);
near(home.trickAt, offset, 'repeated tap does not restart active reach');

const baseHeroTop = 1334 - 145 - 470 * 1507 / 1024;
for (const [width, height] of [[750, 1334], [780, 1688], [1125, 2436], [1624, 750]]) {
    home.node.getComponent(UITransform).setContentSize(width, height);
    home.safe.getComponent(UITransform).setContentSize(width, height); home.safe.setPosition(0, 0, 0); home.fit();
    const hero = home.content.getChildByName('R9Hero'), ui = hero.getComponent(UITransform), ratio = ui.width / 470;
    const heroLeft = hero.position.x - ui.width / 2;
    const heroTop = hero.position.y + ui.height / 2;
    for (const index of [4, 5]) {
        const actor = home.actors[index].node, rect = original.layers[index].rect, actorUI = actor.getComponent(UITransform);
        near((actor.position.x - actorUI.width / 2 - heroLeft) / ratio, rect[0] - 185, 'stage patch x registration');
        near((heroTop - actor.position.y - actorUI.height / 2) / ratio, rect[1] - baseHeroTop, 'stage patch y registration');
        near(actorUI.width / ratio, rect[2], 'stage patch width registration');
    }
    for (const [name, leftOffset, topOffset, baseWidth] of [
        ['R9SlipperFront', 470 * 450 / 1024 - 129, -121, 194],
        ['R9SlipperBack', 470 * 450 / 1024 - 129 - 45, -136, 144],
    ]) {
        const shoe = home.content.getChildByName(name), shoeUI = shoe.getComponent(UITransform);
        near((shoe.position.x - shoeUI.width / 2 - heroLeft) / ratio, leftOffset, 'shoe x registration');
        near((heroTop - shoe.position.y - shoeUI.height / 2) / ratio, topOffset, 'shoe y registration');
        near(shoeUI.width / ratio, baseWidth, 'shoe size registration');
    }
    check(home.actors[4].node.getSiblingIndex() > home.content.getChildByName('R9SlipperFront').getSiblingIndex()
        && home.actors[5].node.getSiblingIndex() < home.content.getChildByName('logo_main').getSiblingIndex(), 'stage layering preserved');
    check(home.city.node.getSiblingIndex() === 4 && home.clouds.every(node => node.parent === home.backdrop), 'city covers all four clouds');
}
home.sequence.sky.layers.forEach((layer, i) => {
    const [start, , width] = layer.rect, endTime = (home.sequence.sky.width + 16 - start) / layer.speed;
    for (const [time, side] of [[endTime - .00001, 'right'], [endTime + .00001, 'left']]) {
        setTime(time);
        const cloud = home.clouds[i], ui = home.backdrop.getComponent(UITransform), c = cloud.getComponent(UITransform);
        const left = (cloud.position.x - c.width / 2 + ui.width / 2) * home.sequence.sky.width / ui.width;
        check(side === 'right' ? left > home.sequence.sky.width : left + width < 0, 'cloud is completely offscreen at wrap');
    }
});
const nodeCount = home.content.children.length + home.backdrop.children.length;
const button = home.buttons[0]; button.emit(Node.EventType.TOUCH_START); home.update(0);
near(button.scale.x, .96, 'button press retained');
home.onDisable();
check(game.count('hide') === 0 && game.count('show') === 0 && activeTweens.size === 0, 'disable clears global handlers and button tweens');
home.onEnable();
near(home.elapsed, 0, 'homepage return replays entrance');
check(home.content.children.length + home.backdrop.children.length === nodeCount && game.count('hide') === 1, 'reenable creates no duplicate nodes or handlers');
home.onDisable(); home.onDestroy();
check(button.count('start') === 0 && home.content.getChildByName('R9Hero').count('end') === 0, 'destroy removes component-owned node handlers');
console.log(JSON.stringify({ status: 'passed', assertions, sampledTimes: sampleTimes.size, frameCount: imported.files.length,
    frameBytes, frameRGBABytes, productionSourceSha256: hash(sourceFile),
    limits: 'Static references and mock cc logic only; no rendering, GPU/memory, Web/WeChat build or device validation.' }, null, 2));
