// Contract check: loads src/engine/*.js in Node (vm, PLAN.md 6.1 order, no browser) and checks that every
// name in PLAN.md 7.3 exists with the right type, that the ids in STYLES, PAPERS and DEFAULTS and the numbers
// in STRIP match, the file names (section 3 Step 4), the paper choice, the print layout in points, the crop
// clamp, that the screens only use PB names that exist, the script order and the font and config files.
// Pattern copied from ../look-up/tests/smoke.js.
//   node tests/smoke.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const ORDER = ["util", "decode", "camera", "photo", "styles", "stamp", "strip", "scene", "print", "pdf", "sound", "sample", "export", "share"];

// minimal stand-ins for the browser: nothing here may be needed at load time (no document, no window, no navigator)
const sandbox = {
  console: console, setTimeout: setTimeout, clearTimeout: clearTimeout, URL: URL, Promise: Promise, Intl: Intl, Date: Date, Math: Math,
  Uint8Array: Uint8Array, Uint32Array: Uint32Array, Float32Array: Float32Array, Float64Array: Float64Array, Int32Array: Int32Array,
  Uint8ClampedArray: Uint8ClampedArray, WeakMap: WeakMap, Map: Map, Set: Set, Array: Array, Object: Object, String: String, Number: Number,
  JSON: JSON, Error: Error, isFinite: isFinite, parseInt: parseInt
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

let fails = 0;
function report(ok, label, extra) {
  if (!ok) fails += 1;
  console.log((ok ? "PASS " : "FAIL ") + label + (extra ? "  (" + extra + ")" : ""));
}

for (const name of ORDER) {
  const file = path.join(ROOT, "src", "engine", name + ".js");
  try {
    vm.runInContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file });
    report(true, "load src/engine/" + name + ".js");
  } catch (e) {
    report(false, "load src/engine/" + name + ".js", e && e.message);
  }
}

const PB = sandbox.PB || {};
function get(p) {
  return p.split(".").reduce(function (o, k) { return o == null ? undefined : o[k]; }, PB);
}
function has(p, type) {
  const v = get(p);
  const t = Array.isArray(v) ? "array" : typeof v;
  report(v != null && t === type, "PB." + p + " is " + type, t === type ? "" : "found " + t);
}
function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); } // objects made inside the vm have other prototypes: compare as JSON

// PLAN.md 7.3: constants
has("STYLES", "array"); has("PAPERS", "array"); has("DEFAULTS", "object"); has("STRIP", "object"); has("FRAMES", "number");
// photo in, camera, photos
has("decode.fileToImageData", "function");
["supported", "start", "grab", "stopAll"].forEach(function (n) { has("camera." + n, "function"); });
["from", "autoCrop", "clampCrop", "drawCrop"].forEach(function (n) { has("photo." + n, "function"); });
// the strip
has("strip.create", "function");
has("stamp.draw", "function");
has("scene.draw", "function");
// print, export, sample, sound, share
["paperFor", "layout", "drawPreview"].forEach(function (n) { has("print." + n, "function"); });
["shareImage", "printPdf", "fileName"].forEach(function (n) { has("export." + n, "function"); });
has("sample.load", "function");
["beep", "shutter", "unlock"].forEach(function (n) { has("sound." + n, "function"); });
["platform", "canShare", "share", "save"].forEach(function (n) { has("share." + n, "function"); });
has("pdf.build", "function");

