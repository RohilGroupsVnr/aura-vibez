/* AURA patcher: index.html + shop.html + newcollections.html + product.html
   Run from the AURA project root:   node patch-all.js          (uses the "user" folder)
   or:                               node patch-all.js path/to/user
   Backups are saved as <file>.bak (only the first time). Safe to run twice. */
const fs = require("fs"), path = require("path");
const dir = process.argv[2] || "user";

function lineAt(src, idx) { let n = 1; for (let i = 0; i < idx; i++) if (src.charCodeAt(i) === 10) n++; return n; }

/* finds unclosed / unexpected tags and prints their LINE numbers (this is what VS Code's red errors are) */
function checkHtml(src) {
  let t = src.replace(/<!--[\s\S]*?-->/g, m => m.replace(/[^\n]/g, " "));
  t = t.replace(/(<(script|style)\b[^>]*>)([\s\S]*?)(<\/\2>)/gi, (m, o, tag, body, c) => o + body.replace(/[^\n]/g, " ") + c);
  const VOID = new Set("area base br col embed hr img input link meta param source track wbr".split(" "));
  const AUTO = new Set(["p", "li", "option", "tr", "td", "th", "thead", "tbody", "dt", "dd"]);
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/g;
  const stack = [], issues = []; let m;
  while ((m = re.exec(t))) {
    const close = m[1] === "/", tag = m[2].toLowerCase(), attrs = m[3], line = lineAt(t, m.index);
    if (VOID.has(tag)) continue;
    if (!close) { if (/\/\s*$/.test(attrs)) continue; stack.push({ tag, line }); continue; }
    let i = -1; for (let k = stack.length - 1; k >= 0; k--) if (stack[k].tag === tag) { i = k; break; }
    if (i === -1) { issues.push("Line " + line + ": unexpected </" + tag + ">  (nothing is open to close)"); continue; }
    for (let k = stack.length - 1; k > i; k--) if (!AUTO.has(stack[k].tag)) issues.push("Line " + stack[k].line + ": <" + stack[k].tag + "> is never closed (before </" + tag + "> on line " + line + ")");
    stack.length = i;
  }
  stack.forEach(u => { if (!AUTO.has(u.tag)) issues.push("Line " + u.line + ": <" + u.tag + "> is never closed"); });
  return issues;
}

function patchFile(name, edits, opts) {
  const file = path.join(dir, name);
  console.log("\n=== " + file + " ===");
  if (!fs.existsSync(file)) { console.log("NOT FOUND, skipped"); return; }
  const raw = fs.readFileSync(file, "utf8");
  if (!fs.existsSync(file + ".bak")) fs.writeFileSync(file + ".bak", raw);
  const crlf = raw.includes("\r\n");
  let s = raw.replace(/\r\n/g, "\n");
  edits.forEach(([label, fn]) => { const b = s; s = fn(s); console.log((s !== b ? "OK      " : "SKIPPED ") + label + (s === b ? "  (already done / text not found)" : "")); });
  fs.writeFileSync(file, crlf ? s.replace(/\n/g, "\r\n") : s);
  if (opts && opts.check) {
    const issues = checkHtml(s);
    console.log(issues.length ? "\nHTML structure problems still in this file (fix these lines by hand):\n  " + issues.slice(0, 30).join("\n  ") : "\nHTML structure check: no unclosed / unexpected tags.");
  }
}

/* ---------- shared pieces for shop + newcollections ---------- */
const IMG_FIND = `<img src="' + esc(src) + '" alt="' + esc(p.name) + '" loading="lazy" onerror="this.style.opacity=.25">`;
const IMG_NEW = `<img ' + (i ? 'data-src' : 'src') + '="' + esc(src) + '" alt="' + esc(p.name) + '" width="600" height="900" decoding="async"' + (i ? '' : (idx < 4 ? ' fetchpriority="high"' : ' loading="lazy"')) + ' onerror="this.style.opacity=.25">`;
const SLIDE_LOADER =
  "\n      /* extra slides load only when the customer touches / hovers / swipes the card */" +
  "\n      function loadSlides(card) { card.querySelectorAll('img[data-src]').forEach(function (im) { im.src = im.dataset.src; im.removeAttribute('data-src'); }); }" +
  "\n      (function () {" +
  "\n        var g = document.getElementById('grid'); if (!g) return;" +
  "\n        function go(e) { var c = e.target.closest && e.target.closest('.hy-card'); if (c) loadSlides(c); }" +
  "\n        g.addEventListener('pointerenter', go, true);" +
  "\n        g.addEventListener('touchstart', go, { passive: true, capture: true });" +
  "\n        g.addEventListener('click', go, true);" +
  "\n        g.addEventListener('scroll', go, true);" +
  "\n      })();\n";
const PERF_CSS = '<style id="auraPerf">.hy-media{background:linear-gradient(100deg,#f3e6ea 30%,#fbf4f6 50%,#f3e6ea 70%);background-size:300% 100%;animation:hyShimA 1.4s linear 8}@keyframes hyShimA{to{background-position:-150% 0}}@media (prefers-reduced-motion:reduce){.hy-media{animation:none}}</style>\n';

function listingEdits() {
  return [
    ["Cards: only 1st image loads, other slides on touch/hover", s => s.split(IMG_FIND).join(IMG_NEW)],
    ["Cards: card(p) -> card(p, idx)", s => s.replace("function card(p) {", "function card(p, idx) {")],
    ["Cards: slide loader", s => s.includes("function loadSlides") ? s : s.replace(/\n([ \t]*)load\(\);\n([ \t]*)\}\)\(\);/, (m, a, b) => SLIDE_LOADER + "\n" + a + "load();\n" + b + "})();")],
    ["Shimmer placeholder CSS", s => s.includes('id="auraPerf"') ? s : s.replace("</head>", PERF_CSS + "</head>")]
  ];
}

