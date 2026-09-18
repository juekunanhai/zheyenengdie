import { _decorator, AudioClip, Component, director, SpriteFrame, Vec2 } from 'cc';
import { GameAudio } from './game-audio';
import { GameMusic } from './game-music';
import { Incident, WorldBoundary } from './incident-state';
import { bindAction, readPlayerProgress, readSettings, RunLifecycle, TouchBinding, writePlayerProgress, writeSettings } from './local-platform';
import { CALIBRATION_SEQUENCE, ENTER_SECONDS, localBounds, MAX_OBSERVE_SECONDS, ObjectKind, OBJECTS, planarAngle, PLANNING_SECONDS,
    runResult, RunPhase, STABLE_SECONDS } from './object-data';
import { PlayView, PlayViewState } from './play-view';
import { LandingContact, TowerBody, TowerWorld, TowerWorldState } from './tower-world';
import { classifyTowerRisk, DirectorState, RISK_THRESHOLDS, TowerDirector, TowerRisk } from './tower-director';
import { HighlightEvent, HighlightState, HIGHLIGHT_TUNING, RunHighlights } from './run-highlights';
import { ItemKind, ItemLedger, ItemState } from './item-system';
import { CollectionLedger } from './collection-system';
const { ccclass, property } = _decorator;

function newRunId(): string {
    return `${Date.now().toString(36)}-${Math.floor(Math.random() * 0x1000000).toString(36)}`;
}

/** Two in-memory points for the current rules only. No storage, inventory, or ad entitlement. */
interface RunCheckpoint {
    world: TowerWorldState;
    director: DirectorState;
    highlights: HighlightState;
    view: PlayViewState;
    currentId: number | null;
    next: ObjectKind;
    phase: RunPhase;
    boundary: WorldBoundary;
    normalBoundary: WorldBoundary;
    clock: number;
    stableFor: number;
    planningLeft: number;
    releaseCount: number;
    placedCount: number;
    peak: number;
    stars: number;
    rotations: number;
    tutorial: boolean;
    firstTouchGreeted: boolean;
    playfulReactionUsed: boolean;
    sequence: readonly ObjectKind[] | null;
    untimedCalibration: boolean;
    elapsedSeconds: number;
    steadySeconds: number;
    recentImpactSpeed: number;
    chargedIncidentCount: number;
    incidentCount: number;
    risk: TowerRisk;
    items: ItemState;
}

@ccclass('StackGameController')
export class StackGameController extends Component {
    @property([SpriteFrame]) frames: SpriteFrame[] = [];
    @property([AudioClip]) approvedSounds: AudioClip[] = [];
    private phase: RunPhase = 'entering';
    private world!: TowerWorld;
    private display!: PlayView;
    private lifecycle!: RunLifecycle;
    private touches!: TouchBinding;
    private audio!: GameAudio;
    private music!: GameMusic;
    private current: TowerBody | null = null;
    private boundary = { top: 0, bottom: 0, left: 0, right: 0 };
    private clock = 0;
    private stableFor = 0;
    private planningLeft = PLANNING_SECONDS;
    private releaseCount = 0;
    private placedCount = 0;
    private peak = 0;
    private finger: number | null = null;
    private dragOffset = 0;
    private tutorial = false;
    private rotations = 0;
    private sequence: readonly ObjectKind[] | null = null;
    private readonly objectDirector = new TowerDirector(Date.now());
    private risk: TowerRisk = 'Safe';
    private elapsedSeconds = 0;
    private steadySeconds = 0;
    private recentImpactSpeed = 0;
    private chargedIncidentCount = 0;
    private readonly highlights = new RunHighlights();
    private readonly items = new ItemLedger();
    private collection = new CollectionLedger();
    private untimedCalibration = false;
    private stars = 3;
    private incident: Incident | null = null;
    private resumePhase: RunPhase = 'observing';
    private resumeClock = 0;
    private recoveryFor = 0;
    private incidentCount = 0;
    private failureReason: string | null = null;
    private normalBoundary: WorldBoundary = { top: 0, bottom: 0, left: 0, right: 0 };
    private pendingResize = false;
    private firstTouchGreeted = false;
    private playfulReactionUsed = false;
    private stableCheckpoint: RunCheckpoint | null = null;
    private undoCheckpoint: RunCheckpoint | null = null;
    private checkpointAction: 'stable' | 'undo' | 'rebuilding' | null = null;
    private get restoreRequest(): 'stable' | 'undo' | null {
        return this.checkpointAction === 'rebuilding' ? null : this.checkpointAction;
    }
    private get restoringCheckpoint(): boolean { return this.checkpointAction === 'rebuilding'; }