// the constants match PLAN.md 7.3
report(same(get("STYLES"), [{ id: "classic", name: "Classic" }, { id: "film", name: "Warm film" }, { id: "flash", name: "Flash" }, { id: "faded", name: "Faded" }, { id: "fourcut", name: "Four-cut" }, { id: "sepia", name: "Sepia 1950s" }, { id: "disposable", name: "Disposable" }]), "STYLES match PLAN.md");
report(same(get("PAPERS"), [{ id: "auto", name: "Style" }, { id: "white", hex: "#f7f5f0" }, { id: "black", hex: "#141414" }, { id: "pink", hex: "#f6d6dc" }, { id: "blue", hex: "#d5e3f2" }]), "PAPERS match PLAN.md");
report(same(get("DEFAULTS"), { style: "classic", paper: "auto", caption: "", showDate: true, when: 0 }), "DEFAULTS match PLAN.md", JSON.stringify(get("DEFAULTS")));
report(same(get("STRIP"), { w: 600, h: 1800, dpi: 300, margin: 45, frameW: 510, frameH: 383, gap: 30, bandY: 1667, bandH: 133 }), "STRIP matches PLAN.md", JSON.stringify(get("STRIP")));
try {
  const S = PB.STRIP;
  report(S.margin + 4 * S.frameH + 3 * S.gap === 1667 && S.bandY === 1667 && S.bandY + S.bandH === S.h, "45 + 4x383 + 3x30 = 1667 and the band ends at 1800");
  report(S.w === S.frameW + 2 * S.margin, "strip width is 510 + 2 x 45 = 600");
} catch (e) { report(false, "STRIP arithmetic", e.message); }
report(get("FRAMES") === 4, "FRAMES is 4");
report(PB.styles && PB.STYLES.every(function (s) { return !!PB.styles.get(s.id); }), "every style id has a definition in PB.styles");

// errors carry { code, title, detail } (PLAN.md 7.2)
try {
  ["not-image", "heic", "unreadable", "camera-denied", "camera-missing", "camera-unsupported", "export-failed", "pdf-failed", "cancelled"].forEach(function (code) {
    const e = PB.util.error(code);
    report(e instanceof sandbox.Error ? true : typeof e.message === "string", "error code " + code + " can be made");
    report(e.code === code && !!e.title && (code === "cancelled" || !!e.detail), "error " + code + " has code, title and detail");
  });
  const cd = PB.util.error("camera-denied"), cu = PB.util.error("camera-unsupported");
  report(cd.title === "The camera's switched off for this site." && cd.detail === "Allow the camera in your browser settings, or take 4 photos one at a time.", "camera-denied words match PLAN.md 7.2");
  report(PB.util.error("camera-missing").title === "No camera found." && PB.util.error("camera-missing").detail === "You can still make a strip from photos you already have.", "camera-missing words match PLAN.md 7.2");
  report(cu.title === "This app's browser can't open the camera." && cu.detail === "Open this page in Chrome or Safari for the full booth, or take 4 photos one at a time.", "camera-unsupported words match PLAN.md 7.2");
} catch (e) { report(false, "util.error runs in Node", e.message); }

// file names, PLAN.md section 3 Step 4
try {
  const d = new Date(), ymd = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const eq = function (got, want, label) { report(got === want, label, got); };
  eq(PB.export.fileName("share", "jpg"), "pocket-booth-" + ymd + ".jpg", "fileName: share");
  eq(PB.export.fileName("story", "jpg"), "pocket-booth-story-" + ymd + ".jpg", "fileName: story");
  eq(PB.export.fileName("print", "pdf"), "pocket-booth-print-" + ymd + ".pdf", "fileName: print");
} catch (e) { report(false, "fileName runs in Node", e.message); }

// the paper: US-style locales get Letter, the rest A4
try {
  const eq = function (got, want, label) { report(got === want, label, got); };
  eq(PB.print.paperFor("en-US"), "letter", "paperFor en-US is letter");
  ["en-IN", "en-GB", "hi"].forEach(function (l) { eq(PB.print.paperFor(l), "a4", "paperFor " + l + " is a4"); });
  ["en-CA", "es-MX", "en-PH", "es-CL", "es-CO", "es-VE", "es-PR"].forEach(function (l) { eq(PB.print.paperFor(l), "letter", "paperFor " + l + " is letter"); });
} catch (e) { report(false, "paperFor runs in Node", e.message); }

