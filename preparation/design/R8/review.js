'use strict';

// Homepage composition only. Existing artwork; no physics, Cocos or game storage.
const ART = '../../../assets/batch0/art/';
const CLOUD = '../R7/assets/cloud-soft-r7-clean.png';
const page = { mode: 'r8', height: 667, motion: true };
const scene = document.getElementById('scene');
const phone = document.getElementById('phone');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function sprite(name, x, y, width, height, classes = '') {
  return `<img class="sprite ${classes}" src="${ART}${name}.png" alt="" draggable="false" style="left:${x}px;top:${y}px;width:${width}px;height:${height}px">`;
}
function shadow(x, y, width, height, ground = false) {
  return `<i class="${ground ? 'ground-shadow' : 'contact-shadow'}" style="left:${x}px;top:${y}px;width:${width}px;height:${height}px"></i>`;
}
function object(kind, x, y, plane, scale) {
  const sizes = { cardboard_box: [123.4306, 122.6050, 0], fridge: [121.9219, 170.2030, 10], basketball: [70.2295, 70.2295, 0] };
  const [width, height, dx] = sizes[kind];
  return sprite('object_' + kind, x + (dx - width / 2) * scale,
    plane - (y + height / 2) * scale, width * scale, height * scale, 'object');
}
function button(name, label, x, y, width, height) {
  return `<button class="scene-button" type="button" data-preview="${label}" aria-label="${label}，仅演示按压" style="left:${x}px;top:${y}px;width:${width}px;height:${height}px"><img src="${ART}${name}.png" alt="" draggable="false"></button>`;
}
function home(height) {
  const extra = height - 1334, scale = 1.8 + extra * .0015;
  const platformWidth = 160 * scale;
  const plane = height - 220 - platformWidth * (249 - 82) / 425;
  const boxX = 365, fridgeX = 382, ballX = 375;
  let html = '<img class="sprite backdrop" src="assets/bg-home-r8.png" alt="">';
  html += `<img class="sprite cloud" src="${CLOUD}" alt="" style="left:-160px;top:${325 + extra * .12}px;width:340px;opacity:.8;--duration:25s;--delay:-7s;--travel:140px;--lift:7px">`;
  html += `<img class="sprite cloud" src="${CLOUD}" alt="" style="left:624px;top:${560 + extra * .2}px;width:290px;opacity:.72;--duration:28s;--delay:-13s;--travel:-140px;--lift:-8px">`;
  html += `<img class="sprite cloud" src="${CLOUD}" alt="" style="left:-95px;top:${737 + extra * .25}px;width:185px;opacity:.4;--duration:27s;--delay:-17s;--travel:110px;--lift:6px">`;
  html += shadow(375 - platformWidth / 2, plane + platformWidth * .31, platformWidth, 24, true);
  html += sprite('platform_city_base', 375 - platformWidth / 2,
    plane - platformWidth * 82 / 425, platformWidth, platformWidth * 249 / 425, 'object');
  html += shadow(boxX - 34 * scale, plane + 3 * scale, 68 * scale, 8 * scale);
  html += object('cardboard_box', boxX, 50, plane, scale);
  html += shadow(fridgeX - 27 * scale, plane - 95.3 * scale, 60 * scale, 6.7 * scale);
  html += object('fridge', fridgeX, 172.5, plane, scale);
  html += shadow(ballX - 15 * scale, plane - 244.3 * scale, 29.4 * scale, 5.3 * scale);
  html += object('basketball', ballX, 276, plane, scale);
  html += sprite('logo_main', 70, 48 + extra * .25, 610, 610 * 321 / 545, 'logo');
  const logoBottom = 48 + extra * .25 + 610 * 317 / 545;
  const ballTop = plane - (276 + 70.2295 / 2) * scale + 70.2295 * scale * 5 / 252;
  html += `<div class="tagline" style="top:${(logoBottom + ballTop - 32) / 2}px">把乱七八糟的东西叠上天</div>`;
  html += button('btn_settings_icon', '设置', 660, 24, 65, 65);
  html += button('btn_start', '开始叠', 97, height - 210, 556, 556 * 210 / 594);
  return html;
}
function fit() {
  if (page.mode !== 'r8') return;
  const width = phone.clientWidth;
  phone.style.height = width * page.height / 375 + 'px';
  scene.style.height = page.height * 2 + 'px';
  scene.style.transform = `scale(${width / 750})`;
}
function updateMotion() {
  scene.classList.toggle('is-still', !page.motion || reducedMotion.matches || page.mode !== 'r8');
  scene.classList.toggle('is-hidden', document.hidden);
  const toggle = document.getElementById('motion-toggle');
  toggle.disabled = page.mode !== 'r8' || reducedMotion.matches;
  toggle.textContent = reducedMotion.matches ? '系统已减少动效' : page.motion ? '暂停云动效' : '播放云动效';
  toggle.setAttribute('aria-pressed', String(page.motion));
}
function render() {
  const comparison = page.mode !== 'r8';
  document.getElementById('workspace').classList.toggle('is-reference', comparison);
  document.getElementById('reference').hidden = !comparison;
  document.getElementById('viewport-size').disabled = comparison;
  document.querySelectorAll('[data-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === page.mode)));
  if (comparison) {
    const image = document.getElementById('reference-image');
    image.src = page.mode === 'r7' ? '../R7/evidence/home-667.png' : 'assets/ui-original-reference.png';
    image.alt = page.mode === 'r7' ? 'R7 首页完整审阅截图' : '原 UI 系统参考整图';
    document.getElementById('reference-caption').textContent = page.mode === 'r7'
      ? 'R7 首页的完整审阅截图，含页面说明；保持原图比例，不伪装为同视口原生对照。'
      : '原 UI 系统参考整图，仅用于理解视觉与构图；未经裁切抠图，图中历史功能不覆盖现行 SPEC。';
  } else scene.innerHTML = home(page.height * 2);
  document.getElementById('caption').textContent = comparison ? '切回 R8 完整稿，可检查短长屏与云动效。' : '按钮仅演示按压反馈，不进入玩法或设置。物品质感与正式图一致。';
  fit(); updateMotion();
}
document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => { page.mode = button.dataset.mode; render(); }));
document.getElementById('viewport-size').addEventListener('change', event => { page.height = Number(event.target.value); render(); });
document.getElementById('motion-toggle').addEventListener('click', () => { page.motion = !page.motion; updateMotion(); });
scene.addEventListener('click', event => {
  const button = event.target.closest('[data-preview]');
  if (button) document.getElementById('caption').textContent = `已预览“${button.dataset.preview}”按压反馈；当前仅审首页，不进入其它页面。`;
});
document.addEventListener('visibilitychange', updateMotion);
reducedMotion.addEventListener('change', updateMotion);
new ResizeObserver(fit).observe(phone);
render();
