// node tests/engine/styles.test.js
// The 7 grades (PLAN.md 5.5) and the one-camera finish (6.4) on small synthetic images, plus speed.
const assert = require("assert");
const T = require("./load.js"), PB = T.PB, test = T.test, makeImage = T.makeImage;

function copyOf(img) { return { width: img.width, height: img.height, data: new Uint8ClampedArray(img.data) }; }
function flat(w, h, r, g, b) { return makeImage(w, h, function () { return [r, g, b]; }); }
function px(img, x, y) { const p = (y * img.width + x) * 4; return [img.data[p], img.data[p + 1], img.data[p + 2]]; }
function luma(c) { return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]; }
function grade(id, img, scale) { PB.styles.grade(id, img.data, img.width, img.height, scale || 1); return img; }
function grey(v) { return flat(64, 48, v, v, v); }
function std(img) { let s = 0, s2 = 0, n = img.width * img.height; for (let i = 0; i < img.data.length; i += 4) { s += img.data[i + 1]; s2 += img.data[i + 1] * img.data[i + 1]; } const m = s / n; return Math.sqrt(Math.max(0, s2 / n - m * m)); }

test("Classic: black and white, black point 4%, white point 96%, an S-curve", function () {
  const ramp = makeImage(256, 4, function (x) { return [x, x, x]; });
  grade("classic", ramp);
  for (let x = 0; x < 256; x++) { const c = px(ramp, x, 0); assert(c[0] === c[1] && c[1] === c[2], "grey"); }
  assert.strictEqual(px(ramp, 8, 0)[0], 0, "below 4% is black");
  assert.strictEqual(px(ramp, 250, 0)[0], 255, "above 96% is white");
  for (let x = 1; x < 256; x++) assert(px(ramp, x, 0)[0] >= px(ramp, x - 1, 0)[0], "monotonic");
  assert(px(ramp, 64, 0)[0] < 64 - 8 && px(ramp, 192, 0)[0] > 192 + 8, "shadows go down, highlights up: an S");
  const col = flat(8, 8, 255, 0, 0); grade("classic", col);
  assert.strictEqual(px(col, 0, 0)[0], px(col, 0, 0)[1], "pure red becomes grey using luma weights");
  assert(Math.abs(px(col, 0, 0)[0] - 76) < 40);
});

test("Sepia: dark brown to cream, never grey", function () {
  const ramp = makeImage(256, 4, function (x) { return [x, x, x]; });
  grade("sepia", ramp);
  const dark = px(ramp, 0, 0), light = px(ramp, 255, 0), mid = px(ramp, 128, 0);
  assert(Math.abs(dark[0] - 43) <= 2 && Math.abs(dark[1] - 26) <= 2 && Math.abs(dark[2] - 14) <= 2, "#2b1a0e " + dark);
  assert(Math.abs(light[0] - 243) <= 2 && Math.abs(light[1] - 227) <= 2 && Math.abs(light[2] - 196) <= 2, "#f3e3c4 " + light);
  for (let x = 0; x < 256; x += 5) { const c = px(ramp, x, 0); assert(c[0] >= c[1] && c[1] >= c[2], "r >= g >= b at " + x); }
  assert(mid[0] - mid[2] > 40, "a real brown in the middle " + mid);
});

test("Flash: the centre is lifted and the corners fall away (about +18% to -25%)", function () {
  const img = grey(110); grade("flash", img);
  const centre = luma(px(img, 32, 24)), corner = luma(px(img, 0, 0));
  assert(centre > corner * 1.5, "centre " + centre + " corner " + corner);
  const cool = flat(64, 48, 128, 128, 128); grade("flash", cool);
  const c = px(cool, 32, 24); assert(c[0] < c[2], "slightly cool: R below B " + c);
  const crush = grey(30); grade("flash", crush); assert(luma(px(crush, 32, 24)) < 25, "shadows are crushed");
});

test("Faded: black point 15%, no real white, low contrast, cyan shadows, warm-pink highlights", function () {
  const black = grey(0), white = grey(255);
  grade("faded", black); grade("faded", white);
  assert(luma(px(black, 32, 24)) >= 36, "blacks are lifted: " + luma(px(black, 32, 24)));
  assert(luma(px(white, 32, 24)) <= 240, "whites are dull");
  const sh = px(black, 32, 24); assert(sh[2] > sh[0] + 4, "cyan-ish shadows (blue/green over red): " + sh);
  const hi = px(white, 32, 24); assert(hi[0] > hi[2], "warm-pink highlights (red over blue): " + hi);
  const ramp = makeImage(256, 4, function (x) { return [x, x, x]; }); grade("faded", ramp);
  assert(luma(px(ramp, 255, 0)) - luma(px(ramp, 0, 0)) < 255 * 0.78, "the whole range is compressed");
  const c = flat(8, 8, 220, 40, 40); grade("faded", c);
  const o = px(c, 0, 0); assert((Math.max.apply(null, o) - Math.min.apply(null, o)) < 180 * 0.8, "saturation drops");
});

