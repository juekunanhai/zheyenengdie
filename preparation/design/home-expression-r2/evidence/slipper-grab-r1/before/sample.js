'use strict';

// An isolated art timing study; no Cocos state, physics, storage or game assets are modified.
const ART = '../../../assets/batch0/art/';
const images = new Map();
const stage = document.querySelector('#phone');
const hero = document.createElement('canvas');
hero.width = 1024; hero.height = 1536;
const cloudCanvas = document.createElement('canvas');
const state = { time: 0, skyTime: 0, playing: !matchMedia('(prefers-reduced-motion: reduce)').matches, speed: 1, loop: true };
let sequence, sky, previous = 0;
if (new URLSearchParams(location.search).get('capture') === 'phone') document.body.classList.add('phone-only');

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => { images.set(url, image); resolve(image); };
    image.onerror = () => reject(new Error(`素材无法加载：${url}`));
    image.src = url;
  });
}

function drawImage(ctx, name, x, y, width, height, angle = 0) {
  const image = images.get(ART + name + '.png');
  const h = height ?? width * image.height / image.width;
  ctx.save(); ctx.translate(x + width / 2, y + h / 2); ctx.rotate(angle * Math.PI / 180);
  ctx.drawImage(image, -width / 2, -h / 2, width, h); ctx.restore();
}

function selectedFrame(frames, localTime) {
  if (localTime < 0 || localTime > frames[frames.length - 1].time) return null;
  let frame = frames[0];
  for (const next of frames) { if (next.time > localTime) break; frame = next; }
  return frame;
}

function paintHero() {
  const ctx = hero.getContext('2d');
  ctx.clearRect(0, 0, hero.width, hero.height);
  ctx.drawImage(images.get(ART + 'home_r9_hero.png'), 0, 0);
  for (const layer of sequence.layers) {
    const frame = selectedFrame(layer.frames, state.time - layer.start);
    if (!frame?.file) continue;
    const [x, y, width, height] = layer.rect;
    ctx.drawImage(images.get(frame.file), x, y, width, height);
  }
}

function paintSky(ctx) {
  const bg = images.get('cloud/' + sky.background.file);
  const scale = Math.max(750 / bg.width, 1334 / bg.height);
  const left = (750 - bg.width * scale) / 2, top = 1334 - bg.height * scale;
  ctx.drawImage(bg, left, top, bg.width * scale, bg.height * scale);
  const clouds = cloudCanvas.getContext('2d');
  clouds.clearRect(0, 0, bg.width, bg.height);
  for (const layer of sky.layers) {
    const [startX, y, width, height] = layer.rect;
    // The complete cloud disappears beyond the edge before entering on the other side.
    const span = bg.width + width + 32;
    const x = (startX + width + 16 + state.skyTime * layer.speed) % span - width - 16;
    clouds.globalAlpha = layer.opacity;
    clouds.drawImage(images.get('cloud/' + layer.file), x, y, width, height);
  }
  clouds.globalAlpha = 1;
  clouds.globalCompositeOperation = 'destination-in';
  clouds.drawImage(images.get('cloud/' + sky.mask.file), 0, 0);
  clouds.globalCompositeOperation = 'source-over';
  ctx.drawImage(cloudCanvas, left, top, bg.width * scale, bg.height * scale);
}

function paintHome() {
  const ctx = stage.getContext('2d');
  ctx.clearRect(0, 0, 750, 1334); paintSky(ctx);
  const heroWidth = 470, heroTop = 1334 - 145 - heroWidth * 1507 / 1024;
  const shoeLeft = 185 + heroWidth * 450 / 1024 - 129;
  const logoHeight = 560 * 732 / 1381, logoTop = heroTop - 136 - logoHeight - 12;
  drawImage(ctx, 'home_r10_airship', 9, logoTop + 102, 112, undefined, -10);
  drawImage(ctx, 'home_r10_airplane', 645, logoTop + 296, 99, undefined, 22);
  paintSign(ctx);
  ctx.drawImage(hero, 185, heroTop, heroWidth, heroWidth * 1536 / 1024);
  drawImage(ctx, 'home_r9_slipper', shoeLeft - 45, heroTop - 136, 144, undefined, -6);
  drawImage(ctx, 'home_r9_slipper', shoeLeft, heroTop - 121, 194);
  drawImage(ctx, 'home_r10_logo', 95, logoTop, 560);
  drawImage(ctx, 'btn_settings_icon', 657, 25, 67, 67);
  drawImage(ctx, 'btn_start', 97, 1131, 556, 556 * 210 / 594);
}

