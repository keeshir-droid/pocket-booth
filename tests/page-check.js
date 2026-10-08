// Page check: headless Edge with a FAKE CAMERA (DevTools protocol, no npm packages) against the running local server.
//   node tests/page-check.js [baseUrl] [sections]
// baseUrl: argument 1, or the PB_BASE environment variable, or http://localhost:8000 (the camera needs localhost or https)
// sections: comma list of  live, photos, outputs, result, screens, widths  (default: all). Screenshots go to shots/join-<name>.png.
// Fails on any console error, uncaught exception or failed network request (the Vercel analytics script is the one allowed 404).
// Never starts or stops a server; always closes Edge.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { launch, sleep } = require("./cdp");

const BASE = (process.argv[2] && /^https?:/.test(process.argv[2]) ? process.argv[2] : (process.env.PB_BASE || "http://localhost:8000")).replace(/\/+$/, "");
const ALL = "live,photos,outputs,result,screens,widths";
const SECTIONS = (process.argv[3] || process.argv.filter(function (a) { return /^(live|photos|outputs|result|screens|widths)(,|$)/.test(a); })[0] || ALL).split(",");
const REAL = path.join(__dirname, "real");

let fails = 0;
function report(ok, label, extra) {
  if (!ok) fails += 1;
  console.log((ok ? "PASS " : "FAIL ") + label + (extra !== undefined && extra !== "" ? "  (" + extra + ")" : ""));
}
function note(s) { console.log("     " + s); }

// ---- run before the page's own scripts: remember every camera stream and what was asked for ----
const WATCH_CAMERA = `
(function () {
  window.__streams = []; window.__gum = [];
  var md = navigator.mediaDevices;
  if (!md || !md.getUserMedia) return;
  var orig = md.getUserMedia.bind(md);
  md.getUserMedia = function (c) {
    window.__gum.push(JSON.stringify(c));
    return orig(c).then(function (s) { window.__streams.push(s); return s; });
  };
})();
`;

// ---- in-page helpers (strings, run inside the page) ----
const INPAGE = `
window.__nb = function (sel) {
  var c = document.querySelector(sel);
  if (!c || !c.width || !c.height) return { ok: false, why: "no canvas or 0x0", w: c && c.width, h: c && c.height };
  var x = c.getContext("2d"), w = c.width, h = c.height;
  var d = x.getImageData(0, 0, w, h).data, seen = 0, lo = 255, hi = 0, n = 0;
  for (var y = 0; y < h; y += Math.max(1, h >> 6)) for (var i = 0; i < w; i += Math.max(1, w >> 6)) {
    var o = (y * w + i) * 4; n++;
    if (d[o + 3] > 8) { seen++; var l = (d[o] * 3 + d[o + 1] * 6 + d[o + 2]) / 10; if (l < lo) lo = l; if (l > hi) hi = l; }
  }
  return { ok: seen > n * 0.5 && hi - lo > 25, w: w, h: h, painted: Math.round(seen / n * 100) + "%", range: Math.round(hi - lo) };
};
window.__hscroll = function () {
  var vw = window.innerWidth;
  var de = document.documentElement;
  var out = { scrollW: de.scrollWidth, bodyScrollW: document.body.scrollWidth, vw: vw, offenders: [] };
  var active = document.querySelector(".screen.is-active") || document.body;
  var els = active.querySelectorAll("*");
  for (var i = 0; i < els.length; i++) {
    var e = els[i];
    if (e.closest("svg") && e.tagName.toLowerCase() !== "svg") continue;
    var cs = getComputedStyle(e);
    if (cs.display === "none" || cs.visibility === "hidden") continue;
    var r = e.getBoundingClientRect();
    if (!r.width && !r.height) continue;
    var left = r.left, right = r.right, p = e.parentElement, clipped = false;
    while (p && p !== document.body && p !== de) {
      var ps = getComputedStyle(p);
      if (ps.overflowX !== "visible") { var pr = p.getBoundingClientRect(); left = Math.max(left, pr.left); right = Math.min(right, pr.right); }
      if (ps.display === "none") { clipped = true; break; }
      p = p.parentElement;
    }
    if (clipped) continue;
    if (right > vw + 1 || left < -1) out.offenders.push((e.id ? "#" + e.id : e.tagName.toLowerCase() + (e.className && e.className.baseVal === undefined ? "." + String(e.className).split(" ")[0] : "")) + " " + Math.round(left) + ".." + Math.round(right));
  }
  out.offenders = out.offenders.slice(0, 8);
  return out;
};
window.__tracksEnded = function () {
  var s = window.__streams || [];
  var all = [];
  s.forEach(function (st) { st.getTracks().forEach(function (t) { all.push(t.readyState); }); });
  return { streams: s.length, tracks: all.length, states: all.join(","), ended: s.length > 0 && all.length > 0 && all.every(function (x) { return x === "ended"; }) };
};
true;
`;

