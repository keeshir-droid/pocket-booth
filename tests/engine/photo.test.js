// node tests/engine/photo.test.js
// Framing maths (auto-crop, clamp, the crop rectangle) and matching (PLAN.md 6.4) on tiny synthetic images.
const assert = require("assert");
const T = require("./load.js"), PB = T.PB, test = T.test, testAsync = T.testAsync, makeImage = T.makeImage;

const A = 510 / 383;
function fakePhoto(w, h) { return { id: 1, width: w, height: h, live: false }; }

test("auto-crop: centred left to right, 40% from the top, zoom 1", function () {
  const land = PB.photo.autoCrop(fakePhoto(4000, 3000)); // a wide photo: the window is full height, so only x is free (and it is centred)
  assert.strictEqual(land.zoom, 1); assert(Math.abs(land.cx - 0.5) < 1e-9);
  const port = PB.photo.autoCrop(fakePhoto(3000, 4000)); // a portrait photo: the window is a band; 40% down
  assert(Math.abs(port.cx - 0.5) < 1e-9); assert(Math.abs(port.cy - 0.4) < 1e-9, "cy " + port.cy);
  const r = PB.photo.cropRect(fakePhoto(3000, 4000), port);
  assert(Math.abs(r.sw / r.sh - A) < 1e-9 && Math.abs(r.sw - 3000) < 1e-6, "covers the width");
  assert(Math.abs((r.sy + r.sh / 2) / 4000 - 0.4) < 1e-9, "centred 40% down");
});

test("auto-crop on a photo already of the frame's shape, and a tall panorama: stays inside the photo", function () {
  [[510, 383], [800, 100], [100, 900], [1, 1], [2000, 1999]].forEach(function (wh) {
    const p = fakePhoto(wh[0], wh[1]), c = PB.photo.autoCrop(p), r = PB.photo.cropRect(p, c);
    assert(r.sx >= -1e-9 && r.sy >= -1e-9 && r.sx + r.sw <= wh[0] + 1e-9 && r.sy + r.sh <= wh[1] + 1e-9, wh + " " + JSON.stringify(r));
    assert(Math.abs(r.sw / r.sh - A) < 1e-9, "the frame's shape");
  });
});

test("clampCrop: zoom 1..8, the window never leaves the photo, junk becomes a sane crop", function () {
  const p = fakePhoto(4000, 3000);
  let c = PB.photo.clampCrop(p, { cx: -3, cy: 9, zoom: 0.2 });
  assert.strictEqual(c.zoom, 1);
  c = PB.photo.clampCrop(p, { cx: 0, cy: 0, zoom: 4 });
  const r = PB.photo.cropRect(p, c);
  assert(Math.abs(r.sx) < 1e-6 && Math.abs(r.sy) < 1e-6, "pinned to the top left corner");
  assert(Math.abs(r.sw - 4000 * 0 - (3000 * A) / 4) < 1e-6, "zoom 4 is a quarter of the cover width");
  c = PB.photo.clampCrop(p, { cx: 1, cy: 1, zoom: 4 });
  const r2 = PB.photo.cropRect(p, c);
  assert(Math.abs(r2.sx + r2.sw - 4000) < 1e-6 && Math.abs(r2.sy + r2.sh - 3000) < 1e-6, "pinned to the bottom right");
  assert.strictEqual(PB.photo.clampCrop(p, { zoom: 99 }).zoom, PB.photo.MAX_ZOOM);
  const j = PB.photo.clampCrop(p, { cx: NaN, cy: undefined, zoom: "x" });
  assert(isFinite(j.cx) && isFinite(j.cy) && j.zoom === 1);
  assert.deepStrictEqual(PB.photo.clampCrop(p, PB.photo.clampCrop(p, { cx: 0.3, cy: 0.7, zoom: 2.5 })), PB.photo.clampCrop(p, { cx: 0.3, cy: 0.7, zoom: 2.5 }), "idempotent");
});

test("statistics: percentiles and means of a known image", function () {
  const img = makeImage(100, 100, function (x) { return [x * 2, x * 2, x * 2]; }); // luma 0..198 across
  const s = PB.photo.statistics(img);
  assert(Math.abs(s.luma.p50 - 99 / 255) < 0.02, "median " + s.luma.p50);
  assert(s.luma.p1 < 0.02 && s.luma.p99 > 0.75);
  assert(Math.abs(s.mean.r - s.mean.g) < 1e-9 && Math.abs(s.mean.g - s.mean.b) < 1e-9);
  assert(s.contrast > 0.7);
});

function medianLuma(img) { return PB.photo.statistics(img).luma.p50; }
function ramp(lo, hi, tint) {
  return makeImage(160, 100, function (x, y) { const v = lo + (hi - lo) * (x / 159); return [v * tint[0], v * tint[1], v * tint[2]]; });
}

