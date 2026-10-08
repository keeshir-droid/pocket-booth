// Images and the print PDF out. The pattern is the shared kit's export.js (blob from a canvas, File objects,
// fileName), with no video and no muxer.
//
//   PB.export.shareImage(strip, format) -> Promise<File>   JPEG (quality 0.92): "share" 1080 x 1350 or "story" 1080 x 1920
//   PB.export.printPdf(strip, { paper }) -> Promise<File>  application/pdf: four strips at true size (6 x 2 in), cut marks;
//                                                          paper "a4" | "letter" (default: from the browser's language)
//   PB.export.fileName(kind, ext?)       -> "pocket-booth-<YYYY-MM-DD>.jpg" | "pocket-booth-story-<date>.jpg" | "pocket-booth-print-<date>.pdf"
//                                           kind "share" | "story" | "print"
// Errors (Error with {code, title, detail}): "export-failed" (images), "pdf-failed" (the PDF)
(function () {
  const PB = (globalThis.PB = globalThis.PB || {});
  const U = function () { return PB.util; };

  const JPEG_QUALITY = 0.92, PDF_JPEG_QUALITY = 0.95;

  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function today() { const d = new Date(); return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
  function fileName(kind, ext) {
    const k = kind === "story" ? "story" : (kind === "print" ? "print" : "share");
    const e = String(ext || (k === "print" ? "pdf" : "jpg")).replace(/^\./, "");
    return "pocket-booth-" + (k === "share" ? "" : k + "-") + today() + "." + e;
  }

  function failed(code, e) {
    if (typeof console !== "undefined" && e) console.error(e);
    return U().error(code);
  }

  async function bytesOf(blob) {
    if (blob.arrayBuffer) return new Uint8Array(await blob.arrayBuffer());
    return new Promise(function (resolve, reject) {
      const r = new FileReader();
      r.onload = function () { resolve(new Uint8Array(r.result)); };
      r.onerror = function () { reject(r.error); };
      r.readAsArrayBuffer(blob);
    });
  }

  async function shareImage(strip, format) {
    try {
      const f = format === "story" ? "story" : "share", size = PB.scene.size(f);
      const canvas = U().createCanvas(size.w, size.h);
      const ctx = canvas.getContext("2d", { alpha: false });
      PB.scene.draw(ctx, strip, f);
      const blob = await U().canvasToBlob(canvas, "image/jpeg", JPEG_QUALITY);
      if (!blob) throw new Error("toBlob gave nothing");
      return new File([blob], fileName(f, "jpg"), { type: "image/jpeg" });
    } catch (e) {
      throw failed("export-failed", e);
    }
  }

  async function printPdf(strip, opts) {
    try {
      let paper = opts && opts.paper;
      if (paper !== "a4" && paper !== "letter") paper = PB.print.paperFor(typeof navigator !== "undefined" ? navigator.language : "");
      const layout = PB.print.layout(paper);
      const lifted = PB.print.liftedCanvas(strip);
      const blob = await U().canvasToBlob(lifted, "image/jpeg", PDF_JPEG_QUALITY);
      if (!blob) throw new Error("toBlob gave nothing");
      const jpeg = await bytesOf(blob);
      const pdf = PB.pdf.build({ layout: layout, jpeg: jpeg, imageWidth: lifted.width, imageHeight: lifted.height, title: "Pocket Booth strips" });
      return new File([pdf], fileName("print", "pdf"), { type: "application/pdf" });
    } catch (e) {
      throw failed("pdf-failed", e);
    }
  }

  PB.export = { shareImage: shareImage, printPdf: printPdf, fileName: fileName };
})();