async function after(b, label) {
  await sleep(150);
  const errs = b.errors.slice(), exc = b.exceptions.slice(), net = b.failedRequests.slice();
  report(errs.length === 0 && exc.length === 0, label + ": no console errors or exceptions", errs.concat(exc).slice(0, 3).join(" | "));
  report(net.length === 0, label + ": no failed network requests", net.slice(0, 3).join(" | "));
  b.clear();
}

async function openUrl(b, qs) {
  await b.open(BASE + "/" + qs);
  await b.waitFor("document.readyState === 'complete'", 15);
  await b.eval(INPAGE);
}

// ---------------------------------------------------------------- the live booth, with the fake camera
async function live(b) {
  console.log("\n== the live booth (fake camera, ?fast=1)");
  await b.viewport(390, 844, 1);
  await openUrl(b, "?fast=1");
  report(await b.waitFor("document.body.dataset.screen === 'landing'", 10), "landing opens");
  report(await b.eval("typeof window.__booth === 'object' && typeof PB === 'object'"), "the engine loaded (PB) and window.__booth exists");
  await b.shot("join-live-landing.png");
  await b.clickEl("#btnStart");
  report(await b.waitFor("document.body.dataset.screen === 'booth'", 5), "Start the booth opens the booth screen");
  const ready = await b.waitFor("!document.getElementById('btnShoot').disabled && document.getElementById('video').videoWidth > 0", 15);
  report(ready, "the fake camera opens and the Start button wakes up", await b.eval("document.getElementById('video').videoWidth + 'x' + document.getElementById('video').videoHeight"));
  report(await b.eval("window.__gum.length > 0 && window.__gum.every(function (c) { return !/\"audio\":true/.test(c); })"), "the camera is only ever asked for video (never audio)", await b.eval("window.__gum.join(' ')"));
  const vh = await b.eval("(function(){var v=document.getElementById('video').getBoundingClientRect(),w=document.getElementById('window').getBoundingClientRect();return {vw:Math.round(v.width),vh:Math.round(v.height),ww:Math.round(w.width)};})()");
  note("preview box: " + JSON.stringify(vh));
  await sleep(500);
  await b.shot("join-live-booth.png");
  await after(b, "booth (camera open)");
  if (!ready) return;

  await b.clickEl("#btnShoot");
  report(await b.waitFor("document.getElementById('screen-booth').classList.contains('is-count')", 5), "Start begins the session (countdown state)");
  await sleep(250);
  await b.shot("join-live-countdown.png");
  const done = await b.waitFor("window.__booth.screen === 'result'", 40);
  report(done, "four shots later the result screen is shown", "screen=" + (await b.eval("window.__booth.screen")));
  if (!done) { await after(b, "live session"); return; }
  report(await b.eval("window.__booth.photos.length === 4"), "window.__booth.photos has 4 entries", String(await b.eval("window.__booth.photos.length")));
  report(await b.eval("window.__booth.crops.length === 4 && !!window.__booth.strip"), "window.__booth has 4 crops and a strip");
  report(await b.eval("window.__booth.photos.every(function (p) { return p.live === true && p.width > 100 && p.height > 100; })"), "every photo is a live shot with a real size", await b.eval("window.__booth.photos.map(function (p) { return p.width + 'x' + p.height; }).join(' ')"));
  await sleep(2600); // the develop animation
  const nb = await b.eval("window.__nb('#rStrip .sc')");
  report(nb.ok, "the result screen shows a strip with non-blank pixels", JSON.stringify(nb));
  await b.shot("join-live-result.png", { full: true });
  const tr = await b.eval("window.__tracksEnded()");
  report(tr.ended, "after the 4th shot the camera is off (every track ended)", JSON.stringify(tr));
  await after(b, "live session");

  // New strip, then the booth again, then leave it half way: the camera must go off on leaving
  await b.clickEl("#btnNew");
  report(await b.waitFor("document.body.dataset.screen === 'landing'", 5), "New strip returns to the landing");
  await b.clickEl("#btnStart");
  report(await b.waitFor("!document.getElementById('btnShoot').disabled", 15), "the booth opens again");
  const before = await b.eval("window.__tracksEnded()");
  report(before.streams >= 2 && !before.ended, "a second stream is live while in the booth", JSON.stringify(before));
  await b.clickEl("#btnBoothBack");
  report(await b.waitFor("document.body.dataset.screen === 'landing'", 5), "Back leaves the booth");
  report(await b.waitFor("window.__tracksEnded().ended", 5), "leaving the booth turns the camera off (every track ended)", JSON.stringify(await b.eval("window.__tracksEnded()")));
  // a session cancelled with Stop
  await b.clickEl("#btnStart");
  await b.waitFor("!document.getElementById('btnShoot').disabled", 15);
  await b.eval("document.getElementById('tgPose').click()");
  await b.clickEl("#btnShoot");
  await sleep(500);
  report(await b.eval("!document.getElementById('btnStop').hidden"), "while shooting there is a Stop button");
  await b.shot("join-live-pose-ideas.png");
  await b.clickEl("#btnStop");
  await sleep(300);
  report(await b.eval("document.getElementById('btnShoot').hidden === false && window.__booth.screen === 'booth'"), "Stop cancels the session and the booth is ready again");
  await b.eval("document.getElementById('tgPose').click()"); // back to the default
  await b.clickEl("#btnBoothBack");
  await b.waitFor("document.body.dataset.screen === 'landing'", 5);
  report(await b.waitFor("window.__tracksEnded().ended", 5), "after Stop and Back, every track is ended");
  await after(b, "booth leave and stop");

  // the flip button: the fake camera has no second facing mode, but it must not break anything
  await openUrl(b, "?fast=1&screen=booth");
  await b.waitFor("!document.getElementById('btnShoot').disabled", 15);
  await b.clickEl("#btnFlip");
  await sleep(1500);
  report(await b.eval("window.__booth.screen === 'booth' || window.__booth.screen === 'camera-help'"), "flipping the camera keeps the page working", await b.eval("window.__booth.screen"));
  await after(b, "flip camera");
}

