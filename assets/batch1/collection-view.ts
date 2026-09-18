import { Color, Graphics, Label, Layers, Node, Sprite, SpriteFrame, UITransform } from 'cc';
import { bindAction, readPlayerProgress } from './local-platform';
import { CollectionLedger, CollectionObjectEntry, ITEM_COLLECTION, OBJECT_COLLECTION, itemEntry } from './collection-system';
import { ItemKind } from './item-system';

type CollectionTab = 'objects' | 'items';

/** Runtime-only Batch 3 collection page. It deliberately does not require a new scene asset. */
export class CollectionView {
    readonly root: Node;
    private readonly page: Node;
    private readonly frames: Map<string, SpriteFrame>;
    private ledger = new CollectionLedger();
    private tab: CollectionTab = 'objects';
    private openDetail: { tab: CollectionTab; index: number } | null = null;
    private static readonly DESIGN_WIDTH = 750;
    private static readonly DESIGN_HEIGHT = 1334;

    constructor(private readonly parent: Node, frames: Map<string, SpriteFrame>) {
        this.frames = frames;
        this.root = new Node('CollectionOverlay');
        this.root.layer = Layers.Enum.UI_2D;
        parent.addChild(this.root);
        this.root.addComponent(UITransform);
        const backdrop = this.root.addComponent(Graphics);
        backdrop.fillColor = new Color(12, 37, 74, 235);
        backdrop.rect(-375, -667, 750, 1334); backdrop.fill();
        this.root.on(Node.EventType.TOUCH_START, (event: { propagationStopped: boolean }) => { event.propagationStopped = true; });
        this.root.on(Node.EventType.TOUCH_MOVE, (event: { propagationStopped: boolean }) => { event.propagationStopped = true; });
        this.root.on(Node.EventType.TOUCH_END, (event: { propagationStopped: boolean }) => { event.propagationStopped = true; });
        this.root.on(Node.EventType.TOUCH_CANCEL, (event: { propagationStopped: boolean }) => { event.propagationStopped = true; });
        this.page = new Node('CollectionPage');
        this.page.layer = this.root.layer; this.root.addChild(this.page);
        this.root.active = false;
    }

    open(tab: CollectionTab = 'objects'): void {
        this.ledger = new CollectionLedger(readPlayerProgress());
        this.tab = tab; this.openDetail = null; this.root.active = true;
        this.fit(); this.render();
    }

    close(): void { this.root.active = false; this.openDetail = null; }

    update(): void { if (this.root.active) this.fit(); }

    dispose(): void { if (this.root.parent) this.root.removeFromParent(); this.root.destroy(); }

    private fit(): void {
        const size = this.parent.getComponent(UITransform);
        const width = size?.width || 750, height = size?.height || 1334;
        this.root.getComponent(UITransform)!.setContentSize(width, height);
        this.root.setPosition(0, 0, 0);
        const graphics = this.root.getComponent(Graphics)!;
        graphics.clear(); graphics.fillColor = new Color(12, 37, 74, 235);
        graphics.rect(-width / 2, -height / 2, width, height); graphics.fill();
        const scale = Math.min(1, width / CollectionView.DESIGN_WIDTH, height / CollectionView.DESIGN_HEIGHT);
        this.page.setScale(scale, scale, 1);
        this.page.setPosition(0, 0, 0);
    }

    private render(): void {
        for (const child of [...this.page.children]) { child.removeFromParent(); child.destroy(); }
        if (this.openDetail) {
            this.renderDetail(this.openDetail.tab, this.openDetail.index);
            return;
        }
        this.text(this.page, 'CollectionTitle', '玩具图鉴', 48, 0, 520, 600, 70, Color.WHITE);
        this.text(this.page, 'CollectionSubtitle', '见过的才会亮起来，提前闯入也算新发现', 23, 0, 466, 680, 42, new Color(192, 224, 255, 255));
        this.button(this.page, 'ObjectsTab', '物体图鉴', -120, 400, 200, 56,
            () => { this.tab = 'objects'; this.render(); }, this.tab === 'objects');
        this.button(this.page, 'ItemsTab', '道具图鉴', 120, 400, 200, 56,
            () => { this.tab = 'items'; this.render(); }, this.tab === 'items');
        this.button(this.page, 'CollectionClose', '返回', 0, -585, 180, 56, () => this.close(), false);
        if (this.tab === 'objects') this.renderObjects(); else this.renderItems();
    }

    private renderObjects(): void {
        const columns = 3, width = 205, gapX = 215, gapY = 88;
        OBJECT_COLLECTION.forEach((entry, index) => {
            const unlocked = this.ledger.hasObject(entry.kind);
            const x = (index % columns - 1) * gapX;
            const y = 282 - Math.floor(index / columns) * gapY;
            this.entryButton(entry.name, unlocked ? entry.personality : '???', x, y, width, 72,
                () => this.showDetail('objects', index), unlocked);
        });
    }

    private renderItems(): void {
        const columns = 2, width = 300, gapX = 320, gapY = 116;
        ITEM_COLLECTION.forEach((entry, index) => {
            const unlocked = this.ledger.hasItem(entry.kind);
            const x = (index % columns ? 1 : -1) * gapX / 2;
            const y = 282 - Math.floor(index / columns) * gapY;
            this.entryButton(entry.name, unlocked ? '已获得 · 点击查看' : '???', x, y, width, 96,
                () => this.showDetail('items', index), unlocked);
        });
    }

    private showDetail(tab: CollectionTab, index: number): void {
        this.openDetail = { tab, index }; this.render();
    }

