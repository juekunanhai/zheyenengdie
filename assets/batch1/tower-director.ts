import { CALIBRATION_SEQUENCE, ObjectKind } from './object-data';

export type TowerRisk = 'Safe' | 'Unstable' | 'Dangerous' | 'Critical';
export interface TowerRiskSignals {
    /** Degrees from the nearest orthogonal resting orientation; round objects contribute zero. */
    maxTiltDegrees: number;
    /** Absolute degrees/second. Cocos angularVelocity must be converted from radians. */
    maxAngularSpeed: number;
    /** Actual bearing overlap / body width, 0..1. A coverage proxy, not contact area. */
    minSupportRatio: number;
    /** Unsupported mass / contacted, active tower mass, 0..1. */
    unsupportedMassRatio: number;
    /** Recent relative impact speed in Box2D metres/second, decayed by the caller. */
    recentImpactSpeed: number;
    mainSupportStable: boolean;
}

/** R1 tuning candidates: SPEC names factors/states but supplies no numeric risk thresholds.
 * Each row is the Unstable / Dangerous / Critical boundary. This does not alter physics. */
export const RISK_THRESHOLDS = {
    tiltDegrees: [8, 18, 32], angularDegrees: [12, 35, 80], supportRatio: [.45, .22, .08],
    unsupportedMassRatio: [.15, .35, .60], impactSpeed: [2.4, 3.6, 5],
} as const;

export function classifyTowerRisk(signals: TowerRiskSignals): TowerRisk {
    const values = [signals.maxTiltDegrees, signals.maxAngularSpeed, signals.minSupportRatio,
        signals.unsupportedMassRatio, signals.recentImpactSpeed];
    if (values.some(value => !Number.isFinite(value))) return 'Critical';
    let level = signals.mainSupportStable ? 0 : 2;
    const above = (value: number, limits: readonly number[]) => {
        for (let i = 0; i < limits.length; i++) if (value >= limits[i]) level = Math.max(level, i + 1);
    };
    above(Math.abs(signals.maxTiltDegrees), RISK_THRESHOLDS.tiltDegrees);
    above(Math.abs(signals.maxAngularSpeed), RISK_THRESHOLDS.angularDegrees);
    above(signals.unsupportedMassRatio, RISK_THRESHOLDS.unsupportedMassRatio);
    above(signals.recentImpactSpeed, RISK_THRESHOLDS.impactSpeed);
    for (let i = 0; i < RISK_THRESHOLDS.supportRatio.length; i++)
        if (signals.minSupportRatio <= RISK_THRESHOLDS.supportRatio[i]) level = Math.max(level, i + 1);
    return (['Safe', 'Unstable', 'Dangerous', 'Critical'] as const)[level];
}

type Difficulty = 'Easy' | 'Normal' | 'Hard' | 'Chaos';
type Absurdity = 'Normal' | 'Weird' | 'WTF';
type Role = 'Stable' | 'Platform' | 'Rescue' | 'Bridge' | 'Rolling' | 'Slippery' | 'Heavy' | 'Danger';
interface DirectorObject {
    difficulty: Difficulty;
    absurdity: Absurdity;
    roles: readonly Role[];
    rarity: 'Common' | 'Rare';
}

/** Classification candidates for all 24 shipped/candidate objects.
 * Difficulty is independent of absurdity: the whale is WTF but Normal, not Chaos. */