// ---------------------------------------------------------------- from your photos
async function photos(b) {
  console.log("\n== from your photos (real file input, tests/real/)");
  await b.viewport(390, 844, 1);
  const pick = function (names) { return names.map(function (n) { return path.join(REAL, n); }); };
  const have = fs.existsSync(REAL) ? fs.readdirSync(REAL).filter(function (f) { return /\.(jpe?g|png)$/i.test(f); }).sort() : [];
  if (have.length < 4) { report(false, "tests/real/ has at least 4 photos", String(have.length)); return; }

  await openUrl(b, "?develop=0");
  await b.waitFor("document.body.dataset.screen === 'landing'", 10);
  const t0 = Date.now();
  await b.setFiles("#fPick", pick(have.slice(0, 4)));
  const ok = await b.waitFor("window.__booth.screen === 'result' && window.__nb('#rStrip .sc').ok", 40);
  report(ok, "picking 4 photos shows a strip on the result screen", (Date.now() - t0) + " ms, " + have.slice(0, 4).join(" "));
  report(await b.eval("window.__booth.photos.length === 4 && window.__booth.photos.every(function (p) { return p.live === false; })"), "4 photos, none of them live shots");
  note("strip canvas: " + JSON.stringify(await b.eval("window.__nb('#rStrip .sc')")));
  await sleep(500);
  await b.shot("join-photos-result.png", { full: true });
  await after(b, "4 photos");

  // 2 photos: "Pick 2 more"
  await openUrl(b, "?develop=0");
  await b.waitFor("document.body.dataset.screen === 'landing'", 10);
  await b.setFiles("#fPick", pick(have.slice(4, 6)));
  report(await b.waitFor("window.__booth.screen === 'pick'", 20), "picking 2 photos shows the pick screen");
  const title = await b.eval("document.getElementById('pickTitle').textContent");
  report(title === "Pick 2 more", 'the pick screen says "Pick 2 more"', title);
  report(await b.eval("document.querySelectorAll('#pickSlots .tile.full').length === 2 && document.querySelectorAll('#pickSlots .tile').length === 4"), "2 of the 4 slots are filled");
  await b.shot("join-photos-pick2.png");
  // add 2 more: the strip appears
  await b.setFiles("#fPick", pick(have.slice(6, 8).length === 2 ? have.slice(6, 8) : have.slice(0, 2)));
  report(await b.waitFor("window.__booth.screen === 'result' && window.__nb('#rStrip .sc').ok", 40), "adding 2 more makes the strip", "screen=" + (await b.eval("window.__booth.screen")));
  await after(b, "2 + 2 photos");

  // a file that is not a picture
  const txt = path.join(os.tmpdir(), "pb-not-a-photo.txt");
  fs.writeFileSync(txt, "hello, this is not a picture");
  await openUrl(b, "?develop=0");
  await b.waitFor("document.body.dataset.screen === 'landing'", 10);
  await b.setFiles("#fPick", [txt]);
  report(await b.waitFor("window.__booth.screen === 'error'", 10), "a text file gives the friendly error screen");
  report(await b.eval("document.getElementById('errTitle').textContent.length > 5 && document.getElementById('errDetail').textContent.length > 5"), "the error has a title and a detail", await b.eval("document.getElementById('errTitle').textContent + ' / ' + document.getElementById('errDetail').textContent + ' / ' + document.querySelector('#errBtn .lbl').textContent"));
  await b.shot("join-photos-error.png");
  try { fs.unlinkSync(txt); } catch (e) { /* ignore */ }
  b.clear(); // a failed decode is not a console error, but the engine may log it
}

