// node tests/engine/pipeline.test.js
// The whole engine end to end on tiny synthetic photos and the software canvas in fakecanvas.js: strip.create,
// render at two scales for all 7 styles, develop, swap/crop updates and caching, the share scenes, the print preview
// and the two exports. This catches crashes and wiring mistakes; it says NOTHING about how the strip looks (that is
// tests/strips.html in a browser).
const assert = require("assert");
const FC = require("./fakecanvas.js");
FC.install();
const T = require("./load.js"), PB = T.PB, test = T.test, testAsync = T.testAsync, makeImage = T.makeImage;

function synthPhoto(i, live) {
  const img = makeImage(200 + i * 20, 150 + i * 10, function (x, y, w, h) {
    const v = 40 + 160 * ((x / w + y / h) / 2), tint = [[1, 0.85, 0.6], [0.7, 0.9, 1], [1, 1, 1], [0.8, 1, 0.8]][i % 4];
    return [v * tint[0], v * tint[1], v * tint[2]];
  });
  return PB.photo.from(img, { live: !!live });
}
async function makeStrip(settings) {
  const photos = await Promise.all([0, 1, 2, 3].map(function (i) { return synthPhoto(i); }));
  return PB.strip.create(photos, photos.map(PB.photo.autoCrop), Object.assign({ seed: 1234, when: new Date(2026, 9, 8).getTime() }, settings || {}));
}
function px(c, x, y) { const p = (y * c.width + x) * 4; return [c.buf[p], c.buf[p + 1], c.buf[p + 2], c.buf[p + 3]]; }

