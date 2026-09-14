'use strict';

// Homepage illustration only. No physics objects, Cocos changes or game storage.
const ART = '../../../assets/batch0/art/';
const CLOUD = '../R7/assets/cloud-soft-r7-clean.png';
const AIR = '../../art/candidates/backgrounds/';
const page = { mode: 'r10', height: 667, motion: true };
const scene = document.getElementById('scene');
const phone = document.getElementById('phone');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function button(name, label, x, y, width, height) {
  return `<button class="scene-button" type="button" data-preview="${label}" aria-label="${label}，仅演示按压" style="left:${x}px;top:${y}px;width:${width}px;height:${height}px"><img src="${ART}${name}.png" alt="" draggable="false"></button>`;
}
function home(height) {
  const extra = height - 1334;
  const heroWidth = 470 + extra * .35;
  const heroHeight = heroWidth * 1536 / 1024, heroLeft = 185 - (heroWidth - 470) / 2;
  const heroTop = height - 145 - heroWidth * 1507 / 1024;
  const shoeLeft = heroLeft + heroWidth * 450 / 1024 - 129;
  // Keep the title and tower as one composition on both screen heights.
  const logoWidth = 560 + extra * .2;
  const logoHeight = logoWidth * 732 / 1381;
  const logoTop = heroTop - 136 - logoHeight - 12;
  let html = '<img class="sprite backdrop" src="assets/bg-home-r10.png" alt="">';
  html += `<img class="sprite cloud" src="${CLOUD}" alt="" style="left:-170px;top:${300 + extra * .12}px;width:340px;opacity:.8;--duration:25s;--delay:-7s;--travel:140px;--lift:7px">`;
  html += `<img class="sprite cloud" src="${CLOUD}" alt="" style="left:610px;top:${490 + extra * .2}px;width:290px;opacity:.72;--duration:28s;--delay:-13s;--travel:-140px;--lift:-8px">`;
  html += `<img class="sprite cloud" src="${CLOUD}" alt="" style="left:-105px;top:${732 + extra * .25}px;width:185px;opacity:.4;--duration:27s;--delay:-17s;--travel:110px;--lift:6px">`;
  html += `<img class="sprite sky-toy" src="${AIR}airship_clean.png" alt="" style="left:9px;top:${logoTop + 102}px;width:112px;transform:rotate(-10deg)">`;
  html += `<img class="sprite sky-toy" src="${AIR}airplane_clean.png" alt="" style="left:645px;top:${logoTop + 296}px;width:99px;transform:rotate(22deg)">`;
  html += `<div class="wood-note" style="top:${height * .49}px"><img src="../R9/assets/sign-wood-r9-trimmed.png" alt=""><div class="wood-copy">平凡的东西<br>也能创造<br>不平凡的高度！</div></div>`;
  html += `<img class="sprite hero" src="../R9/assets/hero-stack-r9-clean.png" alt="蓝色表情箱、表情马桶和黄鸭组成的首页装饰塔" style="left:${heroLeft}px;top:${heroTop}px;width:${heroWidth}px;height:${heroHeight}px">`;
  html += `<img class="sprite slipper-back" src="../R9/assets/hero-slipper.png" alt="" style="left:${shoeLeft - 45}px;top:${heroTop - 136}px;width:144px;height:${144 * 257 / 340}px;transform:rotate(-6deg)">`;
  html += `<img class="sprite slipper-front" src="../R9/assets/hero-slipper.png" alt="一双带表情的正式红拖鞋" style="left:${shoeLeft}px;top:${heroTop - 121}px;width:194px;height:${194 * 257 / 340}px">`;
  html += `<img class="sprite logo" src="assets/logo-home-r10-clean-r2.png" alt="这也能叠，把乱七八糟的东西叠上天" style="left:${(750 - logoWidth) / 2}px;top:${logoTop}px;width:${logoWidth}px;height:${logoHeight}px">`;
  html += button('btn_settings_icon', '设置', 657, 25, 67, 67);
  html += button('btn_start', '开始叠', 97, height - 203, 556, 556 * 210 / 594);
  return html;
}
function fit() {
  if (page.mode !== 'r10') return;
  const width = phone.clientWidth;
  phone.style.height = width * page.height / 375 + 'px';
  scene.style.height = page.height * 2 + 'px';
  scene.style.transform = `scale(${width / 750})`;
}
function updateMotion() {
  scene.classList.toggle('is-still', !page.motion || reducedMotion.matches || page.mode !== 'r10');
  scene.classList.toggle('is-hidden', document.hidden);
  const toggle = document.getElementById('motion-toggle');
  toggle.disabled = page.mode !== 'r10' || reducedMotion.matches;
  toggle.textContent = reducedMotion.matches ? '系统已减少动效' : page.motion ? '暂停云动效' : '播放云动效';
  toggle.setAttribute('aria-pressed', String(page.motion));
}
function render() {
  const comparison = page.mode !== 'r10';
  document.getElementById('workspace').classList.toggle('is-reference', comparison);
  document.getElementById('reference').hidden = !comparison;
  document.getElementById('viewport-size').disabled = comparison;
  document.querySelectorAll('[data-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === page.mode)));
  if (comparison) {
    const image = document.getElementById('reference-image');
    image.src = page.mode === 'r9' ? '../R9/evidence/engine-home-667.png' : '../R8/assets/ui-original-reference.png';
    image.alt = page.mode === 'r9' ? 'R9 首页旧引擎截图' : '原 UI 系统参考整图';
    document.getElementById('reference-caption').textContent = page.mode === 'r9'
      ? 'R9 首页旧引擎截图，保持截图原有比例；非同视口对比。'
      : '原 UI 系统参考整图，重点核对第一屏首页。整图展示，不抠作素材；历史功能不覆盖现行 SPEC。';
  } else scene.innerHTML = home(page.height * 2);
  document.getElementById('caption').textContent = comparison ? '切回 R10 完整稿，可检查短长屏与云动效。' : '按钮仅演示按压反馈。首页插画不改变当前四物体玩法池。';
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