// ---------------------------------------------------------------- the outputs: share image, story image, print PDF
async function outputs(b) {
  console.log("\n== outputs (?sample=1&develop=0)");
  await b.viewport(390, 844, 1);
  await openUrl(b, "?sample=1&develop=0");
  report(await b.waitFor("window.__booth.screen === 'result' && !!window.__booth.strip && window.__nb('#rStrip .sc').ok", 30), "the sample strip is on the result screen");
  const styles = await b.eval("PB.STYLES.map(function (s) { return s.id; })");
  report(styles.length === 7, "7 styles", styles.join(","));
  for (const id of styles) {
    const info = await b.eval(`(async function () {
      var strip = window.__booth.strip;
      await strip.update({ style: ${JSON.stringify(id)} });
      var t0 = performance.now();
      var f = await PB.export.shareImage(strip, "share");
      var ms = Math.round(performance.now() - t0);
      var bm = await createImageBitmap(f);
      var c = document.createElement("canvas"); c.width = 32; c.height = 40;
      var x = c.getContext("2d"); x.drawImage(bm, 0, 0, 32, 40);
      var d = x.getImageData(0, 0, 32, 40).data, lo = 255, hi = 0;
      for (var i = 0; i < d.length; i += 4) { var l = (d[i] + d[i + 1] + d[i + 2]) / 3; if (l < lo) lo = l; if (l > hi) hi = l; }
      return { isFile: f instanceof File, type: f.type, kb: Math.round(f.size / 1024), name: f.name, w: bm.width, h: bm.height, range: Math.round(hi - lo), ms: ms };
    })()`);
    report(info.isFile && info.type === "image/jpeg" && info.w === 1080 && info.h === 1350 && info.kb > 60 && info.range > 40, "shareImage (" + id + "): a 1080x1350 JPEG File", info.type + " " + info.w + "x" + info.h + " " + info.kb + " KB " + info.ms + " ms, range " + info.range);
    if (id === "classic") report(/^pocket-booth-\d{4}-\d{2}-\d{2}\.jpg$/.test(info.name), "the share file is named pocket-booth-<date>.jpg", info.name);
  }
  await b.eval("window.__booth.strip.update({ style: 'film', caption: 'Riya\\'s room' })");
  const story = await b.eval(`(async function () {
    var t0 = performance.now();
    var f = await PB.export.shareImage(window.__booth.strip, "story");
    var bm = await createImageBitmap(f);
    return { type: f.type, kb: Math.round(f.size / 1024), name: f.name, w: bm.width, h: bm.height, ms: Math.round(performance.now() - t0) };
  })()`);
  report(story.type === "image/jpeg" && story.w === 1080 && story.h === 1920, "shareImage (story): a 1080x1920 JPEG File", story.type + " " + story.w + "x" + story.h + " " + story.kb + " KB " + story.ms + " ms");
  report(/^pocket-booth-story-\d{4}-\d{2}-\d{2}\.jpg$/.test(story.name), "the story file is named pocket-booth-story-<date>.jpg", story.name);

  for (const paper of ["a4", "letter"]) {
    const pdf = await b.eval(`(async function () {
      var t0 = performance.now();
      var f = await PB.export.printPdf(window.__booth.strip, { paper: ${JSON.stringify(paper)} });
      var buf = new Uint8Array(await f.arrayBuffer());
      var txt = ""; for (var i = 0; i < buf.length; i += 8192) txt += String.fromCharCode.apply(null, buf.subarray(i, i + 8192));
      var sx = /startxref\\n(\\d+)\\n%%EOF/.exec(txt);
      var mb = /\\/MediaBox \\[0 0 ([\\d.]+) ([\\d.]+)\\]/.exec(txt);
      return { type: f.type, kb: Math.round(f.size / 1024), name: f.name, head: txt.slice(0, 5), actual: txt.indexOf("/PrintScaling /None") > 0, images: (txt.match(/\\/Subtype \\/Image/g) || []).length,
        placements: (txt.match(/\\/Im0 Do/g) || []).length, xrefOk: !!sx && txt.substr(+sx[1], 4) === "xref", media: mb ? mb[1] + "x" + mb[2] : "", ms: Math.round(performance.now() - t0) };
    })()`);
    report(pdf.type === "application/pdf" && pdf.head === "%PDF-" && pdf.actual, "printPdf (" + paper + "): application/pdf, starts with %PDF, has /PrintScaling /None", pdf.type + " " + pdf.kb + " KB " + pdf.ms + " ms");
    report(pdf.images === 1 && pdf.placements === 4 && pdf.xrefOk, "printPdf (" + paper + "): one image drawn four times, xref table points right", "images " + pdf.images + ", placements " + pdf.placements + ", media " + pdf.media);
    report(pdf.kb > 80 && pdf.kb < 2500, "printPdf (" + paper + "): a sensible size (about 300-600 KB)", pdf.kb + " KB");
    if (paper === "a4") report(/^pocket-booth-print-\d{4}-\d{2}-\d{2}\.pdf$/.test(pdf.name), "the PDF is named pocket-booth-print-<date>.pdf", pdf.name);
  }
  await after(b, "outputs");
}

