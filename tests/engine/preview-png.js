// node tests/engine/preview-png.js
// A DEVELOPER AID, not a test. Renders the strip with the software canvas (fakecanvas.js) from SYNTHETIC blobs-and-gradients
// "photos" (not real photos) and writes PNGs to the scratchpad folder, so the paper, grain, stamp dots, grades and layout can be
// looked at before a browser is available. The software canvas ignores clipping, rotation, gradients and strokes, so the
// rounded corners, the crease, the tape and the 7-segment date are NOT shown. Real judgement is tests/strips.html in a browser.
const path = require("path");
const fs = require("fs");
const FC = require("./fakecanvas.js");
FC.install();
const T = require("./load.js"), PB = T.PB, makeImage = T.makeImage;

const OUT = process.env.PB_PREVIEW_DIR || "C:/Users/rishe/AppData/Local/Temp/claude/c--creative-technologist-projects-pocket-booth/f6f5c02d-852c-44bb-981e-158b0dcc752e/scratchpad";
fs.mkdirSync(OUT, { recursive: true });

// four deliberately different scenes: a head-and-shoulders blob on different backgrounds, light and noise
function scene(i) {
  const W = 640, H = 480, rnd = PB.util.mulberry32(100 + i);
  const bg = [[70, 48, 30], [150, 175, 205], [215, 215, 210], [40, 60, 45]][i], skin = [[205, 150, 120], [235, 190, 160], [190, 140, 110], [150, 105, 80]][i];
  const dim = [0.55, 1.0, 0.85, 0.5][i], noise = [14, 3, 2, 16][i];
  return makeImage(W, H, function (x, y) {
    const nx = (x - W * 0.5) / W, ny = (y - H * 0.38) / H;
    const head = (nx * nx) / 0.02 + (ny * ny) / 0.045, body = ((x - W * 0.5) / (W * 0.34)) ** 2 + ((y - H * 1.02) / (H * 0.5)) ** 2;
    let c = bg.map(function (v, k) { return v * (0.8 + 0.4 * (y / H)) + (k === 0 ? 10 : 0); });
    if (body < 1) c = [60, 80, 120].map(function (v) { return v * (1 - 0.3 * body); });
    if (head < 1) c = skin.map(function (v) { return v * (1 - 0.35 * head) + 25 * (1 - head); });
    const n = (rnd() - 0.5) * noise;
    return c.map(function (v) { return Math.max(0, Math.min(255, v * dim + n)); });
  });
}

(async function () {
  const photos = [];
  for (let i = 0; i < 4; i++) photos.push(await PB.photo.from(scene(i), { live: false }));
  const strip = await PB.strip.create(photos, photos.map(PB.photo.autoCrop), { seed: 4242, caption: "Riya's room", when: new Date(2026, 9, 8).getTime() });
  const sheet = new FC.FakeCanvas(7 * 310, 920), sctx = sheet.getContext("2d");
  sctx.fillStyle = "#8a8a8a"; sctx.fillRect(0, 0, sheet.width, sheet.height);
  let i = 0;
  for (const st of PB.STYLES) {
    await strip.update({ style: st.id, caption: "Riya's room", showDate: true });
    const t0 = PB.util.now();
    const c = strip.render(0.5);
    sctx.drawImage(c, i * 310 + 5, 10);
    console.log(st.id.padEnd(11) + " half-size render in the software canvas: " + (PB.util.now() - t0).toFixed(0) + " ms");
    if (st.id === "classic" || st.id === "fourcut") {
      const full = strip.render(1), band = new FC.FakeCanvas(600 * 2, 150 * 2), bctx = band.getContext("2d");
      bctx.drawImage(full, 0, 1650, 600, 150, 0, 0, 1200, 300);
      FC.toPng(band, path.join(OUT, "band-" + st.id + ".png"));
      FC.toPng(full, path.join(OUT, "strip-" + st.id + ".png"));
    }
    i++;
  }
  FC.toPng(sheet, path.join(OUT, "contact.png"));
  console.log("wrote PNGs to " + OUT);
})();
