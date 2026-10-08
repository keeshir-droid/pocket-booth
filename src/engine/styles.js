// The 7 booth styles (PLAN.md section 5.5) and the one-camera finish (section 6.4).
// Everything here is pixel maths on RGBA byte arrays (Uint8ClampedArray), so it runs in Node too and
// behaves the same on every phone (no ctx.filter, which Safari lacks).
//
//   PB.styles.get(id)                       -> the style definition (paper, ink, corner radius, grain, vignette, extras flags)
//   PB.styles.paperHex(styleId, paperId)    -> the strip colour as "#rrggbb"
//   PB.styles.inkFor(paperHex)              -> { ink, dark }   the stamp's colour on that paper (white on dark paper)
//   PB.styles.grade(styleId, data, w, h, scale)   the colour grade of one frame, in place
//   PB.styles.finish(data, w, h, opts)      the one-camera finish, in place: soften, uneven development, vignette, grain
//   PB.styles.process(styleId, data, w, h, opts)  grade + finish; opts = { scale, seed, frame }
//   PB.styles.blurPlane(plane, w, h, sigma) -> Float32Array   a soft blur of one channel (fast, via a small copy)
(function () {
  const PB = (globalThis.PB = globalThis.PB || {});
  const U = function () { return PB.util; };

  function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }
  function smooth(t) { t = t < 0 ? 0 : (t > 1 ? 1 : t); return t * t * (3 - 2 * t); }
  // blend toward the smoothstep S-curve: a = 0 leaves it, a = 1 is the full S
  function sCurve(x, a) { return x + a * (x * x * (3 - 2 * x) - x); }
  function lutOf(fn) { const t = new Float32Array(256); for (let i = 0; i < 256; i++) t[i] = fn(i / 255); return t; }
  function byte(v) { return v <= 0 ? 0 : (v >= 1 ? 255 : (v * 255 + 0.5) | 0); }

  // ---------- a soft blur of one plane, cheap: shrink, box-blur the small copy, grow back ----------
  function blurPlane(plane, w, h, sigma) {
    if (sigma < 0.6) return plane;
    const f = Math.max(1, Math.floor(sigma / 2));
    const sw = Math.ceil(w / f), sh = Math.ceil(h / f);
    let small = plane, ssw = w, ssh = h;
    if (f > 1) {
      small = new Float32Array(sw * sh);
      for (let y = 0; y < sh; y++) {
        const y0 = y * f, y1 = Math.min(h, y0 + f);
        for (let x = 0; x < sw; x++) {
          const x0 = x * f, x1 = Math.min(w, x0 + f);
          let sum = 0;
          for (let yy = y0; yy < y1; yy++) { const o = yy * w; for (let xx = x0; xx < x1; xx++) sum += plane[o + xx]; }
          small[y * sw + x] = sum / ((y1 - y0) * (x1 - x0));
        }
      }
      ssw = sw; ssh = sh;
    }
    const ss = sigma / f;
    const r = Math.max(1, Math.round((Math.sqrt(6 * ss * ss + 1) - 1) / 2));
    const blurred = U().boxBlur(small, ssw, ssh, r, 2);
    if (f === 1) return blurred;
    const out = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      const fy = Math.max(0, (y + 0.5) / f - 0.5), y0 = Math.min(sh - 1, Math.floor(fy)), y1 = Math.min(sh - 1, y0 + 1), ty = fy - y0;
      for (let x = 0; x < w; x++) {
        const fx = Math.max(0, (x + 0.5) / f - 0.5), x0 = Math.min(sw - 1, Math.floor(fx)), x1 = Math.min(sw - 1, x0 + 1), tx = fx - x0;
        const a = blurred[y0 * sw + x0], b = blurred[y0 * sw + x1], c = blurred[y1 * sw + x0], d = blurred[y1 * sw + x1];
        out[y * w + x] = (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
      }
    }
    return out;
  }

  // ---------- the grades ----------
  // Each takes (d, w, h, s): RGBA bytes of one frame at scale s (s only sets blur radii).

  // Classic: the real 80s booth. Black and white, strong S-curve, black point 4%, white point 96%.
  let classicLut = null;
  function gradeClassic(d, w, h) {
    if (!classicLut) {
      classicLut = new Uint8ClampedArray(256);
      for (let i = 0; i < 256; i++) classicLut[i] = byte(sCurve(clamp01((i / 255 - 0.04) / 0.92), 0.95));
    }
    const n = w * h;
    for (let i = 0, p = 0; i < n; i++, p += 4) {
      const v = classicLut[(d[p] * 77 + d[p + 1] * 150 + d[p + 2] * 29) >> 8];
      d[p] = v; d[p + 1] = v; d[p + 2] = v;
    }
  }

  // Warm film: warm highlights (R +6, B -6), lifted blacks 8%, saturation -10%, a soft red halation (10%).
  let filmLut = null;
  function gradeFilm(d, w, h, s) {
    if (!filmLut) filmLut = lutOf(function (c) { return 0.08 + 0.92 * sCurve(c, 0.22); });
    const n = w * h, mask = new Float32Array(n);
    const tone = new Float32Array(n * 3);
    for (let i = 0, p = 0; i < n; i++, p += 4) {
      let r = filmLut[d[p]], g = filmLut[d[p + 1]], b = filmLut[d[p + 2]];
      let l = 0.299 * r + 0.587 * g + 0.114 * b;
      r = l + (r - l) * 0.9; g = l + (g - l) * 0.9; b = l + (b - l) * 0.9;
      // PLAN.md: R +6, B -6 (of 255) is about 2% and reads as nothing on screen, so the warmth is pushed to about
      // R +13, G +3, B -17, strongest in the highlights, with an amber floor so even a black-and-white photo turns warm
      const warm = 0.05 * (0.45 + 0.55 * l);
      r += warm + 0.012; g += warm * 0.22 + 0.004; b -= warm * 1.3;
      l = 0.299 * r + 0.587 * g + 0.114 * b;
      mask[i] = smooth((l - 0.68) / 0.3);
      const q = i * 3; tone[q] = r; tone[q + 1] = g; tone[q + 2] = b;
    }
    const mb = blurPlane(mask, w, h, 7 * s);
    for (let i = 0, p = 0; i < n; i++, p += 4) {
      const q = i * 3, a = 0.10 * Math.min(1, mb[i] * 2.2);
      let r = tone[q], g = tone[q + 1], b = tone[q + 2];
      r += (1 - r) * a; g += (1 - g) * a * 0.28;
      d[p] = byte(r); d[p + 1] = byte(g); d[p + 2] = byte(b);
    }
  }

  // Flash night: direct flash. Centre +18% falling to the corners -25%, high contrast, crushed shadows,
  // a little cool (R -4), saturation +5%.
  function shoulder(v) { return v <= 0.78 ? v : 0.78 + 0.22 * (1 - Math.exp(-(v - 0.78) / 0.22)); }
  let flashLut = null;
  function gradeFlash(d, w, h) {
    if (!flashLut) flashLut = lutOf(function (c) { return Math.pow(sCurve(clamp01((c - 0.07) / 0.93), 0.85), 1.12); });
    const cx = (w - 1) / 2, cy = (h - 1) / 2;
    for (let y = 0; y < h; y++) {
      const dy = (y - cy) / cy, dy2 = dy * dy;
      for (let x = 0; x < w; x++) {
        const dx = (x - cx) / cx, dist = Math.sqrt((dx * dx + dy2) / 2);
        const gain = 1.18 + (0.75 - 1.18) * smooth(dist);
        const p = (y * w + x) * 4;
        // a soft shoulder above 0.78 so the lifted centre rolls off instead of clipping to flat white
        let r = shoulder(d[p] / 255 * gain), g = shoulder(d[p + 1] / 255 * gain), b = shoulder(d[p + 2] / 255 * gain);
        r = flashLut[byte(r)]; g = flashLut[byte(g)]; b = flashLut[byte(b)];
        const l = 0.299 * r + 0.587 * g + 0.114 * b;
        r = l + (r - l) * 1.05 - 0.008; g = l + (g - l) * 1.05; b = l + (b - l) * 1.05 + 0.005; // slightly cool (R -2/255)
        d[p] = byte(r); d[p + 1] = byte(g); d[p + 2] = byte(b);
      }
    }
  }

  // Faded: contrast -30%, black point 15%, cyan shadows, warm-pink highlights, saturation -35%.
  function gradeFaded(d, w, h) {
    const n = w * h;
    for (let i = 0, p = 0; i < n; i++, p += 4) {
      let r = d[p] / 255, g = d[p + 1] / 255, b = d[p + 2] / 255;
      r = 0.5 + (r - 0.5) * 0.7; g = 0.5 + (g - 0.5) * 0.7; b = 0.5 + (b - 0.5) * 0.7;
      r = 0.15 + r * 0.85; g = 0.15 + g * 0.85; b = 0.15 + b * 0.85;
      let l = 0.299 * r + 0.587 * g + 0.114 * b;
      r = l + (r - l) * 0.65; g = l + (g - l) * 0.65; b = l + (b - l) * 0.65;
      const sh = (1 - l) * (1 - l), hi = l * l;
      r += -0.028 * sh + 0.045 * hi; g += 0.012 * sh - 0.008 * hi; b += 0.04 * sh + 0.016 * hi;
      d[p] = byte(r); d[p + 1] = byte(g); d[p + 2] = byte(b);
    }
  }

  // Four-cut: bright (+10% exposure), low contrast, a soft bloom (a blurred copy screened at 20%), a slight pink tint.
  function gradeFourcut(d, w, h, s) {
    const n = w * h;
    const pr = new Float32Array(n), pg = new Float32Array(n), pb = new Float32Array(n);
    for (let i = 0, p = 0; i < n; i++, p += 4) {
      let r = d[p] / 255 * 1.10, g = d[p + 1] / 255 * 1.10, b = d[p + 2] / 255 * 1.10;
      r = 0.5 + (r - 0.5) * 0.88; g = 0.5 + (g - 0.5) * 0.88; b = 0.5 + (b - 0.5) * 0.88;
      r = 0.03 + r * 0.97; g = 0.03 + g * 0.97; b = 0.03 + b * 0.97;
      const l = 0.299 * r + 0.587 * g + 0.114 * b, mid = 1 - (2 * l - 1) * (2 * l - 1) * 0.5;
      r += 0.022 * mid; g -= 0.006 * mid; b += 0.014 * mid;
      pr[i] = clamp01(r); pg[i] = clamp01(g); pb[i] = clamp01(b);
    }
    const sig = 8 * s, br = blurPlane(pr, w, h, sig), bg = blurPlane(pg, w, h, sig), bb = blurPlane(pb, w, h, sig);
    for (let i = 0, p = 0; i < n; i++, p += 4) {
      const r = 1 - (1 - pr[i]) * (1 - 0.2 * br[i]), g = 1 - (1 - pg[i]) * (1 - 0.2 * bg[i]), b = 1 - (1 - pb[i]) * (1 - 0.2 * bb[i]);
      d[p] = byte(r); d[p + 1] = byte(g); d[p + 2] = byte(b);
    }
  }

  // Sepia 1950s: luminance through a brown ramp (#2b1a0e to #f3e3c4, with a warm brown middle).
  let sepiaRamp = null;
  function buildSepiaRamp() {
    const stops = [[0, 43, 26, 14], [0.5, 160, 120, 80], [1, 243, 227, 196]];
    const rr = new Uint8ClampedArray(256), gg = new Uint8ClampedArray(256), bb = new Uint8ClampedArray(256);
    for (let i = 0; i < 256; i++) {
      const x = sCurve(clamp01((i / 255 - 0.01) / 0.97), 0.22);
      const k = x < 0.5 ? 0 : 1, a = stops[k], b = stops[k + 1], t = (x - a[0]) / (b[0] - a[0]);
      rr[i] = a[1] + (b[1] - a[1]) * t; gg[i] = a[2] + (b[2] - a[2]) * t; bb[i] = a[3] + (b[3] - a[3]) * t;
    }
    return { r: rr, g: gg, b: bb };
  }
  function gradeSepia(d, w, h) {
    if (!sepiaRamp) sepiaRamp = buildSepiaRamp();
    const n = w * h;
    for (let i = 0, p = 0; i < n; i++, p += 4) {
      const l = (d[p] * 77 + d[p + 1] * 150 + d[p + 2] * 29) >> 8;
      d[p] = sepiaRamp.r[l]; d[p + 1] = sepiaRamp.g[l]; d[p + 2] = sepiaRamp.b[l];
    }
  }

  // Disposable: warm and saturated (+15%), green-tinted shadows, highlights slightly clipped.
  let dispLut = null;
  function gradeDisposable(d, w, h) {
    if (!dispLut) dispLut = lutOf(function (c) { return clamp01(0.5 + (sCurve(c, 0.2) * 1.09 - 0.5) * 1.08); });
    const n = w * h;
    for (let i = 0, p = 0; i < n; i++, p += 4) {
      let r = dispLut[d[p]], g = dispLut[d[p + 1]], b = dispLut[d[p + 2]];
      const l = 0.299 * r + 0.587 * g + 0.114 * b;
      r = l + (r - l) * 1.15; g = l + (g - l) * 1.15; b = l + (b - l) * 1.15;
      const warm = 0.022 * (0.5 + 0.5 * l), sh = (1 - l) * (1 - l);
      r += warm - 0.012 * sh; b -= warm * 1.2 - 0.002 * sh; g += 0.03 * sh;
      d[p] = byte(r); d[p + 1] = byte(g); d[p + 2] = byte(b);
    }
  }

  // ---------- the shared palette of a colour style ----------
  // Mixed lighting (a magenta lamp, a teal night, a blue sky) is what makes four photos look like different sessions.
  // After the grade each colour style pulls every pixel toward ONE palette:
  //   1. colours far from the palette's hue lose chroma (blue/teal away from amber, blue/green away from pink)
  //   2. a soft cap on per-pixel saturation, so the most extreme colours are tamed the most
  //   3. a split-tone: shadows lean one way, highlights another (this is also what gives a B&W photo its faint style tint)
  // pal = { hue (degrees, in the YIQ colour plane), pull (0..1), cap (max saturation, soft), shadow: [r,g,b], high: [r,g,b] }
  function palette(d, w, h, pal) {
    if (!pal) return;
    const a = pal.hue * Math.PI / 180, tx = Math.cos(a), ty = Math.sin(a), pull = pal.pull, cap = pal.cap;
    const sh = pal.shadow, hi = pal.high, n = w * h;
    for (let i = 0, p = 0; i < n; i++, p += 4) {
      let r = d[p] / 255, g = d[p + 1] / 255, b = d[p + 2] / 255;
      const l = 0.299 * r + 0.587 * g + 0.114 * b;
      const I = 0.596 * r - 0.274 * g - 0.322 * b, Q = 0.211 * r - 0.523 * g + 0.312 * b, m = Math.sqrt(I * I + Q * Q);
      if (m > 0.004) {
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b), s = (mx - mn) / (mx + 0.04);
        const q = s / cap, soft = 1 / Math.sqrt(Math.sqrt(1 + q * q * q * q)); // 1 for mild colours, cap / s for extreme ones
        const dist = (1 - (I * tx + Q * ty) / m) / 2, k = Math.min(1, dist / 0.45), far = k * k * (3 - 2 * k);
        const cs = soft * (1 - pull * far);
        r = l + (r - l) * cs; g = l + (g - l) * cs; b = l + (b - l) * cs;
      }
      const ws = (1 - l) * (1 - l), wh = l * l;
      r += sh[0] * ws + hi[0] * wh; g += sh[1] * ws + hi[1] * wh; b += sh[2] * ws + hi[2] * wh;
      d[p] = byte(r); d[p + 1] = byte(g); d[p + 2] = byte(b);
    }
  }

  // ---------- the style definitions ----------
  // radius: frame corner radius at 600 x 1800 (px). grain / vignette: PLAN.md 5.5 (film's vignette and the
  // others the plan leaves open are small, so the finish is still shared). mono: grain is luminance only.
  const DEFS = {
    classic:    { id: "classic",    name: "Classic",      paper: "#f7f5f0", radius: 0,  grain: 0.06, vignette: 0.15, mono: true,  grade: gradeClassic },
    film:       { id: "film",       name: "Warm film",    paper: "#f1e8d6", radius: 0,  grain: 0.05, vignette: 0.08, mono: false, grade: gradeFilm,
                  palette: { hue: -10, pull: 0.62, cap: 0.55, shadow: [0.022, 0.006, -0.012], high: [0.030, 0.016, -0.022] } },   // amber and cream
    flash:      { id: "flash",      name: "Flash night",  paper: "#141414", radius: 0,  grain: 0.07, vignette: 0,    mono: false, grade: gradeFlash,
                  palette: { hue: 0, pull: 0, cap: 0.62, shadow: [0, 0, 0.004], high: [0, 0, 0] } },                              // only tames extremes
    faded:      { id: "faded",      name: "Faded",        paper: "#efe2bf", radius: 4,  grain: 0.05, vignette: 0.05, mono: false, grade: gradeFaded, worn: true },
    fourcut:    { id: "fourcut",    name: "Four-cut",     paper: "#f6d6dc", radius: 18, grain: 0.03, vignette: 0,    mono: false, grade: gradeFourcut, bandTitle: "POCKET BOOTH",
                  palette: { hue: 20, pull: 0.58, cap: 0.5, shadow: [0.014, -0.004, 0.012], high: [0.026, 0.008, 0.002] } },     // soft pink and peach pastel
    sepia:      { id: "sepia",      name: "Sepia 1950s",  paper: "#efe6d2", radius: 8,  grain: 0.065, vignette: 0.25, mono: true,  grade: gradeSepia, scuffs: true },
    disposable: { id: "disposable", name: "Disposable",   paper: "#f7f5f0", radius: 0,  grain: 0.06, vignette: 0.20, mono: false, grade: gradeDisposable, dateStamp: true,
                  palette: { hue: -32, pull: 0.5, cap: 0.7, shadow: [-0.004, 0.016, -0.004], high: [0.030, 0.017, -0.030] } }  // drugstore: green shadows, yellow-orange lights
  };
  function get(id) { return DEFS[id] || DEFS.classic; }

  function paperHex(styleId, paperId) {
    if (paperId && paperId !== "auto") {
      for (let i = 0; i < PB.PAPERS.length; i++) if (PB.PAPERS[i].id === paperId && PB.PAPERS[i].hex) return PB.PAPERS[i].hex;
    }
    return get(styleId).paper;
  }
  function inkFor(hex) {
    const c = U().hexToRgb(hex), l = (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255;
    return l < 0.4 ? { ink: "#f1ede4", dark: true } : { ink: "#27211e", dark: false };
  }

  // ---------- the one-camera finish ----------
  // 1. the same tiny softening (a 0.6 px blur at full size) on every frame
  // 2. a touch of uneven development (a few percent, slow across the frame, different on each frame) and a
  //    slightly darker rim, like a chemical print
  // 3. the style's vignette
  // 4. grain from one seed per strip (the same grain on all four frames, read at different offsets)
  const TILE_N = 512, TILE_MASK = TILE_N - 1, GRAIN_K = 0.40;
  let tileSeed = null, tile = null;
  function grainTile(seed) {
    if (tile && tileSeed === seed) return tile;
    const rnd = U().mulberry32(seed ^ 0x51ed270b);
    const N = TILE_N, white = new Float32Array(N * N);
    for (let i = 0; i < white.length; i++) white[i] = (rnd() + rnd() + rnd() - 1.5) * 2; // about unit variance
    // a little clumping: part blurred (grain has a size), part crisp
    const tmp = new Float32Array(N * N), out = new Float32Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const o = y * N; tmp[o + x] = 0.25 * white[o + ((x - 1) & TILE_MASK)] + 0.5 * white[o + x] + 0.25 * white[o + ((x + 1) & TILE_MASK)];
    }
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const b = 0.25 * tmp[((y - 1) & TILE_MASK) * N + x] + 0.5 * tmp[y * N + x] + 0.25 * tmp[((y + 1) & TILE_MASK) * N + x];
      out[y * N + x] = 0.62 * b * 2.67 + 0.78 * white[y * N + x]; // blurred part renormalised, plus crisp part
    }
    tile = out; tileSeed = seed;
    return tile;
  }

  function soften(d, w, h, sigma) {
    if (sigma < 0.25) return;
    const w1 = Math.exp(-1 / (2 * sigma * sigma)), k1 = w1 / (1 + 2 * w1), k0 = 1 / (1 + 2 * w1);
    const tmp = new Uint8ClampedArray(d.length);
    for (let y = 0; y < h; y++) {
      const row = y * w * 4;
      for (let x = 0; x < w; x++) {
        const p = row + x * 4, pl = x > 0 ? p - 4 : p, pr = x < w - 1 ? p + 4 : p;
        tmp[p] = d[pl] * k1 + d[p] * k0 + d[pr] * k1; tmp[p + 1] = d[pl + 1] * k1 + d[p + 1] * k0 + d[pr + 1] * k1;
        tmp[p + 2] = d[pl + 2] * k1 + d[p + 2] * k0 + d[pr + 2] * k1; tmp[p + 3] = d[p + 3];
      }
    }
    const stride = w * 4;
    for (let y = 0; y < h; y++) {
      const up = y > 0 ? -stride : 0, dn = y < h - 1 ? stride : 0;
      for (let x = 0; x < stride; x += 4) {
        const p = y * stride + x;
        d[p] = tmp[p + up] * k1 + tmp[p] * k0 + tmp[p + dn] * k1; d[p + 1] = tmp[p + up + 1] * k1 + tmp[p + 1] * k0 + tmp[p + dn + 1] * k1;
        d[p + 2] = tmp[p + up + 2] * k1 + tmp[p + 2] * k0 + tmp[p + dn + 2] * k1; d[p + 3] = 255;
      }
    }
  }

  // opts: { scale, grain, vignette, mono, seed, frame, soften (true by default) }
  function finish(d, w, h, o) {
    const s = o.scale || 1, seed = (o.seed >>> 0) || 1, frameIx = o.frame || 0;
    soften(d, w, h, 0.6 * s);
    const rnd = U().mulberry32(seed + frameIx * 7919 + 13);
    // the slow density field: a coarse grid of small offsets, read with bilinear steps
    const GX = 9, GY = 7, grid = new Float32Array(GX * GY);
    for (let i = 0; i < grid.length; i++) grid[i] = (rnd() * 2 - 1) * 0.024;
    const xi = new Int32Array(w), xt = new Float32Array(w);
    for (let x = 0; x < w; x++) { const f = x / Math.max(1, w - 1) * (GX - 1), i0 = Math.min(GX - 2, Math.floor(f)); xi[x] = i0; xt[x] = f - i0; }
    // grain: 6% means a standard deviation of about 6% x 255 x GRAIN_K levels on a mid-tone. On the half-size
    // screen render each grain pixel is twice as big, so it is eased down there to read as the same fine grain.
    const vig = o.vignette || 0, amp = (o.grain || 0) * 255 * GRAIN_K * (s < 1 ? 0.6 + 0.4 * s : 1);
    const tl = amp > 0 ? grainTile(seed) : null;
    const ox = (rnd() * TILE_N) | 0, oy = (rnd() * TILE_N) | 0;
    const chroma = o.mono ? 0 : 0.34, luma = o.mono ? 1 : 0.94;
    const cx = (w - 1) / 2, cy = (h - 1) / 2, rim = 5 * s;
    for (let y = 0; y < h; y++) {
      const fy = y / Math.max(1, h - 1) * (GY - 1), j0 = Math.min(GY - 2, Math.floor(fy)), ty = fy - j0;
      const g0 = j0 * GX, g1 = g0 + GX, dy = (y - cy) / cy, dy2 = dy * dy, ey = Math.min(y, h - 1 - y);
      const ty0 = ((y + oy) & TILE_MASK) * TILE_N;
      for (let x = 0; x < w; x++) {
        const i0 = xi[x], t = xt[x];
        const dens = (grid[g0 + i0] * (1 - t) + grid[g0 + i0 + 1] * t) * (1 - ty) + (grid[g1 + i0] * (1 - t) + grid[g1 + i0 + 1] * t) * ty;
        const dx = (x - cx) / cx;
        let m = (1 - vig * (dx * dx + dy2) * 0.5) * (1 + dens);
        const e = Math.min(x, w - 1 - x, ey);
        if (e < rim) { const k = 1 - e / rim; m *= 1 - 0.09 * k * k; }
        const p = (y * w + x) * 4;
        let r = d[p] * m, g = d[p + 1] * m, b = d[p + 2] * m;
        if (tl) {
          const l = (0.299 * r + 0.587 * g + 0.114 * b) / 255, q = 2 * l - 1, wgt = 0.38 + 0.62 * (1 - q * q);
          const tx = (x + ox) & TILE_MASK, n0 = tl[ty0 + tx] * luma;
          if (chroma) {
            const nr = tl[((y + oy + 173) & TILE_MASK) * TILE_N + ((x + ox + 289) & TILE_MASK)], ng = tl[((y + oy + 331) & TILE_MASK) * TILE_N + ((x + ox + 97) & TILE_MASK)], nb = tl[((y + oy + 41) & TILE_MASK) * TILE_N + ((x + ox + 457) & TILE_MASK)];
            const a = amp * wgt;
            r += a * (n0 + chroma * nr); g += a * (n0 + chroma * ng); b += a * (n0 + chroma * nb);
          } else {
            const a = amp * wgt * n0; r += a; g += a; b += a;
          }
        }
        d[p] = r; d[p + 1] = g; d[p + 2] = b; // the clamped array rounds and clamps
      }
    }
  }

  function grade(id, d, w, h, scale) { get(id).grade(d, w, h, scale || 1); }
  function process(id, d, w, h, o) {
    const def = get(id), opts = o || {};
    def.grade(d, w, h, opts.scale || 1);
    palette(d, w, h, def.palette);
    finish(d, w, h, { scale: opts.scale, seed: opts.seed, frame: opts.frame, grain: def.grain, vignette: def.vignette, mono: def.mono });
  }

  PB.styles = {
    get: get, paperHex: paperHex, inkFor: inkFor, grade: grade, finish: finish, process: process,
    blurPlane: blurPlane, palette: palette, list: function () { return PB.STYLES.map(function (s) { return get(s.id); }); }
  };
})();