    onLoad(): void {
        this.collection = new CollectionLedger(readPlayerProgress());
        runResult.runId = newRunId(); runResult.height = 0; runResult.placed = 0; runResult.reason = 'calibration_end';
        runResult.newRecord = false; runResult.collectionNewObjects = []; runResult.collectionNewItems = [];
        runResult.technicalScore = 0; runResult.highlights = this.highlights.snapshot().counts;
        this.world = new TowerWorld(this.node.scene!, (record, pair, speed, landing) => this.impact(record, pair, speed, landing),
            record => this.lost(record));
        this.display = new PlayView(this.node, new Map(this.frames.map(frame => [frame.name, frame])));
        this.audio = new GameAudio(this.node, new Map(this.approvedSounds.map(clip => [clip.name, clip])));
        this.music = new GameMusic(this.node, new Map(this.approvedSounds.map(clip => [clip.name, clip])));
        this.display.setStars(this.stars);
        (this.display as PlayView & { setItemHandlers?: (use: (kind: ItemKind) => void, choose?: (kind: ItemKind, replaceSlot?: 0 | 1) => void) => void })
            .setItemHandlers?.(kind => this.useItem(kind), (kind, slot) => this.chooseItem(kind, slot));
        this.renderItems();
        this.tutorial = !readSettings().tutorialDone;
        this.lifecycle = new RunLifecycle(paused => {
            this.finger = null;
            if (paused) this.display.clearFeedback();
            this.audio.pause(paused || this.restoringCheckpoint);
            this.music.pause(paused || this.restoringCheckpoint);
            this.display.setHint(paused ? '已暂停 · 点击暂停按钮继续' : '');
        });
        this.touches = new TouchBinding(this.display.input, {
            start: (id, point) => this.touchStart(id, point), move: (id, point) => this.touchMove(id, point),
            end: id => this.touchEnd(id), cancel: id => { if (id === this.finger) this.finger = null; },
        });
        bindAction(this.display.rotate, () => { this.audio.interact(); this.rotate(); });
        bindAction(this.display.pause, () => this.lifecycle.togglePause());
        this.spawn();
    }

    private renderItems(): void {
        const view = this.display as PlayView & { setItems?: (state: ItemState) => void };
        view.setItems?.(this.items.snapshot());
    }

    private spawn(): void {
        // A displayed NEXT becomes current unchanged. Only this handoff can draw a new NEXT.
        const choice = this.sequence ? {
            current: this.sequence[this.releaseCount % this.sequence.length],
            next: this.sequence[(this.releaseCount + 1) % this.sequence.length],
        } : this.releaseCount === 0 ? { current: this.objectDirector.current, next: this.objectDirector.next }
            : this.objectDirector.handoff({ elapsedSeconds: this.elapsedSeconds, risk: this.risk,
                stableSeconds: this.steadySeconds, incidentCount: this.chargedIncidentCount, placedCount: this.placedCount,
                allowEarlyDiscovery: true });
        const spec = OBJECTS[choice.current];
        this.discoverObject(choice.current);
        this.boundary = this.display.beginPlacement(this.world.placementTop(), Math.max(spec.width, spec.height));
        this.normalBoundary = this.display.logicalBounds();
        this.world.configureSafety(this.normalBoundary, this.world.supportedTop());
        this.pendingResize = false;
        this.current = this.world.create(spec, 0, this.boundary.top - localBounds(spec, 0).top + 55);
        this.display.setNext(choice.next);
        this.audio.play('next_handoff', .35);
        this.phase = 'entering'; this.clock = 0;
        this.planningLeft = PLANNING_SECONDS; this.rotations = 0;
    }

    update(delta: number): void {
        this.lifecycle.update(delta);
        if (this.lifecycle.paused || this.phase === 'ended') return;
        if (this.restoreRequest) {
            const kind = this.restoreRequest;
            this.checkpointAction = null;
            const point = kind === 'stable' ? this.stableCheckpoint : this.undoCheckpoint;
            if (point) this.applyCheckpoint(point, kind);
            return;
        }
        if (this.restoringCheckpoint) {
            if (!this.world.restoring) this.finishRestore();
            return;
        }
        const dt = Math.min(delta, .067);
        this.clock += delta; this.audio.update(dt);
        this.items.tick(dt);
        if (this.phase === 'defeated') {
            if (this.clock >= 1.2) this.commitResult();
            return;
        }
        // Use the same bounded active-game delta as physics-facing control. Paused/background
        // frames and a long resume gap cannot advance difficulty or consume random draws.
        this.elapsedSeconds += dt;
        this.recentImpactSpeed *= Math.exp(-dt / .6);
        for (const record of this.world.bodies) {
            if (record.lost || !record.collider.enabled) continue;
            if (record.contactSeconds !== null)
                record.contactSeconds = Math.min(MAX_OBSERVE_SECONDS, record.contactSeconds + delta);
        }
        const signals = this.world.riskSignals(this.recentImpactSpeed);
        this.risk = this.incident ? 'Critical' : classifyTowerRisk(signals);
        const structuralRisk = classifyTowerRisk({ ...signals, recentImpactSpeed: 0 });
        // Accumulate genuinely steady low-risk time. Ordinary short landing impulses pause
        // this progress; actual structural danger/accidents clear it. A well-supported wide
        // plank may remain Unstable by the conservative width proxy, without blocking rhythm.
        if (this.incident || structuralRisk === 'Dangerous' || structuralRisk === 'Critical') this.steadySeconds = 0;
        else if ((this.risk === 'Safe' || this.risk === 'Unstable') && this.world.isStable()) this.steadySeconds += dt;
        if (!this.incident && this.world.collapseTrend()) this.beginIncident();
        this.highlights.observe({ dt, oldTowerRisk: classifyTowerRisk(this.world.riskSignals(0, true)),
            towerRisk: structuralRisk, stable: this.world.isStable(),
            hasExistingTower: this.world.bodies.filter(record => record.placed && !record.lost).length >= 2,
            incidentActive: this.incident !== null, incidentCount: this.chargedIncidentCount });
        // Re-enable after pause before a fresh stable event can consume its feedback slot.
        // Defeated/ended frames already returned; their feedback remains disabled.
        this.display.setRisk(this.risk);
        if (this.incident) { this.updateIncident(dt); return; }
        // Assistance follows the actually supported structure, not the historical score.
        // A handoff can precede score confirmation; those supported pieces still help the base.
        // The incident early return freezes this reference for the whole recovery animation.
        this.world.configureSafety(this.normalBoundary, this.world.supportedTop());
        this.confirmStable(dt);
        if (this.phase === 'entering') this.enter();
        else if (this.phase === 'planning') this.plan(dt);
        else if (this.phase === 'falling' || this.phase === 'observing') this.observe();
    }

