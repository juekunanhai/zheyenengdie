import { _decorator, Color, Component, game, Game, Graphics, Label, Node, Sprite, SpriteFrame, UITransform, UIOpacity } from 'cc';
import { runResult } from '../../batch1/object-data';

const { ccclass, property } = _decorator;

/** A compact score card over the approved Home art. Decorations are never a run screenshot. */
@ccclass('ResultPresentation')
export class ResultPresentation extends Component {
    @property([SpriteFrame]) heightFrames: SpriteFrame[] = [];
    private safe!: Node;
    private content!: Node;
    private card!: Node;
    private homeArt!: Node;
    private backdrop!: Node;
    private dim!: Graphics;
    private width = 0;
    private height = 0;
    private safeWidth = 0;
    private safeHeight = 0;
    private elapsed = 0;
    private hidden = false;
    private readonly hide = () => { this.hidden = true; this.resetButtons(); };
    private readonly show = () => { this.hidden = false; };

    onLoad(): void {
        this.safe = this.node.getChildByName('SafeArea')!;
        this.content = this.safe.getChildByName('Content_1230')!;
        this.card = this.content.getChildByName('ResultCard')!;
        this.homeArt = this.node.getChildByName('ResultHomeArt')!;
        this.backdrop = this.node.getChildByName('ResultHomeBackdrop')!;
        this.dim = this.node.getChildByName('ResultDim')!.addComponent(Graphics);
        for (const name of ['result_btn_retry', 'result_btn_close']) {
            const button = this.card.getChildByName(name)!;
            const visual = button.getChildByName('CloseVisual') ?? button.getChildByName('RetryVisual')!;
            button.on(Node.EventType.TOUCH_START, () => visual.setScale(.96, .96, 1));
            button.on(Node.EventType.TOUCH_END, () => visual.setScale(1, 1, 1));
            button.on(Node.EventType.TOUCH_CANCEL, () => visual.setScale(1, 1, 1));
        }
        this.setHeight(runResult.height);
        this.showMetrics();
        this.fit();
        this.paintEntry();
    }

    onEnable(): void { game.on(Game.EVENT_HIDE, this.hide); game.on(Game.EVENT_SHOW, this.show); }
    onDisable(): void { game.off(Game.EVENT_HIDE, this.hide); game.off(Game.EVENT_SHOW, this.show); this.resetButtons(); }

    /** Layout image glyphs from the genuine result; never bake a sample score into the card. */
    setHeight(height: number): void {
        const value = Number.isFinite(height) ? Math.max(0, height) : 0;
        const text = `${value.toFixed(1)}m`;
        const treatment = this.card.getChildByName('HeightTreatment')!;
        // setHeight is also used by the local layout reviewer: remove obsolete digits first.
        for (const child of [...treatment.children]) { child.removeFromParent(); child.destroy(); }
        // Creator's loose transpiler treats [...string] as one array element.
        const glyphs = text.split('').map(char => {
            const key = char === '.' ? 'dot' : char;
            const frame = this.heightFrames.find(item => item.name === `result_r13_height_${key}`)!;
            const height = (char === 'm' ? 30 : char === '.' ? 20 : 52) * 2.3;
            return { char, frame, height, width: height * frame.originalSize.width / frame.originalSize.height };
        });
        const overlap = 12 * 2.3;
        const width = glyphs.reduce((total, glyph) => total + glyph.width, 0) - overlap * (glyphs.length - 1);
        const scale = Math.min(1, 161 * 2.3 / width);
        let x = -width * scale / 2;
        for (const glyph of glyphs) {
            const node = new Node(`HeightGlyph:${glyph.char}`);
            node.layer = treatment.layer;
            treatment.addChild(node);
            node.addComponent(UITransform).setContentSize(glyph.width * scale, glyph.height * scale);
            const sprite = node.addComponent(Sprite);
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            sprite.trim = false;
            sprite.spriteFrame = glyph.frame;
            node.setPosition(x + glyph.width * scale / 2, (-52 * 2.3 / 2 + glyph.height / 2) * scale, 0);
            x += (glyph.width - overlap) * scale;
        }
    }

    /** Native text uses the settled run snapshot, including real zeroes. No sample or percentile art. */
    private showMetrics(): void {
        const board = new Node('ResultMetrics');
        board.layer = this.card.layer;
        this.card.addChild(board);
        board.setSiblingIndex(this.card.getChildByName('result_btn_retry')!.getSiblingIndex());
        // R13's existing data area, in the same 2.3x coordinates as the rest of the card.
        const width = 209 * 2.3, height = 70 * 2.3;
        board.addComponent(UITransform).setContentSize(width, height);
        board.setPosition((18 + 209 / 2 - 149) * 2.3, (168 - 189 - 70 / 2) * 2.3, 0);
        const graphics = board.addComponent(Graphics);
        graphics.fillColor = new Color(255, 255, 255, 248);
        graphics.roundRect(-width / 2, -height / 2, width, height, 24);
        graphics.fill();
        graphics.strokeColor = new Color(193, 228, 247, 255);
        graphics.lineWidth = 2;
        graphics.moveTo(0, -height / 2 + 24);
        graphics.lineTo(0, height / 2 - 24);
        graphics.stroke();
        const count = (value: number) => String(Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0);
        const columns = [
            { name: 'TechnicalScore', title: '本次技术分', value: count(runResult.technicalScore) },
            { name: 'NarrowEscapes', title: '惊险稳住', value: `${count(runResult.highlights.narrow_escape)}次` },
        ];
        columns.forEach((column, index) => {
            for (const heading of [true, false]) {
                const node = new Node(`${column.name}${heading ? 'Title' : 'Value'}`);
                node.layer = board.layer;
                board.addChild(node);
                node.addComponent(UITransform).setContentSize(width / 2 - 24, heading ? 42 : 66);
                node.setPosition((index ? 1 : -1) * width / 4, heading ? 34 : -22, 0);
                const label = node.addComponent(Label);
                label.string = heading ? column.title : column.value;
                label.fontSize = heading ? 27 : 48;
                label.lineHeight = heading ? 36 : 60;
                label.isBold = true;
                label.horizontalAlign = Label.HorizontalAlign.CENTER;
                label.verticalAlign = Label.VerticalAlign.CENTER;
                label.overflow = Label.Overflow.SHRINK;
                label.enableWrapText = false;
                label.color = heading ? new Color(24, 72, 164) : new Color(15, 34, 110);
            }
        });
    }

