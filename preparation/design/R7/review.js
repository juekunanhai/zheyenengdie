'use strict';

// Independent presentation sample: no Cocos, physics, game storage or network calls.
const ART = '../../../assets/batch0/art/';
const CANDIDATES = 'assets/';
const states = [
  { id: 'home', label: '首页', title: '先看见玩具，再想按下开始',
    lead: '统一材质方向和前后关系，保留原来的明亮与轻松。',
    notes: ['展示塔直接接触，阴影只落在接触位置。', '开始按钮与承台分开，主次清楚。', '背景云缓慢经过，塔和地面保持稳固。'],
    caption: '首页展示塔为静态构图；开始与设置可试按。' },
  { id: 'ground', label: '地面开局', title: '轻快的环境，安静的操作区',
    lead: 'R6 的顶部挂牌、短抓手和竖向道具区保持原位。',
    notes: ['起点只有地面承台，没有预先搭好的塔。', '独立云在边缘移动，地面不漂移。', 'NEXT 保留纯轮廓，空道具槽降低存在感。'],
    caption: '0.0 m 为开局示意。旋转可试按；本页不释放物体、不运行物理。' },
  { id: 'stack', label: '已有堆叠', title: '接触的地方，才产生重量感',
    lead: '纸箱、冰箱、篮球、纸箱直接接触，没有装饰木板隔层。',
    notes: ['保持四种正式物体的比例依据。', '接触处使用小范围软影，不给全部物体加光圈。', 'HUD 与环境各自独立，中央留给塔和待放物。'],
    caption: '四件静态摆放，4.1 m 仅为构图数值示意，不是物理成绩。当前工程对照取自暂停截图。' },
  { id: 'pause', label: '暂停', title: '停下来，就明确地停下来',
    lead: '收起释放提示，冻结环境，把继续入口放在视线中心。',
    notes: ['背景轻压暗，仍能辨认刚才的堆叠。', '暂停时云与下层操作全部停止。', '复用正式按钮底图，保持统一按压反馈。'],
    caption: '已暂停为独立视觉状态；继续按钮返回堆叠示意。' },
  { id: 'settings', label: '设置', title: '材质一致，状态诚实',
    lead: '紧凑面板配统一文字层级，不靠空白和大边框撑满。',
    notes: ['标题、项目与次要说明使用同一套字体关系。', '音乐和震动标明后续接入，不能误开。', '音效开关仅演示本页状态，不影响游戏。'],
    caption: '设置仅为视觉小样；不会修改当前游戏的偏好或音频。' },
  { id: 'result', label: '结算', title: '让这局高度成为主角',
    lead: '按当前已有信息收拢面板，不预留大片空洞。',
    notes: ['高度数字与顶部 HUD 使用一致的字重。', '只保留这一轮已有的高度和重新开始入口。', '不展示尚未实现的新纪录、奖励或死因。'],
    caption: '4.1 m 为示例数值；按钮只切换本页开局示意。' },
];
const page = { state: 'home', mode: 'after', height: 667, motion: true, sound: true, angle: 0 };
const scene = document.getElementById('scene');
const phone = document.getElementById('phone');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let returnState = 'home';

