// node tests/engine/print.test.js
// The print sheet layout in points (PLAN.md 6.6): paper choice, four true-size strips, margins, cut marks, the 5 cm ruler.
const assert = require("assert");
const T = require("./load.js"), PB = T.PB, test = T.test;

const MM10 = 10 / 25.4 * 72; // 10 mm in points

test("paperFor: Letter for US CA MX PH CL CO VE PR, A4 for everything else", function () {
  ["en-US", "en-us", "en_US", "en-CA", "fr-CA", "es-MX", "fil-PH", "en-PH", "es-CL", "es-CO", "es-VE", "es-PR", "es-US"].forEach(function (l) { assert.strictEqual(PB.print.paperFor(l), "letter", l); });
  ["en-GB", "en-IN", "hi-IN", "de-DE", "fr-FR", "pt-BR", "en-AU", "zh-Hans-CN", "ja-JP", "en", "", undefined, null, "es-419"].forEach(function (l) { assert.strictEqual(PB.print.paperFor(l), "a4", String(l)); });
});

function segDistToRect(m, r) { // the marks are all horizontal or vertical
  const x0 = Math.min(m.x1, m.x2), x1 = Math.max(m.x1, m.x2), y0 = Math.min(m.y1, m.y2), y1 = Math.max(m.y1, m.y2);
  const dx = Math.max(r.x - x1, x0 - (r.x + r.w), 0), dy = Math.max(r.y - y1, y0 - (r.y + r.h), 0);
  return Math.hypot(dx, dy);
}

["a4", "letter"].forEach(function (paper) {
  const L = PB.print.layout(paper);

  test(paper + ": the page size", function () {
    if (paper === "a4") { assert(Math.abs(L.page.w - 595.28) < 0.01 && Math.abs(L.page.h - 841.89) < 0.01); }
    else { assert.strictEqual(L.page.w, 612); assert.strictEqual(L.page.h, 792); }
  });

  test(paper + ": four strips, each exactly 432 x 144 pt (6 x 2 in), 18 pt apart, centred, sideways", function () {
    assert.strictEqual(L.strips.length, 4);
    L.strips.forEach(function (s, i) {
      assert.strictEqual(s.w, 432); assert.strictEqual(s.h, 144); assert.strictEqual(Math.abs(s.rotate), 90);
      if (i) assert(Math.abs(s.y - (L.strips[i - 1].y + 144 + 18)) < 1e-9, "18 pt gap");
      assert(Math.abs(s.x - (L.page.w - 432) / 2) < 1e-9, "centred left to right");
    });
    const top = L.strips[0].y, bottom = L.page.h - (L.strips[3].y + 144);
    assert(Math.abs(top - bottom) < 1e-9, "centred top to bottom");
    assert(Math.abs((L.strips[3].y + 144 - L.strips[0].y) - 630) < 1e-9, "the stack is 630 pt tall");
  });

  test(paper + ": every strip is inside the page with at least 10 mm all round", function () {
    L.strips.forEach(function (s) {
      assert(s.x >= MM10 && s.y >= MM10 && L.page.w - (s.x + s.w) >= MM10 && L.page.h - (s.y + s.h) >= MM10, JSON.stringify(s));
    });
  });

  test(paper + ": cut marks are 0.5 pt lines 12 pt long, start 4 pt outside each corner and never touch a strip", function () {
    assert.strictEqual(L.marks.length, 32);
    L.marks.forEach(function (m) {
      const len = Math.hypot(m.x2 - m.x1, m.y2 - m.y1);
      assert(Math.abs(len - 12) < 1e-9, "12 pt long");
      assert(m.x1 === m.x2 || m.y1 === m.y2, "straight");
      L.strips.forEach(function (s) { assert(segDistToRect(m, s) >= 1.9, "clear of the strip by " + segDistToRect(m, s)); });
      [m.x1, m.x2].forEach(function (x) { assert(x >= 0 && x <= L.page.w); }); [m.y1, m.y2].forEach(function (y) { assert(y >= 0 && y <= L.page.h); });
    });
    // for each strip corner there is a mark that starts exactly 4 pt away (one horizontal, one vertical)
    L.strips.forEach(function (s) {
      [[s.x, s.y], [s.x + s.w, s.y], [s.x, s.y + s.h], [s.x + s.w, s.y + s.h]].forEach(function (c) {
        const near = L.marks.filter(function (m) { return Math.min(Math.hypot(m.x1 - c[0], m.y1 - c[1]), Math.hypot(m.x2 - c[0], m.y2 - c[1])) < 4.0001 && Math.min(Math.hypot(m.x1 - c[0], m.y1 - c[1]), Math.hypot(m.x2 - c[0], m.y2 - c[1])) > 3.9999; });
        assert(near.length >= 2, "two marks 4 pt from the corner " + c);
      });
    });
  });

  test(paper + ": the ruler is 5 cm (141.73 pt), inside the page, centred, and clear of the marks", function () {
    const r = L.ruler;
    assert(Math.abs((r.x2 - r.x1) - 141.73) < 0.01, "length " + (r.x2 - r.x1));
    assert(Math.abs((r.x1 + r.x2) / 2 - L.page.w / 2) < 1e-9);
    assert(r.y > L.strips[3].y + 144 + 16 && r.y < L.page.h - 20);
    L.marks.forEach(function (m) { assert(Math.min(m.y1, m.y2) < r.y - 8 || Math.max(m.y1, m.y2) < r.y, "marks sit above the ruler"); });
  });

  test(paper + ": the two lines of text fit the page and stay off the strips and marks", function () {
    assert.strictEqual(L.texts.length, 2);
    assert(/Pocket Booth/.test(L.texts[0].text) && /Actual size/.test(L.texts[0].text) && /Cut along the marks/.test(L.texts[0].text));
    assert.strictEqual(L.texts[1].text, "This line should measure 5 cm");
    L.texts.forEach(function (t) {
      const w = PB.print.textWidth(t.text, t.size);
      assert(t.x >= 20 && t.x + w <= L.page.w - 20, "inside the page, width " + w);
      assert(Math.abs(t.x + w / 2 - L.page.w / 2) < 1e-9, "centred");
      assert.strictEqual(t.size, 9);
    });
    assert(L.texts[0].y < L.strips[0].y - 16, "the top line is above the top marks");
    assert(L.texts[1].y > L.ruler.y && L.texts[1].y < L.page.h - 12, "the ruler's label is under it and on the page");
  });
});

test("textWidth uses Helvetica metrics", function () {
  assert(Math.abs(PB.print.textWidth("Hello", 10) - 22.78) < 1e-9);
  assert(Math.abs(PB.print.textWidth("·", 1000) - 278) < 1e-9);
  assert(PB.print.textWidth("W", 9) > PB.print.textWidth("i", 9));
});

test("the print lift: mid-tones brighten (gamma 0.9), shadows rise by 3%, white stays white, monotonic", function () {
  const d = new Uint8ClampedArray(256 * 4);
  for (let i = 0; i < 256; i++) { d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = i; d[i * 4 + 3] = 255; }
  PB.print.lift(d);
  assert(Math.abs(d[0] - 8) <= 1, "black becomes about 3%: " + d[0]);
  assert.strictEqual(d[255 * 4], 255);
  assert(d[128 * 4] > 128 + 4 && d[128 * 4] < 128 + 24, "mid-grey " + d[128 * 4]);
  for (let i = 1; i < 256; i++) assert(d[i * 4] >= d[(i - 1) * 4]);
  assert.strictEqual(d[3], 255);
});

T.done();