// the print layout: 4 strips of 432 x 144 pt, rotated, inside the page, 18 pt apart, centred; the ruler is 5 cm
try {
  const close = function (a, b) { return Math.abs(a - b) < 0.01; };
  [["a4", 595.28, 841.89], ["letter", 612, 792]].forEach(function (p) {
    const L = PB.print.layout(p[0]), n = p[0];
    report(close(L.page.w, p[1]) && close(L.page.h, p[2]), "layout(" + n + ") page is " + p[1] + " x " + p[2] + " pt", L.page.w + " x " + L.page.h);
    report(L.strips.length === 4 && L.strips.every(function (s) { return close(s.w, 432) && close(s.h, 144) && s.rotate !== 0 && s.rotate !== undefined; }), "layout(" + n + ") has 4 rotated strips of 432 x 144 pt");
    report(L.strips.every(function (s) { return s.x >= 0 && s.y >= 0 && s.x + s.w <= L.page.w && s.y + s.h <= L.page.h; }), "layout(" + n + ") strips are all inside the page");
    report(L.strips.every(function (s, i) { return i === 0 || close(s.y - (L.strips[i - 1].y + L.strips[i - 1].h), 18); }), "layout(" + n + ") strips are 18 pt apart");
    const top = L.strips[0].y, bottom = L.page.h - (L.strips[3].y + L.strips[3].h);
    report(close(top, bottom) && close(L.strips[0].x, L.page.w - (L.strips[0].x + 432)), "layout(" + n + ") the stack is centred", "top " + top.toFixed(2) + ", bottom " + bottom.toFixed(2));
    report(close(L.ruler.x2 - L.ruler.x1, 141.73), "layout(" + n + ") the ruler is 141.73 pt (5 cm)", String(L.ruler.x2 - L.ruler.x1));
    report(L.marks.length > 0 && L.marks.every(function (m) { return [m.x1, m.y1, m.x2, m.y2].every(isFinite); }), "layout(" + n + ") has cut marks", String(L.marks.length));
    report(L.texts.some(function (t) { return /Actual size/.test(t.text); }) && L.texts.some(function (t) { return /5 cm/.test(t.text); }), "layout(" + n + ") has the Actual size line and the 5 cm line");
  });
} catch (e) { report(false, "print.layout runs in Node", e.message); }

// the crop clamp: zoom stays at least 1, the frame stays covered
try {
  const frameAspect = 510 / 383;
  const photos = [{ width: 2000, height: 1500 }, { width: 1200, height: 2000 }, { width: 3000, height: 1000 }, { width: 510, height: 383 }];
  const crops = [{ cx: 0.5, cy: 0.4, zoom: 1 }, { cx: -3, cy: 9, zoom: 0.2 }, { cx: 0, cy: 0, zoom: 6 }, { cx: 1, cy: 1, zoom: 3 }, { cx: NaN, cy: undefined, zoom: undefined }, { zoom: 100 }];
  let okZoom = true, okCover = true, detail = "";
  photos.forEach(function (ph, pi) {
    crops.forEach(function (c, ci) {
      const r = PB.photo.clampCrop(ph, c);
      if (!(r.zoom >= 1)) { okZoom = false; detail = "photo " + pi + " crop " + ci + " zoom " + r.zoom; }
      // the window the frame shows, as a fraction of the photo: it must stay inside 0..1
      const cover = (ph.width / ph.height > frameAspect) ? { w: ph.height * frameAspect, h: ph.height } : { w: ph.width, h: ph.width / frameAspect };
      const hw = cover.w / r.zoom / 2 / ph.width, hh = cover.h / r.zoom / 2 / ph.height, eps = 1e-9;
      if (!(r.cx - hw >= -eps && r.cx + hw <= 1 + eps && r.cy - hh >= -eps && r.cy + hh <= 1 + eps)) { okCover = false; detail = "photo " + pi + " crop " + ci + " -> " + JSON.stringify(r); }
    });
  });
  report(okZoom, "clampCrop keeps zoom >= 1", detail);
  report(okCover, "clampCrop keeps the frame covered by the photo", detail);
  const ac = PB.photo.autoCrop({ width: 2000, height: 3000 });
  report(ac.zoom === 1 && ac.cx === 0.5 && ac.cy >= 0.4 - 1e-9, "autoCrop is centred, zoom 1, and sits at 40% from the top where it can", JSON.stringify(ac));
} catch (e) { report(false, "photo.clampCrop runs in Node", e.message); }