    lateUpdate(dt: number): void {
        if (!this.display || this.lifecycle.paused) return;
        const feedbackActive = this.phase !== 'defeated' && this.phase !== 'ended';
        const holdPhase = this.phase === 'incident' ? this.resumePhase : this.phase;
        const held = (holdPhase === 'planning' || holdPhase === 'entering') && !this.current?.lost ? this.current : null;
        if (this.display.fit()) {
            // A release/incident owns its rule boundary until a safe handoff.
            this.pendingResize = true;
            if (held && !this.incident && this.phase !== 'defeated' && !this.restoringCheckpoint) this.refitHeld();
        }
        this.display.update(this.restoringCheckpoint ? 0 : Math.min(dt, .067), this.world.bodies, held, Math.min(1, this.clock / .24), holdPhase === 'entering');
        if (this.restoringCheckpoint) return;
        this.music.update(Math.min(dt, .067), this.display.getViewHeight(), this.incident !== null,
            !feedbackActive, this.audio.isReacting(), this.risk === 'Dangerous' || this.risk === 'Critical');
    }

    private refitHeld(): void {
        const held = this.current!;
        this.boundary = this.display.beginPlacement(this.world.placementTop(), Math.max(held.spec.width, held.spec.height));
        this.normalBoundary = this.display.logicalBounds();
        this.world.configureSafety(this.normalBoundary, this.world.supportedTop());
        const bounds = localBounds(held.spec, planarAngle(held.node.rotation));
        const x = Math.max(this.boundary.left - bounds.left + 4,
            Math.min(this.boundary.right - bounds.right - 4, held.node.position.x));
        const enteringOffset = this.phase === 'entering' ? 55 * (1 - Math.min(1, this.clock / ENTER_SECONDS)) ** 3 : 0;
        held.node.setPosition(x, this.boundary.top - bounds.top + enteringOffset, 0);
        this.pendingResize = false; this.finger = null;
    }

    private enter(): void {
        const current = this.current!;
        const t = Math.min(1, this.clock / ENTER_SECONDS);
        current.node.setPosition(current.node.position.x, this.boundary.top - localBounds(current.spec, 0).top + 55 * (1 - t) ** 3, 0);
        if (t === 1) { this.phase = 'planning'; this.clock = 0; this.audio.play('claw_grip'); this.plan(0); }
    }

    private plan(dt: number): void {
        if (!this.display.cameraRecovered() || this.world.hasPlacementHazard()) {
            this.finger = null;
            this.display.setHint('等待掉落结束');
            return;
        }
        const exempt = this.untimedCalibration || (this.tutorial && this.releaseCount < 2);
        if (!exempt) this.planningLeft = Math.max(0, this.planningLeft - dt);
        const text = this.untimedCalibration ? '观察 NEXT · 松手释放' : exempt ? (this.releaseCount === 1 && this.rotations === 0 ? '试试右下旋转按钮，再松手释放' : '左右拖动，松手释放')
            : `${Math.ceil(this.planningLeft)} 秒后释放`;
        this.display.setHint(text);
        if (!exempt && this.planningLeft === 0) this.release();
    }

    private touchStart(id: number, point: Vec2): void {
        this.audio.interact();
        if (this.phase !== 'planning' || this.lifecycle.paused || this.finger !== null || this.restoringCheckpoint || this.restoreRequest || !this.display.cameraRecovered()) return;
        if (!this.firstTouchGreeted && !this.world.hasPlacementHazard()) {
            this.firstTouchGreeted = true;
            this.audio.play('voice_hey', .65);
        }
        this.finger = id;
        this.dragOffset = this.current!.node.position.x - this.display.pointerX(point);
    }
    private touchMove(id: number, point: Vec2): void {
        if (id !== this.finger || this.phase !== 'planning' || this.lifecycle.paused) return;
        this.moveTo(this.display.pointerX(point) + this.dragOffset);
    }
    private touchEnd(id: number): void {
        if (id !== this.finger) return;
        this.finger = null;
        this.release();
    }

