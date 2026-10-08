// A minimal hand-written PDF writer (PLAN.md section 6.6). No library. Runs in Node too.
// PDF 1.4: Catalog (with /PrintScaling /None), Pages, one Page, one JPEG image (DCTDecode), the standard
// Helvetica font, one uncompressed content stream, a correct xref table. The JPEG is embedded ONCE and drawn
// once per strip placement (one image object, four `cm` placements).
//
//   PB.pdf.build({ layout, jpeg, imageWidth?, imageHeight?, title? }) -> Uint8Array
//        layout: PB.print.layout(...)   jpeg: Uint8Array of a baseline JPEG (the size is read from the file if not given)
//   PB.pdf.jpegInfo(bytes) -> { width, height, components } | null
(function () {
  const PB = (globalThis.PB = globalThis.PB || {});

  function num(v) {
    const s = (Math.round(v * 1000) / 1000).toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
    return s === "-0" ? "0" : s;
  }
  function latin1(str) {
    const out = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); out[i] = c < 256 ? c : 63; }
    return out;
  }
  function esc(text) { // a PDF literal string, WinAnsi bytes
    let s = "";
    for (let i = 0; i < text.length; i++) {
      const ch = text[i], c = text.charCodeAt(i);
      if (ch === "\\" || ch === "(" || ch === ")") s += "\\" + ch;
      else if (c < 32 || c > 255) s += "?";
      else s += ch;
    }
    return "(" + s + ")";
  }

  function jpegInfo(b) {
    if (!b || b.length < 4 || b[0] !== 0xFF || b[1] !== 0xD8) return null;
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xFF) { i++; continue; }
      const m = b[i + 1];
      if (m === 0xFF) { i++; continue; }
      if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) {
        return { width: (b[i + 7] << 8) | b[i + 8], height: (b[i + 5] << 8) | b[i + 6], components: b[i + 9] };
      }
      if (m === 0xD8 || m === 0x01 || (m >= 0xD0 && m <= 0xD7)) { i += 2; continue; }
      i += 2 + ((b[i + 2] << 8) | b[i + 3]);
    }
    return null;
  }

  // the matrix that puts the image's unit square on a strip box (PDF space: origin bottom left, y up)
  function placement(s, pageH) {
    const X0 = s.x, Y0 = pageH - (s.y + s.h), w = s.w, h = s.h;
    if (s.rotate === -90) return [0, h, -w, 0, X0 + w, Y0];   // counter-clockwise: the strip's top at the left
    if (s.rotate === 90) return [0, -h, w, 0, X0, Y0 + h];    // clockwise: the strip's top at the right
    return [w, 0, 0, h, X0, Y0];
  }

  function contentStream(L) {
    const H = L.page.h, out = [];
    L.strips.forEach(function (s) {
      const m = placement(s, H);
      out.push("q " + m.map(num).join(" ") + " cm /Im0 Do Q");
    });
    out.push("0 G 0.5 w");
    let path = "";
    L.marks.forEach(function (k) { path += num(k.x1) + " " + num(H - k.y1) + " m " + num(k.x2) + " " + num(H - k.y2) + " l "; });
    out.push(path + "S");
    const r = L.ruler, ty = H - r.y;
    out.push("0.4 G " + num(r.x1) + " " + num(ty) + " m " + num(r.x2) + " " + num(ty) + " l " +
      num(r.x1) + " " + num(ty - r.tick / 2) + " m " + num(r.x1) + " " + num(ty + r.tick / 2) + " l " +
      num(r.x2) + " " + num(ty - r.tick / 2) + " m " + num(r.x2) + " " + num(ty + r.tick / 2) + " l S");
    L.texts.forEach(function (t) {
      out.push("BT /F1 " + num(t.size) + " Tf " + num(t.grey) + " g " + num(t.x) + " " + num(H - t.y) + " Td " + esc(t.text) + " Tj ET");
    });
    return out.join("\n") + "\n";
  }

  function build(o) {
    if (!o || !o.layout || !o.jpeg) throw new Error("pdf: a layout and a JPEG are needed");
    const L = o.layout, jpeg = o.jpeg, info = jpegInfo(jpeg);
    const iw = o.imageWidth || (info && info.width), ih = o.imageHeight || (info && info.height);
    if (!iw || !ih) throw new Error("pdf: not a JPEG I can read");
    const cs = info && info.components === 1 ? "/DeviceGray" : (info && info.components === 4 ? "/DeviceCMYK" : "/DeviceRGB");
    const chunks = [], offsets = [];
    let pos = 0;
    function push(u8) { chunks.push(u8); pos += u8.length; }
    function str(s) { push(latin1(s)); }
    function obj(n, body) { offsets[n] = pos; str(n + " 0 obj\n" + body + "\nendobj\n"); }

    str("%PDF-1.4\n"); push(new Uint8Array([0x25, 0xE2, 0xE3, 0xCF, 0xD3, 0x0A])); // the binary-file comment
    obj(1, "<< /Type /Catalog /Pages 2 0 R /ViewerPreferences << /PrintScaling /None >> >>");
    obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
    obj(3, "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + num(L.page.w) + " " + num(L.page.h) + "] " +
      "/Resources << /XObject << /Im0 4 0 R >> /Font << /F1 5 0 R >> /ProcSet [/PDF /Text /ImageC] >> /Contents 6 0 R >>");
    offsets[4] = pos;
    str("4 0 obj\n<< /Type /XObject /Subtype /Image /Width " + iw + " /Height " + ih + " /ColorSpace " + cs +
      " /BitsPerComponent 8 /Filter /DCTDecode /Length " + jpeg.length + " >>\nstream\n");
    push(jpeg);
    str("\nendstream\nendobj\n");
    obj(5, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
    const content = contentStream(L);
    obj(6, "<< /Length " + content.length + " >>\nstream\n" + content + "endstream");
    obj(7, "<< /Title " + esc(o.title || "Pocket Booth print sheet") + " /Creator (the-pocket-booth.vercel.app) /Producer (Pocket Booth) >>");

    const xrefAt = pos, count = 8;
    let x = "xref\n0 " + count + "\n0000000000 65535 f \n";
    for (let n = 1; n < count; n++) x += String(offsets[n]).padStart(10, "0") + " 00000 n \n";
    str(x + "trailer\n<< /Size " + count + " /Root 1 0 R /Info 7 0 R >>\nstartxref\n" + xrefAt + "\n%%EOF\n");

    const out = new Uint8Array(pos);
    let at = 0;
    chunks.forEach(function (c) { out.set(c, at); at += c.length; });
    return out;
  }

  PB.pdf = { build: build, jpegInfo: jpegInfo };
})();