// a tiny PDF through the writer: starts with %PDF, asks for actual size, has a valid xref
try {
  const jpeg = new Uint8Array([0xFF, 0xD8, 0xFF, 0xC0, 0, 17, 8, 7, 8, 2, 88, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1, 0xFF, 0xD9]);
  const bytes = PB.pdf.build({ layout: PB.print.layout("a4"), jpeg: jpeg, imageWidth: 600, imageHeight: 1800 });
  const text = Buffer.from(bytes).toString("latin1");
  report(text.startsWith("%PDF-1.4"), "pdf.build output starts with %PDF-1.4");
  report(text.indexOf("/PrintScaling /None") > 0, "pdf.build output contains /PrintScaling /None");
  const sx = /startxref\n(\d+)\n%%EOF/.exec(text);
  report(!!sx && text.slice(+sx[1], +sx[1] + 4) === "xref", "pdf.build startxref points at the xref table");
} catch (e) { report(false, "pdf.build runs in Node", e.message); }

// platform() works without a browser
try {
  const p = PB.share.platform();
  report(["ios", "android", "desktop"].indexOf(p) >= 0, "share.platform() returns ios / android / desktop", p);
} catch (e) { report(false, "share.platform() runs in Node", e.message); }

// the screens only use PB names that exist
const used = new Set(), consts = new Set();
for (const f of ["index.html", "src/app.js"]) {
  const src = fs.readFileSync(path.join(ROOT, f), "utf8").replace(/\/\/[^\n]*/g, "");
  let m;
  const re = /\bPB\.([A-Za-z]+)\.([A-Za-z_]+)/g;
  while ((m = re.exec(src))) used.add(m[1] + "." + m[2]);
  const re2 = /\bPB\.(STYLES|PAPERS|DEFAULTS|STRIP|FRAMES)\b/g;
  while ((m = re2.exec(src))) consts.add(m[1]);
}
used.forEach(function (p) { report(get(p) !== undefined, "screens use PB." + p + " and it exists"); });
consts.forEach(function (n) { report(get(n) !== undefined, "screens use PB." + n + " and it exists"); });

