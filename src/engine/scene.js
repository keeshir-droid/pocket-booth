// The share images: the strip, presented (PLAN.md section 5.6). Never a bare thin strip.
// The strip lies on a warm table under a lamp, tilted, with a two-layer shadow and a strip of washi tape across
// its top, and the mark "made with the-pocket-booth.vercel.app" in the corner. Everything is drawn in code.
// Both formats draw the same full-resolution strip.render(1), so they stay sharp.
//
//   PB.scene.draw(ctx, strip, format)   format "share" (1080 x 1350) or "story" (1080 x 1920)
//   PB.scene.size(format)               -> { w, h }
//   PB.scene.placement(format)          -> { cx, cy, h, w, rotate (radians) }   where the strip goes (for tests)
(function () {
  const PB = (globalThis.PB = globalThis.PB || {});
  const U = function () { return PB.util; };

  const FORMATS = {
    // the strip about 1180 px tall, tilted -4 degrees; the mark at 22 px, bottom right
    share: { w: 1080, h: 1350, cx: 540, cy: 652, sh: 1180, tilt: -4, markSize: 22, markX: 1080 - 46, markY: 1350 - 36 },
    // the strip 1200 px tall, tilted -3 degrees, inside the story safe zone (y 270-1540, 90 px sides); the mark at 26 px
    story: { w: 1080, h: 1920, cx: 540, cy: 895, sh: 1180, tilt: -3, markSize: 26, markX: 1080 - 112, markY: 1514 }
  };
  const MARK = "made with the-pocket-booth.vercel.app";
  const TAPES = { // washi tape colour and pattern per style
    classic: { c: [232, 196, 106], p: "stripes" }, film: { c: [170, 188, 150], p: "dots" }, flash: { c: [236, 164, 178], p: "stripes" },
    faded: { c: [214, 190, 148], p: "plain" }, fourcut: { c: [164, 200, 230], p: "dots" }, sepia: { c: [206, 166, 112], p: "stripes" },
    disposable: { c: [240, 160, 92], p: "dots" }
  };

  function sizeOf(format) { const f = FORMATS[format] || FORMATS.share; return { w: f.w, h: f.h }; }
  function placement(format) {
    const f = FORMATS[format] || FORMATS.share, k = f.sh / PB.STRIP.h;
    return { cx: f.cx, cy: f.cy, h: f.sh, w: PB.STRIP.w * k, rotate: f.tilt * Math.PI / 180 };
  }

  // ---------- the table ----------
  const bgCache = {};
  function makeBackground(format) {
    const f = FORMATS[format], W = f.w, H = f.h;
    const c = U().createCanvas(W, H), ctx = c.getContext("2d", { willReadFrequently: true });
    const rnd = U().mulberry32(format === "story" ? 7777 : 4242);
    ctx.fillStyle = "#f3ece0"; ctx.fillRect(0, 0, W, H);
    // the grain of the table top: long faint streaks, a little wavy
    for (let i = 0; i < 90; i++) {
      const y = rnd() * H, x0 = -40 + rnd() * W * 0.5, len = W * (0.35 + rnd() * 0.8), amp = 2 + rnd() * 5, ph = rnd() * 6.28;
      ctx.strokeStyle = rnd() < 0.6 ? "rgba(122,86,46," + (0.014 + rnd() * 0.022).toFixed(3) + ")" : "rgba(255,250,236," + (0.05 + rnd() * 0.06).toFixed(3) + ")";
      ctx.lineWidth = 0.8 + rnd() * 3.2;
      ctx.beginPath();
      for (let x = 0; x <= len; x += 24) { const yy = y + Math.sin(x * 0.012 + ph) * amp; if (x) ctx.lineTo(x0 + x, yy); else ctx.moveTo(x0, yy); }
      ctx.stroke();
    }
    // slow patches, as if the finish were not quite even
    for (let i = 0; i < 7; i++) {
      const x = rnd() * W, y = rnd() * H, r = 220 + rnd() * 360, g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, "rgba(140,100,55," + (0.025 + rnd() * 0.025).toFixed(3) + ")"); g.addColorStop(1, "rgba(140,100,55,0)");
      ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // the lamp: a warm pool of light up and to the left, and the room falling into shade at the corners
    const lx = W * 0.30, ly = H * 0.20, lr = Math.max(W, H) * 0.95;
    const lamp = ctx.createRadialGradient(lx, ly, 0, lx, ly, lr);
    lamp.addColorStop(0, "rgba(255,238,196,0.55)"); lamp.addColorStop(0.35, "rgba(255,232,180,0.22)"); lamp.addColorStop(1, "rgba(255,226,170,0)");
    ctx.fillStyle = lamp; ctx.fillRect(0, 0, W, H);
    const vr = Math.hypot(W, H) * 0.62, vg = ctx.createRadialGradient(W * 0.46, H * 0.46, vr * 0.38, W * 0.46, H * 0.46, vr);
    vg.addColorStop(0, "rgba(96,62,28,0)"); vg.addColorStop(1, "rgba(96,62,28,0.30)");
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    // fine grain on top
    const img = ctx.getImageData(0, 0, W, H), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (rnd() + rnd() - 1) * 7;
      d[i] += n; d[i + 1] += n; d[i + 2] += n;
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }
  function background(format) {
    if (!bgCache[format]) bgCache[format] = makeBackground(format);
    return bgCache[format];
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
    ctx.shadowColor = "rgba(46,26,8,0.26)"; ctx.shadowBlur = 56; ctx.shadowOffsetX = 18; ctx.shadowOffsetY = 36;
    ctx.fillStyle = hex; ctx.fill();
    PB.strip.rrPath(ctx, -pl.w / 2, -pl.h / 2, pl.w, pl.h, corner);
    ctx.shadowColor = "rgba(40,22,6,0.50)"; ctx.shadowBlur = 8; ctx.shadowOffsetX = 3; ctx.shadowOffsetY = 6;
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

    // the mark
    ctx.save();
    ctx.font = "600 " + f.markSize + 'px "Caveat", "Segoe Script", "Bradley Hand", cursive';
    ctx.textAlign = "right"; ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "rgba(70,44,20,0.62)";
    ctx.fillText(MARK, f.markX, f.markY);
    ctx.restore();
  }

  PB.scene = { draw: draw, size: sizeOf, placement: placement, FORMATS: FORMATS, MARK: MARK };
})();
