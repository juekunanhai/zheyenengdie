import { director, Director, EventTouch, game, Game, isValid, Node, PhysicsSystem2D, sys, Vec2, view } from 'cc';

const STORAGE_KEY = 'zhynd.local-settings.v1';
export interface LocalSettings { tutorialDone: boolean; music: boolean; sound: boolean; vibration: boolean }
const defaults: LocalSettings = { tutorialDone: false, music: true, sound: true, vibration: false };
let userHasInteracted = false;
export function markUserInteraction(): void { userHasInteracted = true; }
export function hasUserInteraction(): boolean { return userHasInteracted; }

/** The current engine-backed storage boundary; no unused platform SDK shells. */
export function readSettings(): LocalSettings {
    try {
        const saved = JSON.parse(sys.localStorage.getItem(STORAGE_KEY) || '{}');
        const result = { ...defaults };
        for (const key of Object.keys(result) as (keyof LocalSettings)[]) {
            if (typeof saved?.[key] === 'boolean') result[key] = saved[key];
        }
        return result;
    } catch { return { ...defaults }; }
}
export function writeSettings(value: LocalSettings): boolean {
    try { sys.localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); return true; }
    catch { return false; }
}

export interface PlayInput { start(id: number, point: Vec2): void; move(id: number, point: Vec2): void;
    end(id: number): void; cancel(id: number): void }

/** Engine touch coordinates are the only input that reaches gameplay. */
export class TouchBinding {
    private readonly start = (e: EventTouch) => { e.propagationStopped = true; markUserInteraction(); const id = e.getID(); if (id !== null) this.sink.start(id, e.getUILocation()); };
    private readonly move = (e: EventTouch) => { e.propagationStopped = true; const id = e.getID(); if (id !== null) this.sink.move(id, e.getUILocation()); };
    private readonly end = (e: EventTouch) => { e.propagationStopped = true; const id = e.getID(); if (id !== null) this.sink.end(id); };
    private readonly cancel = (e: EventTouch) => { e.propagationStopped = true; const id = e.getID(); if (id !== null) this.sink.cancel(id); };
    constructor(private readonly node: Node, private readonly sink: PlayInput) {
        node.on(Node.EventType.TOUCH_START, this.start);
        node.on(Node.EventType.TOUCH_MOVE, this.move);
        node.on(Node.EventType.TOUCH_END, this.end);
        node.on(Node.EventType.TOUCH_CANCEL, this.cancel);
    }
    dispose(): void {
        if (!isValid(this.node, true)) return;
        this.node.off(Node.EventType.TOUCH_START, this.start);
        this.node.off(Node.EventType.TOUCH_MOVE, this.move);
        this.node.off(Node.EventType.TOUCH_END, this.end);
        this.node.off(Node.EventType.TOUCH_CANCEL, this.cancel);
    }
}

export function bindAction(node: Node, action: () => void): void {
    let finger: number | null = null;
    node.on(Node.EventType.TOUCH_START, (e: EventTouch) => { e.propagationStopped = true; if (finger === null) finger = e.getID(); });
    node.on(Node.EventType.TOUCH_MOVE, (e: EventTouch) => { e.propagationStopped = true; });
    node.on(Node.EventType.TOUCH_CANCEL, (e: EventTouch) => { e.propagationStopped = true; if (finger === e.getID()) finger = null; });
    node.on(Node.EventType.TOUCH_END, (e: EventTouch) => {
        e.propagationStopped = true;
        if (finger === null || finger !== e.getID()) return;
        finger = null; markUserInteraction(); action();
    });
}

/** User pause and app visibility can overlap; returning to the app must not undo user pause. */
export class RunLifecycle {
    private hidden = false;
    private userPaused = false;
    private frameTime = 0;
    private readonly hide = () => { this.hidden = true; this.apply(); };
    private readonly show = () => { this.hidden = false; this.apply(); };
    private readonly afterPhysics = () => {
        const physics = PhysicsSystem2D.instance;
        if (this.frameTime > physics.fixedTimeStep * physics.maxSubSteps) physics.resetAccumulator();
    };
    constructor(private readonly changed: (paused: boolean) => void) {
        game.on(Game.EVENT_HIDE, this.hide);
        game.on(Game.EVENT_SHOW, this.show);
        director.on(Director.EVENT_AFTER_PHYSICS, this.afterPhysics);
        view.resizeWithBrowserSize(true);
    }
    get paused(): boolean { return this.hidden || this.userPaused; }
    update(dt: number): void { this.frameTime = dt; }
    togglePause(): void { this.userPaused = !this.userPaused; this.apply(); }
    private apply(): void {
        this.changed(this.paused);
        PhysicsSystem2D.instance.resetAccumulator();
        if (this.paused) game.pause(); else game.resume();
    }
    dispose(): void {
        game.off(Game.EVENT_HIDE, this.hide);
        game.off(Game.EVENT_SHOW, this.show);
        director.off(Director.EVENT_AFTER_PHYSICS, this.afterPhysics);
        if (this.paused) game.resume();
    }
}
