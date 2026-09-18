import { STABLE_SECONDS } from './object-data';
import type { TowerRisk } from './tower-director';

export type HighlightKind = 'narrow_escape' | 'edge_balance' | 'bridge' | 'large_rescue';
export const HIGHLIGHT_LABELS: Record<HighlightKind, string> = {
    narrow_escape: '惊险稳住', edge_balance: '极限边缘', bridge: '桥接成功', large_rescue: '大物体救场',
};

/** SPEC defines the four events, but no scores/geometry thresholds. These are R1 candidates.
 * Stability reuses the existing placement duration; none of these values change physics. */
export const HIGHLIGHT_TUNING = {
    points: { narrow_escape: 100, edge_balance: 80, bridge: 120, large_rescue: 150 },
    criticalSeconds: .35,
    stableSeconds: STABLE_SECONDS,
    feedbackSeconds: 6,
    maxFrameSeconds: .067,
    edgeMinSupportRatio: .15,
    edgeMaxSupportRatio: .35,
    edgeMinCenterOffsetRatio: .65,
    bridgeMinGapRatio: .12,
    bridgeMinSupportRatio: .15,
    largeMinWidth: 140,
    largeMinArea: 20000,
} as const;

export interface HighlightRelease {
    large: boolean;
    /** Existing confirmed tower only, without recent-impact impulses or this falling body. */
    oldTowerRisk: TowerRisk;
    oldBodyIds: readonly number[];
}
export interface HighlightFrame {
    /** Active simulation time only; the caller must not observe while paused. */
    dt: number;
    oldTowerRisk: TowerRisk;
    towerRisk: TowerRisk;
    /** At least two active, previously confirmed bodies, as sampled by the world. */
    hasExistingTower: boolean;
    stable: boolean;
    incidentActive: boolean;
    /** Monotonic effective, star-charging incident count. */
    incidentCount: number;
}
export interface HighlightPlacement {
    id: number;
    supported: boolean;
    /** Union of real solver bearing-point spans / width; single points do not imply an area. */
    supportRatio: number;
    /** For one bearing: abs(COM - bearing midpoint) / bearing half-width. */
    centerOffsetRatio: number;
    /** Gap between distinct bearings on either side of COM, divided by body width. */
    bridgeGapRatio: number;
    bearingCount: number;
    /** Bodies this placement really carries, from directed upward bearing relations. */
    supportedBodyIds: readonly number[];
}
export interface HighlightEvent {
    kind: HighlightKind;
    bodyId: number | null;
    points: number;
    /** Audio/visual eligibility only. A muted or cooling event still counts exactly once. */
    feedback: boolean;
}
export interface HighlightSnapshot {
    technicalScore: number;
    counts: Record<HighlightKind, number>;
    locked: boolean;
    criticalSeconds: number;
    stableSeconds: number;
    recoverySeconds: number;
    pendingRecovery: boolean;
}

/** Complete in-memory ledger, including still-falling releases and feedback cooldown. */
export interface HighlightState extends HighlightSnapshot {
    elapsedSeconds: number;
    /** -Infinity means no event has played feedback yet. This is not a JSON persistence format. */
    lastFeedbackSeconds: number;
    incidentActive: boolean;
    incidentCount: number;
    releases: { id: number; large: boolean; oldTowerRisk: TowerRisk; oldBodyIds: number[] }[];
    confirmed: number[];
}

/** Pure per-run state. Only real stable confirmations award points; reads never advance it.
 * Geometric events belong to a body; narrow escapes belong to a sustained danger episode.
 * Perfect drops intentionally have no kind, points, counter or result field here. */
export class RunHighlights {
    private technicalScore = 0;
    private readonly counts: Record<HighlightKind, number> = {
        narrow_escape: 0, edge_balance: 0, bridge: 0, large_rescue: 0,
    };
    private locked = false;
    private elapsedSeconds = 0;
    private lastFeedbackSeconds = -Infinity;
    private criticalSeconds = 0;
    private stableSeconds = 0;
    private recoverySeconds = 0;
    private pendingRecovery = false;
    private incidentActive = false;
    private incidentCount = 0;
    private readonly releases = new Map<number, HighlightRelease>();
    private readonly confirmed = new Set<number>();

    recordRelease(id: number, release: HighlightRelease): void {
        if (this.locked || this.incidentActive || !this.validId(id) || this.confirmed.has(id) || this.releases.has(id)) return;
        // Copy IDs: later body confirmations or mutable caller arrays cannot rewrite history.
        this.releases.set(id, { large: release.large, oldTowerRisk: release.oldTowerRisk,
            oldBodyIds: Array.from(new Set(release.oldBodyIds.filter(oldId => this.validId(oldId) && oldId !== id))) });
        this.stableSeconds = 0; this.recoverySeconds = 0;
    }