    private renderDetail(tab: CollectionTab, index: number): void {
        this.button(this.page, 'CollectionBack', '返回图鉴', 0, -585, 220, 56, () => {
            this.openDetail = null; this.render();
        }, false);
        const unlocked = tab === 'objects'
            ? this.ledger.hasObject(OBJECT_COLLECTION[index].kind)
            : this.ledger.hasItem(ITEM_COLLECTION[index].kind);
        this.text(this.page, 'DetailTitle', unlocked ? (tab === 'objects' ? OBJECT_COLLECTION[index].name : ITEM_COLLECTION[index].name) : '???',
            54, 0, 500, 680, 78, Color.WHITE);
        if (!unlocked) {
            this.text(this.page, 'DetailLocked', '在对局中见到它后解锁', 28, 0, 365, 680, 70, new Color(192, 224, 255, 255));
            return;
        }
        if (tab === 'objects') this.renderObjectDetail(OBJECT_COLLECTION[index]);
        else this.renderItemDetail(ITEM_COLLECTION[index].kind);
    }

    private renderObjectDetail(entry: CollectionObjectEntry): void {
        const image = this.frames.get(entry.spriteName);
        if (image) {
            const node = new Node('DetailSprite'); node.layer = this.page.layer; this.page.addChild(node);
            this.fitDetailSprite(node, image, 300, 220);
        } else {
            this.text(this.page, 'DetailArtFallback', '正式大图随资源包载入', 22, 0, 270, 580, 44, new Color(150, 194, 230, 255));
        }
        this.text(this.page, 'DetailFacts', `重量感：${entry.weight}    稳定性：${entry.stability}\n${entry.personality}`,
            29, 0, 110, 680, 92, new Color(255, 235, 152, 255));
        this.text(this.page, 'DetailDescription', entry.description, 27, 0, -40, 650, 110, Color.WHITE);
    }

    private renderItemDetail(kind: ItemKind): void {
        const entry = itemEntry(kind); const image = this.frames.get(entry.spriteName);
        if (image) {
            const node = new Node('DetailSprite'); node.layer = this.page.layer; this.page.addChild(node);
            this.fitDetailSprite(node, image, 250, 240);
        } else {
            this.text(this.page, 'DetailArtFallback', '正式道具图随资源包载入', 22, 0, 270, 580, 44, new Color(150, 194, 230, 255));
        }
        this.text(this.page, 'DetailDescription', entry.description, 29, 0, 80, 650, 130, Color.WHITE);
    }

    private fitDetailSprite(node: Node, image: SpriteFrame, maxWidth: number, maxHeight: number): void {
        const source = image.originalSize;
        const sourceWidth = source.width || maxWidth;
        const sourceHeight = source.height || maxHeight;
        const scale = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight);
        node.addComponent(UITransform).setContentSize(sourceWidth * scale, sourceHeight * scale);
        node.setPosition(0, 270, 0);
        const sprite = node.addComponent(Sprite);
        sprite.spriteFrame = image;
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.trim = false;
    }

    private entryButton(title: string, subtitle: string, x: number, y: number, width: number, height: number,
        action: () => void, unlocked: boolean): void {
        const node = new Node(`CollectionEntry:${title}`); node.layer = this.page.layer; this.page.addChild(node);
        node.addComponent(UITransform).setContentSize(width, height); node.setPosition(x, y, 0);
        const graphics = node.addComponent(Graphics);
        graphics.fillColor = unlocked ? new Color(42, 94, 157, 245) : new Color(25, 51, 91, 245);
        graphics.roundRect(-width / 2, -height / 2, width, height, 18); graphics.fill();
        const label = node.addComponent(Label); label.string = `${title}\n${subtitle}`; label.fontSize = 23; label.lineHeight = 30;
        label.color = unlocked ? Color.WHITE : new Color(142, 171, 201, 255); label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER; label.enableWrapText = false; label.overflow = Label.Overflow.SHRINK;
        bindAction(node, action);
    }

    private button(parent: Node, name: string, title: string, x: number, y: number, width: number, height: number,
        action: () => void, selected: boolean): void {
        const node = new Node(name); node.layer = parent.layer; parent.addChild(node);
        node.addComponent(UITransform).setContentSize(width, height); node.setPosition(x, y, 0);
        const graphics = node.addComponent(Graphics); graphics.fillColor = selected ? new Color(255, 201, 71, 255) : new Color(42, 94, 157, 245);
        graphics.roundRect(-width / 2, -height / 2, width, height, 18); graphics.fill();
        const label = node.addComponent(Label); label.string = title; label.fontSize = 25; label.lineHeight = 32;
        label.color = selected ? new Color(24, 57, 106, 255) : Color.WHITE; label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER; label.enableWrapText = false;
        bindAction(node, action);
    }

    private text(parent: Node, name: string, value: string, fontSize: number, x: number, y: number,
        width: number, height: number, color: Color): void {
        const node = new Node(name); node.layer = parent.layer; parent.addChild(node);
        node.addComponent(UITransform).setContentSize(width, height); node.setPosition(x, y, 0);
        const label = node.addComponent(Label); label.string = value; label.fontSize = fontSize; label.lineHeight = Math.round(fontSize * 1.35);
        label.color = color; label.horizontalAlign = Label.HorizontalAlign.CENTER; label.verticalAlign = Label.VerticalAlign.CENTER;
        label.enableWrapText = true; label.overflow = Label.Overflow.SHRINK;
    }
}
