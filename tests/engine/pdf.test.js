// node tests/engine/pdf.test.js
// The hand-written PDF (PLAN.md 6.6), built from a small stand-in JPEG and taken apart again:
// header, every xref offset, the MediaBox for A4 and Letter, the four 432 x 144 pt placements, /PrintScaling /None.
const assert = require("assert");
const T = require("./load.js"), PB = T.PB, test = T.test;

// A stand-in JPEG: a real header (SOI, JFIF, SOF0 for 600 x 1800 x 3, SOS), then binary junk that includes every byte value and the
// words "endstream" and "endobj" (a naive writer or a text-mode write would corrupt these), then EOI. It is not decodable;
// the writer only copies the bytes and reads the size from SOF0. (A real JPEG is checked in the browser.)
function fakeJpeg(width, height) {
  const head = [0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
    0xFF, 0xC0, 0x00, 0x11, 0x08, height >> 8, height & 255, width >> 8, width & 255, 0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
    0xFF, 0xDA, 0x00, 0x0C, 0x03, 0x01, 0x00, 0x02, 0x11, 0x03, 0x11, 0x00, 0x3F, 0x00];
  const body = [];
  for (let i = 0; i < 1500; i++) body.push((i * 37 + (i >> 3)) & 255);
  Array.from("\nendstream\nendobj\nxref\n").forEach(function (c) { body.push(c.charCodeAt(0)); });
  for (let i = 0; i < 256; i++) body.push(i);
  return new Uint8Array(head.concat(body, [0xFF, 0xD9]));
}
function latin1(u8) { let s = ""; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return s; }
function sameBytes(a, b) { if (a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; }

const JPEG = fakeJpeg(600, 1800);

test("jpegInfo reads the size and the components from SOF0", function () {
  const i = PB.pdf.jpegInfo(JPEG);
  assert.deepStrictEqual(i, { width: 600, height: 1800, components: 3 });
  assert.strictEqual(PB.pdf.jpegInfo(new Uint8Array([1, 2, 3, 4])), null);
});

["a4", "letter"].forEach(function (paper) {
  const L = PB.print.layout(paper);
  const bytes = PB.pdf.build({ layout: L, jpeg: JPEG });
  const text = latin1(bytes);

  test(paper + ": starts with %PDF-1.4, a binary-marker comment, and ends with %%EOF", function () {
    assert(bytes instanceof Uint8Array);
    assert(text.indexOf("%PDF-1.4\n") === 0);
    const second = text.split("\n")[1];
    assert(second[0] === "%" && second.charCodeAt(1) > 127, "binary comment marks the file as binary");
    assert(/%%EOF\n$/.test(text));
  });

  test(paper + ": every xref offset points at its 'n 0 obj'", function () {
    const m = /startxref\n(\d+)\n%%EOF\n$/.exec(text);
    assert(m, "startxref");
    const xrefAt = parseInt(m[1], 10);
    assert.strictEqual(text.substr(xrefAt, 5), "xref\n", "startxref points at the xref table");
    const lines = text.substr(xrefAt).split("\n");
    assert.strictEqual(lines[1], "0 8");
    assert.strictEqual(lines[2], "0000000000 65535 f ");
    for (let n = 1; n < 8; n++) {
      const entry = lines[2 + n];
      assert(/^\d{10} 00000 n $/.test(entry), "entry " + n + " is 20 bytes: '" + entry + "'");
      const off = parseInt(entry.slice(0, 10), 10);
      assert.strictEqual(text.substr(off, (n + " 0 obj").length), n + " 0 obj", "object " + n + " at " + off);
    }
    assert(/trailer\n<< \/Size 8 \/Root 1 0 R \/Info 7 0 R >>/.test(text));
  });

  test(paper + ": the catalog asks viewers not to scale when printing (/PrintScaling /None)", function () {
    assert(/1 0 obj\n<< \/Type \/Catalog \/Pages 2 0 R \/ViewerPreferences << \/PrintScaling \/None >> >>/.test(text));
  });

  test(paper + ": one page, MediaBox for the paper", function () {
    assert(/\/Count 1/.test(text));
    const mb = /\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/.exec(text);
    assert(mb);
    if (paper === "a4") { assert.strictEqual(mb[1], "595.28"); assert.strictEqual(mb[2], "841.89"); }
    else { assert.strictEqual(mb[1], "612"); assert.strictEqual(mb[2], "792"); }
  });

  test(paper + ": the JPEG is embedded once, byte for byte, as /DCTDecode DeviceRGB 8 bit, with the right /Length", function () {
    assert.strictEqual((text.match(/\/Subtype \/Image/g) || []).length, 1, "one image object");
    const m = /4 0 obj\n<< \/Type \/XObject \/Subtype \/Image \/Width 600 \/Height 1800 \/ColorSpace \/DeviceRGB \/BitsPerComponent 8 \/Filter \/DCTDecode \/Length (\d+) >>\nstream\n/.exec(text);
    assert(m, "image dictionary");
    const len = parseInt(m[1], 10), start = m.index + m[0].length;
    assert.strictEqual(len, JPEG.length);
    assert(sameBytes(bytes.subarray(start, start + len), JPEG), "the bytes are untouched");
    assert.strictEqual(text.substr(start + len, 18), "\nendstream\nendobj\n");
  });

  test(paper + ": four placements, each 432 x 144 pt, on the layout's strips, sideways with the strip's top at the left", function () {
    const cs = /6 0 obj\n<< \/Length (\d+) >>\nstream\n([\s\S]*?)endstream/.exec(text);
    assert(cs, "content stream");
    assert.strictEqual(parseInt(cs[1], 10), cs[2].length, "content /Length");
    const re = /q ([-\d. ]+) cm \/Im0 Do Q/g;
    const placed = []; let m;
    while ((m = re.exec(cs[2]))) placed.push(m[1].trim().split(/\s+/).map(Number));
    assert.strictEqual(placed.length, 4);
    assert.strictEqual((cs[2].match(/\/Im0 Do/g) || []).length, 4, "drawn four times from the one image");
    placed.forEach(function (c, i) {
      const a = c[0], b = c[1], cc = c[2], d = c[3], e = c[4], f = c[5];
      const pts = [[0, 0], [1, 0], [0, 1], [1, 1]].map(function (p) { return [a * p[0] + cc * p[1] + e, b * p[0] + d * p[1] + f]; });
      const xs = pts.map(function (p) { return p[0]; }), ys = pts.map(function (p) { return p[1]; });
      const w = Math.max.apply(null, xs) - Math.min.apply(null, xs), h = Math.max.apply(null, ys) - Math.min.apply(null, ys);
      assert(Math.abs(w - 432) < 1e-6 && Math.abs(h - 144) < 1e-6, "strip " + i + " covers " + w + " x " + h);
      assert(Math.abs(Math.hypot(a, b) - 144) < 1e-6 && Math.abs(Math.hypot(cc, d) - 432) < 1e-6, "the image's width is 144 pt, its height 432 pt");
      const s = L.strips[i];
      assert(Math.abs(Math.min.apply(null, xs) - s.x) < 1e-6, "x");
      assert(Math.abs(Math.min.apply(null, ys) - (L.page.h - s.y - s.h)) < 1e-6, "y (flipped to PDF space)");
      const topLeft = [cc + e, d + f]; // the image's top-left (u 0, v 1)
      assert(Math.abs(topLeft[0] - s.x) < 1e-6, "the strip's top end is at the left");
    });
  });

  test(paper + ": cut marks, the 5 cm ruler and both lines of text are in the content stream", function () {
    const cs = /6 0 obj\n<< \/Length \d+ >>\nstream\n([\s\S]*?)endstream/.exec(text)[1];
    assert(/0 G 0\.5 w/.test(cs), "0.5 pt black marks");
    const marksPath = /0 G 0\.5 w\n([^\n]*) S\n/.exec(cs)[1];
    assert.strictEqual((marksPath.match(/ l /g) || []).length + (/ l$/.test(marksPath) ? 1 : 0), 32, "32 mark segments");
    const r = /0\.4 G ([\d.]+) ([\d.]+) m ([\d.]+) ([\d.]+) l/.exec(cs);
    assert(Math.abs(parseFloat(r[3]) - parseFloat(r[1]) - 141.732) < 0.002, "ruler length " + (r[3] - r[1]));
    assert(cs.indexOf("(This line should measure 5 cm) Tj") > 0);
    assert(cs.indexOf("(Pocket Booth \xB7 Print at Actual size (100%), not Fit to page \xB7 Cut along the marks) Tj".replace(/\(100%\)/, "\\(100%\\)")) > 0, "the top line, with its brackets escaped");
    assert(/BT \/F1 9 Tf 0\.4 g /.test(cs));
  });

  test(paper + ": the font is the standard Helvetica with WinAnsi encoding, and the file is a sensible size", function () {
    assert(/5 0 obj\n<< \/Type \/Font \/Subtype \/Type1 \/BaseFont \/Helvetica \/Encoding \/WinAnsiEncoding >>/.test(text));
    assert(bytes.length < JPEG.length + 4000, "overhead is only a few KB: " + (bytes.length - JPEG.length));
  });
});

test("errors: no layout or no JPEG, or a file that is not a JPEG", function () {
  assert.throws(function () { PB.pdf.build({}); });
  assert.throws(function () { PB.pdf.build({ layout: PB.print.layout("a4"), jpeg: new Uint8Array([1, 2, 3]) }); });
  const ok = PB.pdf.build({ layout: PB.print.layout("a4"), jpeg: new Uint8Array([1, 2, 3]), imageWidth: 600, imageHeight: 1800 });
  assert(ok.length > 500, "explicit sizes are accepted");
});

T.done();