test("matching pulls a dark, flat photo toward the middle (median toward 0.48)", function () {
  const dark = ramp(10, 90, [1, 1, 1]);
  const before = medianLuma(dark);
  const params = PB.photo.matchPixels(dark.data, dark.width, dark.height, 1);
  const after = medianLuma(dark);
  assert(after > before + 0.1, "brighter: " + before + " -> " + after);
  assert(Math.abs(after - 0.48) < Math.abs(before - 0.48), "closer to 0.48");
  assert(params.gain <= 2.2 + 1e-9, "the stretch is capped so a dim photo's noise is not blown up");
});

test("matching pulls a bright, washed-out photo down", function () {
  const bright = ramp(170, 250, [1, 1, 1]);
  const before = medianLuma(bright);
  PB.photo.matchPixels(bright.data, bright.width, bright.height, 1);
  const after = medianLuma(bright);
  assert(after < before - 0.05, before + " -> " + after);
});

test("matching pulls a strong colour cast toward neutral, but not all the way (blend 50%, gains 0.8..1.25)", function () {
  const warm = ramp(40, 220, [1.0, 0.82, 0.55]);
  const mean = function (img) { const s = PB.photo.statistics(img).mean; return s; };
  const b = mean(warm);
  const params = PB.photo.matchPixels(warm.data, warm.width, warm.height, 1);
  const a = mean(warm);
  const castBefore = b.r / b.b, castAfter = a.r / a.b;
  assert(castAfter < castBefore, "less orange: " + castBefore + " -> " + castAfter);
  assert(castAfter > 1.0, "still a little warm (matching is a blend)");
  [params.gains.r, params.gains.g, params.gains.b].forEach(function (g) { assert(g >= 0.825 - 1e-9 && g <= 1.231 + 1e-9, "blended gain " + g); });
});

test("matching leaves a grey photo grey and a good photo almost alone", function () {
  const grey = ramp(10, 245, [1, 1, 1]);
  PB.photo.matchPixels(grey.data, grey.width, grey.height, 1);
  for (let i = 0; i < grey.data.length; i += 4) assert(grey.data[i] === grey.data[i + 1] && grey.data[i + 1] === grey.data[i + 2], "stays neutral");
  const good = ramp(8, 248, [1, 1, 1]); // full range, median in the middle
  const copy = new Uint8ClampedArray(good.data);
  PB.photo.matchPixels(good.data, good.width, good.height, 1);
  let worst = 0; for (let i = 0; i < copy.length; i += 4) worst = Math.max(worst, Math.abs(copy[i] - good.data[i]));
  assert(worst < 20, "a well exposed photo barely moves: " + worst);
});

test("live shots get half-strength matching", function () {
  const a = ramp(10, 90, [1, 0.9, 0.7]), b = ramp(10, 90, [1, 0.9, 0.7]);
  PB.photo.matchPixels(a.data, a.width, a.height, 1);
  PB.photo.matchPixels(b.data, b.width, b.height, 0.5);
  const orig = ramp(10, 90, [1, 0.9, 0.7]);
  const ma = medianLuma(a), mb = medianLuma(b), mo = medianLuma(orig);
  assert(mo < mb && mb < ma, mo + " < " + mb + " < " + ma);
  const none = ramp(10, 90, [1, 0.9, 0.7]);
  PB.photo.matchPixels(none.data, none.width, none.height, 0);
  assert.deepStrictEqual(Array.from(none.data), Array.from(orig.data), "strength 0 changes nothing");
});

test("matching brings four mismatched photos closer together", function () {
  const set = [ramp(5, 70, [1, 0.8, 0.5]), ramp(120, 255, [0.8, 0.9, 1]), ramp(0, 255, [1, 1, 1]), ramp(60, 130, [0.7, 1, 0.8])];
  const med = function (list) { const m = list.map(medianLuma); return Math.max.apply(null, m) - Math.min.apply(null, m); };
  const spreadBefore = med(set);
  set.forEach(function (img) { PB.photo.matchPixels(img.data, img.width, img.height, 1); });
  const spreadAfter = med(set);
  assert(spreadAfter < spreadBefore * 0.6, "median spread " + spreadBefore.toFixed(3) + " -> " + spreadAfter.toFixed(3));
});

testAsync("PB.photo.from works on ImageData with no canvas (Node) and reports its size and live flag", async function () {
  const img = makeImage(40, 30, function () { return [100, 120, 140]; });
  const p = await PB.photo.from(img, { live: true });
  assert.strictEqual(p.width, 40); assert.strictEqual(p.height, 30); assert.strictEqual(p.live, true);
  assert(p.id > 0); assert(Math.abs(p.stats().luma.p50 - 0.45) < 0.05);
  const q = await PB.photo.from(img, {});
  assert.strictEqual(q.live, false); assert(q.id !== p.id);
}).then(T.done);