// ---------------------------------------------------------------- the result screen: chips, colours, caption, editor, Send/Save/Print
async function result(b) {
  console.log("\n== the result screen, the frame editor and the buttons");
  await b.viewport(390, 844, 1);
  await openUrl(b, "?sample=1&develop=0");
  report(await b.waitFor("window.__booth.screen === 'result' && window.__nb('#rStrip .sc').ok", 30), "the sample strip is on the result screen");
  report(await b.eval("document.querySelectorAll('#styleRow .chip').length === 7"), "7 style chips");
  report(await b.eval("document.querySelectorAll('#paperRow .dot').length === 5"), "5 strip-colour dots");
  const before = await b.eval("window.__nb('#rStrip .sc')");
  await b.clickEl("#styleRow .chip[data-id='flash']");
  await sleep(900);
  report(await b.eval("window.__booth.settings.style === 'flash' && window.__booth.strip.settings.style === 'flash' && document.querySelector('#styleRow .chip[data-id=flash]').getAttribute('aria-pressed') === 'true'"), "tapping Flash changes the style (settings, strip, chip)");
  report((await b.eval("window.__nb('#rStrip .sc')")).ok, "the strip is repainted after a style change", JSON.stringify(await b.eval("window.__nb('#rStrip .sc')")));
  await b.clickEl("#paperRow .dot[data-id='pink']");
  await sleep(700);
  report(await b.eval("window.__booth.settings.paper === 'pink' && window.__booth.strip.settings.paper === 'pink'"), "tapping the Pink dot changes the strip colour");
  await b.clickEl("#caption");
  await b.eval("document.getElementById('caption').select()");
  await b.typeText("Riya's room");
  await sleep(700);
  report(await b.eval("window.__booth.settings.caption === \"Riya's room\" && window.__booth.strip.settings.caption === \"Riya's room\""), "typing a caption reaches the strip", await b.eval("window.__booth.settings.caption"));
  await b.eval("document.activeElement && document.activeElement.blur()");
  await b.clickEl("#dateToggle");
  await sleep(500);
  report(await b.eval("window.__booth.settings.showDate === false && document.getElementById('dateToggle').getAttribute('aria-checked') === 'false'"), "the date switch turns the date off");
  await b.clickEl("#dateToggle");
  await sleep(300);
  await b.clickEl("#styleRow .chip[data-id='classic']");
  await b.clickEl("#paperRow .dot[data-id='auto']");
  await sleep(700);
  await b.shot("join-result-controls.png", { full: true });
  void before;

  // tap the second photo on the strip: the frame editor
  const rect = await b.eval("(function(){document.querySelector('#rStrip .sc').scrollIntoView({block:'center'});var r=document.querySelector('#rStrip .sc').getBoundingClientRect();return {l:r.left,t:r.top,w:r.width,h:r.height};})()");
  await b.click(rect.l + rect.w * 0.5, rect.t + rect.h * ((45 + 383 + 30 + 190) / 1800));
  report(await b.waitFor("window.__booth.screen === 'edit'", 5), "tapping a photo on the strip opens the frame editor");
  report(await b.eval("document.getElementById('editTitle').textContent") === "Frame 2 of 4", "the editor opens on the tapped photo (Frame 2 of 4)", await b.eval("document.getElementById('editTitle').textContent"));
  await sleep(500);
  report((await b.eval("window.__nb('#editCanvas')")).ok, "the editor shows the photo", JSON.stringify(await b.eval("window.__nb('#editCanvas')")));
  await b.shot("join-edit.png");
  const c0 = await b.eval("JSON.stringify(window.__booth.crops[1])");
  // zoom in with the slider, then drag with a real finger
  await b.eval("(function(){var z=document.getElementById('zoom');z.value='2';z.dispatchEvent(new Event('input',{bubbles:true}));z.dispatchEvent(new Event('change',{bubbles:true}));})()");
  await sleep(300);
  const er = await b.eval("(function(){var r=document.getElementById('editCanvas').getBoundingClientRect();return {l:r.left,t:r.top,w:r.width,h:r.height};})()");
  await b.touchDrag([{ x: er.l + er.w * 0.7, y: er.t + er.h * 0.6 }, { x: er.l + er.w * 0.6, y: er.t + er.h * 0.55 }, { x: er.l + er.w * 0.4, y: er.t + er.h * 0.45 }, { x: er.l + er.w * 0.3, y: er.t + er.h * 0.4 }], 20);
  await sleep(400);
  const c1 = await b.eval("JSON.stringify(window.__booth.crops[1])");
  report(c0 !== c1 && JSON.parse(c1).zoom >= 1.99, "zoom and drag change the crop of frame 2", c0 + " -> " + c1);
  report(await b.eval("(function(){var c=window.__booth.crops[1];return c.zoom>=1 && c.cx>0 && c.cx<1 && c.cy>0 && c.cy<1;})()"), "the crop stays valid (zoom >= 1, centre inside the photo)");
  // reorder
  const idBefore = await b.eval("window.__booth.photos[1].id + ',' + window.__booth.photos[2].id");
  await b.clickEl("#btnDown");
  await sleep(500);
  const idAfter = await b.eval("window.__booth.photos[1].id + ',' + window.__booth.photos[2].id");
  const parts = idBefore.split(","), after2 = idAfter.split(",");
  report(parts[0] === after2[1] && parts[1] === after2[0] && (await b.eval("document.getElementById('editTitle').textContent")) === "Frame 3 of 4", "Move down swaps the photo with the next one and follows it", idBefore + " -> " + idAfter);
  await b.clickEl("#btnEditDone");
  report(await b.waitFor("window.__booth.screen === 'result' && window.__nb('#rStrip .sc').ok", 5), "Done returns to the result screen with the strip painted");
  await after(b, "result controls and editor");

  // Save image: a real tap; on a computer this is a download
  b.downloads.length = 0;
  await b.clickEl("#btnSave");
  report(await b.waitFor("window.__booth.screen === 'done'", 20), "Save image goes to the Done screen", "screen=" + (await b.eval("window.__booth.screen")));
  await sleep(500);
  report(b.downloads.length === 1 && /^pocket-booth-\d{4}-\d{2}-\d{2}\.jpg$/.test(b.downloads[0].name || ""), "Save image downloaded pocket-booth-<date>.jpg", JSON.stringify(b.downloads.map(function (d) { return d.name; })));
  report((await b.eval("document.getElementById('doneTitle').textContent")) === "Saved.", "done: says Saved.");
  await b.shot("join-done.png", { full: true });
  // Print from the done screen
  b.downloads.length = 0;
  await b.clickEl("#btnPrint2");
  await b.waitFor("window.__booth.screen === 'done' && document.getElementById('doneTitle').textContent === 'Your sheet is ready.'", 20);
  await sleep(500);
  report(b.downloads.length === 1 && /^pocket-booth-print-\d{4}-\d{2}-\d{2}\.pdf$/.test(b.downloads[0].name || ""), "Print 4 strips downloaded pocket-booth-print-<date>.pdf", JSON.stringify(b.downloads.map(function (d) { return d.name; })));
  // Try another style goes back to the result
  await b.clickEl("#btnAnother");
  report(await b.waitFor("window.__booth.screen === 'result'", 5), "Try another style returns to the result screen");
  // Send and Story size go through the share sheet: a stand-in share sheet records what it was given
  await b.eval("window.__shared = []; navigator.canShare = function () { return true; }; navigator.share = function (d) { window.__shared.push(d.files.map(function (f) { return f.name + '|' + f.type + '|' + f.size; })); return Promise.resolve(); }; true");
  await b.clickEl("#btnSend");
  report(await b.waitFor("window.__shared.length === 1", 20), "Send hands the share image to the share sheet", JSON.stringify(await b.eval("window.__shared")));
  const sent = String(await b.eval("window.__shared[0][0]"));
  report(/^pocket-booth-\d{4}-\d{2}-\d{2}\.jpg\|image\/jpeg\|\d+$/.test(sent), "Send shares only the file (no text), a JPEG named pocket-booth-<date>.jpg", sent);
  report(await b.waitFor("window.__booth.screen === 'done' && document.getElementById('doneTitle').textContent === 'Sent.'", 10), "after Send the Done screen says Sent.");
  await b.clickEl("#btnAnother");
  await b.waitFor("window.__booth.screen === 'result'", 5);
  await b.clickEl("#btnStory");
  report(await b.waitFor("window.__shared.length === 2", 20), "Story size hands the story image to the share sheet", JSON.stringify(await b.eval("window.__shared[1]")));
  const sentStory = String(await b.eval("window.__shared.length > 1 ? window.__shared[1][0] : ''"));
  report(/^pocket-booth-story-\d{4}-\d{2}-\d{2}\.jpg\|image\/jpeg/.test(sentStory), "the story file is named pocket-booth-story-<date>.jpg", sentStory);
  await b.waitFor("window.__booth.screen === 'done'", 10);
  // New strip
  await b.clickEl("#btnNewStrip");
  report(await b.waitFor("window.__booth.screen === 'landing'", 5), "New strip returns to the landing");
  await after(b, "save, print and story");
}