/* ---------- index.html ---------- */
patchFile("index.html", [
  ["Remove stray </main>", s => s.replace(/(<\/section>\s*)<\/main>(\s*<!-- =+ AURA FAQ)/, (m, a, b) => a + b.replace(/^\s*/, "\n\n  "))],
  ["Wishlist button without inline JS", s => s.replace(/onclick="toggleWishlist\([^\n]*?\)" aria-label="Add to wishlist"/, () => 'data-id="${esc(id)}" data-name="${esc(name)}" data-img="${esc(image)}" data-price="₹${price}" aria-label="Add to wishlist"')],
  ["Wishlist click listener", s => s.includes("grid.dataset.wl") ? s : s.replace(/\n(\s*)grid\.innerHTML = html;/, (m, sp) => "\n" + sp + "grid.innerHTML = html;\n" + sp + 'if (!grid.dataset.wl) {\n' + sp + '  grid.dataset.wl = "1";\n' + sp + '  grid.addEventListener("click", function (e) {\n' + sp + '    var b = e.target.closest(".wishlist-btn"); if (!b) return;\n' + sp + '    e.preventDefault();\n' + sp + '    if (typeof window.toggleWishlist === "function") window.toggleWishlist(b.dataset.id, b.dataset.name, b.dataset.img, b.dataset.price);\n' + sp + '  });\n' + sp + '}')],
  ["Lightbox opens on card click", s => s.replace('if (event.target.closest("a")) return;', 'if (event.target.closest(".go")) return;')],
  ["assets/ paths -> ../assets/", s => s.split('src="assets/').join('src="../assets/')],
  ["FAQ text cart -> bag", s => s.split("before adding to cart.").join("before adding to bag.")],
  ["Review saves uid", s => s.includes("uid: (auth.currentUser") ? s : s.replace("name: name, rating: rating, image: finalImageUrl, text: text, createdAt: serverTimestamp()", "name: name, rating: rating, image: finalImageUrl, text: text, uid: (auth.currentUser && auth.currentUser.uid) || null, createdAt: serverTimestamp()")],
  ["Grid videos: preload none", s => s.split('class="vg-video" autoplay muted loop playsinline preload="metadata"').join('class="vg-video" muted loop playsinline preload="none"')],
  ["Hero video: remove empty poster attribute", s => s.replace(/(id="heroVideo"[^>]*?)\sposter>/, "$1>")],
  ["decoding=async on lazy images", s => s.replace(/loading="lazy"(?![^>]*\bdecoding=)/g, 'loading="lazy" decoding="async"')],
  ["Review modal Esc / outside click", s => s.includes("closeReview") ? s : s.replace(/if \(closeBtn\) closeBtn\.addEventListener\('click', \(\) => \{ modal\.classList\.remove\('show'\); modal\.setAttribute\('aria-hidden', 'true'\); \}\);/, m => m + "\n      const closeReview = () => { modal.classList.remove('show'); modal.setAttribute('aria-hidden', 'true'); };\n      modal.addEventListener('click', e => { if (e.target === modal) closeReview(); });\n      document.addEventListener('keydown', e => { if (e.key === 'Escape' && modal.classList.contains('show')) closeReview(); });")]
], { check: true });

/* ---------- shop.html ---------- */
patchFile("shop.html", [
  ["Remove broken stock-ribbon block (p is not defined error)", s => s.replace(/\n[ \t]*\/\/ 🔥 NEW: Stock Ribbon Logic 🔥[\s\S]*?\n[ \t]*\}\s*(?=<\/script>)/, "\n  ")]
].concat(listingEdits()), { check: true });

/* ---------- newcollections.html ---------- */
patchFile("newcollections.html", listingEdits(), { check: true });

/* ---------- product.html ---------- */
patchFile("product.html", [
  ["Load ONLY this product first (was downloading all products)", s => s.includes("Single product load failed") ? s : s.replace(
    /var rows = await fetchProducts\(\);\s*products = rows\.map\(normalizeProduct\);\s*if \(id\) product = products\.find\(function \(p\) \{ return p\.id === id; \}\);\s*else if \(products\.length\) product = products\[0\];/,
    () => "if (id) {\n" +
      "          try {\n" +
      "            var fm = await import(\"./js/firebase.js\");\n" +
      "            var one = await fm.getDoc(fm.doc(fm.db, \"products\", id));\n" +
      "            if (one.exists()) {\n" +
      "              var od = Object.assign({ id: one.id }, one.data()), os = String(od.status || \"\").toLowerCase();\n" +
      "              if (os === \"active\" || os === \"\") { product = normalizeProduct(od); products = [product]; }\n" +
      "            }\n" +
      "          } catch (err) { console.warn(\"Single product load failed:\", err); }\n" +
      "        }\n" +
      "        if (!product) {\n" +
      "          var rows = await fetchProducts();\n" +
      "          products = rows.map(normalizeProduct);\n" +
      "          if (id) product = products.find(function (p) { return p.id === id; });\n" +
      "          else if (products.length) product = products[0];\n" +
      "        } else {\n" +
      "          fetchProducts().then(function (rows) { products = rows.map(normalizeProduct); renderAlso(); });   // for \"You may also like\", in the background\n" +
      "        }"
  )],
  ["Main image loads with high priority", s => s.replace(`(i ? ' loading="lazy"' : '')`, `(i ? ' loading="lazy" decoding="async"' : ' fetchpriority="high"')`)],
  ["Add to Cart -> Add to Bag", s => s.split("Add to Cart").join("Add to Bag")]
], { check: true });

console.log("\nDone.");