// The landing / dev sample: four free-licensed photos of the same friends, assets/sample/1.jpg ... 4.jpg
// (PLAN.md sections 4, 6.1, 7.3). Loaded from this site's own files only.
//
//   PB.sample.load() -> Promise<{ photos, crops, settings }>
//        photos: four Photo objects (PB.photo.from), crops: four { cx, cy, zoom }, settings: partial strip settings
//   PB.sample.base   where the files are looked for (worked out from this script's address; assets/sample/ by default)
//   PB.sample.CROPS  the preset crops; tuned by eye once the real sample photos are in
(function () {
  const PB = (globalThis.PB = globalThis.PB || {});

  // the folder this script was loaded from is src/engine/, so the sample is two folders up and then assets/sample/
  let BASE = "assets/sample/";
  try {
    if (typeof document !== "undefined" && document.currentScript && document.currentScript.src) {
      BASE = document.currentScript.src.replace(/[^\/]*$/, "") + "../../assets/sample/";
    } else if (typeof document !== "undefined" && document.scripts) {
      for (let i = 0; i < document.scripts.length; i++) {
        const s = document.scripts[i].src || "";
        if (/\/sample\.js(\?|$)/.test(s)) { BASE = s.replace(/[^\/]*$/, "") + "../../assets/sample/"; break; }
      }
    }
  } catch (e) { /* keep the default */ }

  // tuned by eye on the four 1200 x 800 sample photos: faces centred, tight enough to fill the frame
  const CROPS = [
    { cx: 0.45, cy: 0.50, zoom: 1.6 },   // 1: both faces, selfie arm up
    { cx: 0.47, cy: 0.58, zoom: 2.0 },   // 2: the duck face (an arm crosses the other face, so go in on this one)
    { cx: 0.41, cy: 0.325, zoom: 1.7 },  // 3: both faces looking at the phone
    { cx: 0.433, cy: 0.27, zoom: 2.0 }   // 4: shot from above, the faces are small, so in close
  ];
  const SETTINGS = { style: "classic", paper: "auto", caption: "Friday night", showDate: true, when: 0 };

  function loadImage(url) {
    return new Promise(function (resolve, reject) {
      const img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(PB.util.error("unreadable", { title: "The sample photo is missing.", detail: "Reload the page and try again." })); };
      img.src = url;
    });
  }

  async function load() {
    if (typeof Image === "undefined") throw PB.util.error("unreadable");
    const photos = [];
    for (let i = 1; i <= PB.FRAMES; i++) {
      const img = await loadImage(PB.sample.base + i + ".jpg");
      photos.push(await PB.photo.from(img, { live: false }));
    }
    const crops = photos.map(function (p, i) { return PB.photo.clampCrop(p, CROPS[i]); });
    return { photos: photos, crops: crops, settings: Object.assign({}, SETTINGS) };
  }

  PB.sample = { load: load, base: BASE, CROPS: CROPS };
})();
