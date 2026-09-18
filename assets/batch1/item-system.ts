export type ItemKind = 'strong_glue' | 'undo' | 'shrink' | 'reroll' | 'feather' | 'restore_star';

export const ITEM_KINDS: readonly ItemKind[] = [
    'strong_glue', 'undo', 'shrink', 'reroll', 'feather', 'restore_star',
];

export interface ItemStack {
    kind: ItemKind;
    count: number;
}

export interface ItemEffects {
    glueSeconds: number;
    shrinkNext: boolean;
    featherNext: boolean;
}

export interface ItemState {
    slots: [ItemStack | null, ItemStack | null];
    offer: ItemKind[] | null;
    offerPlacedCount: number | null;
    offeredMilestones: number[];
    consumed: Record<ItemKind, number>;
    reviveUsed: boolean;
    active: ItemEffects;
}

export interface ItemUseResult {
    kind: ItemKind;
    slot: 0 | 1;
    effects: ItemEffects;
}

const OFFER_INTERVAL = 10;
const MAX_STACK = 2;
const GLUE_SECONDS = 10;

function emptyConsumed(): Record<ItemKind, number> {
    return { strong_glue: 0, undo: 0, shrink: 0, reroll: 0, feather: 0, restore_star: 0 };
}

function cloneStack(stack: ItemStack | null): ItemStack | null {
    return stack ? { kind: stack.kind, count: stack.count } : null;
}

function cloneState(state: ItemState): ItemState {
    return {
        slots: [cloneStack(state.slots[0]), cloneStack(state.slots[1])],
        offer: state.offer ? [...state.offer] : null,
        offerPlacedCount: state.offerPlacedCount,
        offeredMilestones: [...state.offeredMilestones],
        consumed: { ...state.consumed },
        reviveUsed: state.reviveUsed,
        active: { ...state.active },
    };
}

function validKind(value: unknown): value is ItemKind {
    return typeof value === 'string' && (ITEM_KINDS as readonly string[]).indexOf(value) >= 0;
}

export class ItemLedger {
    private slots: [ItemStack | null, ItemStack | null] = [null, null];
    private offer: ItemKind[] | null = null;
    private offerPlacedCount: number | null = null;
    private offeredMilestones: number[] = [];
    private consumed = emptyConsumed();
    private reviveUsed = false;
    private active: ItemEffects = { glueSeconds: 0, shrinkNext: false, featherNext: false };

    snapshot(): ItemState {
        return cloneState({
            slots: this.slots,
            offer: this.offer,
            offerPlacedCount: this.offerPlacedCount,
            offeredMilestones: this.offeredMilestones,
            consumed: this.consumed,
            reviveUsed: this.reviveUsed,
            active: this.active,
        });
    }

    exportState(): ItemState { return this.snapshot(); }

    static validateState(state: ItemState): void {
        const fail = (): never => { throw new Error('Invalid item checkpoint'); };
        if (!state || !Array.isArray(state.slots) || state.slots.length !== 2
            || !Array.isArray(state.offeredMilestones) || (state.offer !== null && !Array.isArray(state.offer))
            || (state.offerPlacedCount !== null && (!Number.isSafeInteger(state.offerPlacedCount) || state.offerPlacedCount < 0))
            || !state.consumed || typeof state.reviveUsed !== 'boolean' || !state.active) fail();
        const seen = new Set<ItemKind>();
        for (const stack of state.slots) {
            if (stack === null) continue;
            if (!validKind(stack.kind) || !Number.isSafeInteger(stack.count) || stack.count < 1 || stack.count > MAX_STACK
                || seen.has(stack.kind)) fail();
            seen.add(stack.kind);
        }
        if (state.offer !== null) {
            if (state.offer.length !== 3 || state.offer.some(kind => !validKind(kind))
                || new Set(state.offer).size !== state.offer.length || state.offerPlacedCount === null) fail();
        } else if (state.offerPlacedCount !== null) fail();
        const milestones = new Set<number>();
        for (const milestone of state.offeredMilestones) {
            if (!Number.isSafeInteger(milestone) || milestone < OFFER_INTERVAL || milestone % OFFER_INTERVAL !== 0
                || milestones.has(milestone)) fail();
            milestones.add(milestone);
        }
        for (const kind of ITEM_KINDS) {
            if (!Number.isSafeInteger(state.consumed[kind]) || state.consumed[kind] < 0) fail();
        }
        if (![state.active.glueSeconds].every(value => Number.isFinite(value) && value >= 0)
            || typeof state.active.shrinkNext !== 'boolean' || typeof state.active.featherNext !== 'boolean') fail();
    }

