// A very small software canvas for the Node tests. It is NOT a browser: it holds real pixels so the engine's
// pixel code runs for real, and it understands just enough drawing (rectangles, circles, scaled/translated
// drawImage, putImageData/getImageData) to catch crashes and to make a rough picture of the strip's paper,
// grain, grading and dot-matrix stamp. It ignores rotation, clipping, skew, paths other than circles and rects,
// gradients, shadows and composite modes. Never use it to judge how the real thing looks.
//
//   const FC = require("./fakecanvas.js"); FC.install();   // sets globalThis.OffscreenCanvas so PB.util.createCanvas works
//   FC.toPng(canvas, path)                                  // writes a PNG (alpha composited on mid grey) to look at
const fs = require("fs");
const zlib = require("zlib");

function parseColour(s) {
  if (typeof s !== "string") return null;
  s = s.trim();
  let m = /^#([0-9a-f]{6})$/i.exec(s);
  if (m) { const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1]; }
  m = /^#([0-9a-f]{3})$/i.exec(s);
  if (m) { const h = m[1]; return [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16), 1]; }
  m = /^rgba?\(([^)]+)\)$/i.exec(s);
  if (m) { const p = m[1].split(",").map(parseFloat); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; }
  return null;
}

class FakeCtx {
  constructor(canvas) {
    this.canvas = canvas;
    this.fillStyle = "#000"; this.strokeStyle = "#000"; this.globalAlpha = 1; this.globalCompositeOperation = "source-over";
    this.lineWidth = 1; this.font = ""; this.textAlign = "left"; this.textBaseline = "alphabetic";
    this.shadowColor = "transparent"; this.shadowBlur = 0; this.shadowOffsetX = 0; this.shadowOffsetY = 0;
    this.imageSmoothingEnabled = true; this.imageSmoothingQuality = "low"; this.lineCap = "butt"; this.lineJoin = "miter";
    this.m = { a: 1, d: 1, e: 0, f: 0 }; this.stack = []; this.path = []; this.texts = [];
  }
  save() { this.stack.push({ m: Object.assign({}, this.m), fillStyle: this.fillStyle, globalAlpha: this.globalAlpha, globalCompositeOperation: this.globalCompositeOperation }); }
  restore() { const s = this.stack.pop(); if (s) { this.m = s.m; this.fillStyle = s.fillStyle; this.globalAlpha = s.globalAlpha; this.globalCompositeOperation = s.globalCompositeOperation; } }
  translate(x, y) { this.m.e += this.m.a * x; this.m.f += this.m.d * y; }
  scale(x, y) { this.m.a *= x; this.m.d *= y; }
  rotate() { this.rotated = true; }
  transform() { /* skew is ignored */ }
  setTransform(a, b, c, d, e, f) { this.m = { a: a, d: d, e: e, f: f }; }
  getTransform() { return { a: this.m.a, b: 0, c: 0, d: this.m.d, e: this.m.e, f: this.m.f }; }
  beginPath() { this.path = []; }
  closePath() {} moveTo() {} lineTo() {} arcTo() {} quadraticCurveTo() {} bezierCurveTo() {} stroke() {} clip() {} strokeRect() {}
  rect(x, y, w, h) { this.path.push({ rect: [x, y, w, h] }); }
  arc(x, y, r) { this.path.push({ circle: [x, y, r] }); }
  createLinearGradient() { return { addColorStop() {} }; }
  createRadialGradient() { return { addColorStop() {} }; }
  createImageData(w, h) { return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }; }
  getImageData(x, y, w, h) {
    const out = new Uint8ClampedArray(w * h * 4), c = this.canvas;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const sx = x + i, sy = y + j;
      if (sx < 0 || sy < 0 || sx >= c.width || sy >= c.height) continue;
      const s = (sy * c.width + sx) * 4, d = (j * w + i) * 4;
      out[d] = c.buf[s]; out[d + 1] = c.buf[s + 1]; out[d + 2] = c.buf[s + 2]; out[d + 3] = c.buf[s + 3];
    }
    return { width: w, height: h, data: out };
  }
  putImageData(img, x, y) {
    const c = this.canvas;
    for (let j = 0; j < img.height; j++) for (let i = 0; i < img.width; i++) {
      const dx = x + i, dy = y + j;
      if (dx < 0 || dy < 0 || dx >= c.width || dy >= c.height) continue;
      const s = (j * img.width + i) * 4, d = (dy * c.width + dx) * 4;
      c.buf[d] = img.data[s]; c.buf[d + 1] = img.data[s + 1]; c.buf[d + 2] = img.data[s + 2]; c.buf[d + 3] = img.data[s + 3];
    }
  }
  clearRect(x, y, w, h) { this._rect(x, y, w, h, [0, 0, 0, 0], true); }
  fillText(t, x, y) { this.texts.push({ t: t, x: x, y: y, font: this.font }); }
  measureText(t) { return { width: String(t).length * 6 }; }
  _blend(px, py, rgb, a) {
    const c = this.canvas;
    if (px < 0 || py < 0 || px >= c.width || py >= c.height || a <= 0) return;
    const d = (py * c.width + px) * 4, da = c.buf[d + 3] / 255, oa = a + da * (1 - a);
    if (oa <= 0) return;
    for (let k = 0; k < 3; k++) c.buf[d + k] = (rgb[k] * a + c.buf[d + k] * da * (1 - a)) / oa;
    c.buf[d + 3] = oa * 255;
  }
  _rect(x, y, w, h, col, replace) {
    const m = this.m, x0 = Math.round(m.a * x + m.e), y0 = Math.round(m.d * y + m.f), x1 = Math.round(m.a * (x + w) + m.e), y1 = Math.round(m.d * (y + h) + m.f);
    for (let py = Math.min(y0, y1); py < Math.max(y0, y1); py++) for (let px = Math.min(x0, x1); px < Math.max(x0, x1); px++) {
      if (replace) { const c = this.canvas; if (px >= 0 && py >= 0 && px < c.width && py < c.height) { const d = (py * c.width + px) * 4; c.buf[d] = c.buf[d + 1] = c.buf[d + 2] = c.buf[d + 3] = 0; } }
      else this._blend(px, py, col, col[3] * this.globalAlpha);
    }
  }
  fillRect(x, y, w, h) { const col = parseColour(this.fillStyle); if (col && this.globalCompositeOperation === "source-over") this._rect(x, y, w, h, col, false); }
  fill() {
    const col = parseColour(this.fillStyle), m = this.m;
    if (!col || this.globalCompositeOperation !== "source-over") return;
    this.path.forEach((p) => {
      if (p.rect) this._rect(p.rect[0], p.rect[1], p.rect[2], p.rect[3], col, false);
      else if (p.circle) {
        const cx = m.a * p.circle[0] + m.e, cy = m.d * p.circle[1] + m.f, r = p.circle[2] * Math.abs(m.a);
        for (let py = Math.floor(cy - r - 1); py <= Math.ceil(cy + r + 1); py++) for (let px = Math.floor(cx - r - 1); px <= Math.ceil(cx + r + 1); px++) {
          const dist = Math.hypot(px + 0.5 - cx, py + 0.5 - cy), cov = Math.max(0, Math.min(1, r + 0.5 - dist));
          if (cov > 0) this._blend(px, py, col, cov * col[3] * this.globalAlpha);
        }
      }
    });
  }
  drawImage(src, a1, a2, a3, a4, a5, a6, a7, a8) {
    if (!src || !src.buf) return;
    let sx = 0, sy = 0, sw = src.width, sh = src.height, dx, dy, dw, dh;
    if (a8 !== undefined) { sx = a1; sy = a2; sw = a3; sh = a4; dx = a5; dy = a6; dw = a7; dh = a8; }
    else if (a4 !== undefined) { dx = a1; dy = a2; dw = a3; dh = a4; }
    else { dx = a1; dy = a2; dw = src.width; dh = src.height; }
    if (this.globalCompositeOperation === "destination-in") return;
    const m = this.m, X0 = m.a * dx + m.e, Y0 = m.d * dy + m.f, W = m.a * dw, H = m.d * dh;
    const px0 = Math.round(X0), py0 = Math.round(Y0), px1 = Math.round(X0 + W), py1 = Math.round(Y0 + H);
    for (let py = Math.min(py0, py1); py < Math.max(py0, py1); py++) {
      const v = (py + 0.5 - Y0) / H, syy = Math.min(src.height - 1, Math.max(0, Math.floor(sy + v * sh)));
      for (let px = Math.min(px0, px1); px < Math.max(px0, px1); px++) {
        const u = (px + 0.5 - X0) / W, sxx = Math.min(src.width - 1, Math.max(0, Math.floor(sx + u * sw)));
        const s = (syy * src.width + sxx) * 4;
        this._blend(px, py, [src.buf[s], src.buf[s + 1], src.buf[s + 2]], src.buf[s + 3] / 255 * this.globalAlpha);
      }
    }
  }
}

