import { ObjectKind, OBJECTS } from './object-data';
import { ITEM_KINDS, ItemKind } from './item-system';

export interface CollectionState {
    schemaVersion: 1;
    discoveredObjects: ObjectKind[];
    discoveredItems: ItemKind[];
    bestHeight: number;
}

export interface CollectionObjectEntry {
    kind: ObjectKind;
    name: string;
    weight: '轻' | '中' | '重' | '超重';
    stability: '稳' | '一般' | '难稳' | '极难';
    personality: string;
    description: string;
    spriteName: string;
    nextSpriteName: string;
}

export interface CollectionItemEntry {
    kind: ItemKind;
    name: string;
    description: string;
    spriteName: string;
}

const OBJECT_META: Record<ObjectKind, Omit<CollectionObjectEntry, 'kind' | 'spriteName' | 'nextSpriteName'>> = {
    cardboard_box: { name: '纸箱', weight: '中', stability: '稳', personality: '老实可靠', description: '先从最普通的纸箱开始，把塔底放稳。' },
    wood_plank: { name: '木板', weight: '轻', stability: '一般', personality: '救场平台', description: '横着放能搭桥，偏一点也能给上面留落脚处。' },
    basketball: { name: '篮球', weight: '轻', stability: '极难', personality: '爱滚', description: '圆滚滚的家伙，落点和速度都要算准。' },
    fridge: { name: '冰箱', weight: '重', stability: '一般', personality: '沉稳大块头', description: '又宽又重，放稳后能把底盘压得很扎实。' },
    toilet: { name: '马桶', weight: '中', stability: '难稳', personality: '滑稽高台', description: '看着稳，真正接触时总会给你一点惊喜。' },
    dumbbell: { name: '哑铃', weight: '超重', stability: '难稳', personality: '两头沉', description: '两端重量分开，稍有倾斜就会把塔带偏。' },
    wooden_crate: { name: '木箱', weight: '中', stability: '稳', personality: '方方正正', description: '边缘清楚，适合作为早期的可靠支撑。' },
    ice_block: { name: '冰块', weight: '中', stability: '难稳', personality: '很滑', description: '接触面不容易抓住，平稳落下只是第一关。' },
    sofa: { name: '沙发', weight: '重', stability: '一般', personality: '软乎乎', description: '体积很大，落下时会给下面带来一阵晃动。' },
    whale: { name: '鲸鱼', weight: '超重', stability: '一般', personality: '意外大客人', description: '体型夸张但并非不可驯服，找好两处支撑就行。' },
    burger: { name: '汉堡', weight: '中', stability: '难稳', personality: '圆顶滑手', description: '食材很可爱，圆顶和圆底却都不太愿意停住。' },
    slipper: { name: '拖鞋', weight: '轻', stability: '难稳', personality: '神秘闯入者', description: '角度和边缘都很调皮，常常改变最后一层的走向。' },
    television: { name: '电视机', weight: '重', stability: '一般', personality: '方形重心', description: '看起来规整，转过九十度后占位完全不同。' },
    bathtub: { name: '浴缸', weight: '重', stability: '一般', personality: '大肚平台', description: '宽大的边缘能救场，也会把上层推到新的位置。' },
    piano: { name: '钢琴', weight: '超重', stability: '难稳', personality: '沉默重物', description: '真正的重量级选手，最好在塔已经稳定时迎接它。' },
    tire: { name: '轮胎', weight: '中', stability: '极难', personality: '会滚的圈', description: '圆形接触会把每一次轻微倾斜都放大。' },
    bowling_ball: { name: '保龄球', weight: '重', stability: '极难', personality: '一言不合就滚', description: '小而重，落在边缘时尤其容易改变全塔重心。' },
    oil_drum: { name: '油桶', weight: '重', stability: '难稳', personality: '滚筒重心', description: '圆柱形身体容易滚动，横向接触会更难控制。' },
    spring_pad: { name: '弹簧垫', weight: '中', stability: '一般', personality: '弹一下', description: '平面能承托，落点偏高时会给塔带来额外反馈。' },
    cat_bed: { name: '猫窝', weight: '轻', stability: '稳', personality: '柔软平台', description: '低矮而宽，适合在危险阶段给塔一个缓冲。' },
    giraffe: { name: '长颈鹿', weight: '中', stability: '极难', personality: '高重心', description: '身材太高，任何一点旋转都会放大顶部摆动。' },
    ufo: { name: 'UFO', weight: '轻', stability: '一般', personality: '神秘桥梁', description: '扁平的飞行器，可以横跨两点，也可以制造悬念。' },
    rocket: { name: '火箭', weight: '重', stability: '极难', personality: '细长高塔', description: '竖起来很高，横过来又会突然占满一层。' },
    vending_machine: { name: '自动贩卖机', weight: '超重', stability: '难稳', personality: '又高又重', description: '体积和重量一起上场，适合留给真正稳定的塔。' },
};