export const DIRECTOR_OBJECTS: Record<ObjectKind, DirectorObject> = {
    cardboard_box: { difficulty: 'Easy', absurdity: 'Normal', roles: ['Stable'], rarity: 'Common' },
    wooden_crate: { difficulty: 'Easy', absurdity: 'Normal', roles: ['Stable'], rarity: 'Common' },
    wood_plank: { difficulty: 'Easy', absurdity: 'Normal', roles: ['Platform', 'Rescue', 'Bridge'], rarity: 'Common' },
    sofa: { difficulty: 'Normal', absurdity: 'Weird', roles: ['Stable', 'Rescue'], rarity: 'Common' },
    burger: { difficulty: 'Normal', absurdity: 'Weird', roles: ['Stable'], rarity: 'Common' },
    fridge: { difficulty: 'Normal', absurdity: 'Normal', roles: ['Heavy'], rarity: 'Common' },
    toilet: { difficulty: 'Hard', absurdity: 'WTF', roles: ['Danger'], rarity: 'Common' },
    dumbbell: { difficulty: 'Hard', absurdity: 'Weird', roles: ['Heavy', 'Danger'], rarity: 'Common' },
    ice_block: { difficulty: 'Hard', absurdity: 'Normal', roles: ['Slippery', 'Danger'], rarity: 'Common' },
    basketball: { difficulty: 'Hard', absurdity: 'Normal', roles: ['Rolling', 'Danger'], rarity: 'Common' },
    slipper: { difficulty: 'Normal', absurdity: 'WTF', roles: ['Danger'], rarity: 'Common' },
    whale: { difficulty: 'Normal', absurdity: 'WTF', roles: ['Stable'], rarity: 'Rare' },
    television: { difficulty: 'Normal', absurdity: 'Weird', roles: ['Stable', 'Heavy'], rarity: 'Rare' },
    bathtub: { difficulty: 'Normal', absurdity: 'Weird', roles: ['Platform', 'Rescue'], rarity: 'Rare' },
    piano: { difficulty: 'Hard', absurdity: 'Normal', roles: ['Heavy'], rarity: 'Rare' },
    tire: { difficulty: 'Hard', absurdity: 'Normal', roles: ['Rolling', 'Danger'], rarity: 'Rare' },
    bowling_ball: { difficulty: 'Hard', absurdity: 'Normal', roles: ['Rolling', 'Danger'], rarity: 'Rare' },
    oil_drum: { difficulty: 'Hard', absurdity: 'Normal', roles: ['Heavy', 'Danger'], rarity: 'Rare' },
    spring_pad: { difficulty: 'Normal', absurdity: 'Weird', roles: ['Platform', 'Rescue'], rarity: 'Rare' },
    cat_bed: { difficulty: 'Easy', absurdity: 'Weird', roles: ['Stable', 'Platform'], rarity: 'Rare' },
    giraffe: { difficulty: 'Hard', absurdity: 'WTF', roles: ['Danger'], rarity: 'Rare' },
    ufo: { difficulty: 'Normal', absurdity: 'WTF', roles: ['Bridge'], rarity: 'Rare' },
    rocket: { difficulty: 'Hard', absurdity: 'WTF', roles: ['Danger'], rarity: 'Rare' },
    vending_machine: { difficulty: 'Hard', absurdity: 'Normal', roles: ['Heavy', 'Danger'], rarity: 'Rare' },
};

/** Batch 2 discovery gates. These are explicit R2 tuning candidates until a live
 * balance pass supplies final milestone values; omitting placedCount keeps the
 * standalone director harness on the original twelve-object pool. */
export const SECOND_BATCH_UNLOCKS: Readonly<Record<ObjectKind, number>> = {
    television: 10, bathtub: 15, piano: 20, tire: 25, bowling_ball: 30, oil_drum: 35,
    spring_pad: 40, cat_bed: 45, giraffe: 50, ufo: 55, rocket: 60, vending_machine: 70,
    cardboard_box: 0, wood_plank: 0, basketball: 0, fridge: 0, toilet: 0, dumbbell: 0,
    wooden_crate: 0, ice_block: 0, sofa: 0, whale: 0, burger: 0, slipper: 0,
};

/** Timing percentages are SPEC §7.1 initial values; other numbers are R1 candidates. */
export const DIRECTOR_TUNING = {
    difficultyBands: [
        { until: 30, weights: [55, 35, 10, 0] },
        { until: 90, weights: [35, 40, 23, 2] },
        { until: 180, weights: [20, 40, 35, 5] },
        { until: 300, weights: [10, 35, 45, 10] },
        { until: Infinity, weights: [5, 25, 50, 20] },
    ],
    absurdityWeights: [45, 30, 25],
    earlySeconds: 90,
    maxPlatformGap: 7,
    rareCooldownDraws: 8,
    highRiskRescueMultiplier: 4,
    longStableSeconds: 18,
    longStableDangerMultiplier: 2,
    recoveryDraws: 2,
    earlyDiscoveryWeight: .02,
} as const;

export interface DirectorContext {
    /** Active, unpaused play time only. */
    elapsedSeconds: number;
    risk: TowerRisk;
    stableSeconds: number;
    /** Monotonic count of effective incidents (not an unconfirmed collapse trend). */
    incidentCount: number;
    /** Confirmed placements used for the Batch 2 discovery gates. */
    placedCount?: number;
    /** Enables the SPEC's low-probability mysterious early entry in normal play. */
    allowEarlyDiscovery?: boolean;
}

