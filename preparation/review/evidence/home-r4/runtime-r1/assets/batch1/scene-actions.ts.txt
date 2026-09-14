import { _decorator, AudioClip, AudioSource, Color, Component, director, game, Game, isValid, Label, Node, Sprite, SpriteFrame, UITransform } from 'cc';
import { GameAudio } from './game-audio';
import { bindAction, hasUserInteraction, markUserInteraction, readSettings, writeSettings } from './local-platform';
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
    }
}