    observe(frame: HighlightFrame): void {
        if (this.locked) return;
        const dt = Number.isFinite(frame.dt) && frame.dt > 0 ? Math.min(frame.dt, HIGHLIGHT_TUNING.maxFrameSeconds) : 0;
        this.elapsedSeconds += dt;
        const charged = Number.isInteger(frame.incidentCount) && frame.incidentCount > this.incidentCount;
        if (charged) this.incidentCount = frame.incidentCount;
        // Incident end can precede a same-frame touch release. Synchronize even at dt=0.
        this.incidentActive = frame.incidentActive;
        if (charged || frame.incidentActive) {
            this.criticalSeconds = 0; this.stableSeconds = 0; this.recoverySeconds = 0; this.pendingRecovery = false;
            this.releases.clear();
            return;
        }
        if (dt === 0) return;
        this.stableSeconds = frame.stable ? this.stableSeconds + dt : 0;
        const recovered = this.lowRisk(frame.oldTowerRisk) && this.lowRisk(frame.towerRisk);
        this.recoverySeconds = frame.stable && recovered ? this.recoverySeconds + dt : 0;
        if (!frame.hasExistingTower) {
            this.criticalSeconds = 0; this.pendingRecovery = false;
        } else if (frame.oldTowerRisk === 'Critical') {
            this.criticalSeconds += dt;
            if (this.criticalSeconds >= HIGHLIGHT_TUNING.criticalSeconds) this.pendingRecovery = true;
        } else {
            // A short Critical spike cannot borrow time from a later, unrelated spike.
            this.criticalSeconds = 0;
        }
    }

    /** Call at the genuine stable-confirmation node, even when no new body is confirmed.
     * An observation timeout/handoff is never a stable confirmation. */
    confirmStable(placements: readonly HighlightPlacement[]): HighlightEvent[] {
        if (this.locked || this.incidentActive || this.stableSeconds < HIGHLIGHT_TUNING.stableSeconds) return [];
        const events: HighlightEvent[] = [];
        const recovered = this.recoverySeconds >= HIGHLIGHT_TUNING.stableSeconds;
        for (const placement of placements) {
            if (!this.validId(placement.id) || this.confirmed.has(placement.id)) continue;
            // First confirmation consumes the opportunity, including an ordinary placement.
            // A later geometry change is not another successful placement of the same body.
            this.confirmed.add(placement.id);
            const release = this.releases.get(placement.id);
            this.releases.delete(placement.id);
            // Incidents invalidate pending releases, including geometric celebrations.
            if (!release || !placement.supported) continue;
            let kind: HighlightKind | null = null;
            const coverage = Number.isFinite(placement.supportRatio) && placement.supportRatio >= 0 && placement.supportRatio <= 1;
            const bearings = Number.isInteger(placement.bearingCount) && placement.bearingCount > 0;
            if (coverage && bearings && placement.bearingCount >= 2 && Number.isFinite(placement.bridgeGapRatio)
                && placement.bridgeGapRatio >= HIGHLIGHT_TUNING.bridgeMinGapRatio && placement.bridgeGapRatio <= 1
                && placement.supportRatio >= HIGHLIGHT_TUNING.bridgeMinSupportRatio) kind = 'bridge';
            else if (coverage && bearings && placement.bearingCount === 1
                && placement.supportRatio >= HIGHLIGHT_TUNING.edgeMinSupportRatio
                && placement.supportRatio <= HIGHLIGHT_TUNING.edgeMaxSupportRatio
                && Number.isFinite(placement.centerOffsetRatio)
                && placement.centerOffsetRatio >= HIGHLIGHT_TUNING.edgeMinCenterOffsetRatio
                && placement.centerOffsetRatio <= 1) kind = 'edge_balance';
            else if (release?.large && recovered && release.oldBodyIds.length >= 2
                && (release.oldTowerRisk === 'Dangerous' || release.oldTowerRisk === 'Critical')
                && placement.supportedBodyIds.some(id => release.oldBodyIds.indexOf(id) >= 0)) kind = 'large_rescue';
            if (kind) events.push(this.award(kind, placement.id));
        }
        if (this.pendingRecovery && recovered) {
            this.pendingRecovery = false;
            events.push(this.award('narrow_escape', null));
        }
        return events;
    }

    lock(): HighlightSnapshot { this.locked = true; return this.snapshot(); }

    snapshot(): HighlightSnapshot {
        return { technicalScore: this.technicalScore, counts: { ...this.counts }, locked: this.locked,
            criticalSeconds: this.criticalSeconds, stableSeconds: this.stableSeconds,
            recoverySeconds: this.recoverySeconds, pendingRecovery: this.pendingRecovery };
    }