    moveTo(x: number): void {
        if (this.phase !== 'planning' || !this.current || this.lifecycle.paused || this.restoringCheckpoint || this.restoreRequest || !this.display.cameraRecovered()) return;
        const bounds = localBounds(this.current.spec, planarAngle(this.current.node.rotation));
        const clamped = Math.max(this.boundary.left - bounds.left + 4, Math.min(this.boundary.right - bounds.right - 4, x));
        this.current.node.setPosition(clamped, this.current.node.position.y, 0);
    }

    rotate(): void {
        if (this.phase !== 'planning' || !this.current || this.lifecycle.paused || this.restoringCheckpoint || this.restoreRequest || !this.display.cameraRecovered()) return;
        const current = this.current;
        this.rotations++;
        current.node.setRotationFromEuler(0, 0, -(this.rotations % 4) * 90);
        const bounds = localBounds(current.spec, -(this.rotations % 4) * 90);
        current.node.setPosition(current.node.position.x, this.boundary.top - bounds.top, 0);
        this.moveTo(current.node.position.x);
        this.audio.play('skill_rotate_90');
    }

    release(): void {
        if (this.phase !== 'planning' || !this.current || this.lifecycle.paused || this.restoringCheckpoint || this.restoreRequest || !this.display.cameraRecovered() || this.world.hasPlacementHazard()) return;
        this.undoCheckpoint = this.captureCheckpoint();
        const effects = this.items.takeNextEffects();
        (this.world as TowerWorld & { applyHeldEffects?: (record: TowerBody, effects: { glueSeconds: number; shrinkNext: boolean; featherNext: boolean }) => void })
            .applyHeldEffects?.(this.current, effects);
        this.phase = 'falling'; this.clock = 0; this.finger = null;
        this.stableFor = 0;
        const shape = this.world.bounds(this.current);
        this.highlights.recordRelease(this.current.id, {
            large: shape.right - shape.left >= HIGHLIGHT_TUNING.largeMinWidth &&
                this.current.spec.width * this.current.spec.height >= HIGHLIGHT_TUNING.largeMinArea,
            oldTowerRisk: classifyTowerRisk(this.world.riskSignals(0, true)),
            oldBodyIds: this.world.bodies.filter(record => record.placed && !record.lost).map(record => record.id),
        });
        this.current.lossBoundary = { left: this.boundary.left, right: this.boundary.right, bottom: this.boundary.bottom };
        this.world.release(this.current); this.releaseCount++;
        this.renderItems();
        this.display.setHint(''); this.audio.play('claw_release');
    }

    /** Inventory action entry point used by the local HUD and calibration host. */
    useItem(kind: ItemKind): boolean {
        if (this.phase === 'ended' || this.lifecycle?.paused || this.restoringCheckpoint || this.restoreRequest) return false;
        const hasItem = () => this.items.snapshot().slots.some(stack => stack?.kind === kind);
        if (!hasItem()) return false;
        if (kind === 'undo') {
            if (!this.undoCheckpoint || !this.items.use(kind)) return false;
            this.renderItems();
            return this.restoreCheckpoint('undo');
        }
        if (kind === 'restore_star') {
            if (this.stars >= 3 || !this.items.use(kind)) return false;
            this.stars++;
            this.display.setStars(this.stars); this.renderItems();
            return true;
        }
        if (kind === 'reroll') {
            if (this.phase !== 'planning' || this.sequence || !this.current) return false;
            const next = this.objectDirector.reroll({ elapsedSeconds: this.elapsedSeconds, risk: this.risk,
                stableSeconds: this.steadySeconds, incidentCount: this.chargedIncidentCount, placedCount: this.placedCount,
                allowEarlyDiscovery: true });
            if (!next) return false;
            if (!this.items.use(kind)) return false;
            this.display.setNext(next); this.renderItems();
            return true;
        }
        if (this.phase !== 'planning' || !this.current) return false;
        if (!this.items.use(kind)) return false;
        this.renderItems();
        return true;
    }

    chooseItem(kind: ItemKind, replaceSlot?: 0 | 1): boolean {
        if (!this.items.chooseOffer(kind, replaceSlot)) return false;
        this.discoverItem(kind);
        this.renderItems();
        return true;
    }

    private discoverObject(kind: ObjectKind): void {
        if (!this.collection.discoverObject(kind)) return;
        if (typeof writePlayerProgress === 'function') writePlayerProgress(this.collection.snapshot());
    }

    private discoverItem(kind: ItemKind): void {
        if (!this.collection.discoverItem(kind)) return;
        if (typeof writePlayerProgress === 'function') writePlayerProgress(this.collection.snapshot());
    }

