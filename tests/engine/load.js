// Shared by the Node tests: loads the engine files in the order of PLAN.md 6.1 (they attach to globalThis.PB),
// plus a tiny test runner and a few synthetic-ImageData helpers. No canvas, no browser.
const path = require("path");
const FILES = ["util", "decode", "camera", "photo", "styles", "stamp", "strip", "scene", "print", "pdf", "sound", "sample", "export", "share"];
FILES.forEach(function (f) { require(path.join(__dirname, "../../src/engine/" + f + ".js")); });

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log("ok   " + name); }
  catch (e) { failed++; console.log("FAIL " + name + "\n     " + (e && e.stack ? e.stack.split("\n").slice(0, 3).join("\n     ") : e)); process.exitCode = 1; }
}
async function testAsync(name, fn) {
  try { await fn(); passed++; console.log("ok   " + name); }
  catch (e) { failed++; console.log("FAIL " + name + "\n     " + (e && e.stack ? e.stack.split("\n").slice(0, 3).join("\n     ") : e)); process.exitCode = 1; }
}
function done() { console.log("\n" + passed + " passed, " + failed + " failed"); }

// a w x h RGBA image from a function (x, y, w, h) -> [r, g, b] in 0..255
function makeImage(w, h, fn) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = fn(x, y, w, h), p = (y * w + x) * 4;
    data[p] = c[0]; data[p + 1] = c[1]; data[p + 2] = c[2]; data[p + 3] = 255;
  }
  return { width: w, height: h, data: data };
}

module.exports = { PB: globalThis.PB, test: test, testAsync: testAsync, done: done, makeImage: makeImage };
