// The strip: four photos on a true 600 x 1800 booth strip (2 x 6 in at 300 dpi), PLAN.md sections 5.4, 5.5, 6.2.
// This is the one picture the screen, the share images and the PDF all come from.
//
//   PB.strip.create(photos, crops, settings) -> Promise<Strip>     resolves once the fonts the strip needs are ready
//   strip.settings                       current settings (defaults filled in)
//   strip.update(partial)                -> Promise<void>
//   strip.setPhoto(i, photo, crop) / strip.setCrop(i, crop) / strip.swap(i, j)
//   strip.render(scale)                  -> canvas 600*scale x 1800*scale, cached per settings and scale (do not draw on it)
//   strip.renderDeveloping(scale, t)     -> canvas, the strip part way through developing (t 0..1; the develop animation)
//   strip.frameRects(scale)              -> the four frame rectangles, in canvas px, for overlays
//
// Also (pure, and tested in Node): PB.strip.frameRect(i), PB.strip.bandLines(settings, nowMs), PB.strip.fmtDate(ms),
// PB.strip.fmtDateSegment(ms). Everything is drawn in code; the only images are the photos.
(function () {
  const PB = (globalThis.PB = globalThis.PB || {});
  const U = function () { return PB.util; };
  const S = function () { return PB.STRIP; };

  const ADDRESS = "THE-POCKET-BOOTH.VERCEL.APP";
  const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const PAPER_CORNER = 3; // a cut strip has very slightly softened corners
  const WORN_CORNER = 15;
  const PALE = "#cfc6b8"; // the flat grey-brown a frame starts from while it develops (PLAN.md 5.3)

  // ---------- pure helpers ----------
  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function fmtDate(ms) {
    const d = new Date(ms);
    return pad2(d.getDate()) + " " + MONTHS[d.getMonth()] + " " + d.getFullYear();
  }
  function fmtDateSegment(ms) { // the Disposable's imprint: '26 10 08
    const d = new Date(ms);
    return "'" + pad2(d.getFullYear() % 100) + " " + pad2(d.getMonth() + 1) + " " + pad2(d.getDate());
  }
  function frameRect(i) {
    const s = S();
    return { x: s.margin, y: s.margin + i * (s.frameH + s.gap), w: s.frameW, h: s.frameH };
  }
  function cleanCaption(c) {
    return String(c === undefined || c === null ? "" : c).replace(/\s+/g, " ").trim().slice(0, 24).trim();
  }
  // the width of a stamp line; the Caveat fallback is estimated (it can only be measured on a canvas)
  function lineWidth(text, height) {
    const m = PB.stamp.measure(text, height);
    return m === null ? Array.from(String(text)).length * height * 1.45 * 0.42 : m;
  }
  function fit(text, hMax, maxW, hMin) {
    const w = lineWidth(text, hMax);
    if (w <= maxW) return hMax;
    const h = Math.floor(hMax * maxW / w * 10) / 10;
    return h >= hMin ? h : 0;
  }

  // What goes in the bottom band, and where. Returns [{ text, height, y, alpha }] (all centred at x = 300).
  //   the caption and the date in the stamp (shrunk to fit; on two lines if both together are too wide),
  //   THE-POCKET-BOOTH.VERCEL.APP at 60% ink under them. Four-cut puts POCKET BOOTH above.
  function bandLines(settings, nowMs) {
    const s = S(), st = settings || {}, def = PB.styles.get(st.style);
    const maxW = s.frameW;
    const caption = cleanCaption(st.caption);
    const wantDate = st.showDate !== false;
    const dateText = (wantDate && !def.dateStamp) ? fmtDate(nowMs) : ""; // Disposable carries its date in frame 4
    const items = [];
    if (def.bandTitle) items.push({ text: def.bandTitle, height: 24, gapAfter: 12, alpha: 1 });
    const topH = def.bandTitle ? 20 : 26;
    const one = [caption, dateText].filter(Boolean).join(" · ");
    if (one) {
      const h = fit(one, topH, maxW, def.bandTitle ? 15 : 19);
      if (h) {
        items.push({ text: one, height: h, gapAfter: 22, alpha: 1 });
      } else {
        const hc = fit(caption, topH, maxW, 12) || 12;
        items.push({ text: caption, height: hc, gapAfter: 8, alpha: 1 });
        if (dateText) items.push({ text: dateText, height: Math.min(topH - 4, fit(dateText, topH - 4, maxW, 12) || 12), gapAfter: 22, alpha: 1 });
        else items[items.length - 1].gapAfter = 22;
      }
    }
    items.push({ text: ADDRESS, height: def.bandTitle ? 12 : 14, gapAfter: 0, alpha: 0.6 });
    let total = 0;
    items.forEach(function (it, i) { total += it.height + (i < items.length - 1 ? it.gapAfter : 0); });
    let y = s.bandY + (s.bandH - total) / 2;
    return items.map(function (it, i) {
      const r = { text: it.text, height: it.height, y: y, alpha: it.alpha };
      y += it.height + it.gapAfter;
      return r;
    });
  }

  function rrPath(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    if (r <= 0) { ctx.rect(x, y, w, h); return; }
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ---------- the paper ----------
  // Very fine grain (about 2%), a slow unevenness, a few fibres and specks, a soft darker rim and a hairline edge.
  let paperTile = null;
  function getPaperTile() {
    if (paperTile) return paperTile;
    const rnd = U().mulberry32(0x70a9e3), t = new Float32Array(256 * 256);
    for (let i = 0; i < t.length; i++) t[i] = (rnd() + rnd() - 1); // -1..1, slightly bell shaped
    paperTile = t;
    return t;
  }
  function makePaper(hex, def, scale, seed) {
    const s = S(), W = Math.round(s.w * scale), H = Math.round(s.h * scale);
    const canvas = U().createCanvas(W, H), ctx = canvas.getContext("2d");
    const c = U().hexToRgb(hex), dark = (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) < 100;
    const img = ctx.createImageData(W, H), d = img.data, tile = getPaperTile();
    const rnd = U().mulberry32(seed ^ 0x9a9e7);
    const amp = dark ? 3.2 : 5.2, MX = 12, MY = 34, grid = new Float32Array(MX * MY);
    for (let i = 0; i < grid.length; i++) grid[i] = (rnd() * 2 - 1) * (dark ? 0.02 : 0.013);
    const ox = (rnd() * 256) | 0, oy = (rnd() * 256) | 0;
    for (let y = 0; y < H; y++) {
      const fy = y / Math.max(1, H - 1) * (MY - 1), j0 = Math.min(MY - 2, Math.floor(fy)), ty = fy - j0, r0 = j0 * MX, r1 = r0 + MX;
      const trow = ((y + oy) & 255) * 256;
      for (let x = 0; x < W; x++) {
        const fx = x / Math.max(1, W - 1) * (MX - 1), i0 = Math.min(MX - 2, Math.floor(fx)), tx = fx - i0;
        const m = 1 + (grid[r0 + i0] * (1 - tx) + grid[r0 + i0 + 1] * tx) * (1 - ty) + (grid[r1 + i0] * (1 - tx) + grid[r1 + i0 + 1] * tx) * ty;
        const n = tile[trow + ((x + ox) & 255)] * amp, p = (y * W + x) * 4;
        d[p] = c.r * m + n; d[p + 1] = c.g * m + n; d[p + 2] = c.b * m + n; d[p + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    // fibres and specks
    ctx.lineCap = "round";
    for (let i = 0; i < 260; i++) {
      const x = rnd() * s.w, y = rnd() * s.h, a = rnd() * 6.283, len = 4 + rnd() * 11;
      const light = rnd() < 0.5;
      ctx.strokeStyle = light ? "rgba(255,255,255," + (dark ? 0.05 : 0.22).toFixed(3) + ")" : "rgba(60,45,20," + (dark ? 0.0 : 0.045).toFixed(3) + ")";
      if (dark && !light) continue;
      ctx.lineWidth = 0.5 + rnd() * 0.5;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); ctx.stroke();
    }
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = dark ? "rgba(255,255,255,0.05)" : "rgba(70,55,30,0.07)";
      ctx.beginPath(); ctx.arc(rnd() * s.w, rnd() * s.h, 0.4 + rnd() * 0.8, 0, 6.283); ctx.fill();
    }
    // a soft darker rim, like paper that has been handled, and the hairline edge
    const rim = 9, rimA = dark ? 0.0 : 0.05, edge = dark ? "rgba(255,255,255,0.12)" : "rgba(40,30,15,0.20)";
    if (rimA > 0) {
      const sides = [[0, 0, rim, 0, 0, 0, rim, s.h], [s.w, 0, s.w - rim, 0, s.w - rim, 0, rim, s.h], [0, 0, 0, rim, 0, 0, s.w, rim], [0, s.h, 0, s.h - rim, 0, s.h - rim, s.w, rim]];
      sides.forEach(function (q) {
        const g = ctx.createLinearGradient(q[0], q[1], q[2], q[3]);
        g.addColorStop(0, "rgba(60,45,20," + rimA + ")"); g.addColorStop(1, "rgba(60,45,20,0)");
        ctx.fillStyle = g; ctx.fillRect(q[4], q[5], q[6], q[7]);
      });
    }
    ctx.strokeStyle = edge; ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, s.w - 1, s.h - 1);
    return canvas;
  }

  // ---------- the extras of each style ----------
  function drawCrease(ctx, rnd, seed) {
    const s = S(), k = 1 + (seed % 3), fr = frameRect(k);
    const y0 = fr.y + fr.h * (0.28 + 0.44 * rnd()), slope = (rnd() - 0.5) * 80;
    const pts = [];
    for (let i = 0; i <= 30; i++) { const x = -4 + (s.w + 8) * i / 30; pts.push([x, y0 + slope * (i / 30 - 0.5) + (rnd() - 0.5) * 1.6]); }
    function line(dy, style, lw) {
      ctx.strokeStyle = style; ctx.lineWidth = lw; ctx.beginPath();
      pts.forEach(function (p, i) { if (i) ctx.lineTo(p[0], p[1] + dy); else ctx.moveTo(p[0], p[1] + dy); });
      ctx.stroke();
    }
    ctx.save(); ctx.lineJoin = "round";
    line(0, "rgba(255,250,235,0.045)", 14);   // the raised ridge of the fold
    line(0, "rgba(255,250,235,0.07)", 5);
    line(2.2, "rgba(40,24,8,0.20)", 2.2);     // the shadow side
    line(0, "rgba(255,252,240,0.42)", 1.1);   // the cracked white line
    ctx.restore();
  }
  function drawWear(ctx, rnd, hex) {
    const s = S();
    ctx.save();
    // darker, yellowed paper edges
    const sides = [[0, 0, 26, 0, 0, 0, 26, s.h], [s.w, 0, s.w - 26, 0, s.w - 26, 0, 26, s.h], [0, 0, 0, 26, 0, 0, s.w, 26], [0, s.h, 0, s.h - 26, 0, s.h - 26, s.w, 26]];
    sides.forEach(function (q) {
      const g = ctx.createLinearGradient(q[0], q[1], q[2], q[3]);
      g.addColorStop(0, "rgba(120,86,30,0.26)"); g.addColorStop(1, "rgba(120,86,30,0)");
      ctx.fillStyle = g; ctx.fillRect(q[4], q[5], q[6], q[7]);
    });
    // stains on the margins
    for (let i = 0; i < 7; i++) {
      let x, y;
      if (i % 3 === 0) { x = rnd() * s.w; y = s.bandY + rnd() * s.bandH; } else { x = i % 2 ? rnd() * 40 : s.w - rnd() * 40; y = rnd() * s.h; }
      const r = 14 + rnd() * 30;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, "rgba(130,92,34,0.10)"); g.addColorStop(1, "rgba(130,92,34,0)");
      ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // whitened, rubbed edges and corners
    for (let i = 0; i < 150; i++) {
      const side = (rnd() * 4) | 0, t = rnd(), inset = rnd() * rnd() * 7;
      const x = side === 0 ? inset : side === 1 ? s.w - inset : t * s.w, y = side === 2 ? inset : side === 3 ? s.h - inset : t * s.h;
      ctx.fillStyle = "rgba(255,250,238," + (0.16 + rnd() * 0.24).toFixed(2) + ")";
      ctx.beginPath(); ctx.arc(x, y, 0.5 + rnd() * 1.3, 0, 6.283); ctx.fill();
    }
    ctx.restore();
  }
  function drawScuffs(ctx, rnd) {
    ctx.save(); ctx.lineCap = "round";
    for (let i = 0; i < 9; i++) {
      const fr = frameRect((rnd() * 4) | 0);
      const x = fr.x + rnd() * fr.w, y = fr.y + rnd() * fr.h, len = 10 + rnd() * 38, a = (rnd() - 0.5) * 1.6 + (rnd() < 0.5 ? 0 : 1.57);
      const dark = i % 3 === 2;
      ctx.strokeStyle = dark ? "rgba(35,18,6," + (0.12 + rnd() * 0.1).toFixed(2) + ")" : "rgba(255,246,225," + (0.24 + rnd() * 0.26).toFixed(2) + ")";
      ctx.lineWidth = 0.8 + rnd() * 1.1;
      ctx.beginPath(); ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + Math.cos(a) * len * 0.5 + (rnd() - 0.5) * 6, y + Math.sin(a) * len * 0.5 + (rnd() - 0.5) * 6, x + Math.cos(a) * len, y + Math.sin(a) * len);
      ctx.stroke();
    }
    for (let i = 0; i < 26; i++) { // dust
      const fr = frameRect((rnd() * 4) | 0);
      ctx.fillStyle = rnd() < 0.7 ? "rgba(255,246,225," + (0.18 + rnd() * 0.22).toFixed(2) + ")" : "rgba(30,15,5,0.16)";
      ctx.beginPath(); ctx.arc(fr.x + rnd() * fr.w, fr.y + rnd() * fr.h, 0.5 + rnd() * 1.2, 0, 6.283); ctx.fill();
    }
    ctx.restore();
  }
  function drawDateStamp(ctx, nowMs) {
    const fr = frameRect(3), h = 34;
    const text = fmtDateSegment(nowMs);
    const w = PB.stamp.sevenSegmentWidth(text, h), right = fr.x + fr.w - 20, top = fr.y + fr.h - 18 - h;
    // a soft dark pool behind the digits (a real imprint burns into the corner): the orange then reads on any photo, even a pale hand
    ctx.save();
    ctx.translate(right - w / 2, top + h / 2);
    ctx.scale(1, (h * 1.5) / (w * 0.75));
    const pool = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 0.75);
    pool.addColorStop(0, "rgba(24,8,0,0.62)"); pool.addColorStop(0.6, "rgba(24,8,0,0.38)"); pool.addColorStop(1, "rgba(24,8,0,0)");
    ctx.fillStyle = pool;
    ctx.fillRect(-w * 0.8, -w * 0.8, w * 1.6, w * 1.6);
    ctx.restore();
    ctx.save();
    // plain compositing: a "screen" blend washed the orange out to cream over light hands and walls
    PB.stamp.sevenSegment(ctx, text, right, top, h, "#ff6a00", { align: "right", glowColor: "rgba(255,70,0,0.95)", coreColor: "#ffb050" });
    ctx.restore();
  }

  // ---------- fonts ----------
  function fontsReady(captionText) {
    return new Promise(function (resolve) {
      try {
        if (typeof document === "undefined" || !document.fonts || !document.fonts.load) { resolve(); return; }
        const t = setTimeout(resolve, 1500);
        const text = captionText && !PB.stamp.supports(captionText) ? captionText : "Aa";
        document.fonts.load('600 24px "Caveat"', text).then(function () { clearTimeout(t); resolve(); }, function () { clearTimeout(t); resolve(); });
      } catch (e) { resolve(); }
    });
  }

  // ---------- small caches ----------
  function lru(max) {
    const m = new Map();
    return {
      get: function (k) { if (!m.has(k)) return undefined; const v = m.get(k); m.delete(k); m.set(k, v); return v; },
      set: function (k, v) { m.set(k, v); while (m.size > max) m.delete(m.keys().next().value); },
      clear: function () { m.clear(); }
    };
  }

  // ---------- the strip object ----------
  function normSettings(prev, partial) {
    const o = Object.assign({}, PB.DEFAULTS, prev || {});
    if (partial) Object.keys(partial).forEach(function (k) { if (partial[k] !== undefined) o[k] = partial[k]; }); // undefined never wipes a setting
    if (!PB.styles.get(o.style) || !PB.STYLES.some(function (x) { return x.id === o.style; })) o.style = PB.DEFAULTS.style;
    if (!PB.PAPERS.some(function (x) { return x.id === o.paper; })) o.paper = "auto";
    o.caption = cleanCaption(o.caption);
    o.showDate = o.showDate !== false && o.showDate !== 0 && o.showDate !== "0";
    o.when = Number(o.when) || 0;
    return o;
  }

  function Strip(photos, crops, settings) {
    this.photos = photos.slice(0, PB.FRAMES);
    this.crops = this.photos.map(function (p, i) { return PB.photo.clampCrop(p, (crops && crops[i]) || PB.photo.autoCrop(p)); });
    this.settings = normSettings(null, settings);
    this.seed = ((settings && settings.seed) >>> 0) || ((Math.random() * 4294967295) >>> 0) || 1;
    this._now = this.settings.when || Date.now();
    this._ver = 1;
    this._fv = [1, 1, 1, 1];
    this._matched = [[], [], [], []];
    this._frames = lru(16);
    this._papers = lru(4);
    this._bases = lru(3);
    this._finals = lru(4);
  }

  const P = Strip.prototype;
  P._touch = function (i) { this._ver++; if (i === undefined) this._fv = this._fv.map(function (v) { return v + 1; }); else this._fv[i]++; this._finals.clear(); this._bases.clear(); };

  P.update = function (partial) {
    const before = this.settings;
    this.settings = normSettings(before, partial);
    if (partial && "when" in partial) this._now = this.settings.when || Date.now();
    return fontsReady(this.settings.caption);
  };
  P.setPhoto = function (i, photo, crop) {
    if (i < 0 || i >= this.photos.length) return;
    this.photos[i] = photo; this.crops[i] = PB.photo.clampCrop(photo, crop || PB.photo.autoCrop(photo)); this._matched[i] = []; this._frames.clear(); this._touch(i);
  };
  P.setCrop = function (i, crop) {
    if (i < 0 || i >= this.photos.length) return;
    this.crops[i] = PB.photo.clampCrop(this.photos[i], crop); this._matched[i] = []; this._frames.clear(); this._touch(i);
  };
  P.swap = function (i, j) {
    if (i === j || i < 0 || j < 0 || i >= this.photos.length || j >= this.photos.length) return;
    const p = this.photos[i]; this.photos[i] = this.photos[j]; this.photos[j] = p;
    const c = this.crops[i]; this.crops[i] = this.crops[j]; this.crops[j] = c;
    this._matched = [[], [], [], []]; this._frames.clear(); this._touch();
  };
  P.dispose = function () { this._frames.clear(); this._papers.clear(); this._bases.clear(); this._finals.clear(); this._matched = [[], [], [], []]; };

  P._matchedFrame = function (i, fw, fh) { // the photo, cropped and matched, at this size (cached)
    const size = fw + "x" + fh, bucket = this._matched[i]; // keeps the last two sizes (the screen's and the outputs')
    for (let k = 0; k < bucket.length; k++) if (bucket[k].size === size) { const hit = bucket.splice(k, 1)[0]; bucket.unshift(hit); return hit.canvas; }
    const canvas = PB.photo.matched(this.photos[i], this.crops[i], fw, fh);
    bucket.unshift({ size: size, canvas: canvas });
    if (bucket.length > 2) bucket.length = 2;
    return canvas;
  };

  P._frameCanvas = function (i, scale, styleId) { // graded and finished
    const fw = Math.round(S().frameW * scale), fh = Math.round(S().frameH * scale);
    const key = [i, styleId, scale, this._fv[i], this.seed].join("|");
    const hit = this._frames.get(key);
    if (hit) return hit;
    const src = this._matchedFrame(i, fw, fh);
    const out = U().createCanvas(fw, fh), ctx = out.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(src, 0, 0);
    const img = ctx.getImageData(0, 0, fw, fh);
    PB.styles.process(styleId, img.data, fw, fh, { scale: scale, seed: this.seed, frame: i });
    ctx.putImageData(img, 0, 0);
    this._frames.set(key, out);
    return out;
  };

  P._paper = function (hex, def, scale) {
    const key = [hex, scale, this.seed].join("|"), hit = this._papers.get(key);
    if (hit) return hit;
    const c = makePaper(hex, def, scale, this.seed);
    this._papers.set(key, c);
    return c;
  };

  P._base = function (scale) { // paper, photos and the style's extras: everything but the band's stamp
    const st = this.settings, def = PB.styles.get(st.style), hex = PB.styles.paperHex(st.style, st.paper);
    const stampKey = def.dateStamp ? (st.showDate ? this._now : 0) : 0;
    const key = [st.style, hex, scale, this._ver, stampKey].join("|"), hit = this._bases.get(key);
    if (hit) return hit;
    const s = S(), W = Math.round(s.w * scale), H = Math.round(s.h * scale);
    const canvas = U().createCanvas(W, H), ctx = canvas.getContext("2d");
    ctx.drawImage(this._paper(hex, def, scale), 0, 0, W, H);
    ctx.setTransform(W / s.w, 0, 0, H / s.h, 0, 0);
    const fcol = U().hexToRgb(hex), dark = (0.299 * fcol.r + 0.587 * fcol.g + 0.114 * fcol.b) < 100;
    for (let i = 0; i < PB.FRAMES; i++) {
      const fr = frameRect(i), fc = this._frameCanvas(i, scale, st.style);
      ctx.save();
      rrPath(ctx, fr.x, fr.y, fr.w, fr.h, def.radius);
      ctx.clip();
      ctx.drawImage(fc, fr.x, fr.y, fr.w, fr.h);
      ctx.restore();
      rrPath(ctx, fr.x + 0.5, fr.y + 0.5, fr.w - 1, fr.h - 1, Math.max(0, def.radius - 0.5));
      ctx.strokeStyle = dark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.16)"; ctx.lineWidth = 1; ctx.stroke();
    }
    const rnd = U().mulberry32(this.seed ^ U().hash(st.style));
    if (def.scuffs) drawScuffs(ctx, rnd);
    if (def.worn) { drawCrease(ctx, rnd, this.seed); drawWear(ctx, rnd, hex); }
    if (def.dateStamp && st.showDate) drawDateStamp(ctx, this._now);
    // the corners of the paper: a tiny softening, a worn one on Faded (transparent outside)
    const rad = def.worn ? WORN_CORNER : PAPER_CORNER;
    ctx.globalCompositeOperation = "destination-in";
    rrPath(ctx, 0, 0, s.w, s.h, rad);
    ctx.fillStyle = "#000"; ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    this._bases.set(key, canvas);
    return canvas;
  };

  function drawBand(ctx, lines, ink, alphaMul) {
    const s = S();
    lines.forEach(function (ln, i) {
      PB.stamp.draw(ctx, ln.text, s.w / 2, ln.y, ln.height, ink, { align: "center", alpha: ln.alpha * alphaMul, seed: i });
    });
  }

  P.render = function (scale) {
    scale = scale || 1;
    const st = this.settings, s = S(), def = PB.styles.get(st.style), hex = PB.styles.paperHex(st.style, st.paper);
    const key = [st.style, hex, scale, this._ver, st.caption, st.showDate, this._now].join("|"), hit = this._finals.get(key);
    if (hit) return hit;
    const base = this._base(scale), W = base.width, H = base.height;
    const canvas = U().createCanvas(W, H), ctx = canvas.getContext("2d");
    ctx.drawImage(base, 0, 0);
    ctx.setTransform(W / s.w, 0, 0, H / s.h, 0, 0);
    drawBand(ctx, bandLines(st, this._now), PB.styles.inkFor(hex).ink, 1);
    this._finals.set(key, canvas);
    return canvas;
  };

  // The develop animation: t runs 0..1. Each frame fades in from a flat pale grey-brown (staggered, frame 1
  // first); the band's stamp prints last. t = 1 is exactly render(scale).
  P.renderDeveloping = function (scale, t) {
    scale = scale || 1;
    t = U().clamp(t, 0, 1);
    if (t >= 1) return this.render(scale);
    const st = this.settings, s = S(), def = PB.styles.get(st.style), hex = PB.styles.paperHex(st.style, st.paper);
    const base = this._base(scale), W = base.width, H = base.height;
    const canvas = U().createCanvas(W, H), ctx = canvas.getContext("2d");
    ctx.drawImage(base, 0, 0);
    ctx.setTransform(W / s.w, 0, 0, H / s.h, 0, 0);
    for (let i = 0; i < PB.FRAMES; i++) {
      const local = U().clamp((t - 0.04 * i) / 0.74, 0, 1), veil = 1 - U().smoothstep(local);
      if (veil <= 0.003) continue;
      const fr = frameRect(i);
      ctx.save(); rrPath(ctx, fr.x, fr.y, fr.w, fr.h, def.radius); ctx.clip();
      ctx.globalAlpha = veil; ctx.fillStyle = PALE; ctx.fillRect(fr.x, fr.y, fr.w, fr.h);
      ctx.restore();
    }
    const printed = U().clamp((t - 0.78) / 0.22, 0, 1);
    if (printed > 0) drawBand(ctx, bandLines(st, this._now), PB.styles.inkFor(hex).ink, printed);
    return canvas;
  };

  P.frameRects = function (scale) {
    scale = scale || 1;
    return [0, 1, 2, 3].map(function (i) { const r = frameRect(i); return { x: r.x * scale, y: r.y * scale, w: r.w * scale, h: r.h * scale }; });
  };

  async function create(photos, crops, settings) {
    if (!photos || photos.length < PB.FRAMES) throw U().error("unreadable", { title: "I need 4 photos.", detail: "Pick 4 photos to make a strip." });
    const strip = new Strip(photos, crops, settings);
    await fontsReady(strip.settings.caption);
    return strip;
  }

  PB.strip = {
    create: create, frameRect: frameRect, bandLines: bandLines, fmtDate: fmtDate, fmtDateSegment: fmtDateSegment,
    cleanCaption: cleanCaption, ADDRESS: ADDRESS, PALE: PALE, rrPath: rrPath, fontsReady: fontsReady
  };
})();
