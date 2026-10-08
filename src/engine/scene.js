// The share images: the strip, presented (PLAN.md section 5.6). Never a bare thin strip.
// The strip stands in the booth: midnight navy under a warm spotlight, faint sunburst rays, the red valance across the top.
// It is tilted, with a two-layer shadow and a strip of washi tape across its top, and the mark "made with
// the-pocket-booth.vercel.app" in the corner. Everything is drawn in code.
// Both formats draw the same full-resolution strip.render(1), so they stay sharp.
//
//   PB.scene.draw(ctx, strip, format)   format "share" (1080 x 1350) or "story" (1080 x 1920)
//   PB.scene.size(format)               -> { w, h }
//   PB.scene.placement(format)          -> { cx, cy, h, w, rotate (radians) }   where the strip goes (for tests)
(function () {
  const PB = (globalThis.PB = globalThis.PB || {});
  const U = function () { return PB.util; };

  const FORMATS = {
    // the strip about 1180 px tall, tilted -4 degrees, under a slim valance; the mark at 28 px, bottom right
    share: { w: 1080, h: 1350, cx: 540, cy: 690, sh: 1180, tilt: -4, valH: 64, markSize: 28, markX: 1080 - 48, markY: 1350 - 30, markAlign: "right" },
    // the strip 1120 px tall, tilted -3 degrees, inside the story safe zone (y 270-1540, 90 px sides); the valance sits above the safe zone;
    // the mark at 32 px, centred under the strip and still inside the safe zone
    story: { w: 1080, h: 1920, cx: 540, cy: 876, sh: 1120, tilt: -3, valH: 132, markSize: 32, markX: 540, markY: 1524, markAlign: "center" }
  };
  const MARK = "made with the-pocket-booth.vercel.app";
  const MARK_A = "made with", MARK_B = "the-pocket-booth.vercel.app";
  const TAPES = { // washi tape colour and pattern per style
    classic: { c: [255, 199, 44], p: "stripes" }, film: { c: [191, 227, 240], p: "dots" }, flash: { c: [246, 185, 196], p: "stripes" },
    faded: { c: [214, 190, 148], p: "plain" }, fourcut: { c: [191, 227, 240], p: "dots" }, sepia: { c: [230, 180, 110], p: "stripes" },
    disposable: { c: [255, 160, 80], p: "dots" }
  };
  // ask for the two mark fonts early, so they are ready by the time someone taps Send
  try { if (typeof document !== "undefined" && document.fonts && document.fonts.load) { document.fonts.load('600 32px "Jost"'); document.fonts.load('600 32px "Caveat"'); } } catch (e) { /* the fallbacks are fine */ }

  function sizeOf(format) { const f = FORMATS[format] || FORMATS.share; return { w: f.w, h: f.h }; }
  function placement(format) {
    const f = FORMATS[format] || FORMATS.share, k = f.sh / PB.STRIP.h;
    return { cx: f.cx, cy: f.cy, h: f.sh, w: PB.STRIP.w * k, rotate: f.tilt * Math.PI / 180 };
  }

  // ---------- the booth: midnight navy, a warm spotlight, faint sunburst rays, the red valance across the top ----------
  const bgCache = {};
  function makeBackground(format) {
    const f = FORMATS[format], W = f.w, H = f.h, cx = f.cx, cy = f.cy;
    const c = U().createCanvas(W, H), ctx = c.getContext("2d", { willReadFrequently: true });
    const rnd = U().mulberry32(format === "story" ? 7777 : 4242);
    const base = ctx.createLinearGradient(0, 0, 0, H);
    base.addColorStop(0, "#0b1428"); base.addColorStop(0.45, "#1b2d55"); base.addColorStop(1, "#0f1a33");
    ctx.fillStyle = base; ctx.fillRect(0, 0, W, H);
    // sunburst: 40 rays from behind the strip, fading out with distance
    const R = Math.hypot(W, H), rays = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.62);
    rays.addColorStop(0, "rgba(255,226,170,0.085)"); rays.addColorStop(0.5, "rgba(255,226,170,0.035)"); rays.addColorStop(1, "rgba(255,226,170,0)");
    ctx.fillStyle = rays;
    for (let i = 0; i < 40; i++) {
      const a0 = (i / 40) * Math.PI * 2, a1 = a0 + Math.PI * 2 / 40 * 0.42;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a0) * R, cy + Math.sin(a0) * R); ctx.lineTo(cx + Math.cos(a1) * R, cy + Math.sin(a1) * R); ctx.closePath(); ctx.fill();
    }
    // the spotlight on the strip, and the room falling into shade at the corners
    const spot = ctx.createRadialGradient(cx, cy * 0.92, 0, cx, cy * 0.92, Math.max(W, H) * 0.55);
    spot.addColorStop(0, "rgba(255,214,150,0.26)"); spot.addColorStop(0.45, "rgba(255,214,150,0.09)"); spot.addColorStop(1, "rgba(255,214,150,0)");
    ctx.fillStyle = spot; ctx.fillRect(0, 0, W, H);
    const vr = R * 0.6, vg = ctx.createRadialGradient(W / 2, H * 0.48, vr * 0.42, W / 2, H * 0.48, vr);
    vg.addColorStop(0, "rgba(3,6,14,0)"); vg.addColorStop(1, "rgba(3,6,14,0.5)");
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    // fine film grain on top
    const img = ctx.getImageData(0, 0, W, H), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (rnd() + rnd() - 1) * 9;
      d[i] += n; d[i + 1] += n; d[i + 2] += n;
    }
    ctx.putImageData(img, 0, 0);
    drawValance(ctx, W, f.valH);
    return c;
  }
  function background(format) {
    if (!bgCache[format]) bgCache[format] = makeBackground(format);
    return bgCache[format];
  }

  // the valance from the site, drawn in code: a pelmet band with gold braid, whole swags with soft folds, gold fringe and tassels
  function gold(ctx, y0, y1) {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, "#ffe9a8"); g.addColorStop(0.5, "#f4bd3a"); g.addColorStop(1, "#a86f12");
    return g;
  }
  function drawValance(ctx, W, H) {
    const k = H / 66, n = Math.max(3, Math.round(W / (96 * k * 1.15))), w = W / n;
    const swag = function (x0) { // the swag: along the band, then its lower edge back
      ctx.moveTo(x0, 17 * k); ctx.lineTo(x0 + w, 17 * k);
      ctx.bezierCurveTo(x0 + w * 82 / 96, 70 * k, x0 + w * 14 / 96, 70 * k, x0, 17 * k);
    };
    const edge = function (x0, dy) { // a curve parallel to the swag's lower edge
      ctx.moveTo(x0, (17 + dy) * k);
      ctx.bezierCurveTo(x0 + w * 14 / 96, (70 + dy) * k, x0 + w * 82 / 96, (70 + dy) * k, x0 + w, (17 + dy) * k);
    };
    ctx.save();
    ctx.lineCap = "butt";
    // a soft shadow the valance throws onto the wall
    const sh = ctx.createLinearGradient(0, 30 * k, 0, 90 * k);
    sh.addColorStop(0, "rgba(2,4,10,0.45)"); sh.addColorStop(1, "rgba(2,4,10,0)");
    ctx.fillStyle = sh; ctx.fillRect(0, 30 * k, W, 60 * k);
    for (let i = 0; i < n; i++) {
      const x0 = i * w;
      // fringe behind the rolled edge
      if (ctx.setLineDash) ctx.setLineDash([1.3 * k, 1.5 * k]);
      ctx.lineWidth = 7.5 * k;
      ctx.strokeStyle = "#8a5a0f"; ctx.beginPath(); edge(x0 + 0.7 * k, 4); ctx.stroke();
      ctx.strokeStyle = "#eeb23a"; ctx.beginPath(); edge(x0, 3); ctx.stroke();
      if (ctx.setLineDash) ctx.setLineDash([]);
      // the swag
      const sg = ctx.createRadialGradient(x0 + w / 2, 18 * k, 0, x0 + w / 2, 18 * k, w * 0.62);
      sg.addColorStop(0, "#d33a2b"); sg.addColorStop(0.55, "#ae271f"); sg.addColorStop(1, "#661021");
      ctx.fillStyle = sg; ctx.beginPath(); swag(x0); ctx.closePath(); ctx.fill();
      // folds: dark valleys and lit ridges, nested inside the swag
      ctx.save(); ctx.beginPath(); swag(x0); ctx.closePath(); ctx.clip();
      [[2, 55, "rgba(58,8,20,0.42)", 3.6], [7, 44, "rgba(58,8,20,0.38)", 3.2], [14, 33, "rgba(58,8,20,0.32)", 3],
        [3, 60, "rgba(255,143,114,0.30)", 2.2], [8, 48, "rgba(255,143,114,0.24)", 2], [15, 37, "rgba(255,143,114,0.2)", 1.8]].forEach(function (fo) {
        const a = fo[0] / 96 * w;
        ctx.strokeStyle = fo[2]; ctx.lineWidth = fo[3] * k;
        ctx.beginPath(); ctx.moveTo(x0 + a, 18 * k);
        ctx.bezierCurveTo(x0 + a + (w - 2 * a) * 0.18, fo[1] * k, x0 + w - a - (w - 2 * a) * 0.18, fo[1] * k, x0 + w - a, 18 * k); ctx.stroke();
      });
      const shade = ctx.createLinearGradient(0, 17 * k, 0, 26 * k);
      shade.addColorStop(0, "rgba(32,6,16,0.55)"); shade.addColorStop(1, "rgba(32,6,16,0)");
      ctx.fillStyle = shade; ctx.fillRect(x0, 17 * k, w, 9 * k);
      ctx.restore();
      // gold braid along the edge
      ctx.strokeStyle = gold(ctx, 17 * k, 58 * k); ctx.lineWidth = 2.4 * k; ctx.beginPath(); edge(x0, 0); ctx.stroke();
    }
    // the pelmet band and its braid
    const bg = ctx.createLinearGradient(0, 0, 0, 17 * k);
    bg.addColorStop(0, "#6a1220"); bg.addColorStop(0.5, "#b2281f"); bg.addColorStop(1, "#891c21");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, 17 * k);
    ctx.fillStyle = gold(ctx, 13.4 * k, 18 * k); ctx.fillRect(0, 13.4 * k, W, 4.6 * k);
    // a tassel where each pair of swags meets
    for (let i = 0; i <= n; i++) {
      const x = i * w;
      ctx.strokeStyle = "#b47812"; ctx.lineWidth = 1.6 * k; ctx.beginPath(); ctx.moveTo(x, 18 * k); ctx.lineTo(x, 31 * k); ctx.stroke();
      const kn = ctx.createRadialGradient(x - 1.2 * k, 31.8 * k, 0, x, 33 * k, 3.8 * k);
      kn.addColorStop(0, "#fff3c8"); kn.addColorStop(0.45, "#f4bd3a"); kn.addColorStop(1, "#8f5c0e");
      ctx.fillStyle = kn; ctx.beginPath(); ctx.arc(x, 33 * k, 3.6 * k, 0, Math.PI * 2); ctx.fill();
      const tg = ctx.createLinearGradient(x - 6.4 * k, 0, x + 6.4 * k, 0);
      tg.addColorStop(0, "#b47812"); tg.addColorStop(0.42, "#ffe39a"); tg.addColorStop(0.62, "#f2b632"); tg.addColorStop(1, "#9a650f");
      ctx.fillStyle = tg; ctx.beginPath();
      ctx.moveTo(x - 3.4 * k, 37.5 * k); ctx.bezierCurveTo(x - 4 * k, 44 * k, x - 5.6 * k, 50 * k, x - 6.4 * k, 57 * k);
      ctx.lineTo(x + 6.4 * k, 57 * k); ctx.bezierCurveTo(x + 5.6 * k, 50 * k, x + 4 * k, 44 * k, x + 3.4 * k, 37.5 * k); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "rgba(138,90,15,0.7)"; ctx.lineWidth = 0.6 * k;
      [-1.8, 0, 1.8].forEach(function (dx) { ctx.beginPath(); ctx.moveTo(x + dx, 40 * k); ctx.lineTo(x + dx * 1.9, 56 * k); ctx.stroke(); });
    }
    ctx.restore();
  }

  // ---------- the washi tape ----------
  function tapePath(ctx, w, h) {
    const tooth = 3.2, step = 5;
    ctx.beginPath();
    ctx.moveTo(-w / 2, -h / 2);
    ctx.lineTo(w / 2, -h / 2);
    for (let y = -h / 2, k = 0; y < h / 2; y += step, k++) ctx.lineTo(w / 2 + (k % 2 ? tooth : 0), Math.min(h / 2, y + step / 2));
    ctx.lineTo(w / 2, h / 2);
    ctx.lineTo(-w / 2, h / 2);
    for (let y = h / 2, k = 0; y > -h / 2; y -= step, k++) ctx.lineTo(-w / 2 - (k % 2 ? tooth : 0), Math.max(-h / 2, y - step / 2));
    ctx.closePath();
  }
  function drawTape(ctx, x, y, w, h, angle, tape) {
    const c = tape.c;
    ctx.save();
    ctx.translate(x, y); ctx.rotate(angle);
    // it lifts a hair off the paper: a small soft shadow
    ctx.shadowColor = "rgba(60,38,14,0.30)"; ctx.shadowBlur = 7; ctx.shadowOffsetX = 1; ctx.shadowOffsetY = 3;
    tapePath(ctx, w, h);
    ctx.fillStyle = "rgba(" + c[0] + "," + c[1] + "," + c[2] + ",0.80)";
    ctx.fill();
    ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
    tapePath(ctx, w, h); ctx.clip();
    if (tape.p === "stripes") {
      ctx.strokeStyle = "rgba(255,255,255,0.42)"; ctx.lineWidth = 3;
      for (let i = -w; i < w; i += 11) { ctx.beginPath(); ctx.moveTo(i, -h / 2 - 2); ctx.lineTo(i + h * 0.55, h / 2 + 2); ctx.stroke(); }
    } else if (tape.p === "dots") {
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      for (let yy = -h / 2 + 8, r = 0; yy < h / 2; yy += 11, r++) for (let xx = -w / 2 + (r % 2 ? 4 : 10); xx < w / 2; xx += 15) { ctx.beginPath(); ctx.arc(xx, yy, 2.1, 0, 6.283); ctx.fill(); }
    }
    // the paper's own sheen and fibres, and a lighter top edge
    const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    g.addColorStop(0, "rgba(255,255,255,0.28)"); g.addColorStop(0.45, "rgba(255,255,255,0.03)"); g.addColorStop(1, "rgba(60,40,10,0.12)");
    ctx.fillStyle = g; ctx.fillRect(-w / 2 - 6, -h / 2, w + 12, h);
    const rnd = U().mulberry32(99);
    ctx.lineWidth = 0.6;
    for (let i = 0; i < 70; i++) {
      const fx = (rnd() - 0.5) * w, fy = (rnd() - 0.5) * h, l = 3 + rnd() * 9;
      ctx.strokeStyle = rnd() < 0.5 ? "rgba(255,255,255,0.20)" : "rgba(90,60,20,0.10)";
      ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx + l, fy + (rnd() - 0.5) * 2); ctx.stroke();
    }
    ctx.restore();
  }

  // ---------- the scene ----------
  function draw(ctx, strip, format) {
    const f = FORMATS[format] || FORMATS.share, pl = placement(format in FORMATS ? format : "share");
    const cv = ctx.canvas;
    if (cv && (cv.width !== f.w || cv.height !== f.h)) { cv.width = f.w; cv.height = f.h; }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(background(format in FORMATS ? format : "share"), 0, 0);

    const st = strip.settings, def = PB.styles.get(st.style);
    const hex = PB.styles.paperHex(st.style, st.paper), corner = (def.worn ? 15 : 3) * (pl.h / PB.STRIP.h);
    const img = strip.render(1);
    ctx.save();
    ctx.translate(pl.cx, pl.cy); ctx.rotate(pl.rotate);
    // two layers of shadow: tight and dark, then wide and soft. The light comes from the upper left.
    PB.strip.rrPath(ctx, -pl.w / 2, -pl.h / 2, pl.w, pl.h, corner);
    ctx.shadowColor = "rgba(0,2,8,0.55)"; ctx.shadowBlur = 64; ctx.shadowOffsetX = 18; ctx.shadowOffsetY = 40;
    ctx.fillStyle = hex; ctx.fill();
    PB.strip.rrPath(ctx, -pl.w / 2, -pl.h / 2, pl.w, pl.h, corner);
    ctx.shadowColor = "rgba(0,2,8,0.6)"; ctx.shadowBlur = 10; ctx.shadowOffsetX = 3; ctx.shadowOffsetY = 7;
    ctx.fill();
    ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, -pl.w / 2, -pl.h / 2, pl.w, pl.h);
    // the lamp on the paper: a faint light-to-shade wash across the strip
    ctx.save();
    PB.strip.rrPath(ctx, -pl.w / 2, -pl.h / 2, pl.w, pl.h, corner); ctx.clip();
    const wash = ctx.createLinearGradient(-pl.w / 2, -pl.h / 2, pl.w / 2, pl.h / 2);
    wash.addColorStop(0, "rgba(255,244,214,0.13)"); wash.addColorStop(0.5, "rgba(255,244,214,0)"); wash.addColorStop(1, "rgba(60,36,12,0.10)");
    ctx.fillStyle = wash; ctx.fillRect(-pl.w / 2, -pl.h / 2, pl.w, pl.h);
    ctx.restore();
    // the tape, across the top edge, a few degrees off the strip's own angle
    const tw = Math.round(pl.w * 0.40), th = Math.round(pl.w * 0.125);
    drawTape(ctx, pl.w * 0.02, -pl.h / 2 + 4, tw, th, 0.085, TAPES[st.style] || TAPES.classic);
    ctx.restore();

    // the mark: "made with" handwritten in powder blue, the address in Jost, butter yellow
    ctx.save();
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    const fontA = "600 " + Math.round(f.markSize * 1.3) + 'px "Caveat", "Segoe Script", "Bradley Hand", cursive';
    const fontB = "600 " + f.markSize + 'px "Jost", "Futura", "Century Gothic", "Segoe UI", sans-serif';
    ctx.font = fontA; const wa = ctx.measureText(MARK_A).width;
    ctx.font = fontB; const wb = ctx.measureText(MARK_B).width;
    const gap = f.markSize * 0.4, total = wa + gap + wb;
    const x0 = f.markAlign === "center" ? f.markX - total / 2 : f.markX - total;
    ctx.shadowColor = "rgba(0,0,0,0.45)"; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
    ctx.fillStyle = "#ffc72c";
    ctx.fillText(MARK_B, x0 + wa + gap, f.markY);
    ctx.font = fontA; ctx.fillStyle = "#bfe3f0";
    ctx.fillText(MARK_A, x0, f.markY);
    ctx.restore();
  }

  PB.scene = { draw: draw, size: sizeOf, placement: placement, FORMATS: FORMATS, MARK: MARK, MARK_A: MARK_A, MARK_B: MARK_B };
})();