// ---------------------------------------------------------------- every dev screen (PLAN.md 7.4)
async function screens(b) {
  console.log("\n== dev screens (390x844)");
  await b.viewport(390, 844, 1);
  const list = [
    ["landing", "", "landing", "#lStrip .sc"],
    ["result", "?sample=1&develop=0", "result", "#rStrip .sc"],
    ["result-faded", "?sample=1&develop=0&style=faded&caption=Friday%20night", "result", "#rStrip .sc"],
    ["result-flash", "?sample=1&develop=0&style=flash", "result", "#rStrip .sc"],
    ["result-fourcut", "?sample=1&develop=0&style=fourcut&caption=Riya%27s%20room", "result", "#rStrip .sc"],
    ["result-disposable", "?sample=1&develop=0&style=disposable&paper=blue", "result", "#rStrip .sc"],
    ["edit", "?sample=1&screen=edit&develop=0", "edit", "#editCanvas"],
    ["done", "?sample=1&screen=done&develop=0", "done", "#dStrip .sc"],
    ["booth", "?screen=booth", "booth", null],
    ["countdown", "?screen=countdown", "booth", null],
    ["camera-help", "?screen=camera-help", "camera-help", null],
    ["pick", "?screen=pick", "pick", null],
    ["error-camera-denied", "?screen=error-camera-denied", "error", null],
    ["error-camera-missing", "?screen=error-camera-missing", "error", null],
    ["error-not-image", "?screen=error-not-image", "error", null]
  ];
  for (const s of list) {
    await openUrl(b, s[1]);
    const ok = await b.waitFor("document.body.dataset.screen === " + JSON.stringify(s[2]) + (s[3] ? " && window.__nb(" + JSON.stringify(s[3]) + ").ok" : ""), 25);
    report(ok, "screen " + s[0] + " " + (s[1] || "/") + " is ready", ok ? "" : "data-screen=" + (await b.eval("document.body.dataset.screen")) + " " + JSON.stringify(s[3] ? await b.eval("window.__nb(" + JSON.stringify(s[3]) + ")") : ""));
    if (s[0] === "booth" || s[0] === "countdown") await b.waitFor("document.getElementById('video').videoWidth > 0", 10);
    if (s[0] === "landing") await sleep(3200); // the strip slides out of the slot
    await sleep(700);
    report(await b.eval("window.__booth.screen === document.body.dataset.screen"), "window.__booth.screen matches the page on " + s[0]);
    await b.shot("join-" + s[0] + ".png", { full: s[0] === "landing" || s[0] === "result" || s[0] === "done" });
    await after(b, "screen " + s[0]);
  }
  // single outputs, full size on a canvas
  const frames = [["strip", "?screen=frame&format=strip", "600x1800"], ["share", "?screen=frame&format=share", "1080x1350"], ["story", "?screen=frame&format=story", "1080x1920"],
    ["print-a4", "?screen=frame&format=print&paper=a4", "1240x1754"], ["print-letter", "?screen=frame&format=print&paper=letter", "1275x1650"]];
  for (const f of frames) {
    await openUrl(b, f[1] + "&style=sepia&caption=Friday%20night");
    const ok = await b.waitFor("document.body.dataset.screen === 'frame' && window.__nb('#frameCanvas').ok", 25);
    const dim = await b.eval("document.getElementById('frameCanvas').width + 'x' + document.getElementById('frameCanvas').height");
    report(ok && dim === f[2], "frame " + f[0] + " draws a " + f[2] + " canvas", dim + " " + JSON.stringify(await b.eval("window.__nb('#frameCanvas')")));
    await sleep(300);
    await b.shot("join-frame-" + f[0] + ".png", { full: true });
    await after(b, "frame " + f[0]);
  }
}