    /** Local experiment host may select a fixed sequence before the first release.
     * This explicit calibration override bypasses the director, never a mid-run risk change. */
    configureCalibration(sequence: readonly ObjectKind[], untimed = false): boolean {
        if (this.releaseCount !== 0 || !this.current || this.phase === 'ended'
            || sequence.length < 2 || sequence[0] !== this.current.spec.kind
            || sequence.some(kind => !OBJECTS[kind] || !this.frames.some(frame => frame.name === `object_${kind}`)
                || !this.frames.some(frame => frame.name === `next_${kind}`))) return false;
        this.sequence = [...sequence]; this.untimedCalibration = untimed;
        this.display.setNext(this.sequence[1]);
        return true;
    }

    private observe(): void {
        const current = this.current!;
        if (current.contactSeconds !== null && this.phase === 'falling') {
            this.phase = 'observing';
        }
        if (this.phase !== 'observing' || this.world.hasPlacementHazard()) return;
        if (!current.placed && current.contactSeconds! < MAX_OBSERVE_SECONDS) return;
        // Handoff does not mark an unsettled piece as placed or award its height.
        // The first-run exemption concerns the first two releases, even if settling is delayed.
        if (this.tutorial && this.releaseCount >= 2) {
            const settings = readSettings(); settings.tutorialDone = true; writeSettings(settings);
        }
        this.spawn();
    }

    private confirmStable(dt: number): void {
        // Scoring keeps the approved physical stability rule. SPEC §6.6's non-Critical
        // requirement belongs to future checkpoint saving, not success/height confirmation.
        this.stableFor = this.world.isStable() ? this.stableFor + dt : 0;
        if (this.stableFor < STABLE_SECONDS) return;
        let confirmed = 0;
        let playfulPlacement = false;
        const candidates: ReturnType<TowerWorld['highlightPlacement']>[] = [];
        for (const record of this.world.bodies) {
            if (record.lost || !record.collider.enabled || record.placed) continue;
            record.placed = true; confirmed++;
            candidates.push(this.world.highlightPlacement(record));
            if (['whale', 'burger', 'toilet', 'slipper'].indexOf(record.spec.kind) >= 0) playfulPlacement = true;
        }
        const events = this.highlights.confirmStable(candidates);
        this.presentHighlights(events, candidates);
        if (!confirmed) { this.saveStableCheckpoint(); return; }
        this.placedCount += confirmed;
        this.items.maybeOpenOffer(this.placedCount);
        this.renderItems();
        const previousPeak = this.peak;
        this.peak = Math.max(this.peak, this.world.confirmedTop());
        this.display.setHeight(this.peak);
        // Score uses 100 world units/metre. One event can cross several 5 m milestones.
        // Consuming the crossing now prevents muted/cooling events being celebrated later.
        if (events.some(event => event.feedback)) {
            // A qualified short success cue has priority over an unrelated commentary voice.
        } else if (Math.floor(this.peak / 500) > Math.floor(previousPeak / 500)) {
            this.audio.play('voice_wow', .75);
        } else if (playfulPlacement && !this.playfulReactionUsed) {
            this.playfulReactionUsed = this.audio.play('voice_chuckle', .7);
        }
        // Camera room is selected at handoff, independently of delayed score confirmation.
        // Ordinary placements stay quiet; success cues require the ledger's actual evidence.
        this.saveStableCheckpoint();
    }

    private captureCheckpoint(): RunCheckpoint {
        return {
            world: this.world.exportState(), director: this.objectDirector.exportState(),
            highlights: this.highlights.exportState(), view: this.display.exportState(),
            currentId: this.current?.id ?? null, phase: this.phase,
            next: this.sequence ? this.sequence[(this.releaseCount +
                (this.phase === 'entering' || this.phase === 'planning' ? 1 : 0)) % this.sequence.length] : this.objectDirector.next,
            boundary: { ...this.boundary }, normalBoundary: { ...this.normalBoundary },
            clock: this.clock, stableFor: this.stableFor, planningLeft: this.planningLeft,
            releaseCount: this.releaseCount, placedCount: this.placedCount, peak: this.peak,
            stars: this.stars, rotations: this.rotations, tutorial: this.tutorial,
            firstTouchGreeted: this.firstTouchGreeted, playfulReactionUsed: this.playfulReactionUsed,
            sequence: this.sequence ? [...this.sequence] : null, untimedCalibration: this.untimedCalibration,
            elapsedSeconds: this.elapsedSeconds, steadySeconds: this.steadySeconds,
            recentImpactSpeed: this.recentImpactSpeed, chargedIncidentCount: this.chargedIncidentCount,
            incidentCount: this.incidentCount, risk: this.risk, items: this.items.exportState(),
        };
    }

