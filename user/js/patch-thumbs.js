/* Serves small WebP copies of Firebase Storage images (through the free wsrv.nl image CDN).
   Run AFTER patch-all.js:   node patch-thumbs.js      (uses the "user" folder, or: node patch-thumbs.js path/to/user) */
const fs = require("fs"), path = require("path");
const dir = process.argv[2] || "user";
const FN = 'function thumb(u, w) { if (!u || String(u).indexOf("firebasestorage.googleapis.com") < 0) return u; return "https://wsrv.nl/?url=" + encodeURIComponent(u) + "&w=" + w + "&output=webp&q=75"; }\n';

function patch(name, edits) {
  const f = path.join(dir, name); console.log("\n=== " + f + " ===");
  if (!fs.existsSync(f)) return console.log("NOT FOUND, skipped");
  const raw = fs.readFileSync(f, "utf8"); if (!fs.existsSync(f + ".bak2")) fs.writeFileSync(f + ".bak2", raw);
  const crlf = raw.includes("\r\n"); let s = raw.replace(/\r\n/g, "\n");
  edits.forEach(([l, fn]) => { const b = s; s = fn(s); console.log((s !== b ? "OK      " : "SKIPPED ") + l); });
  fs.writeFileSync(f, crlf ? s.replace(/\n/g, "\r\n") : s);
}
const cardEdits = [
  ["add thumb()", s => s.includes("function thumb(") ? s : s.replace("function card(p, idx) {", FN + "      function card(p, idx) {")],
  ["card images -> 640px webp", s => s.split(`'="' + esc(src) + '" alt="' + esc(p.name) + '" width="600"`).join(`'="' + esc(thumb(src, 640)) + '" alt="' + esc(p.name) + '" width="600"`)]
];
patch("shop.html", cardEdits);
patch("newcollections.html", cardEdits);
patch("product.html", [
  ["add thumb()", s => s.includes("function thumb(") ? s : s.replace("function $(id) { return document.getElementById(id); }", "function $(id) { return document.getElementById(id); }\n      " + FN)],
  ["main slides -> 1000px", s => s.split(`'<div class="pd-slide"><img src="' + esc(it.src) + '"`).join(`'<div class="pd-slide"><img src="' + esc(thumb(it.src, 1000)) + '"`)],
  ["thumbnails -> 160px", s => s.split(`'<img src="' + esc(it.src) + '" alt="' + esc(it.label) + '"`).join(`'<img src="' + esc(thumb(it.src, 160)) + '" alt="' + esc(it.label) + '"`)],
  ["you-may-also-like -> 480px", s => s.split(`'<div class="pd-card-media"><img src="' + esc(img) + '"`).join(`'<div class="pd-card-media"><img src="' + esc(thumb(img, 480)) + '"`)]
]);
console.log("\nDone."); 