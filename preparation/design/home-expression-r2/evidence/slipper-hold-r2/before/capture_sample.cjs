'use strict';
const { chromium } = require('/Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const ROOT = __dirname, OUT = path.join(ROOT, 'evidence/slipper-grab-r1');
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const url = 'http://127.0.0.1:8767/preparation/design/home-expression-r2/index.html?revision=slipper-grab-r1';
const report = { createdAt: new Date().toISOString(), url, checks: [], errors: [],
  boundary: 'Independent browser art sample. No Cocos or WeChat build/acceptance is claimed.' };
const check = (name, pass, data) => report.checks.push({ name, pass: !!pass, data });
let browser;

async function record(speed) {
  const context = await browser.newContext({ viewport: { width: 375, height: 667 },
    recordVideo: { dir: path.join(OUT, 'raw-video'), size: { width: 375, height: 667 } } });
  const page = await context.newPage();
  page.on('pageerror', error => report.errors.push(String(error)));
  await page.goto(url + '&capture=phone');
  await page.waitForFunction(() => window.sampleQA);
  await page.evaluate(speed => {
    sampleQA.seek(0); sampleQA.state.speed = speed; sampleQA.state.playing = true;
  }, speed);
  const snapshots = await page.evaluate(speed => new Promise(resolve => {
    const frames = [], start = performance.now(), length = speed === 1 ? 18 : sampleQA.sequence.duration / sampleQA.state.speed;
    const read = now => {
      frames.push({ wall: (now - start) / 1000, scene: sampleQA.state.time, sky: sampleQA.state.skyTime });
      if (now - start >= length * 1000) resolve(frames); else requestAnimationFrame(read);
    };
    requestAnimationFrame(read);
  }), speed);
  check(`normal_clock_advances_${speed}`, snapshots.length > 80 && snapshots.some(s => s.scene > 4),
    { renderedFrames: snapshots.length, wallSeconds: snapshots.at(-1).wall });
  const wraps = snapshots.slice(1).map((s, i) => ({ before: snapshots[i], after: s }))
    .filter(pair => pair.after.scene < pair.before.scene);
  check(`cloud_clock_continues_across_actor_loops_${speed}`,
    wraps.length > 0 && wraps.every(pair => pair.after.sky >= pair.before.sky), { loops: wraps.length });
  const video = page.video(); await context.close();
  const file = speed === 1 ? 'sample-normal-raw.webm' : 'sample-half-speed-raw.webm';
  await video.saveAs(path.join(OUT, file));
  return { speed, file, snapshots };
}

async function inspect() {
  const page = await browser.newPage({ viewport: { width: 1186, height: 863 } });
  page.on('pageerror', error => report.errors.push(String(error)));
  await page.goto(url); await page.waitForFunction(() => window.sampleQA);
  const sequence = await page.evaluate(() => sampleQA.sequence);
  report.sequenceSha256 = hash(path.join(ROOT, 'sequence.json'));
  report.assetHashes = {};
  for (const layer of sequence.layers) for (const frame of layer.frames) {
    if (frame.file) report.assetHashes[frame.file] = hash(path.join(ROOT, frame.file));
  }
  check('finished_frames_loaded', Object.keys(report.assetHashes).length > 12, { files: Object.keys(report.assetHashes).length });
  report.slipperPixels = await page.evaluate(() => {
    const canvas = document.querySelector('#phone'), ctx = canvas.getContext('2d');
    const at = time => {
      sampleQA.seek(time); sampleQA.state.skyTime = 0; sampleQA.paint();
      return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    };
    const rest = at(0), effort = at(sampleQA.sequence.reviewTimes.slipper_effort);
    const ended = at(sampleQA.sequence.duration - .01);
    let changed = 0, outsideLocalParts = 0, endResidue = 0;
    const rects = sampleQA.sequence.layers.filter(layer => layer.space === 'stage').map(layer => layer.rect);
    for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
      const i = (y * canvas.width + x) * 4;
      const different = [0, 1, 2].some(c => Math.abs(rest[i + c] - effort[i + c]) > 2);
      if (different) {
        changed++;
        if (!rects.some(([left, top, width, height]) => x >= left - 1 && x <= left + width + 1 && y >= top - 1 && y <= top + height + 1)) outsideLocalParts++;
      }
      if ([0, 1, 2].some(c => Math.abs(rest[i + c] - ended[i + c]) > 2)) endResidue++;
    }
    return { changed, outsideLocalParts, endResidue };
  });
  check('slipper_gesture_visible_without_moving_body', report.slipperPixels.changed > 500 && report.slipperPixels.outsideLocalParts === 0, report.slipperPixels);
  check('slipper_retracts_without_residual_hands_or_face', report.slipperPixels.endResidue === 0);
  const sky = await page.evaluate(() => sampleQA.sky);
  for (const layer of [sky.background, sky.mask, ...sky.layers]) {
    report.assetHashes['cloud/' + layer.file] = hash(path.join(ROOT, 'cloud', layer.file));
  }
  report.cloudPixels = await page.evaluate(() => {
    const canvas = document.querySelector('#phone'), ctx = canvas.getContext('2d');
    const pixels = time => {
      sampleQA.seek(0); sampleQA.state.skyTime = time; sampleQA.paint();
      return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    };
    const first = pixels(0), later = pixels(6);
    let visibleSkyChanged = 0, lowerImageChanged = 0;
    for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
      const i = (y * canvas.width + x) * 4;
      const changed = Math.max(...[0, 1, 2].map(c => Math.abs(first[i + c] - later[i + c]))) > 3;
      if (changed) { if (y < 340) visibleSkyChanged++; else lowerImageChanged++; }
    }
    // The right cloud leaves fully at 25.9s. Pixel continuity catches an in-frame wrap jump.
    const beforeWrap = pixels(25.89), afterWrap = pixels(25.91);
    let wrapDelta = 0;
    for (let i = 0; i < beforeWrap.length; i += 4) for (let c = 0; c < 3; c++) {
      wrapDelta += Math.abs(beforeWrap[i + c] - afterWrap[i + c]);
    }
    return { visibleSkyChanged, lowerImageChanged, wrapMeanRgbDelta: wrapDelta / (canvas.width * canvas.height * 3) };
  });
  check('visible_cloud_pixels_move', report.cloudPixels.visibleSkyChanged > 1000, report.cloudPixels);
  check('city_and_hero_stay_fixed', report.cloudPixels.lowerImageChanged === 0);
  check('offscreen_cloud_wrap_has_no_visible_jump', report.cloudPixels.wrapMeanRgbDelta < .1);
  for (const time of [0, 6, 12]) {
    await page.evaluate(time => { sampleQA.seek(0); sampleQA.state.skyTime = time; sampleQA.paint(); }, time);
    await page.locator('#phone').screenshot({ path: path.join(OUT, `cloud-${time}s-phone.png`) });
  }
  report.keyframes = [];
  for (const [name, time] of Object.entries(sequence.reviewTimes)) {
    await page.evaluate(time => sampleQA.seek(time), time);
    await page.locator('#phone').screenshot({ path: path.join(OUT, name + '-phone.png') });
    await page.locator('#hand-detail').screenshot({ path: path.join(OUT, name + '-hand.png') });
    await page.locator('#eye-detail').screenshot({ path: path.join(OUT, name + '-eye.png') });
    if (name.startsWith('slipper_')) await page.locator('#slipper-detail').screenshot({ path: path.join(OUT, name + '-slipper.png') });
    report.keyframes.push({ name, time });
  }
  await page.evaluate(() => sampleQA.seek(0));
  await page.getByRole('button', { name: '重新播放' }).click();
  await page.waitForTimeout(330); await page.getByRole('button', { name: '暂停', exact: true }).click();
  const frozen = await page.evaluate(() => sampleQA.state.time);
  await page.waitForTimeout(120);
  check('pause_and_replay_controls_work', await page.evaluate(t => !sampleQA.state.playing && sampleQA.state.time === t && t > 0, frozen));
  await page.locator('#speed').selectOption('0.5');
  check('slow_motion_control_works', await page.evaluate(() => sampleQA.state.speed === .5));
  await page.evaluate(time => sampleQA.seek(time), sequence.reviewTimes.slipper_effort);
  await page.screenshot({ path: path.join(OUT, 'review-page.png'), fullPage: true });
  await page.close();
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  try {
    browser = await chromium.launch({ headless: true });
    await inspect(); report.recordings = [await record(1), await record(.5)];
    const baseline = JSON.parse(fs.readFileSync(path.join(ROOT, 'BASELINE.json'))).inputs;
    const project = path.resolve(ROOT, '../../..');
    const changed = Object.entries(baseline).filter(([file, expected]) => hash(path.join(project, file)) !== expected).map(([file]) => file);
    check('production_inputs_unchanged', changed.length === 0, { protectedInputs: Object.keys(baseline).length, changed });
    report.status = report.errors.length || report.checks.some(c => !c.pass) ? 'failed' : 'technical_checks_passed_visual_review_separate';
  } catch (error) { report.status = 'failed'; report.failure = String(error.stack || error); }
  finally {
    await browser?.close();
    fs.writeFileSync(path.join(OUT, 'CAPTURE_REPORT.json'), JSON.stringify(report, null, 2) + '\n');
    process.stdout.write(JSON.stringify({ status: report.status, checks: report.checks, errors: report.errors, failure: report.failure }) + '\n');
    if (report.status === 'failed') process.exitCode = 1;
  }
})();