    restoreState(state: ItemState): void {
        ItemLedger.validateState(state);
        const copy = cloneState(state);
        this.slots = copy.slots;
        this.offer = copy.offer;
        this.offerPlacedCount = copy.offerPlacedCount;
        this.offeredMilestones = copy.offeredMilestones;
        this.consumed = copy.consumed;
        this.reviveUsed = copy.reviveUsed;
        this.active = copy.active;
    }

    /**
     * Restore the saved play state while keeping every consumption made after it.
     * This prevents an undo or revival from recreating an item or a used revival.
     */
    restoreCheckpoint(state: ItemState): void {
        ItemLedger.validateState(state);
        const current = this.snapshot();
        const copy = cloneState(state);
        for (const kind of ITEM_KINDS) {
            const delta = current.consumed[kind] - state.consumed[kind];
            if (delta < 0) throw new Error('Item consumption moved backwards');
            const stack = copy.slots.find(item => item?.kind === kind);
            if (stack) {
                stack.count -= delta;
                if (stack.count < 0) throw new Error('Item checkpoint restores consumed inventory');
                if (stack.count === 0) copy.slots[copy.slots.indexOf(stack)] = null;
            }
            copy.consumed[kind] = Math.max(state.consumed[kind], current.consumed[kind]);
        }
        copy.reviveUsed = state.reviveUsed || current.reviveUsed;
        this.restoreState(copy);
    }

    add(kind: ItemKind): boolean {
        if (!validKind(kind)) return false;
        const existing = this.slots.find(stack => stack?.kind === kind);
        if (existing) {
            if (existing.count >= MAX_STACK) return false;
            existing.count++;
            return true;
        }
        const empty = this.slots.findIndex(stack => stack === null);
        if (empty < 0) return false;
        this.slots[empty] = { kind, count: 1 };
        return true;
    }

    replace(slot: 0 | 1, kind: ItemKind): boolean {
        if (!validKind(kind) || !this.slots[slot]) return false;
        const other = this.slots[slot === 0 ? 1 : 0];
        if (other?.kind === kind) {
            if (other.count >= MAX_STACK) return false;
            other.count++;
            this.slots[slot] = null;
            return true;
        }
        this.slots[slot] = { kind, count: 1 };
        return true;
    }

    maybeOpenOffer(placedCount: number): boolean {
        if (!Number.isSafeInteger(placedCount) || placedCount < OFFER_INTERVAL
            || placedCount % OFFER_INTERVAL !== 0 || this.offer !== null
            || this.offeredMilestones.indexOf(placedCount) >= 0) return false;
        const start = ((placedCount / OFFER_INTERVAL) - 1) % ITEM_KINDS.length;
        this.offer = [0, 1, 2].map(offset => ITEM_KINDS[(start + offset) % ITEM_KINDS.length]);
        this.offerPlacedCount = placedCount;
        return true;
    }

    chooseOffer(kind: ItemKind, replaceSlot?: 0 | 1): boolean {
        if (!this.offer || this.offer.indexOf(kind) < 0 || this.offerPlacedCount === null) return false;
        const accepted = replaceSlot === undefined ? this.add(kind) : this.replace(replaceSlot, kind);
        if (!accepted) return false;
        this.offeredMilestones.push(this.offerPlacedCount);
        this.offer = null;
        this.offerPlacedCount = null;
        return true;
    }

    useSlot(slot: 0 | 1): ItemUseResult | null {
        const stack = this.slots[slot];
        if (!stack) return null;
        const kind = stack.kind;
        stack.count--;
        if (stack.count === 0) this.slots[slot] = null;
        this.consumed[kind]++;
        if (kind === 'strong_glue') this.active.glueSeconds = GLUE_SECONDS;
        if (kind === 'shrink') this.active.shrinkNext = true;
        if (kind === 'feather') this.active.featherNext = true;
        return { kind, slot, effects: { ...this.active } };
    }

    use(kind: ItemKind): ItemUseResult | null {
        const slot = this.slots.findIndex(stack => stack?.kind === kind);
        return slot < 0 ? null : this.useSlot(slot as 0 | 1);
    }

    takeNextEffects(): ItemEffects {
        const effects = { ...this.active };
        this.active.shrinkNext = false;
        this.active.featherNext = false;
        this.active.glueSeconds = 0;
        return effects;
    }

    tick(seconds: number): void {
        if (Number.isFinite(seconds) && seconds > 0) this.active.glueSeconds = Math.max(0, this.active.glueSeconds - seconds);
    }

    markReviveUsed(): boolean {
        if (this.reviveUsed) return false;
        this.reviveUsed = true;
        return true;
    }

    get reviveAvailable(): boolean { return !this.reviveUsed; }
    get pendingOffer(): readonly ItemKind[] | null { return this.offer ? [...this.offer] : null; }
}
