// Sounds, synthesised with Web Audio (PLAN.md section 6.5). No files. Safe to call anywhere: it never throws.
//
//   PB.sound.unlock()           create / resume the audio context. Call it inside the first tap (Start).
//   PB.sound.beep()             a short 880 Hz sine, 80 ms (the countdown)
//   PB.sound.shutter()          a 40 ms burst of filtered noise plus a low click
//   PB.sound.setEnabled(bool)   the Sound toggle (on by default); PB.sound.enabled() reads it
(function () {
  const PB = (globalThis.PB = globalThis.PB || {});

  let ctx = null, on = true, noise = null;

  function Ctor() { return (typeof globalThis !== "undefined") && (globalThis.AudioContext || globalThis.webkitAudioContext); }

  function unlock() {
    try {
      const A = Ctor();
      if (!A) return;
      if (!ctx) ctx = new A();
      if (ctx.state === "suspended" && ctx.resume) ctx.resume();
      // a silent tick: iOS only counts the context as unlocked once something has played inside a tap
      const g = ctx.createGain(); g.gain.value = 0.0001;
      const o = ctx.createOscillator(); o.connect(g); g.connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + 0.02);
    } catch (e) { /* no sound is fine */ }
  }

  function ready() {
    if (!on) return false;
    if (!ctx) unlock();
    if (!ctx) return false;
    try { if (ctx.state === "suspended" && ctx.resume) ctx.resume(); } catch (e) { /* ignore */ }
    return true;
  }

  function beep() {
    try {
      if (!ready()) return;
      const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.32, t + 0.008);
      g.gain.setValueAtTime(0.32, t + 0.06);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
      o.connect(g); g.connect(ctx.destination);
      o.start(t); o.stop(t + 0.09);
    } catch (e) { /* ignore */ }
  }

  function noiseBuffer() {
    if (noise) return noise;
    const len = Math.floor(ctx.sampleRate * 0.06), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let a = 12345;
    for (let i = 0; i < len; i++) { a = (a * 1664525 + 1013904223) >>> 0; d[i] = (a / 4294967296) * 2 - 1; }
    noise = buf;
    return buf;
  }

  function shutter() {
    try {
      if (!ready()) return;
      const t = ctx.currentTime;
      // the click: a low thump that drops in pitch
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.type = "sine"; o.frequency.setValueAtTime(190, t); o.frequency.exponentialRampToValueAtTime(55, t + 0.05);
      og.gain.setValueAtTime(0.5, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
      o.connect(og); og.connect(ctx.destination); o.start(t); o.stop(t + 0.08);
      // the burst: 40 ms of band-passed noise
      const n = ctx.createBufferSource(), f = ctx.createBiquadFilter(), ng = ctx.createGain();
      n.buffer = noiseBuffer();
      f.type = "bandpass"; f.frequency.value = 2600; f.Q.value = 0.7;
      ng.gain.setValueAtTime(0.0001, t); ng.gain.exponentialRampToValueAtTime(0.45, t + 0.004); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
      n.connect(f); f.connect(ng); ng.connect(ctx.destination); n.start(t); n.stop(t + 0.05);
    } catch (e) { /* ignore */ }
  }

  PB.sound = { unlock: unlock, beep: beep, shutter: shutter, setEnabled: function (v) { on = !!v; }, enabled: function () { return on; } };
})();
