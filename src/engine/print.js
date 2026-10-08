// The print sheet (PLAN.md section 6.6): where four true-size strips go on A4 or US Letter, in points.
// Pure numbers, so it runs in Node; only drawPreview and liftedCanvas touch a canvas, when called.
//
//   PB.print.paperFor(locale)   -> "a4" | "letter"   Letter for the regions US CA MX PH CL CO VE PR
//   PB.print.layout(paper)      -> { page: {w,h}, strips: [{x,y,w,h,rotate}], marks: [{x1,y1,x2,y2}],
//                                    texts: [{text,x,y,size,grey}], ruler: {x1,y,x2,tick} }
//        All in points (72 pt = 1 in). The origin is the TOP LEFT of the page and y runs DOWN (pdf.js flips it).
//        Every strip is 432 x 144 pt (6 x 2 in) and is drawn sideways: the 600 x 1800 strip is rotated 90 degrees
//        counter-clockwise (rotate: -90), so frame 1 is at the left and the stamped band is at the right end.
//        text x is the left edge and y the baseline; the ruler is 5 cm (141.73 pt) long.
//   PB.print.textWidth(text, size)     Helvetica metrics, in points
//   PB.print.lift(data)                the print lift on RGBA bytes, in place (midtone gamma 0.9, shadows +3%)
//   PB.print.liftedCanvas(strip)       -> canvas 600 x 1800: strip.render(1) on white with the print lift (what the PDF holds)
//   PB.print.drawPreview(canvas, strip, paper)   the whole sheet at 150 dpi
(function () {
  const PB = (globalThis.PB = globalThis.PB || {});

  const PAPERS = { a4: { w: 595.28, h: 841.89 }, letter: { w: 612, h: 792 } };
  const LETTER_REGIONS = ["US", "CA", "MX", "PH", "CL", "CO", "VE", "PR"];
  const STRIP_W = 432, STRIP_H = 144, GAP = 18, MARK_LEN = 12, MARK_OFF = 4, RULER = 50 / 25.4 * 72; // 141.732 pt = 5 cm
  const TOP_LINE = "Pocket Booth · Print at Actual size (100%), not Fit to page · Cut along the marks";
  const RULER_LINE = "This line should measure 5 cm";

  function paperFor(locale) {
    const parts = String(locale || "").replace(/_/g, "-").split("-");
    for (let i = parts.length - 1; i >= 1; i--) {
      const p = parts[i].toUpperCase();
      if (/^[A-Z]{2}$/.test(p)) return LETTER_REGIONS.indexOf(p) >= 0 ? "letter" : "a4";
    }
    return "a4";
  }

  // Helvetica advance widths per 1000 em, characters 32..126, plus the middle dot
  const HELV = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
    1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
    333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
  function textWidth(text, size) {
    let w = 0;
    for (const ch of String(text)) {
      const c = ch.codePointAt(0);
      w += c >= 32 && c <= 126 ? HELV[c - 32] : (c === 183 ? 278 : 556);
    }
    return w * size / 1000;
  }

  function layout(paper) {
    const page = PAPERS[paper] || PAPERS.a4;
    const stackH = 4 * STRIP_H + 3 * GAP, x = (page.w - STRIP_W) / 2, y0 = (page.h - stackH) / 2;
    const strips = [], marks = [];
    for (let i = 0; i < 4; i++) {
      const y = y0 + i * (STRIP_H + GAP);
      strips.push({ x: x, y: y, w: STRIP_W, h: STRIP_H, rotate: -90 });
      const L = x, R = x + STRIP_W, T = y, B = y + STRIP_H;
      marks.push(
        { x1: L - MARK_OFF - MARK_LEN, y1: T, x2: L - MARK_OFF, y2: T }, { x1: R + MARK_OFF, y1: T, x2: R + MARK_OFF + MARK_LEN, y2: T },
        { x1: L - MARK_OFF - MARK_LEN, y1: B, x2: L - MARK_OFF, y2: B }, { x1: R + MARK_OFF, y1: B, x2: R + MARK_OFF + MARK_LEN, y2: B },
        { x1: L, y1: T - MARK_OFF - MARK_LEN, x2: L, y2: T - MARK_OFF }, { x1: R, y1: T - MARK_OFF - MARK_LEN, x2: R, y2: T - MARK_OFF },
        { x1: L, y1: B + MARK_OFF, x2: L, y2: B + MARK_OFF + MARK_LEN }, { x1: R, y1: B + MARK_OFF, x2: R, y2: B + MARK_OFF + MARK_LEN }
      );
    }
    const topSize = 9, topW = textWidth(TOP_LINE, topSize);
    const rulerY = y0 + stackH + MARK_OFF + MARK_LEN + 26, rx1 = (page.w - RULER) / 2;
    const texts = [
      { text: TOP_LINE, x: (page.w - topW) / 2, y: y0 - MARK_OFF - MARK_LEN - 14, size: topSize, grey: 0.4 },
      { text: RULER_LINE, x: (page.w - textWidth(RULER_LINE, 9)) / 2, y: rulerY + 17, size: 9, grey: 0.4 }
    ];
    return { page: { w: page.w, h: page.h }, strips: strips, marks: marks, texts: texts, ruler: { x1: rx1, y: rulerY, x2: rx1 + RULER, tick: 6 } };
  }

  // ---------- the print lift ----------
  let liftLut = null;
  function lift(data) {
    if (!liftLut) {
      liftLut = new Uint8ClampedArray(256);
      for (let i = 0; i < 256; i++) { let v = Math.pow(i / 255, 0.9); v = v + 0.03 * (1 - v) * (1 - v); liftLut[i] = v * 255; }
    }
    for (let p = 0; p < data.length; p += 4) { data[p] = liftLut[data[p]]; data[p + 1] = liftLut[data[p + 1]]; data[p + 2] = liftLut[data[p + 2]]; }
  }
  const liftCache = (typeof WeakMap !== "undefined") ? new WeakMap() : null;
  function liftedCanvas(strip) {
    const src = strip.render(1);
    const hit = liftCache && liftCache.get(src);
    if (hit) return hit;
    const w = PB.STRIP.w, h = PB.STRIP.h, c = PB.util.createCanvas(w, h), ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); // transparent corners (Faded) print as white paper
    ctx.drawImage(src, 0, 0, w, h);
    const id = ctx.getImageData(0, 0, w, h);
    lift(id.data);
    ctx.putImageData(id, 0, 0);
    if (liftCache) liftCache.set(src, c);
    return c;
  }

  // ---------- the preview ----------
  function drawPreview(canvas, strip, paper) {
    const L = layout(paper), k = 150 / 72;
    canvas.width = Math.round(L.page.w * k); canvas.height = Math.round(L.page.h * k);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(k, 0, 0, k, 0, 0);
    const img = liftedCanvas(strip);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    L.strips.forEach(function (s) {
      ctx.save();
      ctx.translate(s.x + s.w / 2, s.y + s.h / 2);
      ctx.rotate(s.rotate * Math.PI / 180);
      ctx.drawImage(img, -s.h / 2, -s.w / 2, s.h, s.w); // before the turn the strip is 144 wide and 432 tall
      ctx.restore();
    });
    ctx.strokeStyle = "#000"; ctx.lineWidth = 0.5; ctx.lineCap = "butt";
    ctx.beginPath();
    L.marks.forEach(function (m) { ctx.moveTo(m.x1, m.y1); ctx.lineTo(m.x2, m.y2); });
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(L.ruler.x1, L.ruler.y); ctx.lineTo(L.ruler.x2, L.ruler.y);
    ctx.moveTo(L.ruler.x1, L.ruler.y - L.ruler.tick / 2); ctx.lineTo(L.ruler.x1, L.ruler.y + L.ruler.tick / 2);
    ctx.moveTo(L.ruler.x2, L.ruler.y - L.ruler.tick / 2); ctx.lineTo(L.ruler.x2, L.ruler.y + L.ruler.tick / 2);
    ctx.stroke();
    ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
    L.texts.forEach(function (t) {
      const g = Math.round(t.grey * 255);
      ctx.fillStyle = "rgb(" + g + "," + g + "," + g + ")";
      ctx.font = t.size + 'px Helvetica, Arial, "Liberation Sans", sans-serif';
      ctx.fillText(t.text, t.x, t.y);
    });
  }

  PB.print = {
    paperFor: paperFor, layout: layout, textWidth: textWidth, lift: lift, liftedCanvas: liftedCanvas, drawPreview: drawPreview,
    PAPERS: PAPERS, RULER_PT: RULER, TOP_LINE: TOP_LINE, RULER_LINE: RULER_LINE
  };
})();
