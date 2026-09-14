/** Normal 1x world coordinates. Presentation zoom never changes these limits. */
export interface WorldBoundary {
    readonly top: number;
    readonly bottom: number;
    readonly left: number;
    readonly right: number;
}

/** One continuous incident. The caller owns time, stars, input and scene transitions. */
export class Incident {
    readonly boundary: WorldBoundary;
    readonly observation: WorldBoundary;
    readonly referenceTop: number;
    readonly members: readonly number[];
    readonly zoom: number;
    readonly N: number;
    readonly K: number | null;
    private readonly memberIDs: Set<number>;
    private readonly losses = new Set<number>();
    private charged = false;
    private memberLosses = 0;

    constructor(boundary: WorldBoundary, observation: WorldBoundary, referenceTop: number,
        members: readonly number[], zoom: number) {
        this.boundary = Object.freeze({ ...boundary });
        this.observation = Object.freeze({ ...observation });
        this.referenceTop = referenceTop;
        // Only already-placed, valid bodies belong here; eligibility is the caller's responsibility.
        this.memberIDs = new Set(members);
        this.members = Object.freeze(Array.from(this.memberIDs));
        this.N = this.members.length;
        this.K = this.N < 3 ? null : Math.min(6, Math.max(3, Math.ceil(this.N * .6)));
        this.zoom = zoom;
    }

    get starCharged(): boolean { return this.charged; }
    get lostIDs(): readonly number[] { return Array.from(this.losses); }
    get lostMemberCount(): number { return this.memberLosses; }
    get collapse(): boolean { return this.K !== null && this.memberLosses >= this.K; }

    recordLoss(id: number): { firstLoss: boolean; duplicate: boolean; collapse: boolean } {
        if (this.losses.has(id)) return { firstLoss: false, duplicate: true, collapse: this.collapse };
        this.losses.add(id);
        if (this.memberIDs.has(id)) this.memberLosses++;
        const firstLoss = !this.charged;
        this.charged = true;
        return { firstLoss, duplicate: false, collapse: this.collapse };
    }

    snapshot(): object {
        return {
            boundary: { ...this.boundary }, observation: { ...this.observation },
            referenceTop: this.referenceTop, zoom: this.zoom, members: this.members.slice(),
            N: this.N, K: this.K, lostIDs: this.lostIDs, lostMemberCount: this.memberLosses,
            starCharged: this.charged, collapse: this.collapse,
        };
    }
}