function image(name, x, y, width, height, classes = '', candidate = false) {
  const h = height ? `height:${height}px;` : '';
  const source = candidate ? CANDIDATES + name : ART + name + '.png';
  return `<img class="sprite ${classes}" src="${source}" alt="" draggable="false" style="left:${x}px;top:${y}px;width:${width}px;${h}">`;
}
function button(name, action, label, x, y, width, height, text = '') {
  const copy = text ? `<span class="button-text">${text}</span>` : '';
  return `<button class="scene-button" data-action="${action}" aria-label="${label}" style="left:${x}px;top:${y}px;width:${width}px;height:${height}px"><img src="${ART}${name}.png" alt="" draggable="false">${copy}</button>`;
}
function shadow(x, y, width, height, opacity = .23, ground = false) {
  return `<i class="${ground ? 'ground-shadow' : 'contact-shadow'}" style="left:${x}px;top:${y}px;width:${width}px;height:${height}px;opacity:${opacity}"></i>`;
}
function background() {
  return `<img class="sprite backdrop" src="${CANDIDATES}bg-ground-clear-r7.png" alt="">
    <img class="sprite cloud" src="${CANDIDATES}cloud-soft-r7-clean.png" alt="" style="left:-220px;top:325px;width:350px;opacity:.94;--duration:24s;--delay:-9s;--travel:180px;--lift:10px">
    <img class="sprite cloud" src="${CANDIDATES}cloud-soft-r7-clean.png" alt="" style="left:630px;top:525px;width:290px;opacity:.75;--duration:29s;--delay:-13s;--travel:-140px;--lift:-8px">
    <img class="sprite cloud" src="${CANDIDATES}cloud-soft-r7-clean.png" alt="" style="left:40px;top:705px;width:185px;opacity:.45;--duration:26s;--delay:-17s;--travel:-110px;--lift:6px">`;
}
function platform(plane) {
  return shadow(263, plane + 72, 238, 25, .15, true)
    + image('platform_city_base', 255, plane - 240 * 82 / 425, 240, 240 * 249 / 425, 'world-sprite');
}
function body(kind, physicsY, plane, x = 375) {
  const specs = {
    cardboard_box: [123.4306, 122.6050, 0, 0],
    fridge: [121.9219, 170.2030, 10, 0],
    basketball: [70.2295, 70.2295, 0, 0],
  };
  const scale = 1.5, [width, height, dx, dy] = specs[kind];
  return image('object_' + kind, x + dx * scale - width * scale / 2,
    plane - (physicsY + dy) * scale - height * scale / 2,
    width * scale, height * scale, 'world-sprite');
}
function tower(plane, topBox = true) {
  // Contact shadows follow their support in DOM order, then the upper object.
  let html = shadow(325, plane + 4, 102, 13, .2) + body('cardboard_box', 50, plane);
  html += shadow(335, plane - 143, 90, 10, .22) + body('fridge', 172.5, plane);
  html += shadow(350, plane - 366.5, 44, 8, .22) + body('basketball', 276, plane);
  if (topBox) html += shadow(349, plane - 468.5, 47, 8, .2) + body('cardboard_box', 360, plane);
  return html;
}
function home(height) {
  const plane = height - 340;
  return background() + platform(plane) + tower(plane, false)
    + image('logo_main', 112, 153, 526, 310, 'hud-sprite')
    + `<div class="tagline" style="top:466px">把乱七八糟的东西叠上天</div>`
    + button('btn_settings_icon', 'settings', '查看设置示意', 641, 49, 71, 71)
    + button('btn_start', 'start', '查看开局示意', 109, height - 197, 532, 188);
}
function hud(height, stacked) {
  const plane = height - 292;
  let html = background() + platform(plane);
  if (stacked) html += tower(plane);
  html += image('object_cardboard_box', 282.427, 152, 185.146, 183.907, 'world-sprite held-object');
  html += image('claw_cable_straight', 369, -6, 12, 86, 'claw-sprite');
  html += image('claw_open_narrow', 311, 46, 128, 149.05, 'claw-sprite');
  html += image('hud_height_sign', 22, 0, 240, 127.123, 'hud-sprite');
  html += `<span class="hud-height">${stacked ? '4.1' : '0.0'}</span>`;
  for (let i = 0; i < 3; i++) html += image('hud_star_full', 43 + i * 58, 148, 46, 45.62, 'hud-sprite');
  html += button('hud_pause', 'pause', '查看暂停示意', 640, 16, 88, 90.39);
  html += image('hud_next_frame', 616, 155, 112, 179.97, 'hud-sprite');
  html += image('next_basketball', 641, 240, 62, 62, 'hud-sprite');
  html += image('inventory-vertical-r7-clean.png', 20, height - 369, 154, 304, 'hud-sprite inventory-button', true);
  html += `<span class="inventory-plus" style="left:57px;top:${height - 310}px">+</span><span class="inventory-plus" style="left:57px;top:${height - 191}px">+</span>`;
  html += button('hud_rotate_90', 'rotate', '预览旋转动效', 514, height - 232, 218, 180.73);
  if (page.state !== 'pause') html += `<div class="instruction">左右移动，松手释放</div>`;
  return html;
}
function panel(height, panelHeight, content) {
  const top = Math.round((height - panelHeight) / 2);
  return `<div class="overlay-shade"></div><section class="dialog" style="top:${top}px;height:${panelHeight}px"><div class="dialog-panel" aria-hidden="true"></div>${content}</section>`;
}
function pause(height) {
  return hud(height, true) + panel(height, 446,
    '<h2 class="dialog-title">已暂停</h2><p class="dialog-subtitle">歇一会儿，塔会等你。</p>'
    + button('btn_settings_base', 'continue', '继续查看堆叠示意', 92, 213, 392, 142, '继续叠'));
}
function settings(height) {
  let rows = '<div class="settings-row inactive" style="top:177px"><div class="settings-copy"><strong>音乐</strong><small>后续接入</small></div><span class="setting-status">未启用</span></div>';
  rows += `<div class="settings-row" style="top:295px"><div class="settings-copy"><strong>音效</strong><small>仅当前小样</small></div>${button(page.sound ? 'toggle_on' : 'toggle_off', 'sound', page.sound ? '关闭示例音效开关' : '打开示例音效开关', 0, 0, 106, 54)}</div>`;
  rows += '<div class="settings-row inactive" style="top:413px"><div class="settings-copy"><strong>震动</strong><small>后续接入</small></div><span class="setting-status">未启用</span></div>';
  return home(height) + panel(height, 707,
    '<h2 class="dialog-title">设置</h2><p class="dialog-subtitle">舒舒服服地叠</p>' + rows
    + button('btn_settings_base', 'back', '返回上一屏示意', 139, 535, 298, 108, '返回'));
}
function result(height) {
  return background() + panel(height, 590,
    '<h2 class="dialog-title">本局高度</h2><div class="result-height">4.1<span>m</span></div><p class="result-detail">再来一次，试着叠得更高。</p>'
    + button('result_btn_retry', 'start', '查看重新开局示意', 83, 377, 410, 141));
}
function before(height) {
  const note = page.state === 'stack' ? '当前工程 · 已堆叠的暂停截图' : '当前工程 · 本轮实机浏览器截图';
  const top = Math.max(0, (height - 1334) / 2);
  return `<div class="before-crop" style="top:${top}px"><img src="before/${page.state}.png" alt="${note}"></div>`
    + (height !== 1334 ? '<div class="before-label">历史截图 375 × 667，保持原比例展示</div>' : '');
}
function updateMotion() {
  scene.classList.toggle('is-still', !page.motion || page.state === 'pause' || reduceMotion.matches);
  scene.classList.toggle('is-hidden', document.hidden);
  const toggle = document.getElementById('motion-toggle');
  toggle.disabled = page.mode === 'before' || page.state === 'pause' || reduceMotion.matches;
  toggle.textContent = reduceMotion.matches ? '系统已减少动效' : page.state === 'pause' ? '暂停状态 · 动效已停' : page.motion ? '暂停动效' : '播放动效';
  toggle.setAttribute('aria-pressed', String(page.motion));
}
function fit() {
  const width = phone.clientWidth;
  phone.style.height = width * page.height / 375 + 'px';
  scene.style.height = page.height * 2 + 'px';
  scene.style.transform = `scale(${width / 750})`;
}
function render() {
  const item = states.find(state => state.id === page.state), height = page.height * 2;
  const scenes = { home, ground: h => hud(h, false), stack: h => hud(h, true), pause, settings, result };
  scene.innerHTML = page.mode === 'before' ? before(height) : scenes[page.state](height);
  if (['pause', 'settings', 'result'].includes(page.state)) {
    scene.querySelectorAll('.scene-button').forEach(button => {
      if (!button.closest('.dialog')) button.disabled = true;
    });
  }
  scene.dataset.state = page.state;
  scene.dataset.mode = page.mode;
  document.getElementById('note-title').textContent = item.title;
  document.getElementById('note-lead').textContent = item.lead;
  document.getElementById('note-items').innerHTML = item.notes.map(note => `<li>${note}</li>`).join('');
  document.getElementById('caption').textContent = item.caption;
  document.getElementById('preview-label').textContent = `${page.mode === 'after' ? 'R7 精修' : '当前工程'} / ${item.label}`;
  document.querySelectorAll('[data-state]').forEach(tab => { if (tab.tagName === 'BUTTON') tab.setAttribute('aria-selected', String(tab.dataset.state === page.state)); });
  document.querySelectorAll('[data-mode]').forEach(tab => { if (tab.tagName === 'BUTTON') tab.setAttribute('aria-pressed', String(tab.dataset.mode === page.mode)); });
  fit(); updateMotion();
}
function selectState(state) {
  if (state === 'settings') returnState = page.state === 'settings' ? 'home' : page.state;
  page.state = state; page.angle = 0; render();
}
function act(action) {
  if (action === 'sound') { page.sound = !page.sound; render(); return; }
  if (action === 'rotate') {
    page.angle += 90;
    const held = scene.querySelector('.held-object');
    if (held) held.style.transform = `rotate(${page.angle}deg)`;
    return;
  }
  const destinations = { start: 'ground', settings: 'settings', pause: 'pause', continue: 'stack', back: returnState };
  if (destinations[action]) selectState(destinations[action]);
}
document.getElementById('state-tabs').innerHTML = states.map(state => `<button type="button" role="tab" data-state="${state.id}" aria-selected="${state.id === page.state}">${state.label}</button>`).join('');
document.getElementById('state-tabs').addEventListener('click', event => { const tab = event.target.closest('[data-state]'); if (tab) selectState(tab.dataset.state); });
document.querySelectorAll('button[data-mode]').forEach(button => button.addEventListener('click', () => { page.mode = button.dataset.mode; render(); }));
document.getElementById('viewport-size').addEventListener('change', event => { page.height = Number(event.target.value); render(); });
document.getElementById('motion-toggle').addEventListener('click', () => { page.motion = !page.motion; updateMotion(); });
scene.addEventListener('click', event => { const button = event.target.closest('[data-action]'); if (button && !button.disabled) act(button.dataset.action); });
document.addEventListener('visibilitychange', updateMotion);
reduceMotion.addEventListener('change', updateMotion);
new ResizeObserver(fit).observe(phone);
render();