/** In-memory checkpoint values. Capturing/restoring does not consume a draw. */
export interface DirectorState {
    seed: number;
    rngState: number;
    draws: number;
    generatedCount: number;
    turn: number;
    current: ObjectKind;
    next: ObjectKind;
    lastKind: ObjectKind | null;
    hardStreak: number;
    rollingStreak: number;
    platformGap: number;
    incidentCount: number;
    recoveryDrawsRemaining: number;
    lastSeen: { kind: ObjectKind; index: number }[];
    discovered?: ObjectKind[];
}

/** One locked current/NEXT pair. Only handoff draws; observation never advances RNG.
 * The approved fourteen-piece opening takes priority over new random-pool rules. */
export class TowerDirector {
    readonly seed: number;
    private rngState: number;
    private draws = 0;
    private generatedCount = 0;
    private turn = 1;
    private currentKind: ObjectKind;
    private nextKind: ObjectKind;
    private lastKind: ObjectKind | null = null;
    private hardStreak = 0;
    private rollingStreak = 0;
    private platformGap = 0;
    private incidentCount = 0;
    private recoveryDrawsRemaining = 0;
    private readonly lastSeen = new Map<ObjectKind, number>();
    private readonly discovered = new Set<ObjectKind>();

    constructor(seed: number) {
        this.seed = seed >>> 0;
        this.rngState = this.seed;
        this.currentKind = this.record(CALIBRATION_SEQUENCE[0]);
        this.nextKind = this.record(CALIBRATION_SEQUENCE[1]);
    }

    get current(): ObjectKind { return this.currentKind; }
    get next(): ObjectKind { return this.nextKind; }

    handoff(context: DirectorContext): { current: ObjectKind; next: ObjectKind } {
        if (context.incidentCount > this.incidentCount) {
            this.incidentCount = context.incidentCount;
            this.recoveryDrawsRemaining = DIRECTOR_TUNING.recoveryDraws;
        }
        // Consume the already shown NEXT before considering changed risk.
        this.currentKind = this.nextKind;
        const candidate = this.generatedCount < CALIBRATION_SEQUENCE.length
            ? CALIBRATION_SEQUENCE[this.generatedCount] : this.choose(context);
        this.markDiscovered(candidate);
        this.nextKind = this.record(candidate);
        if (this.recoveryDrawsRemaining > 0) this.recoveryDrawsRemaining--;
        this.turn++;
        return { current: this.currentKind, next: this.nextKind };
    }

    /** Replace the advertised NEXT without advancing CURRENT. The fixed opening is
     * deliberately kept deterministic; item rerolls start once the opening has ended. */
    reroll(context: DirectorContext): ObjectKind | null {
        if (this.generatedCount < CALIBRATION_SEQUENCE.length) return null;
        const candidate = this.choose(context);
        this.markDiscovered(candidate);
        this.nextKind = this.record(candidate);
        this.turn++;
        return this.nextKind;
    }

    snapshot(): { seed: number; rngState: number; draws: number; turn: number; current: ObjectKind; next: ObjectKind;
        hardStreak: number; rollingStreak: number; platformGap: number; recoveryDrawsRemaining: number; discovered: ObjectKind[] } {
        return { seed: this.seed, rngState: this.rngState, draws: this.draws, turn: this.turn,
            current: this.currentKind, next: this.nextKind, hardStreak: this.hardStreak,
            rollingStreak: this.rollingStreak, platformGap: this.platformGap,
            recoveryDrawsRemaining: this.recoveryDrawsRemaining, discovered: Array.from(this.discovered) };
    }

    exportState(): DirectorState {
        return { ...this.snapshot(), generatedCount: this.generatedCount, lastKind: this.lastKind,
            incidentCount: this.incidentCount,
            lastSeen: Array.from(this.lastSeen, ([kind, index]) => ({ kind, index })),
            discovered: Array.from(this.discovered) };
    }