test("Warm film: lifted blacks (8%), warm highlights, a red halation around bright areas", function () {
  const black = grey(0); grade("film", black);
  assert(luma(px(black, 32, 24)) >= 18 && luma(px(black, 32, 24)) <= 30, "lifted to about 8%: " + luma(px(black, 32, 24)));
  const mid = grey(150); grade("film", mid);
  const m = px(mid, 32, 24); assert(m[0] > m[2] + 5, "R up, B down: " + m);
  // a bright block on a dark field: the dark pixels just outside it pick up red
  const img = makeImage(120, 90, function (x, y) { return (x > 50 && x < 70 && y > 35 && y < 55) ? [250, 250, 250] : [20, 20, 20]; });
  const plain = grey(20); grade("film", plain);
  grade("film", img);
  const near = px(img, 46, 45), far = px(img, 2, 2), ref = px(plain, 2, 2);
  assert(near[0] - near[2] > far[0] - far[2] + 2, "red halo near the highlight " + near + " vs " + far);
  assert.deepStrictEqual(far, ref, "far from highlights nothing changes");
});

test("Four-cut: brighter, softer contrast, a bloom, a little pink", function () {
  const mid = grey(120); grade("fourcut", mid);
  const m = px(mid, 32, 24); assert(luma(m) > 130, "brighter: " + m); assert(m[0] > m[1], "pink tint " + m);
  const edge = makeImage(120, 90, function (x) { return x > 60 ? [235, 235, 235] : [40, 40, 40]; });
  const ref = copyOf(edge); grade("fourcut", edge); grade("fourcut", grey(40));
  const dark = px(edge, 56, 45); // just inside the dark side: bloom from the bright side lifts it
  const darkFlat = px(ref, 56, 45);
  assert(luma(dark) > luma(darkFlat) + 5, "bloom lifts the dark side of an edge: " + dark);
});

test("Disposable: more saturation, warm, green in the shadows, clipped highlights", function () {
  const col = flat(8, 8, 180, 120, 90), orig = copyOf(col); grade("disposable", col);
  const a = px(col, 0, 0), b = px(orig, 0, 0);
  assert((Math.max.apply(null, a) - Math.min.apply(null, a)) > (Math.max.apply(null, b) - Math.min.apply(null, b)), "more colour");
  const sh = grey(25); grade("disposable", sh);
  const s = px(sh, 32, 24); assert(s[1] > s[0] && s[1] >= s[2], "green shadows " + s);
  const hi = grey(245); grade("disposable", hi); assert(luma(px(hi, 32, 24)) >= 252, "highlights are clipped");
  const w = grey(128); grade("disposable", w); const wc = px(w, 32, 24); assert(wc[0] > wc[2], "warm");
});

test("every grade keeps the picture alive: values stay in range, alpha stays 255, the mean stays sensible", function () {
  PB.STYLES.forEach(function (st) {
    const img = makeImage(64, 48, function (x, y) { return [x * 4, y * 5, (x + y) * 2]; });
    grade(st.id, img);
    let sum = 0;
    for (let i = 0; i < img.data.length; i += 4) { assert.strictEqual(img.data[i + 3], 255); sum += luma([img.data[i], img.data[i + 1], img.data[i + 2]]); }
    const mean = sum / (64 * 48);
    assert(mean > 40 && mean < 230, st.id + " mean " + mean);
  });
});

test("the finish: deterministic from the seed, different grain on each frame, amplitude follows the style", function () {
  const mk = function () { return grey(128); };
  const a = mk(), b = mk(), c = mk(), d = mk();
  PB.styles.finish(a.data, 64, 48, { scale: 1, seed: 5, frame: 0, grain: 0.06, vignette: 0, mono: true });
  PB.styles.finish(b.data, 64, 48, { scale: 1, seed: 5, frame: 0, grain: 0.06, vignette: 0, mono: true });
  PB.styles.finish(c.data, 64, 48, { scale: 1, seed: 5, frame: 1, grain: 0.06, vignette: 0, mono: true });
  PB.styles.finish(d.data, 64, 48, { scale: 1, seed: 6, frame: 0, grain: 0.06, vignette: 0, mono: true });
  assert.deepStrictEqual(Array.from(a.data), Array.from(b.data), "same seed, same frame: same grain");
  assert.notDeepStrictEqual(Array.from(a.data), Array.from(c.data), "another frame reads another part of the same grain");
  assert.notDeepStrictEqual(Array.from(a.data), Array.from(d.data), "another strip, another grain");
  const sdA = std(a);
  assert(sdA > 3 && sdA < 16, "grain std on mid grey " + sdA.toFixed(1) + " (6% should be visible, not snow)");
  const lo = grey(128); PB.styles.finish(lo.data, 64, 48, { scale: 1, seed: 5, frame: 0, grain: 0.03, vignette: 0, mono: true });
  assert(std(lo) < sdA * 0.7, "less grain, less noise");
  const none = grey(128); PB.styles.finish(none.data, 64, 48, { scale: 1, seed: 5, frame: 0, grain: 0, vignette: 0, mono: true });
  assert(std(none) < 5 && std(none) < sdA, "no grain leaves only the slow development unevenness: " + std(none).toFixed(2));
});