function paintSign(ctx) {
  ctx.save(); ctx.translate(22 + 113, 1334 * .49 + 155); ctx.rotate(-7 * Math.PI / 180);
  const image = images.get(ART + 'home_r9_sign.png');
  ctx.drawImage(image, -113, -155, 226, 310);
  ctx.fillStyle = '#33496a'; ctx.font = 'bold 23px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = '#fff5d466'; ctx.shadowOffsetY = 1;
  ['平凡的东西', '也能创造', '不平凡的高度！'].forEach((line, i) => ctx.fillText(line, 1, -18 + (i - 1) * 35.65));
  ctx.restore();
}

function paintDetail(id, rect) {
  const canvas = document.getElementById(id), ctx = canvas.getContext('2d');
  ctx.fillStyle = '#c5e7f7'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  const [x, y, width, height] = rect;
  const scale = Math.min(canvas.width / width, canvas.height / height);
  ctx.drawImage(hero, x, y, width, height, (canvas.width - width * scale) / 2,
    (canvas.height - height * scale) / 2, width * scale, height * scale);
}

function paint() {
  paintHero(); paintHome();
  paintDetail('hand-detail', sequence.details.hand);
  paintDetail('eye-detail', sequence.details.eye);
  document.querySelector('#time').textContent = `${state.time.toFixed(2)} 秒`;
  document.querySelector('#seek').value = state.time;
}

function animate(now) {
  const dt = Math.min((now - previous) / 1000, .05); previous = now;
  if (sequence && state.playing && !document.hidden) {
    state.time += dt * state.speed;
    state.skyTime += dt * state.speed;
    if (state.time >= sequence.duration) {
      if (state.loop) state.time %= sequence.duration;
      else { state.time = sequence.duration; state.playing = false; syncPause(); }
    }
    paint();
  }
  requestAnimationFrame(animate);
}

function syncPause() {
  document.querySelector('#pause').textContent = state.playing ? '暂停' : '继续播放';
}

async function start() {
  const [response, skyResponse] = await Promise.all([
    fetch('sequence.json?revision=livelier-r1'), fetch('cloud/manifest.json?revision=livelier-r1')]);
  if (!response.ok || !skyResponse.ok) throw new Error('动作素材仍在准备，请稍后刷新。');
  const prepared = await response.json();
  const preparedSky = await skyResponse.json();
  const names = ['home_r10_airship', 'home_r10_airplane',
    'home_r9_sign', 'home_r9_hero', 'home_r9_slipper', 'home_r10_logo', 'btn_settings_icon', 'btn_start'];
  const urls = new Set(names.map(name => ART + name + '.png'));
  prepared.layers.forEach(layer => layer.frames.forEach(frame => { if (frame.file) urls.add(frame.file); }));
  [preparedSky.background, preparedSky.mask, ...preparedSky.layers].forEach(layer => urls.add('cloud/' + layer.file));
  await Promise.all(Array.from(urls).map(loadImage));
  sky = preparedSky;
  cloudCanvas.width = sky.background.width; cloudCanvas.height = sky.background.height;
  sequence = prepared;
  document.querySelector('#seek').max = sequence.duration;
  ['replay', 'pause', 'seek'].forEach(id => { document.getElementById(id).disabled = false; });
  document.querySelector('#status').textContent = '请先看正常速度的双眨眼与探手；多看一轮，观察云的连续移动。';
  syncPause(); paint();
  // Review-only access: deterministic inspection without editing the sequence or images.
  window.sampleQA = { state, sequence, sky, paint, hero,
    seek: time => { state.time = Math.max(0, Math.min(sequence.duration, time)); state.skyTime = state.time;
      state.playing = false; syncPause(); paint(); } };
}

document.querySelector('#replay').addEventListener('click', () => { state.time = 0; state.skyTime = 0; state.playing = true; syncPause(); paint(); });
document.querySelector('#pause').addEventListener('click', () => { state.playing = !state.playing; syncPause(); });
document.querySelector('#speed').addEventListener('change', event => { state.speed = Number(event.target.value); });
document.querySelector('#loop').addEventListener('change', event => { state.loop = event.target.checked; });
document.querySelector('#seek').addEventListener('input', event => { state.time = Number(event.target.value); state.skyTime = state.time;
  state.playing = false; syncPause(); paint(); });
start().catch(error => { const status = document.querySelector('#status'); status.textContent = error.message; status.classList.add('error'); });
requestAnimationFrame(animate);
