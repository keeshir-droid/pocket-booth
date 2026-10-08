// The dot-matrix stamp (a 5 x 7 dot grid per character, drawn in code, no web font) and the 7-segment
// date of the Disposable style (PLAN.md sections 5.4, 5.5).
// Touches no canvas at load time; the glyph table and the measuring run in Node.
//
//   PB.stamp.draw(ctx, text, x, y, height, color, { align, alpha, seed }) -> width
//        x is the left, centre or right edge (align "left" | "center" | "right"); y is the TOP of the 7-dot glyph box.
//        Lower case is drawn as upper case, accents are folded (E for e-acute). Any character the font lacks
//        (non-Latin, emoji) sends the whole text to Caveat instead.
//   PB.stamp.measure(text, height)  -> the width draw() would return
//   PB.stamp.supports(text)         -> true if the text can be drawn in dots
//   PB.stamp.sevenSegment(ctx, text, x, y, height, color, { align, glow, slant }) -> width   digits, space ' - :
//   PB.stamp.GLYPHS                 -> { "A": [7 strings of 5 chars], ... }
(function () {
  const PB = (globalThis.PB = globalThis.PB || {});

  // '#' is a dot. Seven rows, five columns.
  const F = {
    "A": [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
    "B": ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
    "C": [".###.", "#...#", "#....", "#....", "#....", "#...#", ".###."],
    "D": ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
    "E": ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
    "F": ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
    "G": [".###.", "#...#", "#....", "#.###", "#...#", "#...#", ".####"],
    "H": ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
    "I": [".###.", "..#..", "..#..", "..#..", "..#..", "..#..", ".###."],
    "J": ["..###", "...#.", "...#.", "...#.", "...#.", "#..#.", ".##.."],
    "K": ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
    "L": ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
    "M": ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
    "N": ["#...#", "#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#"],
    "O": [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
    "P": ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
    "Q": [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
    "R": ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
    "S": [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
    "T": ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
    "U": ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
    "V": ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
    "W": ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
    "X": ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
    "Y": ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
    "Z": ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
    "0": [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."],
    "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
    "2": [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
    "3": ["#####", "...#.", "..#..", "...#.", "....#", "#...#", ".###."],
    "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
    "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
    "6": ["..##.", ".#...", "#....", "####.", "#...#", "#...#", ".###."],
    "7": ["#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."],
    "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
    "9": [".###.", "#...#", "#...#", ".####", "....#", "...#.", ".##.."],
    " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
    ".": [".....", ".....", ".....", ".....", ".....", ".##..", ".##.."],
    ",": [".....", ".....", ".....", ".....", ".##..", "..#..", ".#..."],
    "'": [".##..", "..#..", ".#...", ".....", ".....", ".....", "....."],
    "!": ["..#..", "..#..", "..#..", "..#..", "..#..", ".....", "..#.."],
    "?": [".###.", "#...#", "....#", "...#.", "..#..", ".....", "..#.."],
    "-": [".....", ".....", ".....", "#####", ".....", ".....", "....."],
    ":": [".....", ".##..", ".##..", ".....", ".##..", ".##..", "....."],
    "&": [".##..", "#..#.", "#.#..", ".#...", "#.#.#", "#..#.", ".##.#"],
    "/": ["....#", "....#", "...#.", "..#..", ".#...", "#....", "#...."],
    "@": [".###.", "#...#", "#.###", "#.#.#", "#.###", "#....", ".###."],
    "#": [".#.#.", ".#.#.", "#####", ".#.#.", "#####", ".#.#.", ".#.#."],
    "♥": [".#.#.", "#####", "#####", "#####", ".###.", "..#..", "....."],
    "·": [".....", ".....", ".....", "..#..", ".....", ".....", "....."]
  };

  // look-alikes that are quietly mapped before drawing
  const ALIAS = { "‘": "'", "’": "'", "`": "'", "´": "'", "–": "-", "—": "-", "−": "-", "•": "·", "∙": "·", "‧": "·", "…": "...", "ß": "SS", " ": " ", "\t": " ", "\n": " " };

  // text -> { text (drawable, upper case), ok (every character is in the font) }
  function normalise(text) {
    let s = String(text === undefined || text === null ? "" : text);
    try { s = s.normalize("NFD").replace(/[̀-ͯ]/g, ""); } catch (e) { /* keep as is */ }
    s = s.toUpperCase();
    let out = "", ok = true;
    for (const ch of s) { // for..of walks code points, so an emoji is one character
      const m = ALIAS[ch] !== undefined ? ALIAS[ch] : ch;
      for (const c of m) { if (F[c]) out += c; else { ok = false; out += c; } }
    }
    return { text: out, ok: ok };
  }
  function supports(text) { return normalise(text).ok; }

  // The geometry: dot pitch p; a dot is 0.74 p wide; a glyph is 7 rows (6 p + a dot) tall and 5 columns wide.
  const DOT = 0.80, ROWS = 7, COLS = 5, ADV = 6; // advance = 6 pitches (5 columns and a gap)
  function pitchFor(height) { return height / ((ROWS - 1) + DOT); }
  function widthOf(n, height) {
    if (n <= 0) return 0;
    const p = pitchFor(height);
    return (n - 1) * ADV * p + (COLS - 1) * p + DOT * p;
  }
  function measure(text, height) {
    const n = normalise(text);
    if (n.ok) return widthOf(Array.from(n.text).length, height);
    return null; // the fallback font is measured on a canvas
  }

  function scaleOf(ctx) {
    try { if (ctx.getTransform) { const t = ctx.getTransform(); return Math.hypot(t.a, t.b) || 1; } } catch (e) { /* ignore */ }
    return 1;
  }

  const FALLBACK_FONT = '"Caveat", "Segoe Script", "Bradley Hand", "Comic Sans MS", cursive';
  function drawFallback(ctx, text, x, y, height, color, align, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.font = "600 " + Math.round(height * 1.45 * 10) / 10 + "px " + FALLBACK_FONT;
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = align;
    ctx.fillText(String(text), x, y + height * 0.92);
    const w = ctx.measureText(String(text)).width;
    ctx.restore();
    return w;
  }

  function draw(ctx, text, x, y, height, color, opts) {
    const o = opts || {}, align = o.align || "left", alpha = o.alpha === undefined ? 1 : o.alpha;
    const norm = normalise(text);
    if (!norm.ok) return drawFallback(ctx, text, x, y, height, color, align, alpha);
    const chars = Array.from(norm.text);
    const n = chars.length;
    if (!n) return 0;
    const p = pitchFor(height), dot = DOT * p, width = widthOf(n, height);
    const x0 = align === "center" ? x - width / 2 : (align === "right" ? x - width : x);
    const rnd = PB.util.mulberry32(PB.util.hash(norm.text) + (o.seed || 0) * 7919);
    ctx.save();
    ctx.fillStyle = color;
    for (let ci = 0; ci < n; ci++) {
      const g = F[chars[ci]];
      for (let r = 0; r < ROWS; r++) {
        const row = g[r];
        for (let c = 0; c < COLS; c++) {
          // draw the random numbers for every position, so a changed neighbour never reshuffles the ink
          const j1 = rnd(), j2 = rnd(), j3 = rnd(), j4 = rnd(), j5 = rnd();
          if (row.charCodeAt(c) !== 35) continue;
          if (j5 < 0.012) continue; // a dot that did not print
          const cx = x0 + ci * ADV * p + dot / 2 + c * p + (j1 - 0.5) * 0.16 * p;
          const cy = y + dot / 2 + r * p + (j2 - 0.5) * 0.16 * p;
          const rad = dot / 2 * (0.9 + 0.2 * j3), a = alpha * (0.8 + 0.2 * j4);
          ctx.globalAlpha = a * 0.17; // a little ink bleeding into the paper
          ctx.beginPath(); ctx.arc(cx, cy, rad * 1.42, 0, 6.2832); ctx.fill();
          ctx.globalAlpha = a;
          ctx.beginPath(); ctx.arc(cx, cy, rad, 0, 6.2832); ctx.fill();
        }
      }
    }
    ctx.restore();
    return width;
  }

  // ---------- the 7-segment date ----------
  // segments: a top, b top right, c bottom right, d bottom, e bottom left, f top left, g middle
  const SEG = { "0": "abcdef", "1": "bc", "2": "abdeg", "3": "abcdg", "4": "bcfg", "5": "acdfg", "6": "acdefg", "7": "abc", "8": "abcdefg", "9": "abcdfg", "-": "g" };
  function segAdvance(ch, h) {
    if (ch === "'") return h * 0.3;
    if (ch === " ") return h * 0.42;
    if (ch === ":") return h * 0.3;
    if (ch === "1") return h * 0.28 + h * 0.2; // a narrow 1 (two short bars, evenly padded), so it never leaves a hole before the next digit
    return h * 0.58 + h * 0.2;
  }
  function segWidth(text, h) {
    let w = 0; const a = Array.from(String(text));
    for (let i = 0; i < a.length; i++) w += segAdvance(a[i], h);
    return Math.max(0, w - h * 0.2);
  }
  // adds the glyph's polygons to the current path; (ox, oy) is the top-left of the digit box
  function addGlyph(ctx, ch, ox, oy, h) {
    const t = h * 0.12;
    if (ch === "1") { ox += h * 0.08; } // the 1 sits in a narrow box with a little room either side
    const dw = ch === "1" ? t : h * 0.58;
    function hSeg(y, x0, x1) {
      ctx.moveTo(ox + x0, oy + y); ctx.lineTo(ox + x0 + t / 2, oy + y - t / 2); ctx.lineTo(ox + x1 - t / 2, oy + y - t / 2);
      ctx.lineTo(ox + x1, oy + y); ctx.lineTo(ox + x1 - t / 2, oy + y + t / 2); ctx.lineTo(ox + x0 + t / 2, oy + y + t / 2); ctx.closePath();
    }
    function vSeg(x, y0, y1) {
      ctx.moveTo(ox + x, oy + y0); ctx.lineTo(ox + x + t / 2, oy + y0 + t / 2); ctx.lineTo(ox + x + t / 2, oy + y1 - t / 2);
      ctx.lineTo(ox + x, oy + y1); ctx.lineTo(ox + x - t / 2, oy + y1 - t / 2); ctx.lineTo(ox + x - t / 2, oy + y0 + t / 2); ctx.closePath();
    }
    if (ch === "'") { // a slanted tick
      ctx.moveTo(ox + t * 0.2, oy); ctx.lineTo(ox + t * 1.1, oy); ctx.lineTo(ox + t * 0.35, oy + t * 2.6); ctx.lineTo(ox - t * 0.45, oy + t * 2.6); ctx.closePath();
      return;
    }
    if (ch === ":") {
      ctx.rect(ox, oy + h * 0.28, t, t); ctx.rect(ox, oy + h * 0.62, t, t);
      return;
    }
    const s = SEG[ch];
    if (!s) return;
    const g = t * 0.55; // the little gap between segments
    if (s.indexOf("a") >= 0) hSeg(t / 2, t * 0.5 + g, dw - t * 0.5 - g);
    if (s.indexOf("g") >= 0) hSeg(h / 2, t * 0.5 + g, dw - t * 0.5 - g);
    if (s.indexOf("d") >= 0) hSeg(h - t / 2, t * 0.5 + g, dw - t * 0.5 - g);
    if (s.indexOf("f") >= 0) vSeg(t / 2, t * 0.5 + g, h / 2 - g);
    if (s.indexOf("b") >= 0) vSeg(dw - t / 2, t * 0.5 + g, h / 2 - g);
    if (s.indexOf("e") >= 0) vSeg(t / 2, h / 2 + g, h - t * 0.5 - g);
    if (s.indexOf("c") >= 0) vSeg(dw - t / 2, h / 2 + g, h - t * 0.5 - g);
  }
  function sevenSegment(ctx, text, x, y, height, color, opts) {
    const o = opts || {}, align = o.align || "left", glow = o.glow !== false, slant = o.slant === undefined ? 0.1 : o.slant;
    const str = String(text), chars = Array.from(str), width = segWidth(str, height);
    const x0 = align === "center" ? x - width / 2 : (align === "right" ? x - width : x);
    const k = scaleOf(ctx);
    ctx.save();
    ctx.translate(x0, y);
    ctx.transform(1, 0, -slant, 1, slant * height, 0); // lean like an LED imprint
    ctx.beginPath();
    let ox = 0;
    for (let i = 0; i < chars.length; i++) { addGlyph(ctx, chars[i], ox, 0, height); ox += segAdvance(chars[i], height); }
    ctx.fillStyle = color;
    if (glow) { // a soft halo first, then a tighter one, then the crisp segments
      ctx.shadowColor = o.glowColor || "rgba(255,110,10,0.95)";
      ctx.shadowBlur = height * 0.5 * k; ctx.globalAlpha = 0.9; ctx.fill();
      ctx.shadowBlur = height * 0.14 * k; ctx.globalAlpha = 1; ctx.fill();
      ctx.shadowBlur = 0; ctx.shadowColor = "transparent";
    }
    ctx.fill();
    // the hot centre of each segment, a touch lighter
    ctx.globalAlpha = 0.22; ctx.fillStyle = o.coreColor || "#ffd9a0";
    ctx.fill();
    ctx.restore();
    return width;
  }

  PB.stamp = {
    draw: draw, measure: measure, supports: supports, normalise: normalise, sevenSegment: sevenSegment, sevenSegmentWidth: segWidth,
    GLYPHS: F, DOT: DOT, ROWS: ROWS, COLS: COLS, ADVANCE: ADV, pitchFor: pitchFor
  };
})();
