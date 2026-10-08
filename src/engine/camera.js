// The camera (PLAN.md section 6.3). Never asks for audio. Touches no browser feature at load time.
//
//   PB.camera.supported()                    -> boolean
//   PB.camera.start(video, { facing })       -> Promise<{ facing, width, height, stop() }>   attaches the stream to the <video>
//   PB.camera.grab(video, { mirror, aspect })-> canvas    the centre crop at `aspect` (default frameW / frameH), full camera resolution
//   PB.camera.stopAll()                      stops every stream this module opened; the camera light goes off
// Errors (Error with {code, title, detail}): camera-unsupported, camera-denied, camera-missing
(function () {
  const PB = (globalThis.PB = globalThis.PB || {});

  const open = []; // { stream, video }

  function supported() {
    try { return !!(typeof navigator !== "undefined" && navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === "function"); }
    catch (e) { return false; }
  }

  function toError(e) {
    const n = e && e.name;
    if (n === "NotAllowedError" || n === "SecurityError" || n === "PermissionDeniedError") return PB.util.error("camera-denied");
    if (n === "NotFoundError" || n === "DevicesNotFoundError" || n === "OverconstrainedError") return PB.util.error("camera-missing");
    if (n === "NotReadableError" || n === "TrackStartError" || n === "AbortError") {
      return PB.util.error("camera-missing", { title: "The camera didn't start.", detail: "Another app might be using it. Close it and try again, or make a strip from photos you already have." });
    }
    return PB.util.error("camera-missing");
  }

  async function getStream(facing) {
    const md = navigator.mediaDevices;
    const tries = [
      { video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false },
      { video: { facingMode: facing }, audio: false },
      { video: true, audio: false }
    ];
    let last = null;
    for (let i = 0; i < tries.length; i++) {
      try { return await md.getUserMedia(tries[i]); }
      catch (e) {
        last = e;
        if (e && (e.name === "NotAllowedError" || e.name === "SecurityError" || e.name === "NotReadableError")) break; // retrying will not help
      }
    }
    throw toError(last);
  }

  function stopStream(stream) {
    try { stream.getTracks().forEach(function (t) { try { t.stop(); } catch (e) { /* ignore */ } }); } catch (e) { /* ignore */ }
  }

  async function start(video, opts) {
    if (!supported()) throw PB.util.error("camera-unsupported");
    const facing = (opts && opts.facing) === "environment" ? "environment" : "user";
    const stream = await getStream(facing);
    const entry = { stream: stream, video: video };
    open.push(entry);
    function stop() {
      stopStream(stream);
      try { if (video && video.srcObject === stream) video.srcObject = null; } catch (e) { /* ignore */ }
      const k = open.indexOf(entry); if (k >= 0) open.splice(k, 1);
    }
    try {
      video.muted = true; video.playsInline = true; video.autoplay = true;
      video.setAttribute("playsinline", ""); video.setAttribute("muted", "");
      video.srcObject = stream;
      await new Promise(function (resolve, reject) {
        let done = false;
        function ok() { if (!done) { done = true; resolve(); } }
        if (video.readyState >= 1 && video.videoWidth) { ok(); return; }
        video.onloadedmetadata = ok;
        setTimeout(function () { if (!done) { done = true; reject(new Error("the camera gave no picture")); } }, 8000);
      });
      try { await video.play(); } catch (e) { /* autoplay is already on; a refused play() is not fatal */ }
    } catch (e) {
      stop();
      throw PB.util.error("camera-missing");
    }
    let actual = facing;
    try {
      const s = stream.getVideoTracks()[0].getSettings();
      if (s && (s.facingMode === "user" || s.facingMode === "environment")) actual = s.facingMode;
    } catch (e) { /* keep the requested one */ }
    return { facing: actual, width: video.videoWidth, height: video.videoHeight, stop: stop };
  }

  function grab(video, opts) {
    const o = opts || {};
    const aspect = o.aspect || (PB.STRIP.frameW / PB.STRIP.frameH);
    const vw = video.videoWidth, vh = video.videoHeight;
    if (!vw || !vh) throw PB.util.error("camera-missing", { title: "The camera isn't ready yet.", detail: "Give it a second and try again." });
    let cw, ch;
    if (vw / vh > aspect) { ch = vh; cw = Math.round(vh * aspect); } else { cw = vw; ch = Math.round(vw / aspect); }
    const sx = Math.round((vw - cw) / 2), sy = Math.round((vh - ch) / 2);
    const canvas = PB.util.createCanvas(cw, ch);
    const ctx = canvas.getContext("2d");
    if (o.mirror) { ctx.translate(cw, 0); ctx.scale(-1, 1); }
    ctx.drawImage(video, sx, sy, cw, ch, 0, 0, cw, ch);
    return canvas;
  }

  function stopAll() {
    while (open.length) {
      const e = open.pop();
      stopStream(e.stream);
      try { if (e.video && e.video.srcObject === e.stream) e.video.srcObject = null; } catch (err) { /* ignore */ }
    }
  }

  PB.camera = { supported: supported, start: start, grab: grab, stopAll: stopAll };
})();
