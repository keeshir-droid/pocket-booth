// Pocket Booth: app.js. All the screens, the live booth session, the photo picker and frame editor,
// the result screen, and saving/sharing. The strip itself is made by the engine (src/engine/), used only through PLAN.md section 7.3 names.
// Sections: kit footer, helpers, poses, state, screens, landing, booth, camera help, pick, strip building, result, editor, outputs, errors, dev, boot.

// ===== kit: MAKER_NAME + SIBLINGS (from ../shared-kit/footer/siblings.js; Pocket Booth itself is not in the list) =====
const MAKER_NAME = "Risheek";
const SIBLINGS = [
  { name: "Handwriting → Font", url: "https://handwriting-font-converter.vercel.app", blurb: "Type in your own handwriting.", icon: "aa" },
  { name: "Doodle Alive", url: "https://doodle-alive.vercel.app", blurb: "Snap a doodle, watch it come alive.", icon: "doodle" },
  { name: "Underline", url: "https://underline-it.vercel.app", blurb: "Highlight the line you love, without ruining your book.", icon: "underline" },
  { name: "Look Up", url: "https://look-up-sky.vercel.app", blurb: "Saw a shape in the clouds? Send it to someone.", icon: "cloud" }
];

// ===== kit: footer (from ../shared-kit/footer/footer.js) =====
var SIB_SVG = {
  aa: "Aa",
  doodle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 16c2-5 4-5 5-1s3 3 4-2 3-6 4-2 2 5 3 3"/><path d="M19 4l.8 1.8L21.6 6.6 19.8 7.4 19 9.2 18.2 7.4 16.4 6.6 18.2 5.8z"/></svg>',
  underline: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M5 8h14M5 12h10"/><path d="M4 17.5c3-.8 6 .6 9-.2s5-.6 7 .2" stroke-width="3" opacity=".55"/></svg>',
  cloud: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M7 18h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.1 9.6 4.2 4.2 0 0 0 7 18z"/></svg>'
};