// a stand-in JPEG with a real SOF0 header, so PB.pdf can read the size
function standInJpeg(w, h) {
  return Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0, 16, 0x4A, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0,
    0xFF, 0xC0, 0, 17, 8, h >> 8, h & 255, w >> 8, w & 255, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1, 0xFF, 0xDA, 0, 12, 3, 1, 0, 2, 0x11, 3, 0x11, 0, 0x3F, 0, 1, 2, 3, 4, 0xFF, 0xD9]);
}

class FakeCanvas {
  constructor(w, h) { this._w = w | 0; this._h = h | 0; this.buf = new Uint8ClampedArray(this._w * this._h * 4); this._ctx = null; }
  get width() { return this._w; } set width(v) { this._w = v | 0; this.buf = new Uint8ClampedArray(this._w * this._h * 4); }
  get height() { return this._h; } set height(v) { this._h = v | 0; this.buf = new Uint8ClampedArray(this._w * this._h * 4); }
  getContext() { if (!this._ctx) this._ctx = new FakeCtx(this); return this._ctx; }
  toBlob(cb, type) { cb(new Blob([standInJpeg(this._w, this._h)], { type: type || "image/jpeg" })); }
  convertToBlob(o) { return Promise.resolve(new Blob([standInJpeg(this._w, this._h)], { type: (o && o.type) || "image/jpeg" })); }
}

function install() { globalThis.OffscreenCanvas = FakeCanvas; }

function crc32(buf) {
  let c, crc = 0xFFFFFFFF;
  for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xFF; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]), crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
// writes the canvas as an RGB PNG, composited over mid grey where it is transparent
function toPng(canvas, file, opts) {
  const w = canvas.width, h = canvas.height, bg = (opts && opts.bg) || [128, 128, 128];
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const s = (y * w + x) * 4, a = canvas.buf[s + 3] / 255, d = y * (w * 3 + 1) + 1 + x * 3;
      for (let k = 0; k < 3; k++) raw[d + k] = canvas.buf[s + k] * a + bg[k] * (1 - a);
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));
}

module.exports = { FakeCanvas: FakeCanvas, FakeCtx: FakeCtx, install: install, toPng: toPng, parseColour: parseColour };