    private saveStableCheckpoint(): void {
        if (this.placedCount === 0 || (this.stableCheckpoint?.placedCount ?? -1) >= this.placedCount
            || this.lifecycle.paused || this.incident || this.restoringCheckpoint || this.restoreRequest
            || this.phase === 'defeated' || this.phase === 'ended' || this.risk === 'Critical'
            || this.stableFor < STABLE_SECONDS || !this.world.canSaveCheckpoint()
            || this.recentImpactSpeed >= RISK_THRESHOLDS.impactSpeed[0]) return;
        this.stableCheckpoint = this.captureCheckpoint();
    }

    /** Local calibration entry only. Actual item consumption / ad revival are not implemented.
     * Queuing avoids rebuilding Box2D inside a touch/contact callback. Pause remains in force. */
    restoreCheckpoint(kind: 'stable' | 'undo'): boolean {
        if ((kind !== 'stable' && kind !== 'undo') || this.phase === 'ended' || this.restoreRequest
            || this.restoringCheckpoint || !this.world || this.world.restoring
            || !(kind === 'stable' ? this.stableCheckpoint : this.undoCheckpoint)) return false;
        this.checkpointAction = kind;
        this.finger = null;
        return true;
    }

    private applyCheckpoint(point: RunCheckpoint, kind: 'stable' | 'undo'): void {
        this.checkpointAction = 'rebuilding';
        this.audio.pause(true); this.music.pause(true);
        this.world.restoreState(point.world);
        this.objectDirector.restoreState(point.director);
        this.highlights.restoreState(point.highlights);
        this.display.restoreState(point.view);
        this.current = this.world.bodies.find(record => record.id === point.currentId) ?? null;
        this.phase = point.phase; this.boundary = { ...point.boundary }; this.normalBoundary = { ...point.normalBoundary };
        this.clock = point.clock; this.stableFor = point.stableFor; this.planningLeft = point.planningLeft;
        // An undo after auto-drop must leave a real chance to act, rather than replaying
        // the expired timer on the very next frame. Stable restoration keeps its timer.
        if (kind === 'undo' && this.phase === 'planning') { this.planningLeft = PLANNING_SECONDS; this.clock = 0; }
        this.releaseCount = point.releaseCount; this.placedCount = point.placedCount; this.peak = point.peak;
        this.stars = point.stars; this.rotations = point.rotations; this.tutorial = point.tutorial;
        this.firstTouchGreeted = point.firstTouchGreeted; this.playfulReactionUsed = point.playfulReactionUsed;
        this.sequence = point.sequence ? [...point.sequence] : null; this.untimedCalibration = point.untimedCalibration;
        this.elapsedSeconds = point.elapsedSeconds; this.steadySeconds = point.steadySeconds;
        this.recentImpactSpeed = point.recentImpactSpeed; this.chargedIncidentCount = point.chargedIncidentCount;
        this.incidentCount = point.incidentCount; this.risk = point.risk;
        this.items.restoreCheckpoint(point.items);
        this.incident = null; this.recoveryFor = 0; this.failureReason = null; this.finger = null; this.dragOffset = 0;
        this.resumePhase = point.phase; this.resumeClock = point.clock;
        const bounds = this.display.logicalBounds();
        this.pendingResize = (['left', 'right', 'top', 'bottom'] as const)
            .some(key => Math.abs(bounds[key] - this.normalBoundary[key]) > .01);
        // Undo cannot keep a revive point from its abandoned future. A genuinely stable
        // restored tower may establish a new point after the solver has rebuilt contacts.
        if (kind === 'undo' && this.stableCheckpoint && (this.stableCheckpoint.releaseCount > point.releaseCount
            || this.stableCheckpoint.placedCount > point.placedCount)) this.stableCheckpoint = null;
        this.undoCheckpoint = null;
        this.display.setStars(this.stars); this.display.setHeight(this.peak); this.renderItems();
        this.display.setNext(point.next);
        this.display.setHint('恢复中…'); this.display.setRisk('Safe', false);
        runResult.height = 0; runResult.placed = 0; runResult.reason = 'calibration_end';
        runResult.technicalScore = 0; runResult.highlights = { narrow_escape: 0, edge_balance: 0, bridge: 0, large_rescue: 0 };
    }

    private finishRestore(): void {
        this.checkpointAction = null;
        if (this.pendingResize && (this.phase === 'planning' || this.phase === 'entering')) this.refitHeld();
        this.display.setRisk(this.risk); this.display.setHint('');
        this.audio.pause(this.lifecycle.paused); this.music.pause(this.lifecycle.paused);
    }

    private presentHighlights(events: readonly HighlightEvent[], candidates: ReturnType<TowerWorld['highlightPlacement']>[]): void {
        for (const event of events) {
            if (!event.feedback) continue;
            const target = event.bodyId === null ? this.world.bodies.filter(record => record.placed && !record.lost && record.supported)
                .sort((a, b) => this.world.nativeBounds(b).top - this.world.nativeBounds(a).top)[0]
                : this.world.bodies.find(record => record.id === event.bodyId);
            const point = candidates.find(candidate => candidate.id === event.bodyId)?.point
                ?? (target ? this.world.highlightPlacement(target).point : null);
            if (this.display.showHighlight(event.kind, point ?? undefined)) this.audio.play('stable', .55, 'highlight');
        }
    }