test("the finish: a vignette darkens the corners by about its amount, softening blurs by a hair", function () {
  const wide = flat(100, 80, 200, 200, 200);
  PB.styles.finish(wide.data, 100, 80, { scale: 1, seed: 3, frame: 0, grain: 0, vignette: 0.25, mono: true });
  const corner = px(wide, 4, 4)[0], centre = px(wide, 50, 40)[0];
  assert(centre > corner * 1.12, "corner " + corner + " centre " + centre);
  const edge = makeImage(40, 10, function (x) { return x < 20 ? [0, 0, 0] : [255, 255, 255]; });
  PB.styles.finish(edge.data, 40, 10, { scale: 1, seed: 3, frame: 0, grain: 0, vignette: 0, mono: true });
  const a = px(edge, 19, 5)[0], b = px(edge, 20, 5)[0];
  assert(a > 5 && b < 250, "a 0.6 px blur softens a hard edge: " + a + " / " + b);
  assert(a < 100 && b > 150, "but only by a hair");
});

test("blurPlane: a soft blur that keeps the total light", function () {
  const w = 120, h = 90, plane = new Float32Array(w * h);
  for (let y = 40; y < 50; y++) for (let x = 55; x < 65; x++) plane[y * w + x] = 1;
  const out = PB.styles.blurPlane(plane, w, h, 8);
  let a = 0, b = 0; for (let i = 0; i < plane.length; i++) { a += plane[i]; b += out[i]; }
  assert(Math.abs(a - b) / a < 0.06, "mass kept: " + a + " " + b);
  assert(out[45 * w + 60] < 0.9 && out[45 * w + 45] > 0.001, "spread out");
  assert.strictEqual(PB.styles.blurPlane(plane, w, h, 0.2), plane, "a tiny sigma is a no-op");
});

test("paper colours and stamp ink: the style's own, the five choices, white ink on black", function () {
  assert.strictEqual(PB.styles.paperHex("classic", "auto"), "#f7f5f0");
  assert.strictEqual(PB.styles.paperHex("film", "auto"), "#f1e8d6");
  assert.strictEqual(PB.styles.paperHex("flash", "auto"), "#141414");
  assert.strictEqual(PB.styles.paperHex("faded", "auto"), "#efe2bf");
  assert.strictEqual(PB.styles.paperHex("fourcut", "auto"), "#f6d6dc");
  assert.strictEqual(PB.styles.paperHex("sepia", "auto"), "#efe6d2");
  assert.strictEqual(PB.styles.paperHex("disposable", "auto"), "#f7f5f0");
  assert.strictEqual(PB.styles.paperHex("film", "black"), "#141414");
  assert.strictEqual(PB.styles.paperHex("film", "pink"), "#f6d6dc");
  assert.strictEqual(PB.styles.paperHex("film", "blue"), "#d5e3f2");
  assert.strictEqual(PB.styles.paperHex("nope", "nope"), "#f7f5f0");
  assert.strictEqual(PB.styles.inkFor("#141414").dark, true);
  assert.strictEqual(PB.styles.inkFor("#f7f5f0").dark, false);
  assert.strictEqual(PB.styles.inkFor("#d5e3f2").dark, false);
  assert.strictEqual(PB.styles.get("fourcut").radius, 18); assert.strictEqual(PB.styles.get("sepia").radius, 8);
});

test("speed: one frame (grade + finish) for every style, full size and half size", function () {
  const lines = [];
  PB.STYLES.forEach(function (st) {
    const full = makeImage(510, 383, function (x, y) { return [(x * 0.5) & 255, (y * 0.6) & 255, ((x + y) * 0.3) & 255]; });
    const half = makeImage(255, 192, function (x, y) { return [(x) & 255, (y) & 255, ((x + y) * 0.6) & 255]; });
    PB.styles.process(st.id, new Uint8ClampedArray(full.data), 510, 383, { scale: 1, seed: 1, frame: 0 }); // warm up (builds the tables)
    let t0 = PB.util.now();
    for (let i = 0; i < 4; i++) PB.styles.process(st.id, new Uint8ClampedArray(full.data), 510, 383, { scale: 1, seed: 1, frame: i });
    const tFull = (PB.util.now() - t0);
    t0 = PB.util.now();
    for (let i = 0; i < 4; i++) PB.styles.process(st.id, new Uint8ClampedArray(half.data), 255, 192, { scale: 0.5, seed: 1, frame: i });
    const tHalf = (PB.util.now() - t0);
    lines.push(st.id.padEnd(11) + " 4 frames full " + tFull.toFixed(1).padStart(6) + " ms   half " + tHalf.toFixed(1).padStart(6) + " ms");
    assert(tHalf < 120, st.id + " half-size style change in Node took " + tHalf + " ms (target well under 60 here)");
  });
  console.log("     " + lines.join("\n     "));
});

T.done();