    restoreState(state: DirectorState): void {
        const count = (value: number) => Number.isSafeInteger(value) && value >= 0;
        const kind = (value: ObjectKind | null) => typeof value === 'string'
            && Object.prototype.hasOwnProperty.call(DIRECTOR_OBJECTS, value);
        // Check everything before assigning, including history required by cooldowns.
        if (!state || state.seed !== this.seed || !count(state.rngState) || state.rngState > 0xffffffff
            || !count(state.generatedCount) || state.generatedCount < 2 || !count(state.draws)
            || state.draws !== Math.max(0, state.generatedCount - CALIBRATION_SEQUENCE.length)
            || state.turn !== state.generatedCount - 1
            || state.rngState !== ((state.seed + Math.imul(state.draws >>> 0, 0x6D2B79F5)) >>> 0)
            || !kind(state.current) || !kind(state.next) || state.lastKind !== state.next
            || !count(state.hardStreak) || state.hardStreak > state.generatedCount
            || !count(state.rollingStreak) || state.rollingStreak > state.hardStreak
            || !count(state.platformGap) || state.platformGap > state.generatedCount
            || !count(state.incidentCount) || !count(state.recoveryDrawsRemaining)
            || state.recoveryDrawsRemaining > DIRECTOR_TUNING.recoveryDraws
            || !Array.isArray(state.lastSeen) || (state.discovered !== undefined && !Array.isArray(state.discovered))) throw new Error('Invalid director checkpoint');
        const seen = new Map<ObjectKind, number>();
        const indices = new Set<number>();
        for (const entry of state.lastSeen) {
            if (!entry || !kind(entry.kind) || !count(entry.index) || entry.index >= state.generatedCount
                || seen.has(entry.kind) || indices.has(entry.index)) throw new Error('Invalid director checkpoint history');
            seen.set(entry.kind, entry.index); indices.add(entry.index);
        }
        const discovered = new Set<ObjectKind>();
        for (const item of state.discovered ?? []) {
            if (!kind(item) || SECOND_BATCH_UNLOCKS[item] === 0 || discovered.has(item)) throw new Error('Invalid director discovery history');
            discovered.add(item);
        }
        // The fixed opening is known history, so omitting an older rare item is
        // invalid even when current/NEXT still look correct.
        const openingSeen = new Map<ObjectKind, number>();
        CALIBRATION_SEQUENCE.slice(0, state.generatedCount).forEach((item, index) => openingSeen.set(item, index));
        let missingOpeningHistory = false;
        openingSeen.forEach((index, item) => {
            const restored = seen.get(item);
            if (restored === undefined || restored < index
                || (state.generatedCount <= CALIBRATION_SEQUENCE.length && restored !== index)) missingOpeningHistory = true;
        });
        const currentSeen = seen.get(state.current), nextSeen = seen.get(state.next);
        if (nextSeen !== state.generatedCount - 1
            || currentSeen === undefined || (state.generatedCount <= CALIBRATION_SEQUENCE.length
                ? currentSeen !== state.generatedCount - 2 : currentSeen >= nextSeen)
            || missingOpeningHistory || (state.generatedCount <= CALIBRATION_SEQUENCE.length && seen.size !== openingSeen.size)
            || state.hardStreak > 2 || state.rollingStreak > 2 || state.platformGap > DIRECTOR_TUNING.maxPlatformGap
            || (state.incidentCount === 0 && state.recoveryDrawsRemaining > 0)
            || (this.hard(state.next) ? state.hardStreak === 0 : state.hardStreak !== 0)
            || (DIRECTOR_OBJECTS[state.next].roles.indexOf('Rolling') >= 0
                ? state.rollingStreak === 0 : state.rollingStreak !== 0)
            || (this.rescue(state.next) ? state.platformGap !== 0 : state.platformGap === 0))
            throw new Error('Inconsistent director checkpoint');
        this.rngState = state.rngState; this.draws = state.draws; this.generatedCount = state.generatedCount;
        this.turn = state.turn; this.currentKind = state.current; this.nextKind = state.next; this.lastKind = state.lastKind;
        this.hardStreak = state.hardStreak; this.rollingStreak = state.rollingStreak; this.platformGap = state.platformGap;
        this.incidentCount = state.incidentCount; this.recoveryDrawsRemaining = state.recoveryDrawsRemaining;
        this.lastSeen.clear(); seen.forEach((index, item) => this.lastSeen.set(item, index));
        this.discovered.clear(); discovered.forEach(item => this.discovered.add(item));
    }

