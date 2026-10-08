// node tests/engine/filename.test.js
// File names (PLAN.md 3 Step 4) and the shared-kit-derived helpers that need no browser.
const assert = require("assert");
const T = require("./load.js"), PB = T.PB, test = T.test;

function today() { const d = new Date(), p = function (n) { return (n < 10 ? "0" : "") + n; }; return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()); }

test("fileName: share, story and print", function () {
  assert.strictEqual(PB.export.fileName("share", "jpg"), "pocket-booth-" + today() + ".jpg");
  assert.strictEqual(PB.export.fileName("story", "jpg"), "pocket-booth-story-" + today() + ".jpg");
  assert.strictEqual(PB.export.fileName("print", "pdf"), "pocket-booth-print-" + today() + ".pdf");
});
test("fileName: sensible defaults for the extension, dots tolerated, unknown kinds are the share image", function () {
  assert.strictEqual(PB.export.fileName("print"), "pocket-booth-print-" + today() + ".pdf");
  assert.strictEqual(PB.export.fileName("share"), "pocket-booth-" + today() + ".jpg");
  assert.strictEqual(PB.export.fileName("story", ".png"), "pocket-booth-story-" + today() + ".png");
  assert.strictEqual(PB.export.fileName("whatever", "jpg"), "pocket-booth-" + today() + ".jpg");
});
test("errors: codes, friendly titles and details (PLAN.md 7.2)", function () {
  ["not-image", "heic", "unreadable", "camera-denied", "camera-missing", "camera-unsupported", "export-failed", "pdf-failed", "cancelled"].forEach(function (c) {
    const e = PB.util.error(c);
    assert(e instanceof Error); assert.strictEqual(e.code, c); assert(e.title && e.title !== "Something went wrong." || c === "cancelled");
    assert.strictEqual(typeof e.detail, "string");
  });
  assert.strictEqual(PB.util.errorInfo("camera-denied").title, "The camera's switched off for this site.");
  assert.strictEqual(PB.util.errorInfo("camera-missing").detail, "You can still make a strip from photos you already have.");
  assert.strictEqual(PB.util.errorInfo("camera-unsupported").title, "This app's browser can't open the camera.");
});
test("share.platform in Node is desktop; camera.supported is false without mediaDevices", function () {
  assert.strictEqual(PB.share.platform(), "desktop");
  assert.strictEqual(PB.share.canShare(null), false);
  assert.strictEqual(typeof PB.camera.supported(), "boolean");
});

T.done();
