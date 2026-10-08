// Photos: the photo object, framing (auto-crop, clamp, draw) and matching (PLAN.md sections 6.4, 7.3).
// Nothing browser-only is touched at load time; the pixel maths (statistics, matchPixels) run in Node too.
//
//   PB.photo.from(source, { live })  -> Promise<Photo>    source: ImageData | canvas | image/bitmap
//        photo = { id, width, height, live, canvas, imageData, stats() }
//   PB.photo.autoCrop(photo)             -> { cx, cy, zoom }   centred left to right, centred 40% from the top, zoom 1
//   PB.photo.clampCrop(photo, crop)      -> crop               zoom 1..8; the frame stays covered by the photo
//   PB.photo.drawCrop(canvas, photo, crop)                     the frame editor's view, un-styled, sized to the canvas
//   PB.photo.cropRect(photo, crop, aspect?) -> { sx, sy, sw, sh }   the part of the photo the frame shows
//   PB.photo.frame(photo, crop, w, h)    -> canvas w x h       the crop, un-styled, un-matched
//   PB.photo.matched(photo, crop, w, h)  -> canvas w x h       the crop, then matched (live shots at half strength)
//   PB.photo.statistics(imageDataLike)   -> { mean, luma: { mean, p1, p50, p99 }, contrast }
//   PB.photo.matchPixels(data, w, h, strength) -> params       matches an RGBA array in place (the three steps of 6.4)
(function () {
  const PB = (globalThis.PB = globalThis.PB || {});
  const U = function () { return PB.util; };

  const MAX_SIDE = 2400;        // a photo held in memory is never bigger than this on its long side
  const MAX_ZOOM = 8;
  const TARGET_MEDIAN = 0.48;
  let nextId = 1;

  function frameAspect() { return PB.STRIP.frameW / PB.STRIP.frameH; }

  // ---------- drawing helpers ----------
  // Draws a region of a source canvas into a destination rectangle, halving step by step first so a big
  // photo is not thrown away in one jump (the browser's own big downscale can alias).
  function drawRegion(ctx, src, sx, sy, sw, sh, dx, dy, dw, dh) {
    let cur = src, rx = sx, ry = sy, rw = sw, rh = sh;
    while (rw / 2 >= dw && rh / 2 >= dh && rw > 8 && rh > 8) {
      const nw = Math.max(1, Math.round(rw / 2)), nh = Math.max(1, Math.round(rh / 2));
      const c = U().createCanvas(nw, nh);
      const x = c.getContext("2d");
      x.imageSmoothingEnabled = true; x.imageSmoothingQuality = "high";
      x.drawImage(cur, rx, ry, rw, rh, 0, 0, nw, nh);
      cur = c; rx = 0; ry = 0; rw = nw; rh = nh;
    }
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    ctx.drawImage(cur, rx, ry, rw, rh, dx, dy, dw, dh);
  }

  // ---------- the photo object ----------
  function isImageDataLike(s) { return s && s.data && typeof s.width === "number" && typeof s.height === "number" && !s.getContext; }

  async function from(source, opts) {
    const live = !!(opts && opts.live);
    if (!source) throw U().error("unreadable");
    const sw = source.width || source.naturalWidth || source.videoWidth, sh = source.height || source.naturalHeight || source.videoHeight;
    if (!sw || !sh) throw U().error("unreadable");
    const photo = { id: nextId++, width: sw, height: sh, live: live, canvas: null, imageData: null };
    let cache = null;
    photo.stats = function () { // lazy: measured on a small copy
      if (!cache) cache = statisticsOfPhoto(photo);
      return cache;
    };
    if (isImageDataLike(source)) {
      photo.imageData = source;
      try {
        const c = U().createCanvas(sw, sh);
        const real = (typeof ImageData !== "undefined" && source instanceof ImageData) ? source : U().makeImageData(sw, sh, source.data);
        c.getContext("2d").putImageData(real, 0, 0);
        photo.canvas = c;
      } catch (e) { photo.canvas = null; } // Node: no canvas, the maths still work on imageData
    } else {
      // a canvas (the camera's grab), an <img> or an ImageBitmap
      const k = Math.min(1, MAX_SIDE / Math.max(sw, sh));
      if (k < 1 || !source.getContext) {
        const w = Math.max(1, Math.round(sw * k)), h = Math.max(1, Math.round(sh * k));
        const c = U().createCanvas(w, h);
        drawRegion(c.getContext("2d"), source, 0, 0, sw, sh, 0, 0, w, h);
        photo.canvas = c; photo.width = w; photo.height = h;
      } else {
        photo.canvas = source;
      }
    }
    if (photo.canvas && photo.imageData && Math.max(sw, sh) > MAX_SIDE) { // decode caps at 2000, but be safe
      const k = MAX_SIDE / Math.max(sw, sh), w = Math.round(sw * k), h = Math.round(sh * k);
      const c = U().createCanvas(w, h);
      drawRegion(c.getContext("2d"), photo.canvas, 0, 0, sw, sh, 0, 0, w, h);
      photo.canvas = c; photo.width = w; photo.height = h; photo.imageData = null;
    }
    return photo;
  }

  // ---------- framing ----------
  // The crop is { cx, cy, zoom }: the centre of the window (0..1 of the photo) and a zoom of at least 1
  // relative to the cover fit (the largest window of the frame's shape that fits in the photo).
  function coverSize(W, H, aspect) {
    return (W / H > aspect) ? { cw: H * aspect, ch: H } : { cw: W, ch: W / aspect };
  }
  function clampCrop(photo, crop, aspect) {
    const W = photo.width, H = photo.height;
    const c = crop || {};
    const z = U().clamp(typeof c.zoom === "number" && isFinite(c.zoom) ? c.zoom : 1, 1, MAX_ZOOM);
    const cs = coverSize(W, H, aspect || frameAspect());
    const hw = (cs.cw / z) / 2 / W, hh = (cs.ch / z) / 2 / H; // half the window, as a fraction of the photo
    const cx = typeof c.cx === "number" && isFinite(c.cx) ? c.cx : 0.5;
    const cy = typeof c.cy === "number" && isFinite(c.cy) ? c.cy : 0.4;
    return { cx: U().clamp(cx, hw, 1 - hw), cy: U().clamp(cy, hh, 1 - hh), zoom: z };
  }
  function autoCrop(photo) { return clampCrop(photo, { cx: 0.5, cy: 0.4, zoom: 1 }); }
  function cropRect(photo, crop, aspect) {
    const A = aspect || frameAspect();
    const c = clampCrop(photo, crop, A), W = photo.width, H = photo.height;
    const cs = coverSize(W, H, A), sw = cs.cw / c.zoom, sh = cs.ch / c.zoom;
    return {
      sx: U().clamp(c.cx * W - sw / 2, 0, W - sw),
      sy: U().clamp(c.cy * H - sh / 2, 0, H - sh),
      sw: sw, sh: sh
    };
  }
  function drawCrop(canvas, photo, crop) {
    const ctx = canvas.getContext("2d");
    const r = cropRect(photo, crop);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawRegion(ctx, photo.canvas, r.sx, r.sy, r.sw, r.sh, 0, 0, canvas.width, canvas.height);
  }
  function frame(photo, crop, w, h) {
    const c = U().createCanvas(w, h);
    const ctx = c.getContext("2d", { willReadFrequently: true });
    const r = cropRect(photo, crop);
    drawRegion(ctx, photo.canvas, r.sx, r.sy, r.sw, r.sh, 0, 0, w, h);
    return c;
  }
  function matched(photo, crop, w, h) {
    const c = frame(photo, crop, w, h);
    const ctx = c.getContext("2d", { willReadFrequently: true });
    const id = ctx.getImageData(0, 0, w, h);
    matchPixels(id.data, w, h, photo.live ? 0.5 : 1);
    ctx.putImageData(id, 0, 0);
    return c;
  }

  // ---------- statistics ----------
  function pctFromHist(hist, total, p) {
    const target = total * p;
    let acc = 0;
    for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc > target) return i; }
    return 255;
  }
  function statistics(src) {
    const d = src.data, n = src.width * src.height;
    const hl = new Uint32Array(256);
    let sr = 0, sg = 0, sb = 0, sl = 0;
    for (let i = 0, p = 0; i < n; i++, p += 4) {
      const r = d[p], g = d[p + 1], b = d[p + 2];
      const l = (r * 299 + g * 587 + b * 114) / 1000;
      hl[l | 0]++; sr += r; sg += g; sb += b; sl += l;
    }
    const inv = n ? 1 / (n * 255) : 0;
    const p1 = pctFromHist(hl, n, 0.01) / 255, p50 = pctFromHist(hl, n, 0.5) / 255, p99 = pctFromHist(hl, n, 0.99) / 255;
    return { width: src.width, height: src.height, mean: { r: sr * inv, g: sg * inv, b: sb * inv }, luma: { mean: sl * inv, p1: p1, p50: p50, p99: p99 }, contrast: p99 - p1 };
  }
  function statisticsOfPhoto(photo) {
    if (photo.imageData) return statistics(photo.imageData);
    if (!photo.canvas) return null;
    const k = 96 / Math.max(photo.width, photo.height), w = Math.max(1, Math.round(photo.width * k)), h = Math.max(1, Math.round(photo.height * k));
    const c = U().createCanvas(w, h), ctx = c.getContext("2d", { willReadFrequently: true });
    drawRegion(ctx, photo.canvas, 0, 0, photo.width, photo.height, 0, 0, w, h);
    return statistics(ctx.getImageData(0, 0, w, h));
  }

  // ---------- matching (PLAN.md 6.4) ----------
  // Runs on the cropped frame at strip size, before the style. In order:
  //   1. levels: stretch from the 1% / 99% luminance percentiles, blended 70%
  //   2. white balance: grey-world, gains clamped 0.8..1.25, blended 50%
  //   3. exposure: a midtone gamma moving the median luminance toward 0.48, blended 70%
  // `strength` is 1 for camera-roll photos and 0.5 for live shots (they already match). Edits `data` in place.
  // PLAN.md says white balance 50% with gains 0.8..1.25. On real mismatched photos (magenta lamp, teal night, blue
  // daylight) that left four obviously different colour worlds, so it is 70% with gains 0.75..1.33, plus step 4 below.
  const LEVELS_BLEND = 0.7, WB_BLEND = 0.7, WB_MIN = 0.75, WB_MAX = 1.33, EXPOSURE_BLEND = 0.7, MAX_LEVEL_GAIN = 2.2;
  const TARGET_SAT = 0.27, SAT_BLEND = 0.7;
  function matchPixels(data, w, h, strength) {
    const s = strength === undefined || strength === null ? 1 : strength;
    const n = w * h;
    const hl = new Uint32Array(256), hr = new Uint32Array(256), hg = new Uint32Array(256), hb = new Uint32Array(256);
    for (let i = 0, p = 0; i < n; i++, p += 4) {
      const r = data[p], g = data[p + 1], b = data[p + 2];
      hl[((r * 299 + g * 587 + b * 114) / 1000) | 0]++; hr[r]++; hg[g]++; hb[b]++;
    }
    // 1. levels
    const lo = Math.min(pctFromHist(hl, n, 0.01) / 255, 0.2);
    const hi = Math.max(pctFromHist(hl, n, 0.99) / 255, lo + 0.1);
    const gain = Math.min(1 / (hi - lo), MAX_LEVEL_GAIN);
    const lb = LEVELS_BLEND * s;
    const lev = new Float32Array(256);
    for (let c = 0; c < 256; c++) {
      const v = c / 255, st = U().clamp((v - lo) * gain, 0, 1);
      lev[c] = v + (st - v) * lb;
    }
    // 2. white balance (grey-world on the mid-tones, so clipped sky or deep shadow don't pull it)
    function midMean(hist) {
      let sum = 0, cnt = 0;
      for (let c = 8; c < 248; c++) { sum += lev[c] * hist[c]; cnt += hist[c]; }
      return { sum: sum, cnt: cnt };
    }
    const mr = midMean(hr), mg = midMean(hg), mb = midMean(hb);
    let gr = 1, gg = 1, gb = 1;
    if (mr.cnt > n * 0.02 && mg.cnt > n * 0.02 && mb.cnt > n * 0.02) {
      const ar = mr.sum / mr.cnt, ag = mg.sum / mg.cnt, ab = mb.sum / mb.cnt;
      if (ar > 0.01 && ab > 0.01) {
        gr = ag / ar; gb = ag / ab; gg = 1;
        const k = 0.299 * gr + 0.587 * gg + 0.114 * gb; // keep the brightness where it was
        gr = U().clamp(gr / k, WB_MIN, WB_MAX); gg = U().clamp(gg / k, WB_MIN, WB_MAX); gb = U().clamp(gb / k, WB_MIN, WB_MAX);
      }
    }
    const wb = WB_BLEND * s;
    gr = 1 + (gr - 1) * wb; gg = 1 + (gg - 1) * wb; gb = 1 + (gb - 1) * wb;
    const lutR = new Float32Array(256), lutG = new Float32Array(256), lutB = new Float32Array(256);
    for (let c = 0; c < 256; c++) {
      lutR[c] = Math.min(1, lev[c] * gr); lutG[c] = Math.min(1, lev[c] * gg); lutB[c] = Math.min(1, lev[c] * gb);
    }
    // 3. exposure: where does the median land now?
    const h2 = new Uint32Array(256);
    for (let i = 0, p = 0; i < n; i++, p += 4) {
      const l = 0.299 * lutR[data[p]] + 0.587 * lutG[data[p + 1]] + 0.114 * lutB[data[p + 2]];
      h2[(l * 255 + 0.5) | 0]++;
    }
    const med = U().clamp(pctFromHist(h2, n, 0.5) / 255, 0.04, 0.96);
    const gam = U().clamp(Math.log(TARGET_MEDIAN) / Math.log(med), 0.4, 2.0);
    const ge = 1 + (gam - 1) * EXPOSURE_BLEND * s;
    const oR = new Uint8ClampedArray(256), oG = new Uint8ClampedArray(256), oB = new Uint8ClampedArray(256);
    const tR = new Float32Array(256), tG = new Float32Array(256), tB = new Float32Array(256);
    for (let c = 0; c < 256; c++) {
      tR[c] = Math.pow(lutR[c], ge); tG[c] = Math.pow(lutG[c], ge); tB[c] = Math.pow(lutB[c], ge);
    }
    // 4. colourfulness: a magenta party photo and a pale daylight one are the biggest give-away that four photos are not
    //    one session, so the mean saturation of the mid-tones moves toward a common value, blended 60%
    //    (a black-and-white photo has none to move and is left alone)
    let satSum = 0, satN = 0;
    for (let i = 0, p = 0; i < n; i += 3, p += 12) {
      const r = tR[data[p]], g = tG[data[p + 1]], b = tB[data[p + 2]], mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      if (mx > 0.15 && mx < 0.97) { satSum += (mx - mn) / mx; satN++; }
    }
    let satGain = 1;
    const meanSat = satN > n / 3 * 0.1 ? satSum / satN : 0;
    if (meanSat > 0.04) satGain = 1 + (U().clamp(TARGET_SAT / meanSat, 0.55, 1.35) - 1) * SAT_BLEND * s;
    if (Math.abs(satGain - 1) < 0.01) {
      for (let c = 0; c < 256; c++) { // (a Uint8ClampedArray rounds to the nearest whole number itself)
        oR[c] = tR[c] * 255; oG[c] = tG[c] * 255; oB[c] = tB[c] * 255;
      }
      for (let i = 0, p = 0; i < n; i++, p += 4) {
        data[p] = oR[data[p]]; data[p + 1] = oG[data[p + 1]]; data[p + 2] = oB[data[p + 2]];
      }
    } else {
      for (let i = 0, p = 0; i < n; i++, p += 4) {
        const r = tR[data[p]], g = tG[data[p + 1]], b = tB[data[p + 2]], l = 0.299 * r + 0.587 * g + 0.114 * b;
        data[p] = (l + (r - l) * satGain) * 255; data[p + 1] = (l + (g - l) * satGain) * 255; data[p + 2] = (l + (b - l) * satGain) * 255;
      }
    }
    return { lo: lo, hi: hi, gain: gain, gains: { r: gr, g: gg, b: gb }, medianBefore: med, gamma: ge, satGain: satGain, strength: s };
  }

  PB.photo = {
    from: from, autoCrop: autoCrop, clampCrop: clampCrop, drawCrop: drawCrop, cropRect: cropRect,
    frame: frame, matched: matched, statistics: statistics, matchPixels: matchPixels,
    drawRegion: drawRegion, MAX_ZOOM: MAX_ZOOM, TARGET_MEDIAN: TARGET_MEDIAN
  };
})();