// ---------------------------------------------------------------- no horizontal scroll at 360, 390 and 430
async function widths(b) {
  console.log("\n== horizontal scroll at 360, 390 and 430 px");
  const list = [["landing", ""], ["result", "?sample=1&develop=0"], ["edit", "?sample=1&screen=edit&develop=0"], ["booth", "?screen=booth"], ["camera-help", "?screen=camera-help"], ["pick", "?screen=pick"], ["error", "?screen=error-camera-denied"], ["done", "?sample=1&screen=done&develop=0"]];
  for (const wh of [[360, 740], [390, 844], [430, 932]]) {
    await b.viewport(wh[0], wh[1], 1);
    for (const s of list) {
      await openUrl(b, s[1]);
      await b.waitFor("document.body.dataset.screen === " + JSON.stringify(s[0]) + (s[0] === "result" ? " && window.__nb('#rStrip .sc').ok" : ""), 25);
      await sleep(s[0] === "landing" ? 3000 : 700);
      const h = await b.eval("window.__hscroll()");
      report(h.scrollW <= h.vw && h.bodyScrollW <= h.vw && h.offenders.length === 0, wh[0] + "px " + s[0] + ": no horizontal scroll", "scrollWidth " + h.scrollW + " / viewport " + h.vw + (h.offenders.length ? " offenders: " + h.offenders.join(", ") : ""));
      if (wh[0] === 360 && (s[0] === "landing" || s[0] === "result" || s[0] === "booth")) await b.shot("join-" + s[0] + "-360.png", { full: s[0] !== "booth" });
      b.clear();
    }
  }
  await b.viewport(390, 844, 1);
}