(async function () {
  let strip;
  await testAsync("create resolves with the defaults filled in", async function () {
    strip = await makeStrip();
    assert.deepStrictEqual(Object.assign({}, strip.settings, { seed: undefined }), Object.assign({}, PB.DEFAULTS, { when: new Date(2026, 9, 8).getTime(), seed: undefined }));
    await assert.rejects(PB.strip.create([], [], {}), function (e) { return e.code === "unreadable" && !!e.title && !!e.detail; });
  });

  await testAsync("render(scale): 600*scale x 1800*scale, cached, a frame is inked and the paper is paper-coloured", async function () {
    const c1 = strip.render(0.5), c2 = strip.render(0.5), c3 = strip.render(1);
    assert.strictEqual(c1, c2, "cached per settings and scale");
    assert.strictEqual(c1.width, 300); assert.strictEqual(c1.height, 900);
    assert.strictEqual(c3.width, 600); assert.strictEqual(c3.height, 1800);
    const paper = px(c3, 20, 800), photo = px(c3, 300, 250);
    assert(paper[0] > 225 && paper[1] > 225 && paper[3] === 255, "paper " + paper);
    assert(Math.abs(photo[0] - paper[0]) + Math.abs(photo[1] - paper[1]) > 20, "a photo sits at the first frame " + photo);
    // the band holds the stamp: some dark pixels between y 1667 and 1800
    let dark = 0; for (let y = 1680; y < 1790; y++) for (let x = 60; x < 540; x++) if (px(c3, x, y)[0] < 120) dark++;
    assert(dark > 300, "stamp dots in the band: " + dark);
    let darkAbove = 0; for (let y = 1668; y < 1676; y++) for (let x = 60; x < 540; x++) if (px(c3, x, y)[0] < 120) darkAbove++;
    assert.strictEqual(darkAbove, 0, "nothing stamped hard against the last frame");
  });

  await testAsync("all 7 styles x 5 papers render at both scales without a crash", async function () {
    const t0 = PB.util.now();
    for (const st of PB.STYLES) for (const paper of PB.PAPERS) {
      await strip.update({ style: st.id, paper: paper.id, caption: "Riya's room", showDate: true });
      [0.5, 1].forEach(function (s) { const c = strip.render(s); assert.strictEqual(c.width, Math.round(600 * s)); });
    }
    console.log("     35 combinations at both scales, in the software canvas: " + (PB.util.now() - t0).toFixed(0) + " ms");
    await strip.update({ style: "classic", paper: "auto", caption: "", showDate: true });
  });

  await testAsync("black paper gets a pale stamp; white paper a dark one", async function () {
    await strip.update({ style: "classic", paper: "black", caption: "", showDate: true });
    const c = strip.render(1); let light = 0, dark = 0;
    for (let y = 1680; y < 1790; y++) for (let x = 60; x < 540; x++) { const p = px(c, x, y)[0]; if (p > 150) light++; if (p < 50) dark++; }
    assert(light > 300, "light dots on black: " + light);
    await strip.update({ paper: "auto" });
  });

  await testAsync("Disposable has no date in the band; the stamp goes in frame 4 (orange pixels appear there only when showDate)", async function () {
    await strip.update({ style: "disposable", showDate: true });
    const withDate = strip.render(1);
    await strip.update({ showDate: false });
    const without = strip.render(1);
    assert.notStrictEqual(withDate, without);
    await strip.update({ style: "classic", showDate: true });
  });

  await testAsync("update(settings) changes the picture; setCrop/setPhoto/swap invalidate only what changed", async function () {
    const before = strip.render(0.5);
    await strip.update({ caption: "A new caption" });
    const after = strip.render(0.5);
    assert.notStrictEqual(before, after);
    const crop = PB.photo.clampCrop(strip.photos[0], { cx: 0.2, cy: 0.2, zoom: 2 });
    strip.setCrop(0, crop);
    assert.notStrictEqual(strip.render(0.5), after, "a crop change re-renders");
    const a = strip.photos[0].id, b = strip.photos[3].id;
    strip.swap(0, 3);
    assert.strictEqual(strip.photos[0].id, b); assert.strictEqual(strip.photos[3].id, a);
    strip.swap(3, 0);
    strip.swap(0, 99); strip.setCrop(7, crop); // out of range: ignored
    strip.setPhoto(1, await synthPhoto(2, true));
    assert.strictEqual(strip.photos[1].live, true);
    strip.render(0.5);
  });

  await testAsync("renderDeveloping: t=1 is exactly render(); earlier frames are veiled in the pale grey-brown", async function () {
    await strip.update({ caption: "", showDate: true });
    assert.strictEqual(strip.renderDeveloping(0.5, 1), strip.render(0.5));
    const early = strip.renderDeveloping(1, 0.05);
    const p = px(early, 300, 250);
    assert(Math.abs(p[0] - 0xcf) < 12 && Math.abs(p[1] - 0xc6) < 12 && Math.abs(p[2] - 0xb8) < 14, "pale veil " + p);
    let dark = 0; for (let y = 1680; y < 1790; y++) for (let x = 60; x < 540; x++) if (px(early, x, y)[0] < 120) dark++;
    assert.strictEqual(dark, 0, "the stamp prints last");
    const rects = strip.frameRects(0.5);
    assert.strictEqual(rects.length, 4); assert.deepStrictEqual(rects[0], { x: 22.5, y: 22.5, w: 255, h: 191.5 });
  });

  await testAsync("scene: share and story draw without a crash and have the right size", async function () {
    for (const f of ["share", "story"]) {
      const size = PB.scene.size(f), cv = new FC.FakeCanvas(size.w, size.h), ctx = cv.getContext("2d");
      PB.scene.draw(ctx, strip, f);
      assert(ctx.texts.some(function (t) { return /the-pocket-booth\.vercel\.app/.test(t.t); }), "the mark is drawn");
    }
    assert.deepStrictEqual(PB.scene.size("share"), { w: 1080, h: 1350 }); assert.deepStrictEqual(PB.scene.size("story"), { w: 1080, h: 1920 });
  });

  test("scene placement: the share strip about 1180 px tall at -4 degrees, the story inside the safe zone", function () {
    const s = PB.scene.placement("share");
    assert(s.h >= 1150 && s.h <= 1210); assert(Math.abs(s.rotate * 180 / Math.PI + 4) < 1e-9);
    assert(Math.abs(s.w / s.h - 600 / 1800) < 1e-9, "true proportions");
    const t = PB.scene.placement("story");
    assert(Math.abs(t.rotate * 180 / Math.PI + 3) < 1e-9);
    [["share", s, 1350], ["story", t, 1920]].forEach(function (e) {
      const p = e[1], c = Math.abs(Math.cos(p.rotate)), sn = Math.abs(Math.sin(p.rotate));
      const bh = p.h * c + p.w * sn, bw = p.w * c + p.h * sn;
      assert(p.cy - bh / 2 >= 0 && p.cy + bh / 2 <= e[2], e[0] + " fits vertically: " + (p.cy - bh / 2).toFixed(0) + ".." + (p.cy + bh / 2).toFixed(0));
      assert(p.cx - bw / 2 >= 90 - 1 && p.cx + bw / 2 <= 1080 - 90 + 1, e[0] + " keeps 90 px side margins");
      if (e[0] === "story") assert(p.cy - bh / 2 >= 270 - 30 && p.cy + bh / 2 <= 1540, "story strip within y 270..1540 (the tape may rise a little above)");
    });
  });

  await testAsync("print preview and both exports", async function () {
    const cv = new FC.FakeCanvas(10, 10);
    PB.print.drawPreview(cv, strip, "a4");
    assert.strictEqual(cv.width, 1240); assert.strictEqual(cv.height, 1754);
    PB.print.drawPreview(cv, strip, "letter");
    assert.strictEqual(cv.width, 1275); assert.strictEqual(cv.height, 1650);
    const img = await PB.export.shareImage(strip, "share");
    assert(img instanceof File); assert.strictEqual(img.type, "image/jpeg"); assert(/^pocket-booth-\d{4}-\d{2}-\d{2}\.jpg$/.test(img.name), img.name);
    const story = await PB.export.shareImage(strip, "story");
    assert(/^pocket-booth-story-\d{4}-\d{2}-\d{2}\.jpg$/.test(story.name), story.name);
    const pdf = await PB.export.printPdf(strip, { paper: "letter" });
    assert.strictEqual(pdf.type, "application/pdf"); assert(/^pocket-booth-print-\d{4}-\d{2}-\d{2}\.pdf$/.test(pdf.name), pdf.name);
    const bytes = new Uint8Array(await pdf.arrayBuffer()), head = Buffer.from(bytes.subarray(0, 8)).toString("latin1");
    assert.strictEqual(head.slice(0, 5), "%PDF-");
    assert(Buffer.from(bytes).toString("latin1").indexOf("/MediaBox [0 0 612 792]") > 0);
    const a4 = await PB.export.printPdf(strip, { paper: "a4" });
    assert(Buffer.from(new Uint8Array(await a4.arrayBuffer())).toString("latin1").indexOf("/MediaBox [0 0 595.28 841.89]") > 0);
    const auto = await PB.export.printPdf(strip, {});
    assert.strictEqual(auto.type, "application/pdf");
  });

  await testAsync("export errors carry a code, a title and a detail", async function () {
    await assert.rejects(PB.export.shareImage({}, "share"), function (e) { return e.code === "export-failed" && !!e.title && !!e.detail; });
    await assert.rejects(PB.export.printPdf({}, { paper: "a4" }), function (e) { return e.code === "pdf-failed" && !!e.title && !!e.detail; });
  });

  T.done();
})();