export const OBJECT_COLLECTION: readonly CollectionObjectEntry[] = (Object.keys(OBJECTS) as ObjectKind[]).map(kind => ({
    kind,
    ...OBJECT_META[kind],
    spriteName: `object_${kind}`,
    nextSpriteName: `next_${kind}`,
}));

export const ITEM_COLLECTION: readonly CollectionItemEntry[] = [
    { kind: 'strong_glue', name: '强力胶', description: '让下一次真实接触获得约 10 秒的有限约束。', spriteName: 'prop_strong_glue_large' },
    { kind: 'undo', name: '后悔药', description: '撤销最近一次放置，回到该物体落下前的状态。', spriteName: 'prop_undo_large' },
    { kind: 'shrink', name: '缩水药', description: '让下一个物体缩小约 35–40%，尺寸变化仍保持可承托。', spriteName: 'prop_shrink_large' },
    { kind: 'reroll', name: '换一个', description: '刷新当前 NEXT，已经展示的 CURRENT 不会被暗中替换。', spriteName: 'prop_reroll_large' },
    { kind: 'feather', name: '羽毛药', description: '让下一个物体质量降低约 70%，尺寸保持不变。', spriteName: 'prop_feather_large' },
    { kind: 'restore_star', name: '恢复 1 星', description: '恢复一颗星，最多回到三颗；不会代替广告复活。', spriteName: 'prop_restore_star_large' },
];

const OBJECT_KINDS = new Set<ObjectKind>(Object.keys(OBJECTS) as ObjectKind[]);
const ITEM_KIND_SET = new Set<ItemKind>(ITEM_KINDS);

function cloneState(state: CollectionState): CollectionState {
    return {
        schemaVersion: 1,
        discoveredObjects: [...state.discoveredObjects],
        discoveredItems: [...state.discoveredItems],
        bestHeight: state.bestHeight,
    };
}

export class CollectionLedger {
    private state: CollectionState = { schemaVersion: 1, discoveredObjects: [], discoveredItems: [], bestHeight: 0 };
    private readonly runObjects = new Set<ObjectKind>();
    private readonly runItems = new Set<ItemKind>();

    constructor(saved?: CollectionState) {
        if (saved) this.restoreState(saved);
    }

    static validateState(state: CollectionState): void {
        const fail = (): never => { throw new Error('Invalid player progress'); };
        if (!state || state.schemaVersion !== 1 || !Array.isArray(state.discoveredObjects)
            || !Array.isArray(state.discoveredItems) || !Number.isFinite(state.bestHeight) || state.bestHeight < 0) fail();
        const objects = new Set<ObjectKind>();
        for (const kind of state.discoveredObjects) {
            if (!OBJECT_KINDS.has(kind) || objects.has(kind)) fail();
            objects.add(kind);
        }
        const items = new Set<ItemKind>();
        for (const kind of state.discoveredItems) {
            if (!ITEM_KIND_SET.has(kind) || items.has(kind)) fail();
            items.add(kind);
        }
    }

    snapshot(): CollectionState { return cloneState(this.state); }

    restoreState(state: CollectionState): void {
        CollectionLedger.validateState(state);
        this.state = cloneState(state);
    }

    discoverObject(kind: ObjectKind): boolean {
        if (!OBJECT_KINDS.has(kind) || this.state.discoveredObjects.indexOf(kind) >= 0) return false;
        this.state.discoveredObjects.push(kind);
        this.runObjects.add(kind);
        return true;
    }

    discoverItem(kind: ItemKind): boolean {
        if (!ITEM_KIND_SET.has(kind) || this.state.discoveredItems.indexOf(kind) >= 0) return false;
        this.state.discoveredItems.push(kind);
        this.runItems.add(kind);
        return true;
    }

    finishRun(height: number): boolean {
        const value = Number.isFinite(height) ? Math.max(0, height) : 0;
        if (value <= this.state.bestHeight) return false;
        this.state.bestHeight = value;
        return true;
    }

    runDiscoveries(): { objects: ObjectKind[]; items: ItemKind[] } {
        return { objects: [...this.runObjects], items: [...this.runItems] };
    }

    hasObject(kind: ObjectKind): boolean { return this.state.discoveredObjects.indexOf(kind) >= 0; }
    hasItem(kind: ItemKind): boolean { return this.state.discoveredItems.indexOf(kind) >= 0; }
}

export function objectEntry(kind: ObjectKind): CollectionObjectEntry {
    return OBJECT_COLLECTION.find(entry => entry.kind === kind)!;
}

export function itemEntry(kind: ItemKind): CollectionItemEntry {
    return ITEM_COLLECTION.find(entry => entry.kind === kind)!;
}