function footerEsc(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

function footerHTML() {
  var cards = SIBLINGS.map(function (s) {
    return '<a class="sib-card" href="' + footerEsc(s.url) + '" target="_blank" rel="noopener">' +
      '<span class="sib-ico" aria-hidden="true">' + (SIB_SVG[s.icon] || "") + "</span>" +
      '<span class="sib-text"><strong>' + footerEsc(s.name) + "</strong><span>" + footerEsc(s.blurb) + "</span></span></a>";
  }).join("");
  return '<footer class="site-footer"><p class="more-from">More from ' + footerEsc(MAKER_NAME) + "</p>" + cards + "</footer>";
}

function fillFooter() {
  Array.prototype.forEach.call(document.querySelectorAll("[data-footer]"), function (el) { el.innerHTML = footerHTML(); });
}

// ===== the app =====
(function () {
  "use strict";

  // ---------- helpers ----------
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function on(el, ev, fn, opt) { if (el) el.addEventListener(ev, fn, opt); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  // Shrikhand's digits are odd (its "4" looks like a small mark), so numbers in headings and big buttons are spelled out
  var NUMW = ["zero", "one", "two", "three", "four"];
  function word(n) { return NUMW[n] || String(n); }
  function capital(s) { s = String(s || ""); return s.charAt(0).toUpperCase() + s.slice(1); }
  function shuffled(a) {
    var r = a.slice();
    for (var i = r.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = r[i]; r[i] = r[j]; r[j] = t; }
    return r;
  }

  var Q = new URLSearchParams(location.search);
  var FAST = Q.get("fast") === "1";
  var DEVELOP = Q.get("develop") !== "0";
  var REDUCED = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  var PREVIEW = 0.5;                       // on-screen strip is drawn at half size (300x900); full size only for outputs
  var CANCEL = { cancelled: true };        // thrown inside a session when it is cancelled
  var LS_KEY = "pocketbooth.v1";
  var IN_APP = /Instagram|FBAN|FBAV|FB_IAB|Line\/|MicroMessenger|Snapchat|TikTok|musical_ly|Twitter|Pinterest|GSA\/|; wv\)/i.test(navigator.userAgent || "");
  var MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  var STYLE_PAPER = { classic: "#f7f5f0", film: "#f1e8d6", flash: "#141414", faded: "#efe2bf", fourcut: "#f6d6dc", sepia: "#efe6d2", disposable: "#f7f5f0" };

  // ---------- pose ideas: short, kind, funny dares (one per shot when the toggle is on) ----------
  var POSES = [
    "Worst passport photo", "Everyone look at the one who’s late", "Surprised by a tiny dog", "Cool kids who don’t care",
    "You just won the lottery", "Hug the person on your left", "Gently glare at the camera", "Fancy dinner, nobody’s eaten yet",
    "A band on its album cover", "Whisper a secret, then gasp", "Superheroes, but sleepy", "The cat knocked something over",
    "Everyone’s a statue", "Fake sneeze, real laugh", "Proud parents at graduation", "Duck lips, but dramatic",
    "Pretend the camera is a mirror", "Detectives who found a clue", "Best friends in a shampoo ad", "Gaze out a rainy window",
    "Tiny people squeezing in", "Big laugh, no sound", "Birthday candles just blew out", "Surprise! Wait, wrong room",
    "Pose like your favourite cartoon", "The plane is landing!", "Tell the camera it’s pretty", "Everyone point at the funniest one",
    "Cosy blanket burritos", "Opera singers, mid-note", "Wave at someone far away", "Chef’s kiss",
    "Pull a rabbit out of a hat", "Say cheese in slow motion", "Pretend it’s 1985", "Group hug, heads together",
    "Judges holding up score cards", "Last slice of pizza, who gets it?", "A very strong wind", "Your best “who, me?”",
    "Sleepy owls", "Royalty, but friendly"
  ];

  // ---------- icons (small line drawings, one path each) ----------
  var ICONS = {
    back: "M15 5l-7 7 7 7", flip: "M4 9h13l-3.5-3.5M20 15H7l3.5 3.5", share: "M12 3v12M7.5 7.5L12 3l4.5 4.5M5 13v7h14v-7",
    download: "M12 3v12M7.5 10.5L12 15l4.5-4.5M5 20h14", print: "M7 9V4h10v5M7 17H5v-7h14v7h-2M7 14h10v6H7z",
    story: "M8 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM10.5 18h3",
    crop: "M6 3v15h15M3 6h15v15", retake: "M4 4v6h6M20 20v-6h-6M5.5 14.5a7 7 0 0 0 12 2.5M18.5 9.5a7 7 0 0 0-12-2.5",
    camera: "M3.5 8h4l2-3h5l2 3h4v11h-17zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z",
    photos: "M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6M16 9.5v.01", lock: "M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3",
    check: "M5 12.5l4.5 4.5L19 7", plus: "M12 5v14M5 12h14", up: "M12 19V5M6 11l6-6 6 6", down: "M12 5v14M6 13l6 6 6-6"
  };
  function icon(n) { return '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="' + ICONS[n] + '"/></svg>'; }
  function fillIcons(root) {
    $$("[data-icon]", root).forEach(function (el) { if (!el.firstChild && ICONS[el.getAttribute("data-icon")]) el.innerHTML = icon(el.getAttribute("data-icon")); });
  }

  // ---------- words for failures (used if the engine's own error has none) ----------
  var ERR = {
    "camera-denied": ["The camera’s switched off for this site.", "Allow the camera in your browser settings, or take 4 photos one at a time."],
    "camera-missing": ["No camera found.", "You can still make a strip from photos you already have."],
    "camera-unsupported": ["This app’s browser can’t open the camera.", "Open this page in Chrome or Safari for the full booth, or take 4 photos one at a time."],
    "not-image": ["That doesn’t look like a photo.", "Choose a picture (a JPG or PNG), or take a new photo."],
    "heic": ["Your phone saved this in a format I can’t read.", "Take a screenshot of it and use that."],
    "unreadable": ["I couldn’t open that picture.", "Try a different photo, or take a screenshot of it and use that."],
    "export-failed": ["That didn’t work.", "Please try again. You can still save the picture."],
    "pdf-failed": ["The print sheet didn’t work.", "Please try again. You can still save the picture."]
  };
  function info(e) {
    var code = (e && e.code) || "unknown";
    var d = ERR[code] || ["Hmm, that didn’t work.", "Please try again."];
    return { code: code, title: (e && e.title) || d[0], detail: (e && e.detail) || d[1] };
  }

  // ---------- state ----------
  var S = {
    screen: "", settings: null, photos: [], crops: [], strip: null, source: "",
    rev: 0, develop: true, drawTok: 0, pref: {}, sound: true, poses: false,
    facing: "user", stream: null, camTok: 0, bstate: "asking", sess: null, dev: false, flipped: false,
    pick: [], cam: [], help: null, edit: { i: 0, crop: null }, out: { share: {}, story: {}, print: {} },
    done: { kind: "share", how: "save", r: "saved" }, sheet: null, errAct: null
  };
  var L = { strip: null, loading: false, i: 0, timer: 0, played: false };
  var LAND_STYLES = ["classic", "film", "flash", "fourcut"];

  // the dev shortcut object: always current
  window.__booth = {};
  Object.defineProperties(window.__booth, {
    screen: { get: function () { return S.screen; }, enumerable: true },
    settings: { get: function () { return S.settings; }, enumerable: true },
    photos: { get: function () { return S.photos; }, enumerable: true },
    crops: { get: function () { return S.crops; }, enumerable: true },
    strip: { get: function () { return S.strip; }, enumerable: true }
  });

  // ---------- remembered on this device (never photos) ----------
  function loadPref() { try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}") || {}; } catch (e) { return {}; } }
  function savePref() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ style: S.pref.style, paper: S.pref.paper, sound: S.sound, poses: S.poses }));
    } catch (e) { /* the site works without it */ }
  }
  function styleOk(id) { return PB.STYLES.some(function (s) { return s.id === id; }); }
  function paperOk(id) { return PB.PAPERS.some(function (p) { return p.id === id; }); }
  function styleHex(id) { return STYLE_PAPER[id] || "#f7f5f0"; }
  function styleName(id) { var s = PB.STYLES.filter(function (x) { return x.id === id; })[0]; return s ? s.name : id; }
  function fmtDate(ms) { var d = new Date(ms || Date.now()); return pad(d.getDate()) + " " + MONTHS[d.getMonth()] + " " + d.getFullYear(); }

  function baseSettings() {
    var s = Object.assign({}, PB.DEFAULTS);
    if (S.pref.style && styleOk(S.pref.style)) s.style = S.pref.style;
    if (S.pref.paper && paperOk(S.pref.paper)) s.paper = S.pref.paper;
    var p = Q.get("style"); if (p && styleOk(p)) s.style = p;
    p = Q.get("paper"); if (p && paperOk(p)) s.paper = p;
    if (Q.has("caption")) s.caption = String(Q.get("caption")).slice(0, 24);
    if (Q.has("date")) s.showDate = Q.get("date") !== "0";
    if (Q.has("when")) { var w = +Q.get("when"); if (isFinite(w)) s.when = w; }
    if (!s.when) s.when = Date.now();
    return s;
  }

  // ---------- small UI pieces ----------
  function busy(msg) { $("#busyText").textContent = msg; $("#busy").classList.add("on"); }
  function unbusy() { $("#busy").classList.remove("on"); }
  var toastT = 0;
  function toast(msg) {
    var t = $("#toast"); t.textContent = msg; t.classList.add("on");
    clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove("on"); }, 2800);
  }
  function snd(name) { try { if (PB.sound && PB.sound[name]) PB.sound[name](); } catch (e) { /* sound is optional */ } }

  function buildRings() {
    $$("[data-ring]").forEach(function (h) {
      var p = h.getAttribute("data-ring").split(","), nx = +p[0], ny = +p[1], k = 0;
      function row(c, n) { var s = ""; for (var j = 0; j < n; j++) s += '<i style="--i:' + (k++) + '"></i>'; return '<div class="' + c + '">' + s + "</div>"; }
      h.className = "ring"; h.setAttribute("aria-hidden", "true");
      h.innerHTML = row("r-t", nx) + row("r-r", ny) + row("r-b", nx) + row("r-l", ny);
    });
  }
  function buildStripBoxes() {
    var t = $("#tpl-strip").innerHTML;
    $$("[data-strip]").forEach(function (b) { b.insertAdjacentHTML("beforeend", t); });
  }

  // draw the strip (half size) into a display canvas, and remember the paper colour for the develop cover
  function paintStrip(cv, strip) {
    var c = strip.render(PREVIEW);
    if (cv.width !== c.width || cv.height !== c.height) { cv.width = c.width; cv.height = c.height; }
    var x = cv.getContext("2d"); x.clearRect(0, 0, cv.width, cv.height); x.drawImage(c, 0, 0);
    var box = cv.parentNode; box.classList.add("has-canvas");
    box.style.setProperty("--paper-now", paperHex(strip.settings || {}));   // the develop cover for the stamp band matches the paper
  }
  function paperHex(s) {
    if (s.paper && s.paper !== "auto") {
      var p = PB.PAPERS.filter(function (x) { return x.id === s.paper; })[0];
      if (p && p.hex) return p.hex;
    }
    return styleHex(s.style);
  }
  function playDevelop(root) {
    if (!root || REDUCED || !DEVELOP) return;
    root.classList.remove("go"); void root.offsetWidth; root.classList.add("go");
  }

  // ---------- screens ----------
  var PARENT = { booth: "landing", "camera-help": "landing", pick: "landing", edit: "result", done: "result", result: "landing", error: "landing" };
  function show(name, noPush) {
    var prev = S.screen;
    if (prev === "booth" && name !== "booth") leaveBooth();
    if (prev === "landing" && name !== "landing") stopLanding();
    S.screen = name;
    $$(".screen").forEach(function (s) { s.classList.toggle("is-active", s.id === "screen-" + name); });
    document.body.setAttribute("data-screen", name);
    unbusy();
    window.scrollTo(0, 0);
    var h = $("#screen-" + name + " [tabindex='-1']");
    if (h) { try { h.focus({ preventScroll: true }); } catch (e) { /* older browsers */ } }
    if (name === "landing") startLanding();
    if (!noPush && prev !== name && name !== "landing" && window.history && history.pushState) { try { history.pushState({ s: name }, ""); } catch (e) { /* fine */ } }
  }
  on(window, "popstate", function () {
    if (S.screen === "landing" || S.screen === "frame") return;
    unbusy(); show(PARENT[S.screen] || "landing", true);
  });

  // =====================================================================
  // LANDING: the sample strip slides out of the slot, develops, then cycles styles
  // =====================================================================
  function sampleData() {
    if (!(PB.sample && PB.sample.load)) return Promise.reject({ code: "unreadable", title: "The sample strip isn’t here yet.", detail: "Try the booth, or pick your own photos." });
    return PB.sample.load();
  }
  function startLanding() {
    if (L.strip) { drawLanding(); scheduleCycle(); return; }
    if (L.loading) return;
    L.loading = true;
    sampleData().then(function (d) {
      var s = Object.assign({}, d.settings || {}, { style: "classic", paper: "auto", caption: "Squeeze in", showDate: true, when: Date.now() });
      return PB.strip.create(d.photos, d.crops, s);
    }).then(function (st) {
      L.strip = st; L.loading = false;
      if (S.screen === "landing") { drawLanding(); scheduleCycle(); }
    }).catch(function () { L.loading = false; /* the drawn strip stays: nothing is broken */ });
  }
  function stopLanding() { clearTimeout(L.timer); }
  function drawLanding() {
    if (!L.strip) return;
    // the drawn strip is already sliding out at page load: if the real one arrives while that plays, swap quietly, otherwise slide it out again
    var fresh = !L.played && (Date.now() - L.t0 < 2400);
    paintStrip($("#lStrip .sc"), L.strip);
    $("#lStyle").textContent = styleName(L.strip.settings.style);
    if (!fresh) playDevelop($("#zone"));
    L.played = true;
  }
  function scheduleCycle() {
    clearTimeout(L.timer);
    if (REDUCED || !L.strip) return;
    L.timer = setTimeout(function () {
      if (S.screen !== "landing" || document.hidden) return;
      L.i = (L.i + 1) % LAND_STYLES.length;
      Promise.resolve(L.strip.update({ style: LAND_STYLES[L.i] })).then(function () {
        if (S.screen !== "landing") return;
        paintStrip($("#lStrip .sc"), L.strip);
        $("#lStyle").textContent = styleName(L.strip.settings.style);
        scheduleCycle();
      }).catch(function () { /* keep the style we have */ });
    }, L.played && !L.cycled ? 3800 : 2400);
    L.cycled = true;
  }

  // =====================================================================
  // THE LIVE BOOTH (Step 2A)
  // =====================================================================
  function unlockSound() { try { if (PB.sound && PB.sound.unlock) PB.sound.unlock(); } catch (e) { /* silent phones are fine */ } }

  function enterBooth() {
    S.dev = false; S.source = "live"; S.flipped = false;
    cancelSession(); resetBoothUI();
    show("booth");
    setBoothState("asking");
    openCamera();
  }
  function setBoothState(st) {
    S.bstate = st;
    var sec = $("#screen-booth");
    ["asking", "opening", "ready", "run"].forEach(function (n) { sec.classList.toggle("st-" + n, n === st); });
    $("#btnShoot").disabled = st !== "ready";
    $("#btnShoot").hidden = st === "run";
    $("#btnStop").hidden = st !== "run";
    $("#explainText").textContent = st === "opening" ? "Opening the camera…" : "Your camera stays on your phone. Nothing is recorded or sent.";
    $("#screen-booth").classList.toggle("is-count", st === "run");
  }
  function openCamera() {
    var tok = ++S.camTok;
    stopCamera();
    if (S.bstate !== "run") setBoothState(S.flipped ? "opening" : "asking");
    var video = $("#video"); video.muted = true;
    var p;
    try { p = PB.camera.start(video, { facing: S.facing }); } catch (e) { p = Promise.reject(e); }
    Promise.resolve(p).then(function (st) {
      if (tok !== S.camTok || S.screen !== "booth") { try { st && st.stop && st.stop(); } catch (e) { /* already stopped */ } return; }
      S.stream = st;
      if (st && st.facing) S.facing = st.facing;
      $("#window").classList.toggle("mirror", S.facing === "user");
      if (!S.dev) setBoothState("ready");
    }).catch(function (e) {
      if (tok !== S.camTok) return;
      if (S.dev) return;
      var code = e && e.code;
      if (S.flipped && code !== "camera-denied") { // no second camera: go back to the first one
        S.flipped = false; S.facing = "user"; toast("No other camera here."); openCamera(); return;
      }
      cameraFail(e);
    });
  }
  function stopCamera() {
    try { if (S.stream && S.stream.stop) S.stream.stop(); } catch (e) { /* ignore */ }
    S.stream = null;
    try { if (PB.camera && PB.camera.stopAll) PB.camera.stopAll(); } catch (e) { /* ignore */ }
  }
  function leaveBooth() {
    cancelSession(); stopCamera(); S.camTok++;
    var v = $("#video"); try { v.pause(); v.srcObject = null; } catch (e) { /* ignore */ }
    setBoothState("asking");
  }
  function cameraFail(e) {
    cancelSession(); stopCamera();
    var i = info(e);
    if (!/^camera-/.test(i.code)) i = info({ code: "camera-missing" });
    S.help = i; S.cam = [];
    fillHelp(); show("camera-help");
  }

  function resetBoothUI() {
    $("#count").classList.remove("show", "pop");
    $("#dare").hidden = true;
    $("#flash").classList.remove("on");
    $$("#mini canvas").forEach(function (c) { c.classList.remove("in"); c.getContext("2d").clearRect(0, 0, c.width, c.height); });
    setLamps(0, -1);
    $("#shotText").textContent = "Shot 1 of 4";
  }
  function setLamps(taken, now) {
    $$("#lamps i").forEach(function (l, i) { l.classList.toggle("on", i < taken); l.classList.toggle("now", i === now); });
  }
  function showCount(n) {
    var c = $("#count"); $("#countNum").textContent = n;
    c.classList.add("show"); c.classList.remove("pop"); void c.offsetWidth; c.classList.add("pop");
  }
  function showDare(t) { $("#dareText").textContent = t; $("#dare").hidden = false; }
  function addMini(i, src) {
    var m = $$("#mini canvas")[i]; if (!m) return;
    try { m.getContext("2d").drawImage(src, 0, 0, src.width, src.height, 0, 0, m.width, m.height); } catch (e) { /* the shot is still kept */ }
    m.classList.remove("in"); void m.offsetWidth; m.classList.add("in");
  }

  // sessions run on timers we can cancel
  function wait(sess, ms) {
    return new Promise(function (res) {
      if (sess.dead) return;
      sess.t.push(setTimeout(function () { if (!sess.dead) res(); }, ms));
    });
  }
  function cancelSession() {
    var s = S.sess;
    if (s) { s.dead = true; s.t.forEach(clearTimeout); s.t = []; S.sess = null; }
    if (S.screen === "booth") {
      resetBoothUI();
      if (S.bstate === "run" && !S.dev) setBoothState(S.stream ? "ready" : "asking");
    }
  }

  function startSession() {
    if (S.screen !== "booth" || !S.stream || S.sess || S.bstate !== "ready") return;
    unlockSound();                                        // inside the Start tap
    var sess = S.sess = { dead: false, t: [], grabs: [] };
    resetBoothUI(); setBoothState("run");
    runSession(sess).catch(function (e) {
      if (e === CANCEL || sess.dead) return;
      cancelSession(); stopCamera(); unbusy();
      showError(e && e.code ? e : { code: "export-failed", title: "The booth hiccuped.", detail: "Your camera is off again. Let’s try that once more." }, { label: "Back to the booth", act: enterBooth });
    });
  }
  async function runSession(sess) {
    var tick = FAST ? 300 : 1000;
    var video = $("#video");
    var mirror = S.facing === "user";
    var aspect = PB.STRIP.frameW / PB.STRIP.frameH;
    var dares = S.poses ? shuffled(POSES).slice(0, PB.FRAMES) : null;
    await wait(sess, FAST ? 100 : 450);
    for (var i = 0; i < PB.FRAMES; i++) {
      setLamps(i, i);
      $("#shotText").textContent = "Shot " + (i + 1) + " of " + PB.FRAMES;
      showDare(dares ? dares[i] : (i ? "Next one…" : "Squeeze in."));
      for (var n = 3; n >= 1; n--) {
        showCount(n);
        if (S.sound) snd("beep");
        await wait(sess, tick);
      }
      $("#count").classList.remove("show");
      await doFlash(sess, i, video, mirror, aspect);
    }
    // all four are in: the camera light goes off, the strip develops
    stopCamera();
    $("#dare").hidden = true;
    busy("Developing your strip…");
    var photos = [];
    for (var k = 0; k < PB.FRAMES; k++) {
      photos.push(await PB.photo.from(sess.grabs[k], { live: true }));
      if (sess.dead) return;
    }
    await newStrip(photos, null, "live");
    if (sess.dead) return;
    S.sess = null;
    enterResult();
  }
  async function doFlash(sess, i, video, mirror, aspect) {
    var fl = $("#flash");
    fl.classList.add("on");
    if (S.sound) snd("shutter");
    await wait(sess, 120);                                // the white screen lights faces, then we grab
    var c = PB.camera.grab(video, { mirror: mirror, aspect: aspect });
    sess.grabs[i] = c; addMini(i, c); setLamps(i + 1, -1);
    fl.classList.remove("on");                            // fades out over 300 ms
    await wait(sess, FAST ? 80 : 420);
  }

  // =====================================================================
  // CAMERA HELP and the one-at-a-time fallback
  // =====================================================================
  function fillSlots(box, photos) {
    box.innerHTML = "";
    for (var i = 0; i < PB.FRAMES; i++) {
      var d = document.createElement("div"), ph = photos[i];
      d.className = "tile" + (ph ? " full" : "");
      if (ph) {
        var cv = document.createElement("canvas"); cv.width = 160; cv.height = 120;
        try { PB.photo.drawCrop(cv, ph, PB.photo.autoCrop(ph)); } catch (e) { /* leave it dark */ }
        d.appendChild(cv); d.insertAdjacentHTML("beforeend", "<b>" + (i + 1) + "</b>");
      } else {
        d.innerHTML = "<b>" + (i + 1) + '</b><span data-icon="plus" aria-hidden="true"></span>';
      }
      box.appendChild(d);
    }
    fillIcons(box);
  }
  function fillHelp() {
    var h = S.help || info({ code: "camera-unsupported" }), n = S.cam.length;
    $("#helpTitle").textContent = n ? "Photo " + word(n + 1) + " of " + word(PB.FRAMES) : h.title;
    $("#helpDetail").textContent = n ? "Take it, then come back for the next one." : h.detail;
    fillSlots($("#camSlots"), S.cam);
    $("#oneBox").hidden = !n;
    $("#btnCamTake .lbl").textContent = n ? "Take photo " + word(n + 1) : "Take four photos one at a time";
    $("#steps").hidden = !(!n && (IN_APP || h.code === "camera-unsupported"));
    $("#allow").hidden = !(!n && h.code === "camera-denied");
    $("#btnHelpRetry").hidden = !!n;
    $("#btnHelpPhotos").hidden = !!n;
  }
  function takeOne() { var f = $("#fCam"); f.value = ""; f.click(); }

  // =====================================================================
  // PHOTOS: the picker (Step 2B), decoding, and building the strip
  // =====================================================================
  function loadPhoto(file) {
    return PB.decode.fileToImageData(file, { maxSide: 2000 }).then(function (id) { return PB.photo.from(id, { live: false }); });
  }
  // decode files one after another (light on memory) into list, up to max photos
  async function addFiles(files, list, max) {
    files = Array.prototype.slice.call(files).slice(0, Math.max(0, max - list.length));
    busy("Getting your photos ready…");
    try {
      for (var i = 0; i < files.length; i++) list.push(await loadPhoto(files[i]));
    } finally { unbusy(); }
  }
  function openPicker() { var f = $("#fPick"); f.value = ""; f.click(); }
  function fillPick() {
    var n = S.pick.length, rem = PB.FRAMES - n;
    $("#pickTitle").textContent = n ? "Pick " + word(rem) + " more" : "Pick four photos";
    $("#pickNote").textContent = n ? "Four photos make one strip. Add " + word(rem) + " more and it appears." : "Four photos make one strip. They’ll go in the order you pick them.";
    fillSlots($("#pickSlots"), S.pick);
  }
  async function buildFrom(photos, source) {
    busy("Putting your strip together…");
    try { await newStrip(photos, null, source); }
    catch (e) { unbusy(); showError(e, { label: "Try again", act: function () { show("landing"); } }); return; }
    enterResult();
  }

  // make (or remake) the strip from photos
  async function newStrip(photos, crops, source, extra) {
    S.settings = Object.assign(baseSettings(), extra || {});
    var cr = (crops || photos.map(function (p) { return PB.photo.autoCrop(p); })).map(function (c) { return Object.assign({}, c); });
    S.photos = photos; S.crops = cr; S.source = source;
    S.strip = await PB.strip.create(photos, cr.map(function (c) { return Object.assign({}, c); }), Object.assign({}, S.settings));
    if (S.strip.settings) S.settings = Object.assign({}, S.settings, S.strip.settings);
    S.rev++; S.out = { share: {}, story: {}, print: {} }; unarmAll();
    S.develop = DEVELOP && !REDUCED;
  }

  // =====================================================================
  // RESULT (Steps 3 and 4)
  // =====================================================================
  function buildControls() {
    var row = $("#styleRow"); row.innerHTML = "";
    PB.STYLES.forEach(function (st, i) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "chip"; b.setAttribute("data-id", st.id); b.setAttribute("aria-pressed", "false");
      b.style.setProperty("--r", (i % 2 ? 1.2 : -1.2) + "deg");
      b.innerHTML = '<i style="--c:' + styleHex(st.id) + '"></i>' + footerEsc(st.name);
      on(b, "click", function () { change({ style: st.id }); });
      row.appendChild(b);
    });
    var pr = $("#paperRow"); pr.innerHTML = "";
    PB.PAPERS.forEach(function (p) {
      var b = document.createElement("button"), label = p.id === "auto" ? "Style’s own colour" : capital(p.id);
      b.type = "button"; b.className = "dot"; b.setAttribute("data-id", p.id); b.setAttribute("aria-pressed", "false"); b.setAttribute("aria-label", label); b.title = label;
      b.innerHTML = '<span class="disc" style="--c:' + (p.hex || "#f7f5f0") + '">' + (p.id === "auto" ? '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="#sym-spark"/></svg>' : "") + "</span>";
      on(b, "click", function () { change({ paper: p.id }); });
      pr.appendChild(b);
    });
  }
  function syncControls(center) {
    var s = S.settings;
    $$("#styleRow .chip").forEach(function (b) {
      var sel = b.getAttribute("data-id") === s.style;
      b.setAttribute("aria-pressed", String(sel));
      if (sel && center) {
        var row = $("#styleRow"), r = row.getBoundingClientRect(), br = b.getBoundingClientRect();
        row.scrollLeft = br.left - r.left + row.scrollLeft - (r.width - br.width) / 2;
      }
    });
    var auto = $('#paperRow .dot[data-id="auto"] .disc'); if (auto) auto.style.setProperty("--c", styleHex(s.style));
    $$("#paperRow .dot").forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-id") === s.paper)); });
    $("#paperName").textContent = s.paper === "auto" ? "Style’s own" : capital(s.paper);
    var cap = $("#caption");
    if (document.activeElement !== cap) cap.value = s.caption || "";
    $("#capCount").textContent = cap.value.length + "/24";
    $("#dateToggle").setAttribute("aria-checked", String(!!s.showDate));
    var d = fmtDate(s.when); $("#dateText").textContent = d; $("#stampDate").textContent = d;
    var live = S.source === "live" || S.source === "fallback";
    $("#btnRetake").hidden = !live;
  }
  function paintResult() { if (S.strip) paintStrip($("#rStrip .sc"), S.strip); }
  function enterResult() {
    show("result");
    syncControls(true); paintResult();
    if (S.develop) { S.develop = false; playDevelop($("#rTable")); }
    schedulePrefetch();
  }
  function bumpRev() { S.rev++; unarmAll(); }
  // a style, colour, caption or date change: swap at once (no re-develop)
  function change(partial) {
    Object.assign(S.settings, partial);
    if (partial.style || partial.paper) {
      if (partial.style) S.pref.style = partial.style;
      if (partial.paper) S.pref.paper = partial.paper;
      savePref();
    }
    bumpRev(); syncControls(false);
    var tok = ++S.drawTok;
    return Promise.resolve(S.strip.update(partial)).then(function () {
      if (tok === S.drawTok) { paintResult(); if (S.screen === "done") paintStrip($("#dStrip .sc"), S.strip); }
      schedulePrefetch();
    }).catch(function (e) { showError(e, { label: "Try again", act: function () { show("result"); } }); });
  }

  // tap a photo on the strip to adjust it
  on($("#rStrip"), "click", function (e) {
    var cv = $("#rStrip .sc");
    if (!S.strip || e.target !== cv) return;
    var fy = (e.offsetY / cv.clientHeight) * PB.STRIP.h, st = PB.STRIP;
    openEditor(clamp(Math.floor((fy - st.margin + st.gap / 2) / (st.frameH + st.gap)), 0, PB.FRAMES - 1));
  });

  // =====================================================================
  // FRAME EDITOR: drag and pinch (pointer events)
  // =====================================================================
  var MAX_ZOOM = 4;
  function openEditor(i) {
    S.edit.i = clamp(i, 0, PB.FRAMES - 1);
    $("#screen-edit").classList.toggle("is-live", S.source === "live");
    var row = $("#frameRow");
    if (!row.firstChild) {
      for (var j = 0; j < PB.FRAMES; j++) {
        (function (j) {
          var b = document.createElement("button"), c = document.createElement("canvas");
          b.type = "button"; b.setAttribute("aria-label", "Frame " + (j + 1)); b.setAttribute("aria-pressed", "false");
          c.width = 144; c.height = 108; b.appendChild(c);
          on(b, "click", function () { commitEdit(); S.edit.i = j; loadEditFrame(); });
          row.appendChild(b);
        })(j);
      }
    }
    show("edit");
    loadEditFrame();
  }
  function loadEditFrame() {
    var i = S.edit.i, cv = $("#editCanvas");
    $("#editTitle").textContent = "Frame " + word(i + 1) + " of " + word(PB.FRAMES);
    var r = cv.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.max(240, Math.round((r.width || 340) * dpr));
    cv.height = Math.round(cv.width * PB.STRIP.frameH / PB.STRIP.frameW);
    S.edit.crop = Object.assign({}, S.crops[i]);
    drawEdit();
    $("#zoom").max = String(MAX_ZOOM); $("#zoom").value = String(S.edit.crop.zoom || 1);
    $("#btnUp").setAttribute("aria-disabled", String(i === 0));
    $("#btnDown").setAttribute("aria-disabled", String(i === PB.FRAMES - 1));
    paintFrameRow();
  }
  var editRaf = 0;
  function drawEdit() {
    if (editRaf) return;
    editRaf = requestAnimationFrame(function () {
      editRaf = 0;
      try { PB.photo.drawCrop($("#editCanvas"), S.photos[S.edit.i], S.edit.crop); } catch (e) { /* keep the last picture */ }
    });
  }
  function paintFrameRow() {
    if (!S.strip) return;
    var r = S.strip.render(PREVIEW), st = PB.STRIP, s = r.width / st.w;
    $$("#frameRow button").forEach(function (b, j) {
      b.setAttribute("aria-pressed", String(j === S.edit.i));
      var c = b.firstChild, x = c.getContext("2d");
      x.drawImage(r, st.margin * s, (st.margin + j * (st.frameH + st.gap)) * s, st.frameW * s, st.frameH * s, 0, 0, c.width, c.height);
    });
  }
  function setEditCrop(c) {
    var ph = S.photos[S.edit.i];
    c.zoom = clamp(c.zoom, 1, MAX_ZOOM);
    S.edit.crop = (PB.photo.clampCrop(ph, c)) || c;
    $("#zoom").value = String(S.edit.crop.zoom);
    drawEdit();
  }
  function commitEdit() {
    var i = S.edit.i, c = S.edit.crop;
    if (!c || !S.strip) return Promise.resolve();
    S.crops[i] = Object.assign({}, c); bumpRev();
    return Promise.resolve(S.strip.setCrop(i, Object.assign({}, c))).then(paintFrameRow).catch(function (e) { showError(e, { label: "Back to your strip", act: function () { show("result"); } }); });
  }
  function initEditor() {
    var cv = $("#editCanvas"), ptrs = {}, last = null;
    function gesture() {
      var k = Object.keys(ptrs); if (!k.length) return null;
      var a = ptrs[k[0]];
      if (k.length === 1) return { x: a.x, y: a.y, d: 0, n: 1 };
      var b = ptrs[k[1]];
      return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y), n: 2 };
    }
    function apply(prev, g) {
      if (!prev || !g || prev.n !== g.n || !S.edit.crop) return;
      var c = Object.assign({}, S.edit.crop), ph = S.photos[S.edit.i];
      if (g.n === 2 && prev.d > 0 && g.d > 0) c.zoom = c.zoom * (g.d / prev.d);
      var rect = cv.getBoundingClientRect(), k = cv.width / (rect.width || 1);
      var sc = Math.max(cv.width / ph.width, cv.height / ph.height) * clamp(c.zoom, 1, MAX_ZOOM);   // canvas px per photo px
      c.cx -= ((g.x - prev.x) * k) / sc / ph.width;
      c.cy -= ((g.y - prev.y) * k) / sc / ph.height;
      setEditCrop(c);
    }
    on(cv, "pointerdown", function (e) {
      try { cv.setPointerCapture(e.pointerId); } catch (x) { /* fine */ }
      ptrs[e.pointerId] = { x: e.clientX, y: e.clientY }; last = gesture(); e.preventDefault();
    });
    on(cv, "pointermove", function (e) {
      var p = ptrs[e.pointerId]; if (!p) return;
      var prev = last; p.x = e.clientX; p.y = e.clientY; var g = gesture(); apply(prev, g); last = g;
    });
    function up(e) {
      if (!ptrs[e.pointerId]) return;
      delete ptrs[e.pointerId]; last = gesture();
      if (!Object.keys(ptrs).length) commitEdit();
    }
    on(cv, "pointerup", up); on(cv, "pointercancel", up);
    on(cv, "wheel", function (e) {
      e.preventDefault();
      var c = Object.assign({}, S.edit.crop); c.zoom *= e.deltaY < 0 ? 1.08 : 1 / 1.08; setEditCrop(c);
      clearTimeout(initEditor.t); initEditor.t = setTimeout(commitEdit, 250);
    }, { passive: false });
    on($("#zoom"), "input", function () { var c = Object.assign({}, S.edit.crop); c.zoom = +this.value; setEditCrop(c); });
    on($("#zoom"), "change", commitEdit);

    on($("#btnUp"), "click", function () { moveFrame(-1); });
    on($("#btnDown"), "click", function () { moveFrame(1); });
    on($("#btnReplace"), "click", function () { var f = $("#fRepl"); f.value = ""; f.click(); });
    on($("#fRepl"), "change", async function () {
      var f = this.files && this.files[0]; if (!f) return;
      busy("Getting your photo ready…");
      try {
        var ph = await loadPhoto(f), c = PB.photo.autoCrop(ph), i = S.edit.i;
        await S.strip.setPhoto(i, ph, Object.assign({}, c));
        S.photos[i] = ph; S.crops[i] = Object.assign({}, c); bumpRev();
        unbusy(); loadEditFrame();
      } catch (e) { unbusy(); showError(e, { label: "Choose another photo", act: function () { show("edit"); var g = $("#fRepl"); g.value = ""; g.click(); } }); }
    });
    on($("#btnEditDone"), "click", doneEditing);
    on($("#btnEditBack"), "click", doneEditing);
  }
  function moveFrame(d) {
    var i = S.edit.i, j = i + d;
    if (j < 0 || j >= PB.FRAMES) return;
    commitEdit();
    S.strip.swap(i, j);
    var tp = S.photos[i]; S.photos[i] = S.photos[j]; S.photos[j] = tp;
    var tc = S.crops[i]; S.crops[i] = S.crops[j]; S.crops[j] = tc;
    S.edit.i = j; bumpRev(); loadEditFrame();
  }
  function doneEditing() {
    commitEdit().then(function () { show("result"); syncControls(false); paintResult(); schedulePrefetch(); });
  }

  // =====================================================================
  // SENDING AND SAVING (PLAN.md 6.7): the share image is made ahead; the story and the PDF are made on tap
  // =====================================================================
  var prefetchT = 0;
  function schedulePrefetch() {
    clearTimeout(prefetchT);
    prefetchT = setTimeout(function () {
      if (!S.strip || (S.screen !== "result" && S.screen !== "done")) return;
      makeFile("share").catch(function () { /* the tap will try again and say so */ });
    }, 300);
  }
  function paperSize() {
    if (S.sheet) return S.sheet;
    try { return PB.print.paperFor(navigator.language || "en-GB"); } catch (e) { return "a4"; }
  }
  function makeFile(kind) {
    var slot = S.out[kind], rev = S.rev, p;
    if (slot.file && slot.rev === rev) return Promise.resolve(slot.file);
    if (slot.p && slot.prev === rev) return slot.p;
    try { p = kind === "print" ? PB.export.printPdf(S.strip, { paper: paperSize() }) : PB.export.shareImage(S.strip, kind); }
    catch (e) { return Promise.reject(e); }
    slot.prev = rev;
    slot.p = Promise.resolve(p).then(function (file) {
      if (slot.prev === rev) { slot.file = file; slot.rev = rev; slot.p = null; }
      return file;
    }, function (e) { if (slot.prev === rev) slot.p = null; throw e; });
    return slot.p;
  }

  function lbl(btn) { return btn.querySelector(".lbl"); }
  function setBusy(btn, yes) {
    var l = lbl(btn); if (!btn._lbl) btn._lbl = l.textContent;
    l.textContent = yes ? "Making it…" : btn._lbl;
    btn.classList.toggle("is-busy", yes);
  }
  function arm(btn, fn) {
    var l = lbl(btn); if (!btn._lbl) btn._lbl = l.textContent;
    l.textContent = "Share now"; btn.classList.add("is-now"); btn._now = fn;
  }
  function unarm(btn) {
    if (!btn || !btn._now) return;
    btn._now = null; btn.classList.remove("is-now");
    var l = lbl(btn); if (l && btn._lbl) l.textContent = btn._lbl;
  }
  function unarmAll() { ["btnSend", "btnSave", "btnPrint", "btnStory", "btnSendAgain", "btnPrint2"].forEach(function (id) { unarm($("#" + id)); }); }

  function failOut(kind) {
    showError({ code: kind === "print" ? "pdf-failed" : "export-failed" }, { label: "Try again", act: function () { show(S.strip ? "result" : "landing"); } });
  }
  function finishOut(kind, how, r) { S.done = { kind: kind, how: how, r: r }; fillDone(); show("done"); }
  function shareNow(file) {
    var p = PB.share.canShare(file) ? PB.share.share(file) : Promise.resolve("failed");
    return p.then(function (r) { return r === "failed" ? PB.share.save(file) : r; });
  }
  // called inside the tap, or just after the file was made
  function deliver(file, how, kind, btn) {
    var p = how === "save" ? PB.share.save(file) : (PB.share.canShare(file) ? PB.share.share(file) : PB.share.save(file));
    return p.then(function (r) {
      if (r === "cancelled") return;
      if (r === "failed") {                                  // the phone wants a fresh tap: turn the button into Share now
        arm(btn, function () {
          shareNow(file).then(function (r2) { if (r2 === "cancelled") return; if (r2 === "failed") failOut(kind); else finishOut(kind, how, r2); });
        });
        return;
      }
      finishOut(kind, how, r);
    });
  }
  function out(kind, how, btn) {
    var slot = S.out[kind], rev0 = S.rev;
    if (slot.file && slot.rev === rev0) { deliver(slot.file, how, kind, btn); return; }   // already made: share inside this very tap
    var t0 = Date.now();
    setBusy(btn, true);
    makeFile(kind).then(function (file) {
      setBusy(btn, false);
      if (rev0 !== S.rev) return;                            // something changed meanwhile: the person can tap again
      if (Date.now() - t0 < 900) deliver(file, how, kind, btn);
      else arm(btn, function () { deliver(file, how, kind, btn); });
    }).catch(function (e) { setBusy(btn, false); showError(e && e.code ? e : { code: kind === "print" ? "pdf-failed" : "export-failed" }, { label: "Try again", act: function () { show(S.screen === "error" ? "result" : S.screen); } }); });
  }
  function bindOut(id, kind, how) {
    var btn = $("#" + id);
    on(btn, "click", function () {
      if (btn._now) { var f = btn._now; unarm(btn); f(); return; }
      out(kind, how, btn);
    });
  }

  // =====================================================================
  // DONE (Step 5)
  // =====================================================================
  function fillDone() {
    var d = S.done;
    $("#doneTitle").textContent = d.kind === "print" ? "Your sheet is ready." : (d.how === "share" && d.r === "shared" ? "Sent." : "Saved.");
    $("#doneNudge").textContent = d.kind === "print" ? "Print at Actual size (100%), on photo paper if you can." : "Send it to everyone in the strip.";
    if (S.strip) paintStrip($("#dStrip .sc"), S.strip);
  }

  // =====================================================================
  // ERRORS: the engine's title and detail, one clear button
  // =====================================================================
  var SIGNS = { camera: "OUT OF ORDER", photo: "TRY ANOTHER", out: "PAPER JAM", other: "OOPS" };
  function showError(e, opt) {
    unbusy();
    var i = info(e); opt = opt || {};
    if (i.code === "cancelled") return;
    $("#errTitle").textContent = i.title;
    $("#errDetail").textContent = i.detail;
    var label = opt.label, act = opt.act, label2 = "", act2 = null, kind = "other";
    if (/^camera-/.test(i.code)) kind = "camera";
    else if (i.code === "not-image" || i.code === "heic" || i.code === "unreadable") kind = "photo";
    else if (i.code === "export-failed" || i.code === "pdf-failed") kind = "out";
    if (!label) {
      if (kind === "camera") {
        label = "Use photos you already have"; act = function () { S.pick = []; openPicker(); };
        label2 = "Take four photos one at a time"; act2 = function () { S.help = i; S.cam = []; fillHelp(); show("camera-help"); takeOne(); };
      }
      else if (kind === "photo") { label = "Choose photos"; act = openPicker; }
      else if (kind === "out") { label = "Try again"; act = function () { show(S.strip ? "result" : "landing"); }; }
      else { label = "Start over"; act = function () { show("landing"); }; }
    }
    $("#errSign").textContent = SIGNS[kind];
    $("#errBtn .lbl").textContent = label; S.errAct = act || function () { show("landing"); };
    var b2 = $("#errBtn2"); b2.hidden = !act2; S.errAct2 = act2;
    if (act2) $(".lbl", b2).textContent = label2;
    show("error");
  }

  // =====================================================================
  // DEV SHORTCUTS (PLAN.md 7.4)
  // =====================================================================
  function devSample(scr) {
    busy("Getting the sample ready…");
    sampleData().then(function (d) {
      return newStrip(d.photos, d.crops, "sample", (!Q.has("caption") && d.settings && d.settings.caption) ? { caption: d.settings.caption } : null);
    }).then(function () {
      unbusy();
      if (scr === "edit") { openEditor(Math.max(0, (+Q.get("frame") || 1) - 1)); }
      else if (scr === "done") { S.done = { kind: "share", how: "save", r: "saved" }; fillDone(); show("done"); }
      else { S.develop = DEVELOP && !REDUCED; enterResult(); }
    }).catch(function (e) { unbusy(); showError(e, { label: "Back to the start", act: function () { show("landing"); } }); });
  }
  function devFrame() {
    var fmt = Q.get("format") || "strip";
    document.body.classList.add("is-frame"); document.body.setAttribute("data-screen", "frame"); S.screen = "frame";
    sampleData().then(function (d) { return newStrip(d.photos, d.crops, "sample"); }).then(function () {
      var cv = $("#frameCanvas"), x;
      if (fmt === "share" || fmt === "story") {
        cv.width = 1080; cv.height = fmt === "share" ? 1350 : 1920;
        PB.scene.draw(cv.getContext("2d"), S.strip, fmt);
      } else if (fmt === "print") {
        PB.print.drawPreview(cv, S.strip, Q.get("paper") === "letter" ? "letter" : "a4");
      } else {
        var c = S.strip.render(1); cv.width = c.width; cv.height = c.height; x = cv.getContext("2d"); x.drawImage(c, 0, 0);
      }
    }).catch(function (e) { document.body.classList.remove("is-frame"); S.screen = ""; showError(e); });
  }
  function devCountdown() {
    S.dev = true; S.source = "live";
    resetBoothUI(); show("booth"); setBoothState("run");
    setLamps(2, 2); $("#shotText").textContent = "Shot 3 of 4";
    showDare(POSES[1]); showCount(2);
    $$("#mini canvas").slice(0, 2).forEach(function (m) {
      var x = m.getContext("2d"), g = x.createLinearGradient(0, 0, 0, m.height);
      g.addColorStop(0, "#b9a58f"); g.addColorStop(1, "#6a5a4b"); x.fillStyle = g; x.fillRect(0, 0, m.width, m.height); m.classList.add("in");
    });
    openCamera();
  }
  function devPick() {
    sampleData().then(function (d) { S.pick = d.photos.slice(0, 2); }).catch(function () { S.pick = []; }).then(function () { fillPick(); show("pick"); });
  }

  // =====================================================================
  // WIRING
  // =====================================================================
  function reflectToggles() {
    $("#tgSound").setAttribute("aria-checked", String(S.sound));
    $("#tgPose").setAttribute("aria-checked", String(S.poses));
  }
  function initKeyboard() {
    var cap = $("#caption"), vv = window.visualViewport;
    function upd() {
      if (!vv) return;
      var kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      document.documentElement.style.setProperty("--kb", kb + "px");
      if (kb > 110 && document.activeElement === cap) setTimeout(function () { try { cap.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (e) { /* ignore */ } }, 60);
    }
    on(cap, "focus", function () { document.body.classList.add("kb"); setTimeout(upd, 250); });
    on(cap, "blur", function () { document.body.classList.remove("kb"); document.documentElement.style.setProperty("--kb", "0px"); });
    on(cap, "keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); cap.blur(); } });
    if (vv) { vv.addEventListener("resize", upd); vv.addEventListener("scroll", upd); }
    on(cap, "input", function () {
      var v = cap.value.slice(0, 24); $("#capCount").textContent = v.length + "/24";
      clearTimeout(initKeyboard.t); initKeyboard.t = setTimeout(function () { change({ caption: v }); }, 140);
    });
  }

  function wire() {
    // landing
    on($("#btnStart"), "click", function () { unlockSound(); S.cam = []; enterBooth(); });
    on($("#btnPhotos"), "click", function () { S.pick = []; openPicker(); });

    // booth
    on($("#btnBoothBack"), "click", function () { show("landing"); });
    on($("#btnFlip"), "click", function () {
      if (S.sess || S.dev) return;
      S.facing = S.facing === "user" ? "environment" : "user"; S.flipped = true; setBoothState("opening"); openCamera();
    });
    on($("#btnShoot"), "click", startSession);
    on($("#btnStop"), "click", function () { cancelSession(); });
    on($("#tgPose"), "click", function () { S.poses = !S.poses; reflectToggles(); savePref(); });
    on($("#tgSound"), "click", function () { S.sound = !S.sound; reflectToggles(); savePref(); if (S.sound) { unlockSound(); snd("beep"); } });

    // camera help and the one-at-a-time fallback
    on($("#btnHelpBack"), "click", function () { S.cam = []; show("landing"); });
    on($("#btnCamTake"), "click", takeOne);
    on($("#btnHelpRetry"), "click", enterBooth);
    on($("#btnHelpPhotos"), "click", function () { S.pick = []; openPicker(); });
    on($("#btnCopy"), "click", function () {
      var url = location.href.split("#")[0];
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(function () { toast("Link copied."); }, function () { toast("Copy the address from the top of your browser."); });
      else toast("Copy the address from the top of your browser.");
    });
    on($("#fCam"), "change", async function () {
      var f = this.files && this.files[0]; if (!f) return;
      try { await addFiles([f], S.cam, PB.FRAMES); }
      catch (e) { showError(e, { label: "Take the photo again", act: function () { fillHelp(); show("camera-help"); takeOne(); } }); return; }
      if (S.cam.length >= PB.FRAMES) { var ph = S.cam.slice(0, PB.FRAMES); S.cam = []; buildFrom(ph, "fallback"); }
      else { fillHelp(); show("camera-help"); }
    });

    // pick
    on($("#fPick"), "change", async function () {
      var files = this.files ? Array.prototype.slice.call(this.files) : [];
      if (!files.length) return;
      try { await addFiles(files, S.pick, PB.FRAMES); }
      catch (e) { showError(e, { label: "Choose photos", act: function () { if (S.pick.length) { fillPick(); show("pick"); } openPicker(); } }); return; }
      if (S.pick.length >= PB.FRAMES) { var ph = S.pick.slice(0, PB.FRAMES); S.pick = []; buildFrom(ph, "photos"); }
      else { fillPick(); show("pick"); }
    });
    on($("#btnPickAdd"), "click", openPicker);
    on($("#btnPickBack"), "click", function () { S.pick = []; show("landing"); });
    on($("#btnPickReset"), "click", function () { S.pick = []; show("landing"); });

    // result
    on($("#btnNew"), "click", newStripReset);
    on($("#dateToggle"), "click", function () { change({ showDate: !S.settings.showDate }); });
    on($("#btnEdit"), "click", function () { openEditor(0); });
    on($("#btnRetake"), "click", function () { S.cam = []; enterBooth(); });
    bindOut("btnSend", "share", "share");
    bindOut("btnSave", "share", "save");
    bindOut("btnStory", "story", "share");
    bindOut("btnPrint", "print", "save");

    // done
    bindOut("btnSendAgain", "share", "share");
    bindOut("btnPrint2", "print", "save");
    on($("#btnAnother"), "click", function () { show("result"); syncControls(true); paintResult(); });
    on($("#btnNewStrip"), "click", newStripReset);

    // errors
    on($("#errBtn"), "click", function () { var a = S.errAct; if (a) a(); });
    on($("#errBtn2"), "click", function () { var a = S.errAct2; if (a) a(); });
    on($("#brokenBtn"), "click", function () { location.reload(); });

    // leaving the booth screen or the page always turns the camera off
    on(document, "visibilitychange", function () {
      if (document.hidden) {
        clearTimeout(L.timer);
        if (S.screen === "booth") { cancelSession(); stopCamera(); S.camTok++; }
      } else if (S.screen === "booth" && !S.dev) { S.flipped = false; openCamera(); }
      else if (S.screen === "landing") { startLanding(); }
    });
    on(window, "pagehide", stopCamera);
    initEditor(); initKeyboard();
  }
  function newStripReset() {
    S.photos = []; S.crops = []; S.strip = null; S.pick = []; S.cam = []; S.source = ""; S.settings = null; S.develop = true;
    clearTimeout(prefetchT); stopCamera(); show("landing");
  }

  // =====================================================================
  // BOOT
  // =====================================================================
  function engineOk() {
    return typeof PB === "object" && PB && PB.STYLES && PB.PAPERS && PB.STRIP && PB.strip && PB.photo && PB.camera && PB.decode && PB.export && PB.share;
  }
  function boot() {
    fillIcons(); buildRings(); buildStripBoxes(); fillFooter();
    S.pref = loadPref(); S.sound = S.pref.sound !== false; S.poses = !!S.pref.poses;
    wire(); reflectToggles();
    if (!engineOk()) { show("broken", true); return; }
    S.pref.style = styleOk(S.pref.style) ? S.pref.style : undefined;
    S.pref.paper = paperOk(S.pref.paper) ? S.pref.paper : undefined;
    if (Q.get("paper") === "letter" || Q.get("paper") === "a4") S.sheet = Q.get("paper");
    buildControls();

    var scr = Q.get("screen"), errs = { "error-camera-denied": "camera-denied", "error-camera-missing": "camera-missing", "error-not-image": "not-image" };
    if (scr === "frame") devFrame();
    else if (scr === "booth") enterBooth();
    else if (scr === "countdown") devCountdown();
    else if (scr === "camera-help") { S.help = info({ code: "camera-denied" }); fillHelp(); show("camera-help"); }
    else if (scr === "pick") devPick();
    else if (errs[scr]) showError({ code: errs[scr] });
    else if (scr === "edit" || scr === "result" || scr === "done") devSample(scr);
    else if (Q.get("sample") === "1") devSample("result");
    else { show("landing", true); L.t0 = Date.now(); playDevelop($("#zone")); }
  }
  boot();
})();
