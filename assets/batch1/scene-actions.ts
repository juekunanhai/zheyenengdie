import { _decorator, AudioClip, AudioSource, Color, Component, director, game, Game, Graphics, isValid, Label, Node, Sprite, SpriteFrame, UITransform } from 'cc';
import { GameAudio } from './game-audio';
import { bindAction, hasUserInteraction, markUserInteraction, readSettings, writeSettings } from './local-platform';
import { CollectionView } from './collection-view';
const { ccclass, property } = _decorator;

/** Existing Home/Settings/Result art; only implemented fields and actions are active. */
@ccclass('StackSceneActions')
export class StackSceneActions extends Component {
    @property([SpriteFrame]) frames: SpriteFrame[] = [];
    @property(AudioClip) resultSound: AudioClip | null = null;
    @property(AudioClip) uiSound: AudioClip | null = null;
    @property(AudioClip) homeMusicClip: AudioClip | null = null;
    private navigating = false;
    private audio?: GameAudio;
    private homeMusic: AudioSource | null = null;
    private homeMusicGain = 0;
    private homeSuspended = false;
    private collectionView: CollectionView | null = null;
    private collectionButton: Node | null = null;
    private readonly onHomeTouch = () => { markUserInteraction(); this.syncHomeMusic(); };
    private readonly onHomeHide = () => { this.homeSuspended = true; this.stopHomeMusic(); };
    private readonly onHomeShow = () => { this.homeSuspended = false; this.syncHomeMusic(); };

    onLoad(): void {
        const scene = this.node.scene!.name;
        const content = this.node.getChildByName('SafeArea')!.getChildByName('Content_1230')!;
        if (this.uiSound) {
            this.audio = new GameAudio(this.node, new Map([['next_handoff', this.uiSound]]));
            this.audio.play('ui_tap', .5);
        }
        if (scene === 'Home') {
            // Capture includes blank areas and buttons without consuming their touch events.
            this.node.on(Node.EventType.TOUCH_START, this.onHomeTouch, this, true);
            game.on(Game.EVENT_HIDE, this.onHomeHide);
            game.on(Game.EVENT_SHOW, this.onHomeShow);
            this.syncHomeMusic();
            this.collectionView = new CollectionView(this.node.getChildByName('SafeArea')!, new Map(this.frames.map(frame => [frame.name, frame])));
            this.collectionButton = this.makeCollectionButton(content);
            bindAction(content.getChildByName('btn_start')!, () => this.go('HUD'));
            bindAction(content.getChildByName('btn_settings_icon')!, () => this.go('Settings'));
        } else if (scene === 'Result') {
            if (this.resultSound) {
                this.audio = new GameAudio(this.node, new Map([['run_end', this.resultSound]]));
                this.audio.play('run_end', .75);
            }
            const card = content.getChildByName('ResultCard')!;
            bindAction(card.getChildByName('result_btn_retry')!, () => this.go('HUD'));
            bindAction(card.getChildByName('result_btn_close')!, () => this.go('Home'));
        } else if (scene === 'Settings') {
            const credits = new Node('MusicCredits');
            content.addChild(credits); credits.layer = content.layer;
            credits.setPosition(0, -540, 0);
            credits.addComponent(UITransform).setContentSize(660, 140);
            const label = credits.addComponent(Label);
            label.string = '首页：Carefree\n对局：Happy Boy End Theme\nKevin MacLeod · incompetech.com\n'
                + 'CC BY 4.0 · https://creativecommons.org/licenses/by/4.0\n已作循环剪辑与音量调整';
            label.fontSize = 22; label.lineHeight = 28;
            label.horizontalAlign = Label.HorizontalAlign.CENTER;
            label.verticalAlign = Label.VerticalAlign.CENTER;
            label.color = new Color(23, 48, 71, 255);
            const keys = ['music', 'sound', 'vibration'] as const;
            const toggles = content.children.filter(n => n.name.startsWith('toggle_'));
            toggles.forEach((node, i) => {
                const key = keys[i];
                const paint = () => { node.getComponent(Sprite)!.spriteFrame = this.frames.find(f => f.name === `toggle_${readSettings()[key] ? 'on' : 'off'}`)!; };
                paint();
                bindAction(node, () => {
                    const settings = readSettings(); settings[key] = !settings[key]; writeSettings(settings); paint();
                    if (key === 'sound') this.audio?.pause(!settings.sound);
                    this.audio?.play('ui_tap', .5);
                });
            });
            bindAction(content.getChildByName('btn_settings_base')!, () => this.go('Home'));
        }
    }
    private go(scene: string): void {
        if (this.navigating) return;
        this.navigating = true;
        this.stopHomeMusic();
        director.loadScene(scene, () => { if (this.isValid) this.navigating = false; });
    }

    private makeCollectionButton(parent: Node): Node {
        const button = new Node('btn_collection'); button.layer = parent.layer; parent.addChild(button);
        button.addComponent(UITransform).setContentSize(156, 58); button.setPosition(-291, 608, 0);
        const background = button.addComponent(Graphics); background.fillColor = new Color(255, 201, 71, 255);
        background.roundRect(-78, -29, 156, 58, 18); background.fill();
        const label = button.addComponent(Label); label.string = '图鉴'; label.fontSize = 27; label.lineHeight = 34;
        label.color = new Color(24, 57, 106, 255); label.isBold = true;
        label.horizontalAlign = Label.HorizontalAlign.CENTER; label.verticalAlign = Label.VerticalAlign.CENTER;
        bindAction(button, () => this.collectionView?.open());
        return button;
    }
    private syncHomeMusic(): void {
        if (!this.homeMusicClip || this.navigating || this.homeSuspended
            || !hasUserInteraction() || !readSettings().music) {
            this.stopHomeMusic(); return;
        }
        if (this.homeMusic) return;
        const child = new Node('HomeMusic'); this.node.addChild(child);
        const source = child.addComponent(AudioSource);
        this.homeMusic = source;
        source.playOnAwake = false; source.loop = true; source.volume = 0;
        source.clip = this.homeMusicClip;
        child.on(AudioSource.EventType.STARTED, () => {
            if (this.homeMusic === source && (this.navigating || this.homeSuspended || !readSettings().music)) this.stopHomeMusic();
        });
        source.play();
    }
    private stopHomeMusic(): void {
        const source = this.homeMusic; this.homeMusic = null; this.homeMusicGain = 0;
        if (!source || !isValid(source, true)) return;
        source.volume = 0; source.stop(); source.clip = null;
        // A fresh source on return prevents a same-clip pending load from reviving the old player.
        source.node.destroy();
    }
    update(dt: number): void {
        this.audio?.update(dt);
        this.collectionView?.update();
        if (!this.homeMusicClip) return;
        this.syncHomeMusic();
        if (this.homeMusic?.playing) {
            this.homeMusicGain = Math.min(.28, this.homeMusicGain + dt * .35);
            this.homeMusic.volume = this.homeMusicGain;
        }
    }
    onDestroy(): void {
        this.node.off(Node.EventType.TOUCH_START, this.onHomeTouch, this, true);
        game.off(Game.EVENT_HIDE, this.onHomeHide); game.off(Game.EVENT_SHOW, this.onHomeShow);
        this.stopHomeMusic(); this.audio?.dispose();
        this.collectionView?.dispose(); this.collectionView = null;
        if (this.collectionButton && isValid(this.collectionButton, true)) this.collectionButton.destroy();
        this.collectionButton = null;
    }
}