    exportState(): HighlightState {
        return { ...this.snapshot(), elapsedSeconds: this.elapsedSeconds, lastFeedbackSeconds: this.lastFeedbackSeconds,
            incidentActive: this.incidentActive, incidentCount: this.incidentCount,
            releases: Array.from(this.releases, ([id, release]) => ({ id, large: release.large,
                oldTowerRisk: release.oldTowerRisk, oldBodyIds: Array.from(release.oldBodyIds) })),
            confirmed: Array.from(this.confirmed) };
    }

    restoreState(state: HighlightState): void {
        const count = (value: number) => Number.isSafeInteger(value) && value >= 0;
        const duration = (value: number) => Number.isFinite(value) && value >= 0;
        const id = (value: number) => Number.isSafeInteger(value) && value > 0;
        const kinds = Object.keys(HIGHLIGHT_TUNING.points) as HighlightKind[];
        if (!state || !state.counts || !count(state.technicalScore)
            || kinds.some(kind => !count(state.counts[kind]))
            || kinds.reduce((score, kind) => score + state.counts[kind] * HIGHLIGHT_TUNING.points[kind], 0) !== state.technicalScore
            || typeof state.locked !== 'boolean' || typeof state.pendingRecovery !== 'boolean'
            || typeof state.incidentActive !== 'boolean' || !count(state.incidentCount)
            || !duration(state.elapsedSeconds) || !duration(state.criticalSeconds)
            || !duration(state.stableSeconds) || !duration(state.recoverySeconds)
            || state.criticalSeconds > state.elapsedSeconds || state.stableSeconds > state.elapsedSeconds
            || state.recoverySeconds > state.stableSeconds
            || !(state.lastFeedbackSeconds === -Infinity || (duration(state.lastFeedbackSeconds)
                && state.lastFeedbackSeconds <= state.elapsedSeconds))
            || (state.technicalScore === 0) !== (state.lastFeedbackSeconds === -Infinity)
            || !Array.isArray(state.releases) || !Array.isArray(state.confirmed))
            throw new Error('Invalid highlight checkpoint');
        const confirmed = new Set<number>();
        for (const bodyId of state.confirmed) {
            if (!id(bodyId) || confirmed.has(bodyId)) throw new Error('Invalid highlight confirmation history');
            confirmed.add(bodyId);
        }
        const releases = new Map<number, HighlightRelease>();
        for (const release of state.releases) {
            if (!release || !id(release.id) || releases.has(release.id) || confirmed.has(release.id)
                || typeof release.large !== 'boolean'
                || ['Safe', 'Unstable', 'Dangerous', 'Critical'].indexOf(release.oldTowerRisk) < 0
                || !Array.isArray(release.oldBodyIds)) throw new Error('Invalid highlight release history');
            const oldIds = new Set<number>();
            for (const oldId of release.oldBodyIds) {
                if (!id(oldId) || oldId === release.id || oldIds.has(oldId)) throw new Error('Invalid highlight old-body history');
                oldIds.add(oldId);
            }
            releases.set(release.id, { large: release.large, oldTowerRisk: release.oldTowerRisk, oldBodyIds: Array.from(oldIds) });
        }
        if (state.counts.edge_balance + state.counts.bridge + state.counts.large_rescue > confirmed.size
            || (state.incidentActive && (releases.size > 0 || state.pendingRecovery || state.criticalSeconds > 0
                || state.stableSeconds > 0 || state.recoverySeconds > 0)))
            throw new Error('Inconsistent highlight checkpoint');
        this.technicalScore = state.technicalScore;
        kinds.forEach(kind => { this.counts[kind] = state.counts[kind]; });
        this.locked = state.locked; this.elapsedSeconds = state.elapsedSeconds; this.lastFeedbackSeconds = state.lastFeedbackSeconds;
        this.criticalSeconds = state.criticalSeconds; this.stableSeconds = state.stableSeconds; this.recoverySeconds = state.recoverySeconds;
        this.pendingRecovery = state.pendingRecovery; this.incidentActive = state.incidentActive; this.incidentCount = state.incidentCount;
        this.releases.clear(); releases.forEach((release, bodyId) => this.releases.set(bodyId, release));
        this.confirmed.clear(); confirmed.forEach(bodyId => this.confirmed.add(bodyId));
    }

    private validId(id: number): boolean { return Number.isInteger(id) && id > 0; }
    private lowRisk(risk: TowerRisk): boolean { return risk === 'Safe' || risk === 'Unstable'; }
    private award(kind: HighlightKind, bodyId: number | null): HighlightEvent {
        const points = HIGHLIGHT_TUNING.points[kind];
        this.technicalScore += points; this.counts[kind]++;
        const feedback = this.elapsedSeconds - this.lastFeedbackSeconds >= HIGHLIGHT_TUNING.feedbackSeconds;
        if (feedback) this.lastFeedbackSeconds = this.elapsedSeconds;
        return { kind, bodyId, points, feedback };
    }
}
