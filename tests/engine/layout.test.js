// node tests/engine/layout.test.js
// The true 600 x 1800 geometry (PLAN.md 5.4), the constants of 7.3, and what goes in the bottom band.
const assert = require("assert");
const T = require("./load.js"), PB = T.PB, test = T.test;

test("constants match PLAN.md 7.3", function () {
  assert.deepStrictEqual(PB.STRIP, { w: 600, h: 1800, dpi: 300, margin: 45, frameW: 510, frameH: 383, gap: 30, bandY: 1667, bandH: 133 });
  assert.strictEqual(PB.FRAMES, 4);
  assert.deepStrictEqual(PB.STYLES.map(function (s) { return s.id; }), ["classic", "film", "flash", "faded", "fourcut", "sepia", "disposable"]);
  assert.deepStrictEqual(PB.STYLES.map(function (s) { return s.name; }), ["Classic", "Warm film", "Flash night", "Faded", "Four-cut", "Sepia 1950s", "Disposable"]);
  assert.deepStrictEqual(PB.PAPERS.map(function (p) { return p.id; }), ["auto", "white", "black", "pink", "blue"]);
  assert.deepStrictEqual(PB.DEFAULTS, { style: "classic", paper: "auto", caption: "", showDate: true, when: 0 });
});

test("the four frames sit on the grid: 45 px margins, 30 px gaps, the last ends at 1667", function () {
  const S = PB.STRIP;
  assert.strictEqual(S.w, 2 * 300); assert.strictEqual(S.h, 6 * 300);
  for (let i = 0; i < 4; i++) {
    const r = PB.strip.frameRect(i);
    assert.strictEqual(r.x, 45); assert.strictEqual(r.w, 510); assert.strictEqual(r.h, 383);
    assert.strictEqual(r.y, 45 + i * (383 + 30));
    assert.strictEqual(r.x + r.w, S.w - 45, "equal side margins");
  }
  assert.strictEqual(PB.strip.frameRect(3).y + 383, 1667);
  assert.strictEqual(S.bandY, 1667); assert.strictEqual(S.bandY + S.bandH, S.h);
  assert(Math.abs(510 / 383 - 4 / 3) < 0.002, "about 4:3");
});

test("the date reads 08 OCT 2026 and the disposable's imprint '26 10 08", function () {
  const ms = new Date(2026, 9, 8, 12, 0, 0).getTime();
  assert.strictEqual(PB.strip.fmtDate(ms), "08 OCT 2026");
  assert.strictEqual(PB.strip.fmtDateSegment(ms), "'26 10 08");
});

function bandBox(lines) { // top and bottom of the band content
  return { top: Math.min.apply(null, lines.map(function (l) { return l.y; })), bottom: Math.max.apply(null, lines.map(function (l) { return l.y + l.height; })) };
}
const NOW = new Date(2026, 9, 8).getTime();

test("band lines stay inside the band and inside the 510 px between the margins, for every style and awkward captions", function () {
  const captions = ["", "Riya's room", "WWWWWWWWWWWWWWWWWWWWWWWW", "Mum & Dad's 25th!!", "ab", "Friday night out", "1234567890123456789012345", "Zoë's café", "iiiiiiiiiiiiiiiiiiiiiiii"];
  PB.STYLES.forEach(function (st) {
    captions.forEach(function (cap) {
      [true, false].forEach(function (showDate) {
        const lines = PB.strip.bandLines({ style: st.id, caption: cap, showDate: showDate }, NOW);
        assert(lines.length >= 1, "at least the address");
        const last = lines[lines.length - 1];
        assert.strictEqual(last.text, "THE-POCKET-BOOTH.VERCEL.APP"); assert.strictEqual(last.alpha, 0.6);
        lines.forEach(function (l) {
          const w = PB.stamp.measure(l.text, l.height);
          assert(w === null || w <= 510 + 0.01, st.id + " '" + cap + "' line '" + l.text + "' is " + w + " px wide");
        });
        const b = bandBox(lines);
        assert(b.top >= 1667 + 6 && b.bottom <= 1800 - 6, st.id + " '" + cap + "' band content " + b.top + ".." + b.bottom);
        for (let i = 1; i < lines.length; i++) assert(lines[i].y >= lines[i - 1].y + lines[i - 1].height, "lines do not overlap");
      });
    });
  });
});

test("the common case is one line: caption and date, about 23 px tall, and the address 14 px", function () {
  const lines = PB.strip.bandLines({ style: "classic", caption: "Riya's room", showDate: true }, NOW);
  assert.strictEqual(lines.length, 2);
  assert.strictEqual(lines[0].text, "Riya's room · 08 OCT 2026");
  assert(lines[0].height >= 19 && lines[0].height <= 26, "line 1 height " + lines[0].height);
  assert.strictEqual(lines[1].height, 14);
  const bare = PB.strip.bandLines({ style: "classic", caption: "", showDate: true }, NOW);
  assert.strictEqual(bare[0].text, "08 OCT 2026"); assert.strictEqual(bare[0].height, 26);
});

test("Four-cut puts POCKET BOOTH above; Disposable keeps its date in the frame, not the band", function () {
  const f = PB.strip.bandLines({ style: "fourcut", caption: "", showDate: true }, NOW);
  assert.strictEqual(f[0].text, "POCKET BOOTH"); assert.strictEqual(f[1].text, "08 OCT 2026"); assert.strictEqual(f.length, 3);
  const d = PB.strip.bandLines({ style: "disposable", caption: "Beach", showDate: true }, NOW);
  assert.deepStrictEqual(d.map(function (l) { return l.text; }), ["Beach", "THE-POCKET-BOOTH.VERCEL.APP"]);
});

test("no caption and no date leaves just the address, centred in the band", function () {
  const l = PB.strip.bandLines({ style: "classic", caption: "", showDate: false }, NOW);
  assert.strictEqual(l.length, 1);
  const mid = l[0].y + l[0].height / 2;
  assert(Math.abs(mid - (1667 + 133 / 2)) < 0.5);
});

test("a caption is cut at 24 characters and tidied", function () {
  assert.strictEqual(PB.strip.cleanCaption("   a   b  "), "a b");
  assert.strictEqual(PB.strip.cleanCaption("x".repeat(40)).length, 24);
  assert.strictEqual(PB.strip.cleanCaption(null), "");
});

T.done();