    private beginIncident(): void {
        if (this.incident || this.restoringCheckpoint || this.phase === 'defeated' || this.phase === 'ended') return;
        const boundary = this.normalBoundary;
        const intersects = (a: WorldBoundary, b: WorldBoundary) => a.left <= b.right && a.right >= b.left && a.top >= b.bottom && a.bottom <= b.top;
        const placed = this.world.bodies.filter(record => record.placed && !record.lost);
        const visible = placed.filter(record => intersects(this.world.nativeBounds(record), boundary)).length;
        const zoom = visible >= 3 && visible <= 5 ? .75 : 1;
        const cx = (boundary.left + boundary.right) / 2, cy = (boundary.top + boundary.bottom) / 2;
        const halfWidth = (boundary.right - boundary.left) / (2 * zoom), halfHeight = (boundary.top - boundary.bottom) / (2 * zoom);
        const observation = { left: cx - halfWidth, right: cx + halfWidth, bottom: cy - halfHeight, top: cy + halfHeight };
        this.incident = new Incident(boundary, observation, this.world.assistanceTop(),
            placed.filter(record => intersects(this.world.nativeBounds(record), observation)).map(record => record.id), zoom);
        this.incidentCount++;
        this.risk = 'Critical'; this.steadySeconds = 0;
        this.display.clearFeedback();
        this.highlights.observe({ dt: 0, oldTowerRisk: 'Critical', towerRisk: 'Critical', hasExistingTower: false,
            stable: false, incidentActive: true, incidentCount: this.chargedIncidentCount });
        this.audio.stopReactions();
        this.resumePhase = this.phase; this.resumeClock = this.clock;
        this.phase = 'incident'; this.clock = 0; this.recoveryFor = 0; this.finger = null; this.stableFor = 0;
        this.display.beginIncident(zoom);
        this.display.setHint('先稳住，等这一波掉落结束');
    }

    /** Called before the physical loss flag changes, so the first old piece belongs to the frozen set. */
    private lost(record: TowerBody): void {
        if (this.restoringCheckpoint || this.phase === 'ended' || this.phase === 'defeated') return;
        this.beginIncident();
        const loss = this.incident!.recordLoss(record.id);
        if (loss.duplicate) return;
        if (this.recoveryFor >= .6) this.display.holdIncident();
        this.recoveryFor = 0;
        if (loss.firstLoss) {
            this.chargedIncidentCount++;
            this.stars = Math.max(0, this.stars - 1);
            this.display.setStars(this.stars);
            // The optional incident clip is bound only after its separate audio review.
            this.audio.play('star_lost', .65, `incident:${this.incidentCount}`);
        }
        if (loss.collapse || this.stars === 0) this.lockFailure(loss.collapse ? 'large_collapse' : 'stars_exhausted');
        else this.display.setHint(`还剩 ${this.stars} 颗星 · 等掉落结束`);
    }

    private updateIncident(dt: number): void {
        const wasRecovering = this.recoveryFor >= .6;
        this.recoveryFor = this.world.remainingStable() && !this.world.collapseTrend() ? this.recoveryFor + dt : 0;
        if (wasRecovering && this.recoveryFor === 0) this.display.holdIncident();
        if (this.recoveryFor < .6) return;
        if (!wasRecovering) this.display.endIncident();
        if (!this.display.cameraRecovered()) return;
        this.incident = null; this.recoveryFor = 0;
        // A touch can release the held piece before the next update. Synchronize the
        // ledger now, without advancing any stable/danger timer or restoring old chances.
        this.highlights.observe({ dt: 0, oldTowerRisk: this.risk, towerRisk: this.risk, stable: false,
            hasExistingTower: false, incidentActive: false, incidentCount: this.chargedIncidentCount });
        if (this.current && !this.current.lost) {
            this.phase = this.resumePhase; this.clock = this.resumeClock;
            if (this.pendingResize && (this.phase === 'planning' || this.phase === 'entering')) this.refitHeld();
        } else {
            // The missed piece consumed one release; NEXT remains the already advertised item.
            this.spawn();
        }
        this.display.setHint('');
    }

    private lockFailure(reason: string): void {
        if (this.phase === 'defeated' || this.phase === 'ended') return;
        this.failureReason = reason;
        this.audio.stopReactions();
        if (this.current && !this.current.collider.enabled) this.current.node.active = false;
        this.phase = 'defeated'; this.clock = 0; this.finger = null;
        this.display.clearFeedback(); this.display.setRisk('Safe', false);
        const highlights = this.highlights.lock();
        runResult.height = this.peak / 100; runResult.placed = this.placedCount; runResult.reason = reason;
        runResult.technicalScore = highlights.technicalScore; runResult.highlights = highlights.counts;
        const discoveries = this.collection.runDiscoveries();
        runResult.newRecord = this.collection.finishRun(runResult.height);
        runResult.collectionNewObjects = discoveries.objects;
        runResult.collectionNewItems = discoveries.items;
        this.display.setHint(reason === 'large_collapse' ? '这次倒得有点多…' : '星星用完啦');
        // Physics may finish the collapse, but no further input, score or result changes are allowed.
    }

