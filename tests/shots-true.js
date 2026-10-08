// True-width phone screenshots with device emulation (headless Edge cannot go narrower than ~500 px with --screenshot).
//   PB_BASE=http://localhost:8011 node tests/shots-true.js [name,name,...]   (default: all)
// Files go to shots/<name>-true.png. One Edge window, closed at the end.
const { launch, sleep } = require("./cdp");
const BASE = (process.env.PB_BASE || "http://localhost:8000").replace(/\/+$/, "");

// name: [width, height, query, screen to wait for, canvas to wait for, mobile?, script to run before the shot]
const SHOTS = {
  "landing-844": [390, 844, "", "landing", "#lStrip .sc"],
  "landing-1200": [390, 1200, "", "landing", "#lStrip .sc"],
  "landing-915": [412, 915, "", "landing", "#lStrip .sc"],
  "landing-932": [430, 932, "", "landing", "#lStrip .sc"],
  "landing-laptop": [1280, 800, "", "landing", "#lStrip .sc", false],
  "landing-640": [360, 640, "", "landing", "#lStrip .sc"],
  "booth-844": [390, 844, "?screen=booth", "booth", null],
  "booth-932": [430, 932, "?screen=booth", "booth", null],
  "booth-laptop": [1280, 800, "?screen=booth", "booth", null, false],
  "countdown-844": [390, 844, "?screen=countdown", "booth", null],
  "result-844": [390, 844, "?sample=1&develop=0", "result", "#rStrip .sc"],
  "result-640": [360, 640, "?sample=1&develop=0", "result", "#rStrip .sc"],
  "result-932": [430, 932, "?sample=1&develop=0", "result", "#rStrip .sc"],
  "edit-844": [390, 844, "?sample=1&screen=edit&develop=0", "edit", "#editCanvas"],
  "edit-932": [430, 932, "?sample=1&screen=edit&develop=0", "edit", "#editCanvas"],
  "pick-844": [390, 844, "?screen=pick", "pick", null],
  "pick-932": [430, 932, "?screen=pick", "pick", null],
  "error-844": [390, 844, "?screen=error-camera-denied", "error", null],
  "camera-missing-844": [390, 844, "?screen=error-camera-missing", "error", null],
  "not-image-844": [390, 844, "?screen=error-not-image", "error", null],
  "camera-help-844": [390, 844, "?screen=camera-help", "camera-help", null],
  "done-844": [390, 844, "?sample=1&screen=done&develop=0", "done", "#dStrip .sc"],
  "disposable": [390, 844, "?sample=1&develop=0&style=disposable", "result", "#rStrip .sc"],
  "landing-430": [430, 932, "", "landing", "#lStrip .sc"],
  "landing-footer": [390, 844, "", "landing", "#lStrip .sc", true, "window.scrollTo(0, 99999)"],
  "booth-640": [360, 640, "?screen=booth", "booth", null],
  "booth-1200": [390, 1200, "?screen=booth", "booth", null],
  "result-1200": [390, 1200, "?sample=1&develop=0", "result", "#rStrip .sc"],
  "result-laptop": [1280, 800, "?sample=1&develop=0", "result", "#rStrip .sc", false],
  "result-scroll": [390, 844, "?sample=1&develop=0", "result", "#rStrip .sc", true, "window.scrollTo(0, 99999)"],
  "result-flash": [390, 844, "?sample=1&develop=0&style=flash", "result", "#rStrip .sc", true, "window.scrollTo(0, 380)"],
  "result-fourcut": [390, 844, "?sample=1&develop=0&style=fourcut", "result", "#rStrip .sc"],
  "done-1200": [390, 1200, "?sample=1&screen=done&develop=0", "done", "#dStrip .sc"],
  "error-1200": [390, 1200, "?screen=error-camera-denied", "error", null],
  "countdown-640": [360, 640, "?screen=countdown", "booth", null],
  "develop-mid": [390, 844, "?sample=1", "result", "#rStrip .sc"],
  "share": [1080, 1350, "?screen=frame&format=share", "frame", "#frameCanvas", false],
  "share-flash": [1080, 1350, "?screen=frame&format=share&style=flash", "frame", "#frameCanvas", false],
  "share-fourcut": [1080, 1350, "?screen=frame&format=share&style=fourcut", "frame", "#frameCanvas", false],
  "story": [1080, 1920, "?screen=frame&format=story", "frame", "#frameCanvas", false],
  "story-film": [1080, 1920, "?screen=frame&format=story&style=film", "frame", "#frameCanvas", false]
};

(async function () {
  const want = (process.argv[2] ? process.argv[2].split(",") : Object.keys(SHOTS));
  const b = await launch({ width: 390, height: 844 });
  try {
    await b.eval("1");
    for (const n of want) {
      const s = SHOTS[n];
      if (!s) { console.log("no such shot " + n); continue; }
      await b.viewport(s[0], s[1], 1);
      await b.send("Emulation.setTouchEmulationEnabled", { enabled: s[5] !== false });
      await b.open(BASE + "/" + s[2]);
      await b.waitFor("document.readyState === 'complete'", 15);
      await b.waitFor("document.body.dataset.screen === " + JSON.stringify(s[3]), 20);
      if (s[4]) await b.waitFor("(function(){var c=document.querySelector(" + JSON.stringify(s[4]) + ");return c&&c.width>0&&c.getContext('2d').getImageData(c.width>>1,c.height>>1,1,1).data[3]>0;})()", 20);
      if (s[3] === "booth") await b.waitFor("document.getElementById('video').videoWidth > 0", 8);
      await sleep(/^landing/.test(n) ? 3400 : 900);
      if (s[6]) { await b.eval(s[6]); await sleep(400); }
      const file = await b.shot(n + "-true.png");
      console.log("shot " + file + "  errors:" + b.errors.length + " exceptions:" + b.exceptions.length);
      b.clear();
    }
  } finally { await b.close(); }
})().catch(function (e) { console.log("FAIL " + (e && e.stack || e)); process.exit(1); });