    update(dt: number): void {
        this.fit();
        if (!this.hidden) this.elapsed += Math.min(dt, .05);
        this.paintEntry();
        this.paintClouds();
    }

    private resetButtons(): void {
        if (!this.card) return;
        for (const name of ['result_btn_retry', 'result_btn_close']) {
            const button = this.card.getChildByName(name)!;
            (button.getChildByName('CloseVisual') ?? button.getChildByName('RetryVisual')!).setScale(1, 1, 1);
        }
    }

    private paintEntry(): void {
        const t = Math.min(1, this.elapsed / .24);
        const eased = 1 - Math.pow(1 - t, 3);
        const scale = .965 + .035 * eased;
        this.card.setScale(scale, scale, 1);
        this.card.setPosition(0, -10 * (1 - eased), 0);
        this.card.getComponent(UIOpacity)!.opacity = 190 + 65 * eased;
    }

    private fit(): void {
        const canvas = this.node.getComponent(UITransform)!;
        const safe = this.safe.getComponent(UITransform)!;
        if (canvas.width === this.width && canvas.height === this.height && safe.width === this.safeWidth && safe.height === this.safeHeight) return;
        this.width = canvas.width; this.height = canvas.height;
        this.safeWidth = safe.width; this.safeHeight = safe.height;
        // The card and both hit targets remain inside the safe area, including short screens.
        const scale = Math.min(canvas.width / 750, canvas.height / 1334);
        const cardScale = Math.min(canvas.width / 750, safe.width / 750, safe.height / 820);
        this.content.setScale(cardScale, cardScale, 1);
        this.content.setPosition(0, 0, 0);
        const backdropSource = this.backdrop.getComponent(Sprite)!.spriteFrame!.originalSize;
        const cover = Math.max(canvas.width / backdropSource.width, canvas.height / backdropSource.height);
        this.backdrop.getComponent(UITransform)!.setContentSize(backdropSource.width * cover, backdropSource.height * cover);
        this.backdrop.setPosition(0, (backdropSource.height * cover - canvas.height) / 2, 0);
        this.dim.node.getComponent(UITransform)!.setContentSize(canvas.width, canvas.height);
        this.dim.clear();
        this.dim.fillColor = new Color(14, 38, 76, 135);
        this.dim.rect(-canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height);
        this.dim.fill();

        // Match the existing approved Home composition; only the overlay is interactive.
        const height = canvas.height / scale;
        const extra = height - 1334;
        this.homeArt.setScale(scale, scale, 1);
        this.homeArt.getComponent(UITransform)!.setContentSize(750, height);
        const heroWidth = 470 + extra * .35;
        const heroLeft = 185 - (heroWidth - 470) / 2;
        const heroTop = height - 145 - heroWidth * 1507 / 1024;
        const shoeLeft = heroLeft + heroWidth * 450 / 1024 - 129;
        this.placeHome('R9Hero', heroLeft, heroTop, heroWidth, heroWidth * 1.5);
        this.placeHome('R9SlipperBack', shoeLeft - 45, heroTop - 136, 144, 144 * 257 / 340);
        this.placeHome('R9SlipperFront', shoeLeft, heroTop - 121, 194, 194 * 257 / 340);
        this.placeHome('R9WoodBoard', 22, height * .49, 226, 310);
        const logoWidth = 560 + extra * .2;
        const logoHeight = logoWidth * 732 / 1381;
        const logoTop = heroTop - 136 - logoHeight - 12;
        this.placeHome('logo_main', (750 - logoWidth) / 2, logoTop, logoWidth, logoHeight);
        this.placeHome('HomeAirship', 9, logoTop + 102, 112, 64);
        this.placeHome('HomeAirplane', 645, logoTop + 296, 99, 99 * 94 / 159);
        this.paintClouds();
    }

    private placeHome(name: string, left: number, top: number, width: number, height: number): void {
        const node = this.homeArt.getChildByName(name)!;
        node.getComponent(UITransform)!.setContentSize(width, height);
        const totalHeight = this.homeArt.getComponent(UITransform)!.height;
        node.setPosition(left + width / 2 - 375, totalHeight / 2 - top - height / 2, 0);
    }

    private paintClouds(): void {
        const extra = this.homeArt.getComponent(UITransform)!.height - 1334;
        const positions = [[-170, 300 + extra * .12, 340, 25, 7, 140, 7],
            [610, 490 + extra * .2, 290, 28, 13, -140, -8], [-105, 732 + extra * .25, 185, 27, 17, 110, 6]];
        positions.forEach(([x, y, width, duration, offset, travel, lift], i) => {
            const weight = (1 - Math.cos(Math.PI * (this.elapsed + offset) / duration)) / 2;
            const name = `R9Cloud${i}`;
            const source = this.homeArt.getChildByName(name)!.getComponent(Sprite)!.spriteFrame!.originalSize;
            this.placeHome(name, x + travel * weight, y + lift * weight, width, width * source.height / source.width);
        });
    }
}