    /** Local reviewer can end a run explicitly; ordinary play uses the incident rules. */
    finish(reason = 'calibration_end'): void {
        if (this.phase === 'ended' || this.phase === 'defeated') return;
        this.lockFailure(reason);
        this.commitResult();
    }

    private commitResult(): void {
        if (this.phase === 'ended') return;
        this.phase = 'ended'; this.clock = 0; this.finger = null;
        if (typeof writePlayerProgress === 'function') writePlayerProgress(this.collection.snapshot());
        const settings = readSettings(); settings.tutorialDone = true; writeSettings(settings);
        this.audio.pause(true);
        this.music.pause(true);
        director.loadScene('Result');
    }

    private impact(record: TowerBody, pair: string, speed: number, landing?: LandingContact): void {
        if (record.lost || this.restoringCheckpoint || this.lifecycle?.paused || this.phase === 'ended') return;
        if (this.phase !== 'defeated') this.recentImpactSpeed = Math.max(this.recentImpactSpeed, landing?.speed ?? speed);
        const bounds = this.world.nativeBounds(record);
        if (speed >= .6 && bounds.top >= this.boundary.bottom && bounds.right >= this.boundary.left && bounds.left <= this.boundary.right)
            this.audio.play(`impact_${record.spec.kind}`, Math.min(.85, .25 + speed * .035), pair);
        if (landing && this.phase !== 'defeated' && landing.point.y >= this.normalBoundary.bottom && landing.point.y <= this.normalBoundary.top &&
            landing.point.x >= this.normalBoundary.left && landing.point.x <= this.normalBoundary.right) this.display.land(landing);
    }

    /** Read-only diagnostics used by the local calibration page. */
    snapshot(): object {
        return { phase: this.phase, releases: this.releaseCount, placed: this.placedCount, peakMetres: this.peak / 100,
            stars: this.stars, incidentCount: this.incidentCount, incident: this.incident?.snapshot() ?? null,
            recoverySeconds: this.recoveryFor, failureReason: this.failureReason, normalBoundary: this.normalBoundary,
            safety: this.world.safetySnapshot(),
            sequence: [...(this.sequence ?? CALIBRATION_SEQUENCE)], untimedCalibration: this.untimedCalibration,
            drawMode: this.sequence ? 'calibration' : 'director', director: this.objectDirector.snapshot(),
            risk: this.risk, elapsedSeconds: this.elapsedSeconds, steadySeconds: this.steadySeconds,
            highlights: this.highlights.snapshot(),
            collection: this.collection.snapshot(),
            items: this.items.snapshot(),
            checkpoints: { stable: this.stableCheckpoint ? { placed: this.stableCheckpoint.placedCount,
                releases: this.stableCheckpoint.releaseCount, peakMetres: this.stableCheckpoint.peak / 100 } : null,
                undo: this.undoCheckpoint ? { placed: this.undoCheckpoint.placedCount,
                    releases: this.undoCheckpoint.releaseCount, peakMetres: this.undoCheckpoint.peak / 100 } : null,
                restoring: this.restoringCheckpoint, queued: this.restoreRequest },
            recentImpactSpeed: this.recentImpactSpeed, chargedIncidentCount: this.chargedIncidentCount,
            observationSeconds: this.current?.contactSeconds, maxObserveSeconds: MAX_OBSERVE_SECONDS,
            placementBlocked: this.world.hasPlacementHazard(), placementTop: this.world.placementTop(),
            stabilizers: this.world.stabilizerSnapshot(),
            secondsLeft: this.planningLeft, tutorial: this.tutorial, paused: this.lifecycle.paused,
            boundary: this.boundary, view: this.display.snapshot(), music: this.music.snapshot(), audioClips: this.approvedSounds.length,
            currentId: this.current?.id, bodies: this.world.bodies.map(r => ({ id: r.id, kind: r.spec.kind,
                position: r.node.position.clone(), angle: planarAngle(r.node.rotation), size: [r.spec.width, r.spec.height],
                physicsAxis: r.body.getWorldVector(new Vec2(1, 0), new Vec2()),
                velocity: r.body.linearVelocity.clone(), angularVelocity: r.body.angularVelocity,
                mass: r.body.getMass(), awake: r.body.isAwake(), contacts: r.contacts.size,
                contactSeconds: r.contactSeconds, lossBoundary: r.lossBoundary,
                lost: r.lost, supported: r.supported, detachedSeconds: r.detachedSeconds, fallingSeconds: r.fallingSeconds,
                assistDamping: r.assistDamping,
                placed: r.placed, type: r.body.type, scale: r.node.worldScale.clone(), bounds: this.world.bounds(r) })) };
    }

    onDestroy(): void {
        this.audio?.dispose(); this.music?.dispose(); this.touches?.dispose(); this.lifecycle?.dispose(); this.world?.dispose(); this.display?.dispose();
    }
}
