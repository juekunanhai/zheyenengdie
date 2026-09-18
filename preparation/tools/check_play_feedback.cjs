/* Actual presentation/music/SFX modules against engine doubles; no app, browser or build. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('/Applications/CocosCreator/3.8.8/CocosCreator.app/Contents/Resources/app.asar.unpacked/node_modules/typescript/lib/typescript.js');
const root = path.resolve(__dirname, '../..');
class Node {
    constructor(name) { this.name = name; this.children = []; this.components = new Map(); this.handlers = new Map(); this.active = true; this.layer = 1; this.position = { x: 0, y: 0, z: 0 }; }
    addChild(node) { this.children.push(node); node.parent = this; }
    addComponent(Type) { const component = new Type(); component.node = this; this.components.set(Type, component); return component; }
    getComponent(Type) { return this.components.get(Type); }
    setSiblingIndex(index) { const siblings = this.parent.children; siblings.splice(siblings.indexOf(this), 1); siblings.splice(index, 0, this); }
    setPosition(x, y, z) { this.position = { x, y, z }; }
    on(name, handler) { this.handlers.set(name, handler); }
    off(name) { this.handlers.delete(name); }
    destroy() { this.destroyed = true; this.children.forEach(node => node.destroy()); }
}
class UITransform { setContentSize(width, height) { this.contentSize = { width, height }; } }
class UIOpacity { constructor() { this.opacity = 255; } }
class Color { constructor(r, g, b, a = 255) { Object.assign(this, { r, g, b, a }); } }
class Graphics {
    constructor() { this.rectangles = []; }
    clear() { this.rectangles.length = 0; }
    rect(x, y, width, height) { this.rectangles.push({ x, y, width, height, color: this.fillColor }); }
    fill() {}
}
class Sprite { static SizeMode = { CUSTOM: 0 }; }
class Label {}
class AudioSource {
    static EventType = { STARTED: 'started' };
    constructor() { this.currentTime = 0; this.playing = false; this.playStarts = 0; this.clip = null; }
    get clip() { return this._clip; }
    set clip(value) { this._clip = value; this.loaded = !value?.deferredLoad; this.pending = []; this.playing = false; }
    get duration() { return this.clip?.getDuration() || 0; }
    play() {
        if (!this.loaded && this.clip) { this.pending.push('play'); return; }
        if (!this.clip) return;
        this.playing = true; this.playStarts++; this.node.handlers.get('started')?.();
    }
    stop() {
        if (!this.loaded && this.clip) { this.pending.push('stop'); return; }
        this.playing = false; this.currentTime = 0;
    }
    pause() {
        if (!this.loaded && this.clip) { this.pending.push('pause'); return; }
        this.playing = false;
    }
    // Match AudioSource's deferred operation replay and clip-identity cancellation.
    resolveClip(clip) {
        if (this.clip !== clip) return;
        this.loaded = true;
        for (const operation of this.pending.splice(0)) this[operation]();
    }
}
const settings = { music: true, sound: true }; let interacted = true;
const cc = { Node, UITransform, UIOpacity, Color, Graphics, Sprite, Label, AudioSource,
    game: new Node('GameEvents'), Game: { EVENT_HIDE: 'hide', EVENT_SHOW: 'show' },
    isValid: node => !!node && !node.destroyed, warn() {} };
function load(name) {
    const file = path.join(root, 'assets/batch1', name + '.ts'), module = { exports: {} };
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
        target: ts.ScriptTarget.ES2018, module: ts.ModuleKind.CommonJS,
    } }).outputText;
    const requireLocal = id => {
        if (id === 'cc') return cc;
        assert.equal(id, './local-platform');
        return { readSettings: () => settings, hasUserInteraction: () => interacted,
            markUserInteraction: () => { interacted = true; } };
    };
    new vm.Script(`(function(require,module,exports){${code}\n})`, { filename: file })
        .runInThisContext()(requireLocal, module, module.exports);
    return module.exports;
}
const { PlayFeedback } = load('play-feedback'), { GameMusic } = load('game-music'), { GameAudio } = load('game-audio');
const checks = [];
function check(name, run) { run(); checks.push(name); }
function fixture() {
    const safe = new Node('SafeArea'), world = new Node('PlayWorld'), input = new Node('PlayInput'), hud = new Node('HUD');
    [world, input, hud].forEach(node => safe.addChild(node));
    const view = new PlayFeedback(safe, world, new Map([['fx_landing_ring_r1', { originalSize: { width: 256, height: 128 } }]]));
    view.fit(750, 1334, 237); return { view, safe, world, input, hud };
}
function advance(view, seconds) { for (let t = 0; t < seconds; t += 1 / 60) view.update(1 / 60, 1.75, y => y); }
check('Danger darkens only thin non-overlapping edge bands below input and HUD', () => {
    const { view, safe, input, hud } = fixture(), edges = safe.children.find(node => node.name === 'DangerEdges');
    assert.deepEqual(safe.children.map(node => node.name), ['PlayWorld', 'DangerEdges', 'PlayInput', 'HUD']);
    assert(safe.children.indexOf(edges) < safe.children.indexOf(input)); assert(safe.children.indexOf(edges) < safe.children.indexOf(hud));
    const rectangles = edges.getComponent(Graphics).rectangles;
    assert.equal(rectangles.length, 72);
    for (const box of rectangles) {
        assert(box.color.r === 0 && box.color.g === 0 && box.color.b === 0 && box.color.a <= 22);
        assert(box.width > 0 && box.height > 0);
        assert(!(box.x < 0 && box.y < 0 && box.x + box.width > 0 && box.y + box.height > 0));
    }
    for (let i = 0; i < rectangles.length; i++) for (let j = i + 1; j < rectangles.length; j++) {
        const a = rectangles[i], b = rectangles[j];
        const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
        const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
        assert(overlapX < 1e-8 || overlapY < 1e-8, 'Corners must not double the alpha');
    }
    const nodes = [safe, ...safe.children, ...view.accent.children];
    assert(nodes.every(node => node.handlers.size === 0), 'Presentation cannot intercept drag or HUD input');
});
check('Risk entry and immediate stable exit are interruptible and remain subtle', () => {
    const { view } = fixture(); assert.equal(view.snapshot().strength, 0);
    view.setRisk('Dangerous'); advance(view, 1); const danger = view.snapshot();
    assert(danger.strength > .6 && danger.strength <= .65);
    view.setRisk('Critical'); advance(view, .5); const critical = view.snapshot();
    assert(critical.strength > danger.strength && critical.strength <= 1);
    view.setRisk('Safe'); view.update(1 / 60, 1, y => y);
    assert(view.snapshot().strength < critical.strength, 'No waiting period before recovery starts');
    view.setRisk('Critical'); advance(view, .2); assert(view.snapshot().strength > .5);
    view.setRisk('Unstable'); advance(view, 1); assert.equal(view.snapshot().strength, 0);
});
check('One contact highlight uses approved ring, stays away from planning text, and is rate limited', () => {
    const { view } = fixture(), point = { x: 40, y: 120 };
    assert.equal(view.showHighlight('narrow_escape', point), true);
    point.x = 9999; view.update(.1, 2, y => y + 10);
    assert.deepEqual(view.ring.position, { x: 80, y: 130, z: 0 }, 'Caller mutation does not move the retained real contact');
    assert.equal(view.caption.string, '惊险稳住'); assert.equal(view.showHighlight('bridge'), false);
    assert(view.caption.node.position.y <= 237);
    advance(view, .9); assert.equal(view.accent.active, false);
    advance(view, .3); assert.equal(view.showHighlight('bridge', { x: 0, y: 600 }), true);
    view.update(.1, 1, y => y); assert.equal(view.caption.string, '桥接成功');
    assert(view.caption.node.position.y <= 237, 'High contacts cannot cover planning instructions');
});
check('No invented contact marker for missing, invalid or offscreen contact', () => {
    for (const point of [undefined, { x: NaN, y: 10 }, { x: 2000, y: 2000 }]) {
        const { view } = fixture(); view.showHighlight('edge_balance', point); view.update(.1, 1, y => y);
        assert.equal(view.ring.active, false); assert.equal(view.caption.string, '极限边缘');
    }
});
check('Pause/defeat clear cancels accents, blocks new playback and resumes only from current risk', () => {
    const { view } = fixture(); view.setRisk('Critical'); advance(view, .5);
    view.showHighlight('large_rescue', { x: 0, y: 0 }); view.clear(); advance(view, 3);
    assert.equal(view.snapshot().strength, 0); assert.equal(view.snapshot().highlight, null);
    assert.equal(view.showHighlight('bridge'), false);
    view.setRisk('Safe'); advance(view, .1); assert.equal(view.accent.active, false);
    view.setRisk('Critical'); advance(view, .2); assert(view.snapshot().strength > 0);
    view.setRisk('Critical', false); assert.equal(view.snapshot().edgeOpacity, 0);
    view.dispose(); assert(view.edges.destroyed && view.accent.destroyed);
});
function musicFixture() {
    settings.music = true; interacted = true;
    return new GameMusic(new Node('Music'), new Map(['bgm_city', 'bgm_cloud', 'bgm_space'].map(name => [name, { name, getDuration: () => 40 }])));
}
function musicFor(music, seconds, ...args) { for (let t = 0; t < seconds; t += 1 / 60) music.update(1 / 60, 0, ...args); }
check('Normal, danger, incident, voice and defeat music priorities; old call signature preserved', () => {
    const music = musicFixture(); musicFor(music, 2); assert.equal(music.snapshot().gain, .28);
    music.update(.1, 0, false, false, false, true); assert(music.snapshot().gain < .28 && music.snapshot().gain > .2);
    musicFor(music, 1, false, false, false, true); assert.equal(music.snapshot().gain, .2);
    musicFor(music, 1, true, false, false, true); assert.equal(music.snapshot().gain, .09);
    musicFor(music, 1, false, false, true, true); assert.equal(music.snapshot().gain, .09);
    musicFor(music, 1, true, true, true, true); assert.equal(music.snapshot().gain, 0);
    musicFor(music, 2); assert.equal(music.snapshot().gain, .28);
});
check('Danger gain respects music off, interaction lock, pause and simultaneous regional crossfade', () => {
    const music = musicFixture(); musicFor(music, 2); music.pause(true); const paused = music.snapshot();
    music.update(20, 170, false, false, false, true); assert.deepEqual(music.snapshot(), paused);
    music.pause(false); musicFor(music, 1, false, false, false, true);
    music.update(.1, 170, false, false, false, true);
    const fading = music.snapshot(); assert.equal(fading.region, 'bgm_space'); assert(fading.fading);
    assert(Math.abs(fading.sources.reduce((sum, source) => sum + source.volume, 0) - .2) < 1e-9);
    settings.music = false; music.update(.1, 170); assert.equal(music.snapshot().region, null);
    music.pause(true); music.pause(false); assert(music.snapshot().sources.every(source => !source.playing));
    settings.music = true; interacted = false; music.update(.1, 0); assert.equal(music.snapshot().region, null);
    interacted = true; music.update(.1, 0); music.dispose(); assert.equal(music.snapshot().region, null);
});
function audioFixture(deferredHighlight = false) {
    settings.sound = true; interacted = true;
    const clips = new Map(['stable', 'voice_wow', 'impact_paper_1', 'star_lost'].map(name => [name, {
        name, getDuration: () => name === 'stable' ? .29 : 1, deferredLoad: name === 'stable' && deferredHighlight,
    }]));
    return new GameAudio(new Node('Sfx'), clips);
}
check('Accident/failure cancellation stops active success and voice cues, preserving impact and star-loss audio', () => {
    const audio = audioFixture();
    assert(audio.play('stable', .55, 'highlight'));
    assert.equal(audio.isReacting(), false, 'Success cues must not become twelve-second voice reactions');
    assert(audio.play('voice_wow'));
    assert(audio.play('impact_cardboard_box', .5, 'contact:1'));
    assert(audio.play('star_lost', .65, 'incident:1'));
    const highlight = audio.voices.find(voice => voice.pairKey === 'highlight');
    const voice = audio.voices.find(item => item.reaction);
    const impact = audio.voices.find(item => item.pairKey === 'contact:1');
    const star = audio.voices.find(item => item.pairKey === 'incident:1');
    audio.stopReactions();
    for (const item of [highlight, voice]) {
        assert.equal(item.source.playing, false); assert.equal(item.source.clip, null); assert.equal(item.availableAt, 0);
    }
    for (const item of [impact, star]) {
        assert.equal(item.source.playing, true); assert(item.source.clip); assert(item.availableAt > 0);
    }
    audio.update(.2);
    assert(audio.play('stable', .55, 'highlight'), 'A later real success remains outside the voice cooldown');
    assert.equal(audio.play('voice_wow'), false, 'Cancelling a comment does not reset its twelve-second cooldown');
    audio.stopReactions(); audio.update(12);
    assert(audio.play('voice_wow'), 'The original voice cooldown still expires normally');
    audio.dispose();
});
check('Accident/failure cancellation detaches an in-flight success clip before its deferred play can run', () => {
    const audio = audioFixture(true);
    assert(audio.play('stable', .55, 'highlight'));
    const source = audio.voices.find(voice => voice.pairKey === 'highlight').source, clip = source.clip;
    assert.equal(source.playStarts, 0); assert.deepEqual(source.pending, ['play']);
    audio.stopReactions();
    assert.equal(source.clip, null); assert.deepEqual(source.pending, []);
    source.resolveClip(clip);
    assert.equal(source.playing, false); assert.equal(source.playStarts, 0);
    audio.dispose();
});
check('Pause/restore cancels all active or in-flight collision and operation clips as well as highlights', () => {
    for (const name of ['impact_cardboard_box', 'star_lost']) {
        const audio = audioFixture();
        const clip = audio.clips.get(name === 'impact_cardboard_box' ? 'impact_paper_1' : 'star_lost');
        clip.deferredLoad = true;
        assert(audio.play(name));
        const voice = audio.voices.find(item => item.pairKey === name), source = voice.source;
        assert.equal(source.playStarts, 0);
        audio.pause(true); audio.pause(false); source.resolveClip(clip);
        assert.equal(source.clip, null); assert.equal(source.playStarts, 0); assert.equal(source.playing, false);
        audio.dispose();
    }
});
check('Pause/resume cancels active and in-flight success cues without replaying them or reopening sound', () => {
    for (const deferred of [false, true]) {
        const audio = audioFixture(deferred);
        assert(audio.play('stable', .55, 'highlight'));
        const source = audio.voices.find(voice => voice.pairKey === 'highlight').source, clip = source.clip;
        const started = source.playStarts;
        audio.pause(true);
        assert.equal(source.clip, null); assert.equal(source.playing, false);
        assert.equal(audio.play('stable', .55, 'highlight'), false);
        settings.sound = false; audio.pause(false); source.resolveClip(clip);
        assert.equal(source.playStarts, started); assert.equal(source.playing, false);
        audio.update(1);
        assert.equal(audio.play('stable', .55, 'highlight'), false);
        audio.dispose();
    }
});
console.log(JSON.stringify({ status: 'passed', count: checks.length, checks,
    boundary: 'Engine mocks only. Pixel appearance, device performance, audible mixing and real input remain unverified.' }, null, 2));