(async function main() {
  console.log("Pocket Booth page check against " + BASE + " (sections: " + SECTIONS.join(",") + ")");
  // the server is Rishi's: check it is up, never start it
  try {
    const r = await fetch(BASE + "/index.html");
    if (!r.ok) throw new Error("HTTP " + r.status);
  } catch (e) {
    console.log("FAIL the local server is not answering at " + BASE + " (" + e.message + "). Please start it: python -m http.server 8000 in the pocket-booth folder.");
    process.exit(2);
  }
  let b = null;
  try {
    b = await launch({ width: 390, height: 844, dpr: 1 });
    await b.beforeLoad(WATCH_CAMERA);
    if (SECTIONS.indexOf("live") >= 0) await live(b);
    if (SECTIONS.indexOf("photos") >= 0) await photos(b);
    if (SECTIONS.indexOf("outputs") >= 0) await outputs(b);
    if (SECTIONS.indexOf("result") >= 0) await result(b);
    if (SECTIONS.indexOf("screens") >= 0) await screens(b);
    if (SECTIONS.indexOf("widths") >= 0) await widths(b);
  } catch (e) {
    report(false, "the page check ran to the end", e && e.stack || String(e));
  } finally {
    if (b) {
      report(true, "analytics script 404s ignored (expected locally)", String((b.ignored || []).length) + " seen");
      await b.close();
    }
  }
  console.log(fails ? "\nPAGE CHECK FAIL (" + fails + " failing)" : "\nPAGE CHECK PASS");
  process.exit(fails ? 1 : 0);
})();