// script order in index.html, and every file it names exists
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const order = [], srcs = [];
html.replace(/<script[^>]+src="([^"]+)"/g, function (_, s) { srcs.push(s); const m = /^src\/(?:engine\/)?([a-z]+)\.js$/.exec(s); if (m) order.push(m[1]); });
report(same(order, ORDER.concat(["app"])), "index.html script order matches PLAN.md 6.1", order.join(","));
const missingFiles = srcs.filter(function (s) { return !/^(https?:)?\/|^\/_vercel\//.test(s) && !fs.existsSync(path.join(ROOT, s)); });
report(missingFiles.length === 0, "every local script named in index.html exists", missingFiles.join(", "));

// every element id that app.js looks up exists in index.html
const appSrc = fs.readFileSync(path.join(ROOT, "src", "app.js"), "utf8");
const ids = new Set();
appSrc.replace(/\$\(\s*["']#([A-Za-z0-9_-]+)/g, function (_, id) { ids.add(id); });
appSrc.replace(/bindOut\("([A-Za-z0-9_-]+)"/g, function (_, id) { ids.add(id); });
appSrc.replace(/\[("btn[^\]]*)\]\.forEach/g, function (_, body) { body.replace(/"([A-Za-z0-9_-]+)"/g, function (_2, id) { ids.add(id); }); });
const htmlIds = new Set();
html.replace(/\bid="([^"]+)"/g, function (_, id) { htmlIds.add(id); });
const missingIds = Array.from(ids).filter(function (id) { return !/-$/.test(id) && !htmlIds.has(id); }); // an id ending in "-" is built at run time (screen-<name>)
report(missingIds.length === 0, "every element id used by app.js exists in index.html (" + ids.size + " ids)", missingIds.join(", "));

// fonts: the files exist, the @font-face and preload paths point at real files (styles.css lives in src/, fonts/ is at the root)
const css = fs.readFileSync(path.join(ROOT, "src", "styles.css"), "utf8");
const faces = [];
css.replace(/@font-face\s*\{[^}]*?font-family:\s*"([^"]+)";\s*src:\s*([^;]+);/g, function (_, fam, srcs2) {
  const m = /url\("([^"]+)"\)/.exec(srcs2);
  if (m) faces.push({ family: fam, url: m[1] });
});
const realFaces = faces.filter(function (f) { return /\.woff2$/.test(f.url); });
report(realFaces.length === 3, "styles.css has 3 @font-face rules with a woff2 file (Caprasimo, Jost, Caveat)", realFaces.map(function (f) { return f.family; }).join(", "));
report(realFaces.every(function (f) { return /^\.\.\/fonts\//.test(f.url) && fs.existsSync(path.join(ROOT, "src", f.url)); }), "every @font-face url (../fonts/...) points at a real file", realFaces.map(function (f) { return f.url; }).join(", "));
const pre = [];
html.replace(/<link rel="preload" href="([^"]+)"/g, function (_, h) { pre.push(h); });
report(pre.length > 0 && pre.every(function (h) { return fs.existsSync(path.join(ROOT, h)); }), "every <link rel=preload> path is a real file", pre.join(", "));
report(realFaces.some(function (f) { return f.family === "Caveat"; }), 'the font family name "Caveat" is registered (the engine asks for 600 "Caveat")');
const engineText = ["strip", "stamp", "scene"].map(function (n) { return fs.readFileSync(path.join(ROOT, "src", "engine", n + ".js"), "utf8"); }).join("\n");
report(/"Caveat"/.test(engineText) || /'600 24px "Caveat"'/.test(engineText), 'the engine asks for the family "Caveat"');
report(["caprasimo-400.woff2", "jost-var.woff2", "caveat-600.woff2"].every(function (f) { return fs.existsSync(path.join(ROOT, "fonts", f)); }), "fonts/ has Caprasimo, Jost and Caveat");
report(fs.readdirSync(path.join(ROOT, "fonts")).filter(function (f) { return /^OFL.*\.txt$/.test(f); }).length >= 3, "fonts/ has the OFL licence texts");

// the sample pictures exist and are light
const sampleOk = [1, 2, 3, 4].every(function (i) {
  const f = path.join(ROOT, "assets", "sample", i + ".jpg");
  return fs.existsSync(f) && fs.statSync(f).size <= 200 * 1024;
});
report(sampleOk, "assets/sample/1-4.jpg exist and are 200 KB or less each");

// the support files
["vercel.json", ".gitignore", ".vercelignore", ".gitattributes"].forEach(function (f) { report(fs.existsSync(path.join(ROOT, f)), f + " exists"); });
try { JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8")); report(true, "vercel.json is valid JSON"); } catch (e) { report(false, "vercel.json is valid JSON", e.message); }
const gi = fs.readFileSync(path.join(ROOT, ".gitignore"), "utf8").split(/\r?\n/);
report(["tests/real/", "tests/out/", "shots/"].every(function (l) { return gi.indexOf(l) >= 0; }), ".gitignore keeps tests/real/, tests/out/ and shots/ out");
const vi = fs.readFileSync(path.join(ROOT, ".vercelignore"), "utf8").split(/\r?\n/);
report(["tests/", "notes/", "shots/", ".claude/", "PLAN.md", "HANDOFF.md", "VERIFY.md"].every(function (l) { return vi.indexOf(l) >= 0; }), ".vercelignore keeps tests/, notes/, shots/, .claude/ and the planning files off the site");

console.log(fails ? "\nSMOKE FAIL (" + fails + " failing)" : "\nSMOKE PASS");
process.exit(fails ? 1 : 0);