    private choose(context: DirectorContext): ObjectKind {
        const early = context.elapsedSeconds < DIRECTOR_TUNING.earlySeconds;
        const rescueDue = this.platformGap >= DIRECTOR_TUNING.maxPlatformGap;
        const recovery = this.recoveryDrawsRemaining > 0;
        const candidates = (Object.keys(DIRECTOR_OBJECTS) as ObjectKind[]).filter(kind => {
            const item = DIRECTOR_OBJECTS[kind];
            const locked = (context.placedCount ?? 0) < SECOND_BATCH_UNLOCKS[kind];
            if (locked && !context.allowEarlyDiscovery) return false;
            if (kind === this.lastKind) return false;
            if (rescueDue && !this.rescue(kind)) return false;
            if ((recovery || this.hardStreak >= 2) && this.hard(kind)) return false;
            if (recovery && (item.roles.indexOf('Rolling') >= 0 || item.roles.indexOf('Slippery') >= 0)) return false;
            if (item.roles.indexOf('Rolling') >= 0 && (this.rollingStreak >= 2
                || (early && this.lastKind !== null && DIRECTOR_OBJECTS[this.lastKind].roles.indexOf('Slippery') >= 0))) return false;
            const seen = this.lastSeen.get(kind);
            return item.rarity !== 'Rare' || seen === undefined
                || this.generatedCount - seen >= DIRECTOR_TUNING.rareCooldownDraws;
        });
        // Current pool always retains a crate or rescue option after these filters.
        const band = DIRECTOR_TUNING.difficultyBands.find(item => context.elapsedSeconds < item.until)
            || DIRECTOR_TUNING.difficultyBands[DIRECTOR_TUNING.difficultyBands.length - 1];
        const difficulties: readonly Difficulty[] = ['Easy', 'Normal', 'Hard', 'Chaos'];
        const absurdities: readonly Absurdity[] = ['Normal', 'Weird', 'WTF'];
        const difficultyTotal = difficulties.reduce((sum, difficulty, index) =>
            sum + (candidates.some(kind => DIRECTOR_OBJECTS[kind].difficulty === difficulty) ? band.weights[index] : 0), 0);
        const weights = candidates.map(kind => {
            const item = DIRECTOR_OBJECTS[kind];
            const locked = (context.placedCount ?? 0) < SECOND_BATCH_UNLOCKS[kind];
            const sameDifficulty = candidates.filter(other => DIRECTOR_OBJECTS[other].difficulty === item.difficulty);
            const absurdityTotal = absurdities.reduce((sum, absurdity, index) => sum
                + (sameDifficulty.some(other => DIRECTOR_OBJECTS[other].absurdity === absurdity)
                    ? DIRECTOR_TUNING.absurdityWeights[index] : 0), 0);
            const peers = sameDifficulty.filter(other => DIRECTOR_OBJECTS[other].absurdity === item.absurdity).length;
            let weight = band.weights[difficulties.indexOf(item.difficulty)] / difficultyTotal
                * DIRECTOR_TUNING.absurdityWeights[absurdities.indexOf(item.absurdity)] / absurdityTotal / peers;
            if (locked) weight *= DIRECTOR_TUNING.earlyDiscoveryWeight;
            if ((context.risk === 'Dangerous' || context.risk === 'Critical' || recovery) && this.rescue(kind))
                weight *= DIRECTOR_TUNING.highRiskRescueMultiplier;
            if (!recovery && (context.risk === 'Safe' || context.risk === 'Unstable') && context.stableSeconds >= DIRECTOR_TUNING.longStableSeconds
                && item.roles.indexOf('Danger') >= 0) weight *= DIRECTOR_TUNING.longStableDangerMultiplier;
            return weight;
        });
        let value = this.random() * weights.reduce((sum, weight) => sum + weight, 0);
        for (let i = 0; i < candidates.length; i++) {
            value -= weights[i];
            if (value < 0) return candidates[i];
        }
        return candidates[candidates.length - 1];
    }

    private rescue(kind: ObjectKind): boolean {
        return DIRECTOR_OBJECTS[kind].roles.some(role => role === 'Platform' || role === 'Rescue');
    }
    private markDiscovered(kind: ObjectKind): void {
        if (SECOND_BATCH_UNLOCKS[kind] > 0) this.discovered.add(kind);
    }
    private hard(kind: ObjectKind): boolean {
        return DIRECTOR_OBJECTS[kind].difficulty === 'Hard' || DIRECTOR_OBJECTS[kind].difficulty === 'Chaos';
    }
    private record(kind: ObjectKind): ObjectKind {
        this.hardStreak = this.hard(kind) ? this.hardStreak + 1 : 0;
        this.rollingStreak = DIRECTOR_OBJECTS[kind].roles.indexOf('Rolling') >= 0 ? this.rollingStreak + 1 : 0;
        this.platformGap = this.rescue(kind) ? 0 : this.platformGap + 1;
        this.lastSeen.set(kind, this.generatedCount++);
        this.lastKind = kind;
        return kind;
    }
    private random(): number {
        // Mulberry32: seed zero is valid, and every random selection consumes one draw.
        this.rngState = (this.rngState + 0x6D2B79F5) >>> 0;
        let value = this.rngState;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        this.draws++;
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    }
}
