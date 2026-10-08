// node tests/engine/stamp.test.js
// The 5 x 7 dot-matrix font (PLAN.md 5.4): glyph coverage, shapes, measuring, and what draws with a recording context.
const assert = require("assert");
const T = require("./load.js"), PB = T.PB, test = T.test;

const WANTED = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,'!?-:&/@#♥·";

test("every glyph in PLAN.md 5.4 exists as 7 rows of 5 columns", function () {
  for (const ch of WANTED) {
    const g = PB.stamp.GLYPHS[ch];
    assert(g, "missing glyph " + ch);
    assert.strictEqual(g.length, 7, ch + " has 7 rows");
    g.forEach(function (row) { assert(/^[#.]{5}$/.test(row), ch + " row '" + row + "'"); });
  }
});

test("only space is blank, and no two letters or digits share a shape", function () {
  const seen = {};
  for (const ch of WANTED) {
    const key = PB.stamp.GLYPHS[ch].join("|");
    const blank = !/#/.test(key);
    assert.strictEqual(blank, ch === " ", ch + (blank ? " is blank" : " is not blank"));
    if (/[A-Z0-9]/.test(ch)) { assert(!seen[key], ch + " looks like " + seen[key]); seen[key] = ch; }
  }
});

test("letters touch the top and bottom rows of the grid where they should (a sanity check on a few shapes)", function () {
  const G = PB.stamp.GLYPHS;
  assert.strictEqual(G["E"][0], "#####"); assert.strictEqual(G["E"][6], "#####");
  assert.strictEqual(G["T"][0], "#####"); assert.strictEqual(G["L"][6], "#####");
  assert.strictEqual(G["0"][3], "#.#.#".replace(/./g, function (c) { return c; })); // the slashed zero's middle dot
  assert.strictEqual(G["·"][3], "..#..");
});

test("lower case is drawn as upper case; accents are folded; the rest falls back to Caveat", function () {
  assert.strictEqual(PB.stamp.normalise("riya's").text, "RIYA'S");
  assert.strictEqual(PB.stamp.normalise("Zoë café").text, "ZOE CAFE");
  assert.strictEqual(PB.stamp.supports("Riya's room · 08 OCT 2026 ♥"), true);
  assert.strictEqual(PB.stamp.supports("’curly’"), true, "curly quotes are mapped to '");
  assert.strictEqual(PB.stamp.supports("नमस्ते"), false, "Devanagari");
  assert.strictEqual(PB.stamp.supports("hello 😀"), false, "emoji");
  assert.strictEqual(PB.stamp.supports("你好"), false, "Chinese");
  assert.strictEqual(PB.stamp.supports(""), true);
});

test("measure: width grows with the text, scales with the height, and the date fits the band", function () {
  const w1 = PB.stamp.measure("A", 26), w2 = PB.stamp.measure("AA", 26), w26 = PB.stamp.measure("08 OCT 2026", 26);
  assert(w1 > 0 && w2 > w1);
  assert(Math.abs(PB.stamp.measure("AB", 52) - 2 * PB.stamp.measure("AB", 26)) < 1e-6, "linear in the height");
  assert(w26 < 510, "the date alone at 26 px fits in 510 px: " + w26);
  assert.strictEqual(PB.stamp.measure("你", 26), null, "the fallback is measured on a canvas");
  assert.strictEqual(PB.stamp.measure("", 26), 0);
});

// a recording context: counts the dots and remembers the extent
function recorder() {
  const r = { arcs: [], fillStyle: null, globalAlpha: 1, fonts: [], texts: [] };
  r.save = r.restore = r.beginPath = r.fill = function () {};
  r.arc = function (x, y, rad) { r.arcs.push({ x: x, y: y, r: rad, a: r.globalAlpha }); };
  r.fillText = function (t, x, y) { r.texts.push({ t: t, x: x, y: y }); };
  r.measureText = function (t) { return { width: t.length * 7 }; };
  Object.defineProperty(r, "font", { set: function (v) { r.fonts.push(v); }, get: function () { return ""; } });
  return r;
}

test("draw: the right number of dots, inside the glyph box, centred where asked, and stable between calls", function () {
  const ctx = recorder();
  const w = PB.stamp.draw(ctx, "I", 100, 50, 26, "#000", { align: "left" });
  let lit = 0; PB.stamp.GLYPHS["I"].forEach(function (row) { lit += (row.match(/#/g) || []).length; });
  const cores = ctx.arcs.filter(function (a, i) { return i % 2 === 1; }); // a halo then a core for every dot
  assert(cores.length <= lit && cores.length >= lit - 2, "dots " + cores.length + " of " + lit + " (a rare one may not print)");
  ctx.arcs.forEach(function (a) { assert(a.y >= 50 - 2 && a.y <= 50 + 26 + 2, "inside the box vertically " + a.y); assert(a.x >= 100 - 2 && a.x <= 100 + w + 2); });
  const again = recorder(); PB.stamp.draw(again, "I", 100, 50, 26, "#000", { align: "left" });
  assert.deepStrictEqual(again.arcs, ctx.arcs, "the same ink every time");

  const c = recorder(), wc = PB.stamp.draw(c, "HELLO", 300, 10, 20, "#000", { align: "center" });
  const xs = c.arcs.map(function (a) { return a.x; });
  assert(Math.abs((Math.min.apply(null, xs) + Math.max.apply(null, xs)) / 2 - 300) < 3, "centred on x");
  assert(Math.abs(wc - PB.stamp.measure("HELLO", 20)) < 1e-9);
  const rt = recorder(); PB.stamp.draw(rt, "AB", 500, 0, 20, "#000", { align: "right" });
  assert(Math.max.apply(null, rt.arcs.map(function (a) { return a.x; })) <= 500 + 1);
});

test("draw: non-Latin text goes to Caveat in one piece", function () {
  const ctx = recorder();
  PB.stamp.draw(ctx, "नमस्ते", 10, 10, 26, "#000");
  assert.strictEqual(ctx.arcs.length, 0, "no dots");
  assert.strictEqual(ctx.texts.length, 1);
  assert(/Caveat/.test(ctx.fonts[0]), "font: " + ctx.fonts[0]);
});

test("seven-segment: width of '26 10 08 and digits only", function () {
  const w = PB.stamp.sevenSegmentWidth("'26 10 08", 30);
  assert(w > 100 && w < 260, "width " + w);
  assert(PB.stamp.sevenSegmentWidth("00", 30) > PB.stamp.sevenSegmentWidth("0", 30));
});

T.done();
